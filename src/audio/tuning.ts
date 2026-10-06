import type { PitchReading } from "./AudioEngine";

export type ScaleMode =
  | "chromatic"
  | "major"
  | "minor"
  | "major-pentatonic"
  | "minor-pentatonic";

export interface TuningSettings {
  root: number;
  scale: ScaleMode;
}

export interface PitchTarget {
  midi: number;
  note: string;
  octave: number;
  frequency: number;
  centsToTarget: number;
}

export const ROOT_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

export const SCALE_LABELS: Record<ScaleMode, string> = {
  chromatic: "Cromática",
  major: "Mayor",
  minor: "Menor",
  "major-pentatonic": "Pentatónica mayor",
  "minor-pentatonic": "Pentatónica menor",
};

const SCALE_INTERVALS: Record<ScaleMode, readonly number[]> = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  "major-pentatonic": [0, 2, 4, 7, 9],
  "minor-pentatonic": [0, 3, 5, 7, 10],
};

export const DEFAULT_TUNING: TuningSettings = {
  root: 0,
  scale: "chromatic",
};

function normalizePitchClass(value: number): number {
  return ((value % 12) + 12) % 12;
}

function isAllowedMidi(midi: number, settings: TuningSettings): boolean {
  const pitchClass = normalizePitchClass(midi);
  const relative = normalizePitchClass(pitchClass - settings.root);
  return SCALE_INTERVALS[settings.scale].includes(relative);
}

export function findNearestScaleTarget(
  reading: PitchReading | null,
  settings: TuningSettings,
): PitchTarget | null {
  if (!reading) return null;

  const sourceMidi = reading.midi + reading.cents / 100;
  const center = Math.round(sourceMidi);
  let bestMidi = center;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let candidate = center - 12; candidate <= center + 12; candidate += 1) {
    if (!isAllowedMidi(candidate, settings)) continue;

    const distance = Math.abs(sourceMidi - candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMidi = candidate;
    }
  }

  const pitchClass = normalizePitchClass(bestMidi);
  const octave = Math.floor(bestMidi / 12) - 1;
  const frequency = 440 * Math.pow(2, (bestMidi - 69) / 12);

  return {
    midi: bestMidi,
    note: ROOT_NAMES[pitchClass],
    octave,
    frequency,
    centsToTarget: (sourceMidi - bestMidi) * 100,
  };
}

export function getScaleNotes(settings: TuningSettings): string[] {
  const root = normalizePitchClass(settings.root);
  return SCALE_INTERVALS[settings.scale].map(
    (interval) => ROOT_NAMES[normalizePitchClass(root + interval)],
  );
}
