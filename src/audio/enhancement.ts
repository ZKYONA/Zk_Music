export type VoiceEnhancementMode = "raw" | "clean" | "flagship";

export interface VoiceEnhancementProfile {
  id: VoiceEnhancementMode;
  name: string;
  description: string;
  browserNoiseSuppression: boolean;
  browserEchoCancellation: boolean;
  browserAutoGain: boolean;
  gateThresholdDb: number;
  gateFloorDb: number;
  clarityDb: number;
  airDb: number;
  deEssDb: number;
  compressorBoost: number;
  outputDb: number;
}

export const VOICE_ENHANCEMENT_PROFILES: Record<VoiceEnhancementMode, VoiceEnhancementProfile> = {
  raw: {
    id: "raw",
    name: "Raw",
    description: "Captura lo más directo posible para un micrófono bueno o una sala tratada.",
    browserNoiseSuppression: false,
    browserEchoCancellation: false,
    browserAutoGain: false,
    gateThresholdDb: -72,
    gateFloorDb: 0,
    clarityDb: 0,
    airDb: 0,
    deEssDb: 0,
    compressorBoost: 0,
    outputDb: 0,
  },
  clean: {
    id: "clean",
    name: "Clean",
    description: "Reduce ruido y ambiente para piezas normales, notebook y teléfonos.",
    browserNoiseSuppression: true,
    browserEchoCancellation: true,
    browserAutoGain: false,
    gateThresholdDb: -48,
    gateFloorDb: -18,
    clarityDb: 1.5,
    airDb: 1,
    deEssDb: -1,
    compressorBoost: 8,
    outputDb: -0.5,
  },
  flagship: {
    id: "flagship",
    name: "Flagship Studio",
    description: "Perfil premium: voz cercana, firme, limpia y con brillo controlado.",
    browserNoiseSuppression: true,
    browserEchoCancellation: false,
    browserAutoGain: false,
    gateThresholdDb: -44,
    gateFloorDb: -24,
    clarityDb: 2.8,
    airDb: 2.2,
    deEssDb: -2.2,
    compressorBoost: 16,
    outputDb: -0.8,
  },
};
