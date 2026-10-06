export interface VocalPreset {
  id: string;
  name: string;
  description: string;
  highPass: number;
  low: number;
  mid: number;
  high: number;
  compression: number;
  output: number;
}

export const VOCAL_PRESETS: VocalPreset[] = [
  {
    id: "clean",
    name: "Limpio",
    description: "Punto de partida natural y equilibrado.",
    highPass: 80,
    low: 0,
    mid: 1,
    high: 1.5,
    compression: 35,
    output: -1,
  },
  {
    id: "urban-deep",
    name: "Urbano Grave",
    description: "Calibrado para una voz masculina grave-media y fraseo urbano rápido.",
    highPass: 72,
    low: -1,
    mid: 2,
    high: 1,
    compression: 48,
    output: -1,
  },
  {
    id: "urban",
    name: "Urbano",
    description: "Voz más firme y presente sobre beats densos.",
    highPass: 90,
    low: -1.5,
    mid: 2.5,
    high: 2,
    compression: 55,
    output: -1.5,
  },
  {
    id: "warm",
    name: "Cálido",
    description: "Menos brillo y un cuerpo más suave.",
    highPass: 70,
    low: 2,
    mid: 0.5,
    high: -1,
    compression: 30,
    output: -1,
  },
];
