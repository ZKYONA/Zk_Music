import type { AmbienceSettings, VocalFxSettings } from "./AudioEngine";
import type { VoiceCharacterMode } from "./characters";

export interface VocalPreset extends VocalFxSettings {
  id: string;
  name: string;
  description: string;
  character: VoiceCharacterMode;
  ambience: AmbienceSettings;
}

/**
 * These are starting points, not automatic voice analysis or pitch correction.
 * Wet amounts are intentionally restrained to keep fast urban phrasing clear.
 */
export const VOCAL_PRESETS: VocalPreset[] = [
  {
    id: "clean",
    name: "Limpio",
    description: "Referencia neutral para comparar y construir tu propio sonido.",
    highPass: 80,
    low: 0,
    mid: 1,
    high: 1.5,
    compression: 35,
    output: -1,
    character: "natural",
    ambience: { reverb: 4, delay: 0, delayMs: 145, feedback: 12 },
  },
  {
    id: "urban-deep",
    name: "Urbano Grave",
    description: "Cuerpo controlado, voz firme y presencia para trap, drill y reggaetón oscuro.",
    highPass: 72,
    low: -1,
    mid: 2,
    high: 1,
    compression: 48,
    output: -1,
    character: "warm",
    ambience: { reverb: 7, delay: 4, delayMs: 145, feedback: 14 },
  },
  {
    id: "urban",
    name: "Urbano",
    description: "Proyección vocal para instrumentales densos y ritmos rápidos.",
    highPass: 90,
    low: -1.5,
    mid: 2.5,
    high: 2,
    compression: 55,
    output: -1.5,
    character: "bright",
    ambience: { reverb: 8, delay: 6, delayMs: 155, feedback: 15 },
  },
  {
    id: "warm",
    name: "Cálido",
    description: "Más cercanía y redondez sin exceso de brillo.",
    highPass: 70,
    low: 2,
    mid: 0.5,
    high: -1,
    compression: 30,
    output: -1,
    character: "warm",
    ambience: { reverb: 12, delay: 5, delayMs: 180, feedback: 16 },
  },
  {
    id: "soft-melodic",
    name: "Melódico Suave",
    description: "Voz cálida y fluida con ambiente para R&B y estribillos románticos.",
    highPass: 74,
    low: 0.5,
    mid: 1.2,
    high: 0.8,
    compression: 42,
    output: -1,
    character: "warm",
    ambience: { reverb: 22, delay: 14, delayMs: 235, feedback: 23 },
  },
  {
    id: "deep-melodic",
    name: "Grave Melódico",
    description: "Graves definidos con espacio para cantar sin enturbiar la mezcla.",
    highPass: 70,
    low: -0.5,
    mid: 2,
    high: 1,
    compression: 50,
    output: -1,
    character: "warm",
    ambience: { reverb: 16, delay: 12, delayMs: 205, feedback: 21 },
  },
  {
    id: "bright-nasal",
    name: "Brillante Nasal",
    description: "Articulación incisiva y medios presentes sin exagerar la aspereza.",
    highPass: 88,
    low: -2,
    mid: 3.2,
    high: 1.8,
    compression: 50,
    output: -1.5,
    character: "bright",
    ambience: { reverb: 9, delay: 6, delayMs: 160, feedback: 15 },
  },
  {
    id: "dry-rap",
    name: "Rap Seco",
    description: "Consonantes al frente, dinámica firme y sin cola de reverb ni delay.",
    highPass: 78,
    low: -1,
    mid: 2.6,
    high: 1.2,
    compression: 46,
    output: -1,
    character: "natural",
    ambience: { reverb: 0, delay: 0, delayMs: 145, feedback: 0 },
  },
];
