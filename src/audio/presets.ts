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
  {
    id: "soft-melodic",
    name: "Melódico Suave",
    description: "Más redondo y afinable: conserva cuerpo, suaviza ataques y deja espacio para reverb/delay.",
    highPass: 74,
    low: 0.5,
    mid: 1.2,
    high: 0.8,
    compression: 42,
    output: -1,
  },
  {
    id: "deep-melodic",
    name: "Grave Melódico",
    description: "Objetivo urbano oscuro: grave-media al frente, firme pero sin sonar embarrado.",
    highPass: 70,
    low: -0.5,
    mid: 2.0,
    high: 1.0,
    compression: 50,
    output: -1,
  },
  {
    id: "bright-nasal",
    name: "Brillante Nasal",
    description: "Objetivo más agudo y nasal: recorta cuerpo sobrante y empuja medios/claridad.",
    highPass: 88,
    low: -2,
    mid: 3.2,
    high: 1.8,
    compression: 50,
    output: -1.5,
  },
  {
    id: "dry-rap",
    name: "Rap Seco",
    description: "Ataque claro y poca cola para fraseos rápidos y consonantes definidas.",
    highPass: 78,
    low: -1,
    mid: 2.6,
    high: 1.2,
    compression: 46,
    output: -1,
  },
];