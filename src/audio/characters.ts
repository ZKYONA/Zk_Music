export type VoiceCharacterMode =
  | "natural"
  | "warm"
  | "bright"
  | "radio"
  | "robot";

export interface VoiceCharacterProfile {
  id: VoiceCharacterMode;
  name: string;
  description: string;
  highPassHz: number;
  lowPassHz: number;
  presenceDb: number;
  warmthDb: number;
  distortion: number;
  ringModHz: number;
  ringModDepth: number;
}

export const VOICE_CHARACTER_PROFILES: Record<
  VoiceCharacterMode,
  VoiceCharacterProfile
> = {
  natural: {
    id: "natural",
    name: "Natural",
    description: "Mantiene la identidad de tu voz con el mínimo color extra.",
    highPassHz: 45,
    lowPassHz: 19000,
    presenceDb: 0,
    warmthDb: 0,
    distortion: 0,
    ringModHz: 0,
    ringModDepth: 0,
  },
  warm: {
    id: "warm",
    name: "Warm",
    description: "Más cuerpo y cercanía para voces urbanas y melódicas.",
    highPassHz: 65,
    lowPassHz: 17000,
    presenceDb: 0.8,
    warmthDb: 2.4,
    distortion: 4,
    ringModHz: 0,
    ringModDepth: 0,
  },
  bright: {
    id: "bright",
    name: "Bright",
    description: "Más definición y ataque para que la voz atraviese el beat.",
    highPassHz: 80,
    lowPassHz: 19500,
    presenceDb: 2.2,
    warmthDb: -0.6,
    distortion: 2,
    ringModHz: 0,
    ringModDepth: 0,
  },
  radio: {
    id: "radio",
    name: "Radio",
    description: "Efecto banda limitada tipo teléfono/radio para ad-libs.",
    highPassHz: 320,
    lowPassHz: 3400,
    presenceDb: 4,
    warmthDb: -3,
    distortion: 12,
    ringModHz: 0,
    ringModDepth: 0,
  },
  robot: {
    id: "robot",
    name: "Robot",
    description: "Color metálico para intros, cortes y efectos creativos.",
    highPassHz: 120,
    lowPassHz: 9000,
    presenceDb: 1.5,
    warmthDb: -1,
    distortion: 8,
    ringModHz: 42,
    ringModDepth: 0.55,
  },
};
