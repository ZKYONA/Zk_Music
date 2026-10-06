import {
  PERFORMANCE_PROFILES,
  type PerformanceProfile,
} from "./performance";
import {
  VOICE_ENHANCEMENT_PROFILES,
  type VoiceEnhancementMode,
} from "./enhancement";

export interface VocalFxSettings {
  highPass: number;
  low: number;
  mid: number;
  high: number;
  compression: number;
  output: number;
}

const DEFAULT_FX: VocalFxSettings = {
  highPass: 80,
  low: 0,
  mid: 1,
  high: 1.5,
  compression: 35,
  output: -1,
};

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function pickMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export class AudioEngine {
  private profile: PerformanceProfile;
  private enhancementMode: VoiceEnhancementMode = "flagship";
  private context: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private noiseGate: AudioWorkletNode | null = null;
  private highPass: BiquadFilterNode | null = null;
  private lowEq: BiquadFilterNode | null = null;
  private midEq: BiquadFilterNode | null = null;
  private clarityEq: BiquadFilterNode | null = null;
  private deEssEq: BiquadFilterNode | null = null;
  private highEq: BiquadFilterNode | null = null;
  private airEq: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private recorderDestination: MediaStreamAudioDestinationNode | null = null;
  private beatBuffer: AudioBuffer | null = null;
  private beatSource: AudioBufferSourceNode | null = null;
  private beatGain: GainNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private monitorEnabled = false;
  private calibratedGateThresholdDb: number | null = null;
  private fx: VocalFxSettings = { ...DEFAULT_FX };

  constructor(profile: PerformanceProfile) {
    this.profile = profile;
  }

  setProfile(profile: PerformanceProfile): void {
    this.profile = profile;
    if (this.analyser) {
      this.analyser.fftSize = PERFORMANCE_PROFILES[profile].analyserFftSize;
    }
  }

  getEnhancementMode(): VoiceEnhancementMode {
    return this.enhancementMode;
  }

  async setEnhancementMode(mode: VoiceEnhancementMode): Promise<void> {
    if (mode === this.enhancementMode) return;

    this.enhancementMode = mode;
    this.calibratedGateThresholdDb = null;
    this.applyEnhancement();

    if (this.micStream) {
      this.disconnectMicrophone();
      await this.enableMicrophone();
    }
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.context) {
      const config = PERFORMANCE_PROFILES[this.profile];
      this.context = new AudioContext({
        latencyHint: config.latencyHint,
        sampleRate: config.sampleRate,
      });

      this.highPass = this.context.createBiquadFilter();
      this.highPass.type = "highpass";

      this.lowEq = this.context.createBiquadFilter();
      this.lowEq.type = "lowshelf";
      this.lowEq.frequency.value = 140;

      this.midEq = this.context.createBiquadFilter();
      this.midEq.type = "peaking";
      this.midEq.frequency.value = 2200;
      this.midEq.Q.value = 0.9;

      this.clarityEq = this.context.createBiquadFilter();
      this.clarityEq.type = "peaking";
      this.clarityEq.frequency.value = 3800;
      this.clarityEq.Q.value = 0.75;

      this.deEssEq = this.context.createBiquadFilter();
      this.deEssEq.type = "peaking";
      this.deEssEq.frequency.value = 6500;
      this.deEssEq.Q.value = 1.2;

      this.highEq = this.context.createBiquadFilter();
      this.highEq.type = "highshelf";
      this.highEq.frequency.value = 7800;

      this.airEq = this.context.createBiquadFilter();
      this.airEq.type = "highshelf";
      this.airEq.frequency.value = 10500;

      this.compressor = this.context.createDynamicsCompressor();
      this.limiter = this.context.createDynamicsCompressor();
      this.master = this.context.createGain();

      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = config.analyserFftSize;
      this.analyser.smoothingTimeConstant = 0.78;

      this.recorderDestination = this.context.createMediaStreamDestination();
      this.beatGain = this.context.createGain();
      this.beatGain.gain.value = 0.85;

      try {
        await this.context.audioWorklet.addModule("/worklets/noise-gate.js");
        this.noiseGate = new AudioWorkletNode(this.context, "zk-noise-gate");
      } catch {
        this.noiseGate = null;
      }

      this.highPass
        .connect(this.lowEq)
        .connect(this.midEq)
        .connect(this.clarityEq)
        .connect(this.deEssEq)
        .connect(this.highEq)
        .connect(this.airEq)
        .connect(this.compressor)
        .connect(this.limiter)
        .connect(this.master)
        .connect(this.analyser)
        .connect(this.recorderDestination);

      this.limiter.threshold.value = -1.2;
      this.limiter.knee.value = 0;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.06;

      this.applyEnhancement();
      this.applyFx(this.fx);

      if (this.monitorEnabled) {
        this.master.connect(this.context.destination);
      }
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    return this.context;
  }

  async enableMicrophone(): Promise<void> {
    const context = await this.ensureContext();
    if (this.micStream) return;

    const config = PERFORMANCE_PROFILES[this.profile];
    const enhancement = VOICE_ENHANCEMENT_PROFILES[this.enhancementMode];

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: config.sampleRate,
        echoCancellation: enhancement.browserEchoCancellation,
        noiseSuppression: enhancement.browserNoiseSuppression,
        autoGainControl: enhancement.browserAutoGain,
      },
    });

    this.micSource = context.createMediaStreamSource(this.micStream);

    if (this.noiseGate) {
      this.micSource.connect(this.noiseGate);
      this.noiseGate.connect(this.highPass!);
    } else {
      this.micSource.connect(this.highPass!);
    }
  }

  private disconnectMicrophone(): void {
    try {
      this.micSource?.disconnect();
      this.noiseGate?.disconnect();
    } catch {
      // Node may already be disconnected.
    }

    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    this.micSource = null;
  }

  private applyEnhancement(): void {
    const enhancement = VOICE_ENHANCEMENT_PROFILES[this.enhancementMode];
    if (!this.context) return;

    const now = this.context.currentTime;
    this.clarityEq?.gain.setTargetAtTime(enhancement.clarityDb, now, 0.015);
    this.deEssEq?.gain.setTargetAtTime(enhancement.deEssDb, now, 0.015);
    this.airEq?.gain.setTargetAtTime(enhancement.airDb, now, 0.015);

    if (this.noiseGate) {
      const gateThreshold =
        this.calibratedGateThresholdDb ?? enhancement.gateThresholdDb;
      this.noiseGate.parameters.get("thresholdDb")?.setValueAtTime(gateThreshold, now);
      this.noiseGate.parameters.get("floorDb")?.setValueAtTime(enhancement.gateFloorDb, now);
      this.noiseGate.parameters.get("attackMs")?.setValueAtTime(8, now);
      this.noiseGate.parameters.get("releaseMs")?.setValueAtTime(150, now);
    }

    this.applyFx(this.fx);
  }

  async calibrateRoom(durationMs = 1200): Promise<number> {
    await this.enableMicrophone();

    if (!this.analyser || !this.context) {
      throw new Error("No se pudo iniciar la calibración de ambiente.");
    }

    const startedAt = performance.now();
    const readings: number[] = [];

    while (performance.now() - startedAt < durationMs) {
      const values = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(values);

      let sum = 0;
      for (const value of values) {
        sum += value * value;
      }

      const rms = Math.sqrt(sum / values.length);
      const db = 20 * Math.log10(Math.max(rms, 0.000001));
      readings.push(db);

      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    if (readings.length === 0) {
      throw new Error("No se pudo medir el ruido ambiente.");
    }

    readings.sort((a, b) => a - b);
    const percentileIndex = Math.min(
      readings.length - 1,
      Math.floor(readings.length * 0.75),
    );
    const noiseFloorDb = readings[percentileIndex];
    const thresholdDb = Math.max(-60, Math.min(-28, noiseFloorDb + 8));

    this.calibratedGateThresholdDb = thresholdDb;

    if (this.noiseGate) {
      this.noiseGate.parameters
        .get("thresholdDb")
        ?.setValueAtTime(thresholdDb, this.context.currentTime);
    }

    return thresholdDb;
  }

  applyFx(next: VocalFxSettings): void {
    this.fx = { ...next };
    if (!this.context) return;

    const enhancement = VOICE_ENHANCEMENT_PROFILES[this.enhancementMode];
    const now = this.context.currentTime;

    this.highPass?.frequency.setTargetAtTime(next.highPass, now, 0.01);
    this.lowEq?.gain.setTargetAtTime(next.low, now, 0.01);
    this.midEq?.gain.setTargetAtTime(next.mid, now, 0.01);
    this.highEq?.gain.setTargetAtTime(next.high, now, 0.01);

    if (this.compressor) {
      const amount = Math.max(
        0,
        Math.min(100, next.compression + enhancement.compressorBoost),
      );
      this.compressor.threshold.setTargetAtTime(-10 - amount * 0.25, now, 0.01);
      this.compressor.ratio.setTargetAtTime(1 + amount * 0.05, now, 0.01);
      this.compressor.knee.setTargetAtTime(12, now, 0.01);
      this.compressor.attack.setTargetAtTime(0.008, now, 0.01);
      this.compressor.release.setTargetAtTime(0.18, now, 0.01);
    }

    this.master?.gain.setTargetAtTime(
      dbToGain(next.output + enhancement.outputDb),
      now,
      0.01,
    );
  }

  setMonitor(enabled: boolean): void {
    if (enabled === this.monitorEnabled) return;
    this.monitorEnabled = enabled;

    if (!this.master || !this.context) return;

    if (enabled) {
      this.master.connect(this.context.destination);
    } else {
      try {
        this.master.disconnect(this.context.destination);
      } catch {
        // Already disconnected.
      }
    }
  }

  async loadBeat(file: File): Promise<void> {
    const context = await this.ensureContext();
    const bytes = await file.arrayBuffer();
    this.beatBuffer = await context.decodeAudioData(bytes.slice(0));
  }

  hasBeat(): boolean {
    return this.beatBuffer !== null;
  }

  async playBeat(): Promise<void> {
    const context = await this.ensureContext();
    if (!this.beatBuffer) throw new Error("Primero importa un beat.");

    this.stopBeat();

    const source = context.createBufferSource();
    source.buffer = this.beatBuffer;
    source.connect(this.beatGain!);
    this.beatGain!.connect(context.destination);
    this.beatGain!.connect(this.recorderDestination!);
    source.start();

    source.onended = () => {
      if (this.beatSource === source) {
        this.beatSource = null;
      }
    };

    this.beatSource = source;
  }

  stopBeat(): void {
    if (this.beatSource) {
      try {
        this.beatSource.stop();
      } catch {
        // Source may already be stopped.
      }
      this.beatSource.disconnect();
      this.beatSource = null;
    }

    if (this.beatGain) {
      try {
        this.beatGain.disconnect();
      } catch {
        // Already disconnected.
      }
    }
  }

  async startTake(playBeat = true): Promise<void> {
    await this.enableMicrophone();

    if (!this.recorderDestination) {
      throw new Error("El motor de grabación no está disponible.");
    }

    if (this.recorder?.state === "recording") return;

    this.chunks = [];
    const mimeType = pickMimeType();
    const options: MediaRecorderOptions = {
      audioBitsPerSecond: PERFORMANCE_PROFILES[this.profile].recorderBitrate,
    };

    if (mimeType) options.mimeType = mimeType;

    this.recorder = new MediaRecorder(this.recorderDestination.stream, options);
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };

    this.recorder.start(250);

    if (playBeat && this.beatBuffer) {
      await this.playBeat();
    }
  }

  async stopTake(): Promise<Blob> {
    if (!this.recorder || this.recorder.state !== "recording") {
      throw new Error("No hay una grabación activa.");
    }

    const recorder = this.recorder;

    return new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("No se pudo finalizar la grabación."));
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        resolve(new Blob(this.chunks, { type }));
      };
      recorder.stop();
      this.stopBeat();
    });
  }

  getInputLevel(): number {
    if (!this.analyser) return 0;

    const values = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(values);

    let sum = 0;
    for (const value of values) {
      sum += value * value;
    }

    return Math.min(1, Math.sqrt(sum / values.length) * 3.5);
  }

  dispose(): void {
    this.stopBeat();
    this.disconnectMicrophone();

    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}
