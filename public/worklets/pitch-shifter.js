class ZkPitchShifterProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "ratio",
        defaultValue: 1,
        minValue: 0.75,
        maxValue: 1.334,
        automationRate: "k-rate",
      },
      {
        name: "enabled",
        defaultValue: 0,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();

    this.grainSize = 1536;
    this.baseDelay = this.grainSize * 2;
    this.bufferSize = 16384;
    this.buffers = [];
    this.writeIndex = 0;
    this.phase = 0;
  }

  ensureChannel(channel) {
    while (this.buffers.length <= channel) {
      this.buffers.push(new Float32Array(this.bufferSize));
    }

    return this.buffers[channel];
  }

  wrap(value) {
    let result = value % this.bufferSize;
    if (result < 0) result += this.bufferSize;
    return result;
  }

  readInterpolated(buffer, position) {
    const wrapped = this.wrap(position);
    const indexA = Math.floor(wrapped);
    const indexB = (indexA + 1) % this.bufferSize;
    const fraction = wrapped - indexA;

    return buffer[indexA] * (1 - fraction) + buffer[indexB] * fraction;
  }

  grainSample(buffer, phase, ratio) {
    const motion = (ratio - 1) * phase * this.grainSize;
    const position = this.writeIndex - this.baseDelay + motion;
    return this.readInterpolated(buffer, position);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0 || output.length === 0) {
      return true;
    }

    const ratio = Math.max(0.75, Math.min(1.334, parameters.ratio[0] ?? 1));
    const enabled = (parameters.enabled[0] ?? 0) >= 0.5;

    const frameCount = output[0].length;

    for (let frame = 0; frame < frameCount; frame += 1) {
      const phaseA = this.phase;
      const phaseB = (phaseA + 0.5) % 1;
      const weightA = Math.sin(Math.PI * phaseA) ** 2;
      const weightB = Math.sin(Math.PI * phaseB) ** 2;

      for (let channel = 0; channel < output.length; channel += 1) {
        const source = input[Math.min(channel, input.length - 1)];
        const destination = output[channel];
        const buffer = this.ensureChannel(channel);
        const dry = source?.[frame] ?? 0;

        buffer[this.writeIndex] = dry;

        if (!enabled || Math.abs(ratio - 1) < 0.0005) {
          destination[frame] = dry;
          continue;
        }

        const shiftedA = this.grainSample(buffer, phaseA, ratio);
        const shiftedB = this.grainSample(buffer, phaseB, ratio);
        destination[frame] = shiftedA * weightA + shiftedB * weightB;
      }

      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      this.phase += 1 / this.grainSize;
      if (this.phase >= 1) this.phase -= 1;
    }

    return true;
  }
}

registerProcessor("zk-pitch-shifter", ZkPitchShifterProcessor);
