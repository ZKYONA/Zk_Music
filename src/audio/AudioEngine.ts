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

export interface AmbienceSettings {
  reverb: number;
  delay: number;
  delayMs: number;
  feedback: number;
}

export interface TakeAnalysis {
  duration: number;
  peaks: number[];
}

export interface InputMetrics {
  level: number;
  peak: number;
  clipping: boolean;
}

export interface PitchReading {
  frequency: number;
  midi: number;
  note: string;
  octave: number;
  cents: number;
  confidence: number;
}

const DEFAULT_FX: VocalFxSettings = {
  highPass: 80,
  low: 0,
  mid: 1,
  high: 1.5,
  compression: 35,
  output: -1,
};

const DEFAULT_AMBIENCE: AmbienceSettings = {
  reverb: 12,
  delay: 7,
  delayMs: 145,
  feedback: 18,
};

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function createDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 2048;
  const curve = new Float32Array(
    new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT),
  );
  const drive = Math.max(0, amount) * 0.6;

  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = drive === 0 ? x : ((1 + drive) * x) / (1 + drive * Math.abs(x));
  }

  return curve;
}

function createReverbImpulse(context: AudioContext, seconds = 1.5): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const impulse = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    let seed = 17 + channel * 101;

    for (let i = 0; i < length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const noise = (seed / 2147483647) * 2 - 1;
      const decay = Math.pow(1 - i / length, 2.6);
      data[i] = noise * decay;
    }
  }

  return impulse;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = Math.max(1, Math.min(2, buffer.numberOfChannels));
  const bytesPerSample = 2;
  const frameCount = buffer.length;
  const dataSize = frameCount * channels * bytesPerSample;
  const bytes = new ArrayBuffer(44 + dataSize);
  const view = new DataView(bytes);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channelData = Array.from(
    { length: channels },
    (_, channel) => buffer.getChannelData(channel),
  );

  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] ?? 0));
      const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, Math.round(pcm), true);
      offset += bytesPerSample;
    }
  }

  return new Blob([bytes], { type: "audio/wav" });
}

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

function detectPitchYin(
  samples: Float32Array,
  sampleRate: number,
): PitchReading | null {
  let mean = 0;
  let energy = 0;

  for (const sample of samples) {
    mean += sample;
  }
  mean /= samples.length;

  for (const sample of samples) {
    const centered = sample - mean;
    energy += centered * centered;
  }

  const rms = Math.sqrt(energy / samples.length);
  if (rms < 0.008) return null;

  const minFrequency = 65;
  const maxFrequency = 1100;
  const minTau = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const maxTau = Math.min(
    samples.length - 2,
    Math.floor(sampleRate / minFrequency),
  );

  if (maxTau <= minTau) return null;

  const difference = new Float32Array(maxTau + 1);

  for (let tau = 1; tau <= maxTau; tau += 1) {
    let sum = 0;
    const limit = samples.length - tau;

    for (let index = 0; index < limit; index += 1) {
      const delta =
        (samples[index] - mean) - (samples[index + tau] - mean);
      sum += delta * delta;
    }

    difference[tau] = sum;
  }

  let runningSum = 0;
  difference[0] = 1;

  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += difference[tau];
    difference[tau] =
      runningSum === 0 ? 1 : (difference[tau] * tau) / runningSum;
  }

  const threshold = 0.16;
  let bestTau = -1;

  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (difference[tau] < threshold) {
      while (
        tau + 1 <= maxTau &&
        difference[tau + 1] < difference[tau]
      ) {
        tau += 1;
      }
      bestTau = tau;
      break;
    }
  }

  if (bestTau < 0) {
    let bestValue = 1;
    for (let tau = minTau; tau <= maxTau; tau += 1) {
      if (difference[tau] < bestValue) {
        bestValue = difference[tau];
        bestTau = tau;
      }
    }

    if (bestTau < 0 || bestValue > 0.28) return null;
  }

  const previous = difference[Math.max(minTau, bestTau - 1)];
  const current = difference[bestTau];
  const next = difference[Math.min(maxTau, bestTau + 1)];
  const denominator = previous - 2 * current + next;
  const shift =
    Math.abs(denominator) > 1e-9
      ? 0.5 * (previous - next) / denominator
      : 0;
  const refinedTau = Math.max(minTau, bestTau + shift);
  const frequency = sampleRate / refinedTau;

  if (
    !Number.isFinite(frequency) ||
    frequency < minFrequency ||
    frequency > maxFrequency
  ) {
    return null;
  }

  const midiFloat = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(midiFloat);
  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const cents = Math.max(-50, Math.min(50, (midiFloat - midi) * 100));
  const confidence = Math.max(0, Math.min(1, 1 - current));

  return {
    frequency,
    midi,
    note: NOTE_NAMES[noteIndex],
    octave,
    cents,
    confidence,
  };
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
  private voiceCharacter: VoiceCharacterMode = "natural";
  private ambience: AmbienceSettings = { ...DEFAULT_AMBIENCE };
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
  private characterHighPass: BiquadFilterNode | null = null;
  private characterLowPass: BiquadFilterNode | null = null;
  private characterWarmth: BiquadFilterNode | null = null;
  private characterPresence: BiquadFilterNode | null = null;
  private characterDistortion: WaveShaperNode | null = null;
  private ringGain: GainNode | null = null;
  private ringOscillator: OscillatorNode | null = null;
  private ringDepth: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private dryGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private reverbWet: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayWet: GainNode | null = null;
  private delayFeedback: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private master: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private pitchAnalyser: AnalyserNode | null = null;
  private recorderDestination: MediaStreamAudioDestinationNode | null = null;
  private beatBuffer: AudioBuffer | null = null;
  private beatSource: AudioBufferSourceNode | null = null;
  private beatGain: GainNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private monitorEnabled = false;
  private preferredInputDeviceId = "";
  private beatLevel = 0.85;
  private metronomeEnabled = false;
  private metronomeBpm = 120;
  private metronomeTimer: number | null = null;
  private metronomeBeat = 0;
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

  getVoiceCharacter(): VoiceCharacterMode {
    return this.voiceCharacter;
  }

  setVoiceCharacter(mode: VoiceCharacterMode): void {
    this.voiceCharacter = mode;
    this.applyVoiceCharacter();
  }

  setAmbience(next: AmbienceSettings): void {
    this.ambience = { ...next };
    this.applyAmbience();
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

      this.characterHighPass = this.context.createBiquadFilter();
      this.characterHighPass.type = "highpass";

      this.characterLowPass = this.context.createBiquadFilter();
      this.characterLowPass.type = "lowpass";

      this.characterWarmth = this.context.createBiquadFilter();
      this.characterWarmth.type = "lowshelf";
      this.characterWarmth.frequency.value = 220;

      this.characterPresence = this.context.createBiquadFilter();
      this.characterPresence.type = "peaking";
      this.characterPresence.frequency.value = 3200;
      this.characterPresence.Q.value = 0.9;

      this.characterDistortion = this.context.createWaveShaper();
      this.characterDistortion.oversample = "2x";

      this.ringGain = this.context.createGain();
      this.ringGain.gain.value = 1;
      this.ringOscillator = this.context.createOscillator();
      this.ringOscillator.type = "sine";
      this.ringDepth = this.context.createGain();
      this.ringDepth.gain.value = 0;
      this.ringOscillator.connect(this.ringDepth);
      this.ringDepth.connect(this.ringGain.gain);
      this.ringOscillator.start();

      this.compressor = this.context.createDynamicsCompressor();
      this.dryGain = this.context.createGain();
      this.convolver = this.context.createConvolver();
      this.reverbWet = this.context.createGain();
      this.delayNode = this.context.createDelay(1.5);
      this.delayWet = this.context.createGain();
      this.delayFeedback = this.context.createGain();
      this.limiter = this.context.createDynamicsCompressor();
      this.master = this.context.createGain();

      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = config.analyserFftSize;
      this.analyser.smoothingTimeConstant = 0.78;

      this.pitchAnalyser = this.context.createAnalyser();
      this.pitchAnalyser.fftSize = 2048;
      this.pitchAnalyser.smoothingTimeConstant = 0;

      this.recorderDestination = this.context.createMediaStreamDestination();
      this.beatGain = this.context.createGain();
      this.beatGain.gain.value = this.beatLevel;

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
        .connect(this.characterHighPass)
        .connect(this.characterLowPass)
        .connect(this.characterWarmth)
        .connect(this.characterPresence)
        .connect(this.characterDistortion)
        .connect(this.ringGain)
        .connect(this.compressor);

      this.compressor.connect(this.dryGain).connect(this.limiter);
      this.compressor.connect(this.convolver).connect(this.reverbWet).connect(this.limiter);
      this.compressor.connect(this.delayNode).connect(this.delayWet).connect(this.limiter);
      this.delayNode.connect(this.delayFeedback).connect(this.delayNode);

      this.limiter
        .connect(this.master)
        .connect(this.analyser)
        .connect(this.recorderDestination);

      this.limiter.threshold.value = -1.2;
      this.limiter.knee.value = 0;
      this.limiter.ratio.value = 20;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.06;

      const reverbSeconds = this.profile === "mobile" || this.profile === "low" ? 1.1 : 1.6;
      this.convolver.buffer = createReverbImpulse(this.context, reverbSeconds);

      this.applyEnhancement();
      this.applyFx(this.fx);
      this.applyVoiceCharacter();
      this.applyAmbience();

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
        deviceId: this.preferredInputDeviceId
          ? { exact: this.preferredInputDeviceId }
          : undefined,
      },
    });

    this.micSource = context.createMediaStreamSource(this.micStream);

    if (this.noiseGate) {
      this.micSource.connect(this.noiseGate);
      this.noiseGate.connect(this.highPass!);
      this.noiseGate.connect(this.pitchAnalyser!);
    } else {
      this.micSource.connect(this.highPass!);
      this.micSource.connect(this.pitchAnalyser!);
    }
  }

  async listInputDevices(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "audioinput");
  }

  async setInputDevice(deviceId: string): Promise<void> {
    if (deviceId === this.preferredInputDeviceId) return;
    this.preferredInputDeviceId = deviceId;

    if (this.micStream) {
      this.disconnectMicrophone();
      await this.enableMicrophone();
    }
  }

  setBeatVolume(value: number): void {
    this.beatLevel = Math.max(0, Math.min(1, value));
    if (this.beatGain && this.context) {
      this.beatGain.gain.setTargetAtTime(this.beatLevel, this.context.currentTime, 0.015);
    } else if (this.beatGain) {
      this.beatGain.gain.value = this.beatLevel;
    }
  }

  setMetronome(enabled: boolean, bpm = this.metronomeBpm): void {
    this.metronomeEnabled = enabled;
    this.metronomeBpm = Math.max(50, Math.min(240, bpm));

    if (this.recorder?.state === "recording") {
      if (enabled) this.startMetronome();
      else this.stopMetronome();
    }
  }

  setMetronomeBpm(bpm: number): void {
    this.metronomeBpm = Math.max(50, Math.min(240, bpm));
    if (this.metronomeEnabled && this.recorder?.state === "recording") {
      this.startMetronome();
    }
  }

  private playMetronomeTick(accent: boolean): void {
    if (!this.context) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = accent ? 1320 : 880;
    gain.gain.setValueAtTime(accent ? 0.16 : 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.055);
  }

  private startMetronome(): void {
    this.stopMetronome();
    if (!this.metronomeEnabled || !this.context) return;

    const intervalMs = 60000 / this.metronomeBpm;
    this.metronomeBeat = 0;

    const tick = () => {
      this.playMetronomeTick(this.metronomeBeat % 4 === 0);
      this.metronomeBeat = (this.metronomeBeat + 1) % 4;
    };

    tick();
    this.metronomeTimer = window.setInterval(tick, intervalMs);
  }

  private stopMetronome(): void {
    if (this.metronomeTimer !== null) {
      window.clearInterval(this.metronomeTimer);
      this.metronomeTimer = null;
    }
    this.metronomeBeat = 0;
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

  private applyVoiceCharacter(): void {
    if (!this.context) return;

    const profile = VOICE_CHARACTER_PROFILES[this.voiceCharacter];
    const now = this.context.currentTime;

    this.characterHighPass?.frequency.setTargetAtTime(profile.highPassHz, now, 0.015);
    this.characterLowPass?.frequency.setTargetAtTime(profile.lowPassHz, now, 0.015);
    this.characterWarmth?.gain.setTargetAtTime(profile.warmthDb, now, 0.015);
    this.characterPresence?.gain.setTargetAtTime(profile.presenceDb, now, 0.015);

    if (this.characterDistortion) {
      this.characterDistortion.curve = createDistortionCurve(profile.distortion);
    }

    if (this.ringOscillator && this.ringDepth && this.ringGain) {
      this.ringOscillator.frequency.setTargetAtTime(
        Math.max(1, profile.ringModHz || 1),
        now,
        0.02,
      );
      this.ringDepth.gain.setTargetAtTime(profile.ringModDepth, now, 0.02);
      this.ringGain.gain.setTargetAtTime(
        profile.ringModDepth > 0 ? 1 - profile.ringModDepth : 1,
        now,
        0.02,
      );
    }
  }

  private applyAmbience(): void {
    if (!this.context) return;

    const now = this.context.currentTime;
    const reverb = Math.max(0, Math.min(100, this.ambience.reverb));
    const delay = Math.max(0, Math.min(100, this.ambience.delay));
    const delayMs = Math.max(40, Math.min(1000, this.ambience.delayMs));
    const feedback = Math.max(0, Math.min(70, this.ambience.feedback));

    this.dryGain?.gain.setTargetAtTime(1, now, 0.02);
    this.reverbWet?.gain.setTargetAtTime((reverb / 100) * 0.75, now, 0.02);
    this.delayWet?.gain.setTargetAtTime((delay / 100) * 0.7, now, 0.02);
    this.delayNode?.delayTime.setTargetAtTime(delayMs / 1000, now, 0.02);
    this.delayFeedback?.gain.setTargetAtTime(feedback / 100, now, 0.02);
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
    this.startMetronome();

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
      this.stopMetronome();
    });
  }

  async convertToWav(blob: Blob): Promise<Blob> {
    const context = await this.ensureContext();
    const bytes = await blob.arrayBuffer();
    const buffer = await context.decodeAudioData(bytes.slice(0));
    return audioBufferToWav(buffer);
  }

  async analyzeTake(blob: Blob, points = 96): Promise<TakeAnalysis> {
    const context = await this.ensureContext();
    const bytes = await blob.arrayBuffer();
    const buffer = await context.decodeAudioData(bytes.slice(0));

    const safePoints = Math.max(24, Math.min(240, Math.floor(points)));
    const samplesPerPoint = Math.max(
      1,
      Math.floor(buffer.length / safePoints),
    );
    const peaks: number[] = [];

    for (let point = 0; point < safePoints; point += 1) {
      const start = point * samplesPerPoint;
      const end =
        point === safePoints - 1
          ? buffer.length
          : Math.min(buffer.length, start + samplesPerPoint);

      let peak = 0;

      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const samples = buffer.getChannelData(channel);
        for (let index = start; index < end; index += 1) {
          peak = Math.max(peak, Math.abs(samples[index] ?? 0));
        }
      }

      peaks.push(Math.min(1, peak));
    }

    const maxPeak = Math.max(0.0001, ...peaks);
    const normalized = peaks.map((peak) => Math.min(1, peak / maxPeak));

    return {
      duration: buffer.duration,
      peaks: normalized,
    };
  }

  getPitchReading(): PitchReading | null {
    if (!this.pitchAnalyser || !this.context) return null;

    const values = new Float32Array(this.pitchAnalyser.fftSize);
    this.pitchAnalyser.getFloatTimeDomainData(values);

    return detectPitchYin(values, this.context.sampleRate);
  }

  getInputMetrics(): InputMetrics {
    if (!this.analyser) {
      return { level: 0, peak: 0, clipping: false };
    }

    const values = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(values);

    let sum = 0;
    let peak = 0;

    for (const value of values) {
      sum += value * value;
      peak = Math.max(peak, Math.abs(value));
    }

    return {
      level: Math.min(1, Math.sqrt(sum / values.length) * 3.5),
      peak: Math.min(1, peak),
      clipping: peak >= 0.985,
    };
  }

  getInputLevel(): number {
    return this.getInputMetrics().level;
  }

  dispose(): void {
    this.stopBeat();
    this.stopMetronome();
    this.disconnectMicrophone();

    if (this.context) {
      void this.context.close();
      this.context = null;
    }
  }
}
