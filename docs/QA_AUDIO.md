# ZK Music — manual audio acceptance checklist

These checks are required before calling the studio production-ready. Automated CI catches TypeScript, preset range errors and build regressions; it cannot verify microphone acoustic quality, browser permissions, end-to-end timing, or audible distortion.

## Test environments

- Chromium desktop (Windows or macOS) with headphones and a USB/analog microphone.
- Safari on iPhone with headphones, where supported.
- One slower laptop or phone using Low/Mobile performance mode.

For every test, use the same mic position, beat, input gain and vocal phrase where possible.

## Mic input and record safety

1. Enable mic. Confirm input meter responds to speech and is unaffected by EQ, preset, reverb or monitoring toggle.
2. Gradually raise hardware input gain until the peak warning appears; verify the warning relates to captured input, not limited output. Lower gain before recording.
3. Load a loud beat and record a 15-second verse. Confirm the voice+beat recording-bus sample-peak meter responds and a take is created.
4. Play the take. Check instrumental and voice both appear and limiter does not audibly pump. Adjust beat volume if needed.
5. Start another take after stopping the first. Confirm no orphaned recording remains.
6. Export Original and WAV. Verify playback; a WAV conversion from compressed audio does not restore missing codec quality.
7. Verify a take that cannot be waveform-decoded is still saved and downloadable as Original.
8. Delete a recently renamed take. Reload the page and verify it does not reappear.
9. Verify recordings remain in local browser storage and are not uploaded unexpectedly.

## Urban profiles and A/B

1. Audition Urbano Grave, Melódico Suave, Grave Melódico, Brillante Nasal and Rap Seco.
2. Confirm a single preset updates EQ, compression, character and ambience.
3. Confirm Rap Seco has zero reverb/delay and melodic presets have some ambience.
4. Change a slider and confirm the profile becomes Personalized.
5. Reload and confirm settings persist locally.
6. With headphones and monitoring enabled, compare processed A to captured B (post-browser mic processing, pre-ZK FX). Final limiter is active in both paths.
7. Disable monitoring; ensure A/B cannot be engaged. Start recording with B active; the take must use processed A.

## Failure and performance

1. Deny microphone access, then retry after granting it. Verify useful errors and recovery.
2. Switch mic device between takes; verify no duplicated audio paths.
3. Enable monitoring only with headphones to avoid feedback.
4. Calibrate room in silence. On devices lacking compatible AudioWorklet noise gate, expect an explicit error rather than false success.
5. Test mobile background/foreground, restricted browser storage and short takes.
6. Check Low and Mobile modes for dropouts and responsive record/stop/export.
7. Record quiet speech and high-energy rap. Listen for sibilance, distorted peaks, cut-off consonants, missing starts and unintended echoes.

## Release criteria

- CI check, tests and build are green.
- No lost takes after recoverable codec/analysis errors.
- No unexpected mic output to speakers when monitoring is disabled.
- No audible overload or duplicated signals on tested devices.
- Browser limitations documented. Sample-peak is not true-peak; a limiter cannot repair clipped microphone input.
- Pitch detection is not pitch correction/AutoTune.

Record device, browser version, sample rate, measured sample peaks and outcome for each manual check.
