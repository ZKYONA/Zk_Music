# ZK Music

ZK Music is a local-first music studio prototype focused on making recording and basic vocal processing approachable without hiding the underlying audio quality.

## MVP goals

- Local audio processing by default
- Import a beat from the user's device
- Record microphone locally
- Real-time vocal chain: high-pass filter, 3-band EQ, compressor, limiter and output gain
- Local voice-character profiles (Natural, Warm, Bright, Radio and Robot)
- Full vocal chain presets, including Urbano Grave, Melódico Suave, Grave Melódico, Brillante Nasal and Rap Seco
- A/B button to compare the captured voice against EQ/FX (disabled during recording)
- Remember the active preset, with manual adjustment detection
- Local reverb and delay with wet mix, delay time and feedback controls
- Real-time pitch detection with note, frequency, cents and confidence
- Scale-aware pitch targeting with selectable tonic and scale
- Performance profiles: Low, Medium, High and Mobile
- Local preview and export of takes
- No required cloud backend for the core studio

## Architecture

- React + TypeScript + Vite
- Web Audio API for the audio engine
- Browser MediaRecorder for the first capture/export path
- Tauri-ready structure for the desktop phase
- No server dependency for the current MVP

## Development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run check
npm test
npm run build
```

## Urban vocal profiles

Choosing a preset now updates the vocal EQ, compressor, voice character and reverb/delay together. When you manually change an EQ, ambience, voice character or enhancement control, the preset indicator changes to **Personalizado**. The current choice is saved locally.

**A/B preview:** use **Escuchar sin efectos** to hear the captured microphone before ZK Music's gate, EQ, compression and ambience; the comparison still goes through a final safety limiter. Your device/browser microphone processing may remain active. Monitoring requires headphones to avoid feedback. Recording always restores the processed path, and the A/B toggle is disabled while a take is active.

These are curated starting points, **not** automatic vocal analysis or real-time pitch correction. Check recording gain and listen in context: presets cannot compensate for an overloaded microphone or a poor acoustic environment.

Then open the local Vite URL and allow microphone access when prompted.

## Product direction

The target experience is: import a beat, press record, sound good quickly, and only reveal advanced controls when the user wants them.

Pitch correction, automatic mastering, instruments, cloud sync and AI-assisted presets remain planned milestones. Voice character, room calibration, reverb and delay are implemented locally; AutoTune is intentionally not presented as finished until real pitch correction is available.

## Status

Early MVP foundation. Not production-ready yet.

Copyright (c) 2026 ZK Music. All rights reserved.
