# ZK Music

ZK Music is a local-first music studio prototype focused on making recording and basic vocal processing approachable without hiding the underlying audio quality.

## MVP goals

- Local audio processing by default
- Import a beat from the user's device
- Record microphone locally
- Real-time vocal chain: high-pass filter, 3-band EQ, compressor and output gain
- Live voice character modes: Natural, Warm, Bright, Radio and Robot
- Local algorithmic reverb plus BPM-synced 1/8 delay with feedback
- Performance profiles: Low, Medium, High and Mobile
- Local preview and export of takes
- No required cloud backend for the core studio

## Architecture

- React + TypeScript + Vite
- Web Audio API graph for EQ, dynamics, voice character, reverb, delay and limiting
- Browser MediaRecorder for the first capture/export path
- Tauri-ready structure for the desktop phase
- No server dependency for the current MVP

## Development

```bash
npm install
npm run dev
```

Then open the local Vite URL and allow microphone access when prompted.

## Product direction

The target experience is: import a beat, press record, sound good quickly, and only reveal advanced controls when the user wants them.

Pitch correction, automatic mastering, instruments, cloud sync and AI-assisted presets are planned milestones, not mocked features in this first commit.

## Status

v0.2 Studio Pro foundation. Core processing remains local-first and is not production-ready yet.

Copyright (c) 2026 ZK Music. All rights reserved.
