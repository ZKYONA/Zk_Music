import {
  PERFORMANCE_PROFILES,
  type PerformanceProfile,
} from "./performance";
import {
  VOICE_ENHANCEMENT_PROFILES,
  type VoiceEnhancementMode,
} from "./enhancement";
import {
  VOICE_CHARACTER_PROFILES,
  type VoiceCharacterMode,
} from "./characters";

export interface VocalFxSettings {
  highPass: number;
  low: number;
  mid: number;
  high: number;
  compression: number;
  output: number;
}

export interface SpaceFxSettings {
  reverb: number;
  delay: number;
  feedback: number;
  bpm: number;
}

const DEFAULT_FX: VocalFxSettings = {
  highPass: 80,
  low: 0,
  mid: 1,
  high: 1.5,
  compression: 35,
  output: -1,
};

const DEFAULT_SPACE_FX: SpaceFxSettings = {
  reverb: 18,
  delay: 10,
  feedback: 22,
  bpm: 120,
};

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function createImpulseResponse(
  context: AudioContext,
  durationSeconds = 2.25,
  decay = 2.8,
): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * durationSeconds));
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const progress = index / length;
      data[index] = (Math.random() * 2 - 1) * Math.pow(1 - progress, decay);
    }
  }

  return impulse;
}

function createSaturationCurve(amount: number): Float32Array {
  const samples = 2048;
  const curve = new Float32Array(samples);
  const drive = clamp(amount, 0, 100) / 18;

  for (let index = 0; index < samples; index += 1) {
    const x = (index / (samples - 1)) * 2 - 1;
    curve[index] = drive <= 0
      ? x
      : ((1 + drive) * x) / (1 + drive * Math.abs(x));
  }

  return curve;
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
  private voiceCharacterMode: VoiceCharacterMode = "natural";
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
  private characterHighPass: BiquadFilterNode | null = null;
  private characterLowPass: BiquadFilterNode | null = null;
  private characterWarmth: BiquadFilterNode | null = null;
  private characterPresence: BiquadFilterNode | null = null;
  private characterShaper: WaveShaperNode | null = null;
  private ringModGain: GainNode | null = null;
  private ringOscillator: OscillatorNode | null = null;
  private ringDepth: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delay: DelayNode | null = null;
  private delayGain: GainNode | null = null;
  private delayFeedback: GainNode | null = null;
  private fxBus: GainNode | null = null;
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
  private spaceFx: SpaceFxSettings = { ...DEFAULT_SPACE_FX };

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

  setVoiceCharacterMode(mode: VoiceCharacterMode): void {
    this.voiceCharacterMode = mode;
    this.applyVoiceCharacter();
  }

  applySpaceFx(next: SpaceFxSettings): void {
    this.spaceFx = {
      reverb: clamp(next.reverb, 0, 100),
      delay: clamp(next.delay, 0, 100),
      feedback: clamp(next.feedback, 0, 100),
      bpm: clamp(next.bpm, 50, 220),
    };

    if (!this.context) return;

    const now = this.context.currentTime;
    const eighthNoteSeconds = 60 / this.spaceFx.bpm / 2;

    this.reverbGain?.gain.setTargetAtTime(
      (this.spaceFx.reverb / 100) * 0.5,
      now,
      0.02,
    );
    this.delayGain?.gain.setTargetAtTime(
      (this.spaceFx.delay / 100) * 0.42,
      now,
      0.02,
    );
    this.delayFeedback?.gain.setTargetAtTime(
      (this.spaceFx.feedback / 100) * 0.72,
      now,
      0.02,
    );
    this.delay?.delayTime.setTargetAtTime(
      clamp(eighthNoteSeconds, 0.05, 1.25),
      now,
      0.02,
    );
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

      this.characterHighPass = this.context.createBiquadFilter();
      this.characterHighPass.type = "highpass";

      this.characterLowPass = this.context.createBiquadFilter();
      this.characterLowPass.type = "lowpass";

      this.characterWarmth = this.context.createBiquadFilter();
      this.characterWarmth.type = "lowshelf";
      this.characterWarmth.frequency.value = 220;

      this.characterPresence = this.context.createBiquadFilter();
      this.characterPresence.type = "peaking";
      this.characterPresence.frequency.value = 3400;
      this.characterPresence.Q.value = 0.8;

      this.characterShaper = this.context.createWaveShaper();
      this.characterShaper.oversample = "2x";

      this.ringModGain = this.context.createGain();
      this.ringOscillator = this.context.createOscillator();
      this.ringOscillator.type = "sine";
      this.ringDepth = this.context.createGain();
      this.ringDepth.gain.value = 0;
      this.ringOscillator.connect(this.ringDepth).connect(this.ringModGain.gain);
      this.ringOscillator.start();

      this.dryGain = this.context.createGain();
      this.dryGain.gain.value = 1;

      this.reverb = this.context.createConvolver();
      this.reverb.normalize = true;
      this.reverb.buffer = createImpulseResponse(this.context);
      this.reverbGain = this.context.createGain();

      this.delay = this.context.createDelay(1.5);
      this.delayGain = this.context.createGain();
      this.delayFeedback = this.context.createGain();

      this.fxBus = this.context.createGain();
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
        .connect(this.characterHighPass)
        .connect(this.characterLowPass)
        .connect(this.characterWarmth)
        .connect(this.characterPresence)
        .connect(this.characterShaper)
        .connect(this.ringModGain);

      this.ringModGain.connect(this.dryGain).connect(this.fxBus);
      this.ringModGain.connect(this.reverb).connect(this.reverbGain).connect(this.fxBus);
      this.ringModGain.connect(this.delay).connect(this.delayGain).connect(this.fxBus);
      this.delay.connect(this.delayFeedback).connect(this.delay);

      this.fxBus
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
      this.applyVoiceCharacter();
      this.applySpaceFx(this.spaceFx);

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

  private applyVoiceCharacter(): void {
    if (!this.context) return;

    const character = VOICE_CHARACTER_PROFILES[this.voiceCharacterMode];
    const now = this.context.currentTime;

    this.characterHighPass?.frequency.setTargetAtTime(character.highPassHz, now, 0.02);
    this.characterLowPass?.frequency.setTargetAtTime(character.lowPassHz, now, 0.02);
    this.characterWarmth?.gain.setTargetAtTime(character.warmthDb, now, 0.02);
    this.characterPresence?.gain.setTargetAtTime(character.presenceDb, now, 0.02);

    if (this.characterShaper) {
      this.characterShaper.curve = createSaturationCurve(character.distortion);
    }

    this.ringOscillator?.frequency.setTargetAtTime(
      Math.max(1, character.ringModHz || 42),
      now,
      0.02,
    );
    this.ringModGain?.gain.setTargetAtTime(
      1 - character.ringModDepth * 0.55,
      now,
      0.02,
    );
    this.ringDepth?.gain.setTargetAtTime(
      character.ringModDepth * 0.55,
      now,
      0.02,
    );
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

    try {
      this.ringOscillator?.stop();
    } catch {
      // Oscillator may already be stopped with the context.
    }

    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}
