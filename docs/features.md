# Features

## Core

- **Assist**: screenshot + recent transcript, one shot answer or suggested reply.
- **What should I say?**: reply draft from live conversation.
- **Follow-ups**: short question list to keep a meeting moving.
- **Recap**: bullets for key points, decisions, action items.
- **Ask**: free-form question with screen context.
- **Solve on screen**: coding-problem solver from screenshot (Ctrl/Cmd+H).
- **Smart toggle**: fast vs stronger model per provider.

## 0.2 additions

### S++ Live transcript
Toolbar list icon opens a drawer of You/Them turns as speech-to-text lands. Export copies the session to the clipboard. Clear wipes memory buffers and the list.

### S++ Copy and retry
After a response finishes, Copy puts the raw answer on the clipboard. Retry re-runs the last mode with the same text.

### S+ Opacity
Settings slider from 55% to 100% panel opacity. Persisted in `cue-data.json`.

### S Compact mode
Composer pill toggles denser spacing for small screens or crowded desktops.

### A++ Multi-monitor capture
Screenshots target the display nearest the cursor instead of always the primary display.

### A+ Windows packaging
NSIS installer + portable x64 artifacts via `npm run dist:win`.

### A Motion
GSAP drives toolbar/panel entrance, settings and onboarding, response actions, and the live-dot pulse. Respects `prefers-reduced-motion`.

## Providers

| Provider | Chat | Vision | Transcription |
|---|---|---|---|
| OpenAI | yes | yes | Whisper (if key allows) |
| Anthropic | yes | yes | no (pair with OpenAI/Gemini) |
| Gemini | yes | yes | yes |
| Nvidia | yes (OpenAI-compatible) | model-dependent | no |

## Privacy model

- Local settings only.
- No Cue backend.
- Provider calls happen only when you trigger a feature or when listening flushes audio chunks.
