class NoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "thresholdDb", defaultValue: -48, minValue: -90, maxValue: -10, automationRate: "k-rate" },
      { name: "floorDb", defaultValue: -18, minValue: -60, maxValue: 0, automationRate: "k-rate" },
      { name: "attackMs", defaultValue: 8, minValue: 1, maxValue: 100, automationRate: "k-rate" },
      { name: "releaseMs", defaultValue: 140, minValue: 20, maxValue: 1000, automationRate: "k-rate" },
    ];
  }

  constructor() {
    super();
    this.envelope = 0;
    this.gain = 1;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0) return true;

    const threshold = Math.pow(10, parameters.thresholdDb[0] / 20);
    const floorGain = Math.pow(10, parameters.floorDb[0] / 20);
    const attackSeconds = Math.max(0.001, parameters.attackMs[0] / 1000);
    const releaseSeconds = Math.max(0.001, parameters.releaseMs[0] / 1000);
    const attackCoeff = Math.exp(-1 / (sampleRate * attackSeconds));
    const releaseCoeff = Math.exp(-1 / (sampleRate * releaseSeconds));

    for (let channelIndex = 0; channelIndex < output.length; channelIndex += 1) {
      const inChannel = input[Math.min(channelIndex, input.length - 1)];
      const outChannel = output[channelIndex];

      for (let i = 0; i < outChannel.length; i += 1) {
        const sample = inChannel ? inChannel[i] : 0;
        const magnitude = Math.abs(sample);
        const envCoeff = magnitude > this.envelope ? attackCoeff : releaseCoeff;
        this.envelope = envCoeff * this.envelope + (1 - envCoeff) * magnitude;

        const targetGain = this.envelope >= threshold ? 1 : floorGain;
        const gainCoeff = targetGain > this.gain ? attackCoeff : releaseCoeff;
        this.gain = gainCoeff * this.gain + (1 - gainCoeff) * targetGain;
        outChannel[i] = sample * this.gain;
      }
    }

    return true;
  }
}

registerProcessor("zk-noise-gate", NoiseGateProcessor);
