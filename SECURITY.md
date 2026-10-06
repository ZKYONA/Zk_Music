# Security policy

ZK Music is being designed as a local-first audio application.

## Current security principles

- Core recording and effects do not require a remote server.
- Microphone access is requested only after an explicit user action.
- No audio is uploaded by the current MVP.
- Secrets, API keys and private service credentials must never be committed.
- Remote advertisements, AI providers and cloud sync must be isolated from the audio engine before those features are introduced.

## Reporting

Do not publish exploitable security issues in a public issue. Contact the repository owner privately until a dedicated security reporting channel is configured.
