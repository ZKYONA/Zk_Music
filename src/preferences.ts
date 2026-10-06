import type { AmbienceSettings, PitchCorrectionSettings, VocalFxSettings } from "./audio/AudioEngine";
import type { VoiceCharacterMode } from "./audio/characters";
import type { VoiceEnhancementMode } from "./audio/enhancement";
import type { PerformanceProfile } from "./audio/performance";
import type { TuningSettings } from "./audio/tuning";

export interface StudioPreferences {
  profile: PerformanceProfile;
  fx: VocalFxSettings;
  enhancement: VoiceEnhancementMode;
  voiceCharacter: VoiceCharacterMode;
  ambience: AmbienceSettings;
  beatVolume: number;
  metronome: boolean;
  bpm: number;
  monitor: boolean;
  inputDeviceId: string;
  tuning: TuningSettings;
  pitchCorrection: PitchCorrectionSettings;
}

const STORAGE_KEY = "zk-music:studio-preferences:v1";

export function loadStudioPreferences(): Partial<StudioPreferences> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Partial<StudioPreferences>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStudioPreferences(preferences: StudioPreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage can be unavailable in private/restricted browser modes.
  }
}
