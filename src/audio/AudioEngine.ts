import {
  PERFORMANCE_PROFILES,
  type PerformanceProfile,
} from "./performance";

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
  private context: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private highPass: BiquadFilterNode | null = null;
  private lowEq: BiquadFilterNode | null = null;
  private midEq: BiquadFilterNode | null = null;
  private highEq: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private recorderDestination: MediaStreamAudioDestinationNode | null = null;
  private beatBuffer: AudioBuffer | null = null;
  private beatSource: AudioBufferSourceNode | null = null;
  private beatGain: GainNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private monitorEnabled = false;
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

      this.highEq = this.context.createBiquadFilter();
      this.highEq.type = "highshelf";
      this.highEq.frequency.value = 7800;

      this.compressor = this.context.createDynamicsCompressor();
      this.master = this.context.createGain();

      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = config.analyserFftSize;
      this.analyser.smoothingTimeConstant = 0.78;

      this.recorderDestination = this.context.createMediaStreamDestination();
      this.beatGain = this.context.createGain();
      this.beatGain.gain.value = 0.85;

      this.highPass
        .connect(this.lowEq)
        .connect(this.midEq)
        .connect(this.highEq)
        .connect(this.compressor)
        .connect(this.master)
        .connect(this.analyser)
        .connect(this.recorderDestination);

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
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: config.sampleRate,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.micSource = context.createMediaStreamSource(this.micStream);
    this.micSource.connect(this.highPass!);
  }

  applyFx(next: VocalFxSettings): void {
    this.fx = { ...next };
    if (!this.context) return;

    const now = this.context.currentTime;
    this.highPass?.frequency.setTargetAtTime(next.highPass, now, 0.01);
    this.lowEq?.gain.setTargetAtTime(next.low, now, 0.01);
    this.midEq?.gain.setTargetAtTime(next.mid, now, 0.01);
    this.highEq?.gain.setTargetAtTime(next.high, now, 0.01);

    if (this.compressor) {
      const amount = Math.max(0, Math.min(100, next.compression));
      this.compressor.threshold.setTargetAtTime(-10 - amount * 0.25, now, 0.01);
      this.compressor.ratio.setTargetAtTime(1 + amount * 0.05, now, 0.01);
      this.compressor.knee.setTargetAtTime(12, now, 0.01);
      this.compressor.attack.setTargetAtTime(0.008, now, 0.01);
      this.compressor.release.setTargetAtTime(0.18, now, 0.01);
    }

    this.master?.gain.setTargetAtTime(dbToGain(next.output), now, 0.01);
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
    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    this.micSource = null;

    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}
