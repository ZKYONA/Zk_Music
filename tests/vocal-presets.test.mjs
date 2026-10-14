import assert from "node:assert/strict";
import test from "node:test";
import { VOCAL_PRESETS } from "../src/audio/presets.ts";
import { VOICE_CHARACTER_PROFILES } from "../src/audio/characters.ts";

const required = ["urban-deep", "soft-melodic", "deep-melodic", "bright-nasal", "dry-rap"];

test("all five urban vocal profiles are available", () => {
  const ids = VOCAL_PRESETS.map((preset) => preset.id);
  assert.equal(new Set(ids).size, ids.length, "preset IDs must be unique");
  for (const id of required) assert.ok(ids.includes(id), `missing ${id}`);
});

test("every preset stays within the existing audio-engine and UI ranges", () => {
  for (const preset of VOCAL_PRESETS) {
    assert.ok(preset.name.trim() && preset.description.trim());
    assert.ok(preset.character in VOICE_CHARACTER_PROFILES, preset.id);
    assert.ok(preset.highPass >= 40 && preset.highPass <= 180, preset.id);
    for (const band of ["low", "mid", "high"]) {
      assert.ok(preset[band] >= -8 && preset[band] <= 8, `${preset.id}: ${band}`);
    }
    assert.ok(preset.compression >= 0 && preset.compression <= 100, preset.id);
    assert.ok(preset.output >= -12 && preset.output <= 3, preset.id);
    const { reverb, delay, delayMs, feedback } = preset.ambience;
    assert.ok(reverb >= 0 && reverb <= 60, preset.id);
    assert.ok(delay >= 0 && delay <= 50, preset.id);
    assert.ok(delayMs >= 60 && delayMs <= 650, preset.id);
    assert.ok(feedback >= 0 && feedback <= 65, preset.id);
  }
});

test("rap seco remains dry and melodic presets have space", () => {
  const get = (id) => VOCAL_PRESETS.find((p) => p.id === id);
  assert.equal(get("dry-rap").ambience.reverb, 0);
  assert.equal(get("dry-rap").ambience.delay, 0);
  assert.ok(get("soft-melodic").ambience.reverb > get("urban-deep").ambience.reverb);
  assert.ok(get("deep-melodic").ambience.delay > get("dry-rap").ambience.delay);
});
