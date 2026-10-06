export type PerformanceProfile = "low" | "medium" | "high" | "mobile";

export interface PerformanceConfig {
  label: string;
  description: string;
  sampleRate: number;
  recorderBitrate: number;
  analyserFftSize: 512 | 1024 | 2048 | 4096;
  latencyHint: AudioContextLatencyCategory;
}

export const PERFORMANCE_PROFILES: Record<PerformanceProfile, PerformanceConfig> = {
  low: {
    label: "Low",
    description: "Menos CPU y RAM para equipos modestos.",
    sampleRate: 44100,
    recorderBitrate: 96000,
    analyserFftSize: 512,
    latencyHint: "balanced",
  },
  medium: {
    label: "Medium",
    description: "Equilibrio entre calidad, latencia y consumo.",
    sampleRate: 48000,
    recorderBitrate: 160000,
    analyserFftSize: 1024,
    latencyHint: "interactive",
  },
  high: {
    label: "High",
    description: "Más detalle para equipos potentes.",
    sampleRate: 48000,
    recorderBitrate: 256000,
    analyserFftSize: 2048,
    latencyHint: "interactive",
  },
  mobile: {
    label: "Mobile",
    description: "Ajustado para teléfono y ahorro de batería.",
    sampleRate: 44100,
    recorderBitrate: 128000,
    analyserFftSize: 512,
    latencyHint: "balanced",
  },
};

export function detectDefaultProfile(): PerformanceProfile {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile) return "mobile";

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency ?? 4;

  if ((memory !== undefined && memory <= 4) || cores <= 4) return "low";
  if ((memory !== undefined && memory >= 12) && cores >= 8) return "high";
  return "medium";
}
