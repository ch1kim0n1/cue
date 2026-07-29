# Cue

**Private AI overlay for meetings and code.**

Cue floats a glass panel over your desktop. It can see your screen, hear your mic, and capture meeting audio, then send that context to an AI model you already pay for (OpenAI, Anthropic, Gemini, or Nvidia). Keys stay on your machine. Cue has no account and no server.

Open-source alternative to tools like Cluely. Runs on **Windows** and **macOS**.

<img src="docs/tutorial.png" width="620" alt="Cue first-run guide" />

---

> [!IMPORTANT]
> Cue asks the OS to exclude its window from screen capture. That is **best-effort, not guaranteed**. A phone camera always can see it. On newer macOS builds, some capture tools can ignore the flag. Using a hidden assistant in a proctored exam, job interview, or recorded meeting may break that platform's rules or local consent laws. Cue is meant for your own notes, studying, accessibility, and practice. **You are responsible for how you use it.**
>
> Zoom: set **Settings > Share Screen > Screen capture mode > "Advanced capture with window filtering."**
>
> <img src="docs/zoom-capture-mode.png" width="560" alt="Zoom screen capture mode with window filtering" />

---

## What it does

| Feature | Trigger | Inputs |
|---|---|---|
| **Assist** | configurable shortcut (default Ctrl/Cmd+Enter) or Assist button | screen + recent conversation |
| **What should I say?** | button | meeting audio + mic |
| **Follow-ups** | button | full conversation |
| **Recap** | button | full conversation |
| **Ask anything** | type + Enter | screen + conversation |
| **Solve on screen** | Ctrl/Cmd+H | screen only |
| **Smart** | pill in composer | switches to the slower, stronger model |
| **Live transcript** | list icon in toolbar | You / Them turns, export, clear |
| **Copy / Retry** | response actions | last answer |
| **Opacity / Compact** | Settings + Compact pill | UI density |

---

## Install

### Option A: Download Cue

Latest release: [github.com/ch1kim0n1/cue/releases/latest](https://github.com/ch1kim0n1/cue/releases/latest)

| Platform | Asset |
|---|---|
| **Windows x64** | `Cue-*-win-x64.exe` (NSIS installer) or the portable `.exe` |
| **macOS Apple Silicon** | `Cue-*-arm64-mac.zip` → unzip → move `Cue.app` to Applications |
| **macOS Intel** | `Cue-*-x64-mac.zip` → same steps |

Signed mac builds open on first double-click when notarized and stapled. Unsigned forks may need Gatekeeper workarounds.

Privacy policy and terms: [docs/privacy-policy.md](docs/privacy-policy.md), [docs/terms.md](docs/terms.md). See also [CHANGELOG.md](CHANGELOG.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

### Option B: Run from source

Needs [Node.js](https://nodejs.org) **18–22** (tested in CI with Electron **33.2.1**).

```bash
git clone https://github.com/ch1kim0n1/cue.git
cd cue
npm install
npm start
```

Build packages:

```bash
npm run dist:win      # Windows NSIS + portable
npm run pack         # unpacked dir for current platform
npm run dist         # mac zip (arm64 + x64)
```

---

## First launch

The in-app guide covers this. Reopen it anytime from the **Cue** logo.

### 1. Permissions

**Windows**
- Allow microphone access when prompted (Settings > Privacy & security > Microphone > Let desktop apps access your microphone).
- When you start listening, pick a screen/window and enable system audio sharing if the picker offers it.

**macOS**
- Microphone: System Settings > Privacy & Security > Microphone > Cue
- Screen Recording: System Settings > Privacy & Security > Screen Recording > Cue (also covers meeting audio capture)

### 2. API key

Open Settings (`...` or Ctrl/Cmd+,). Paste a key for OpenAI, Anthropic, Gemini, or Nvidia.

| Provider | Notes |
|---|---|
| **OpenAI** | Chat + Whisper transcription if the key allows audio |
| **Anthropic** | Strong for screen/coding; add OpenAI or Gemini for listening |
| **Gemini** | Chat + transcription with one key |
| **Nvidia** | OpenAI-compatible chat endpoint |

Keys live in local `cue-data.json` under the app userData folder and are sent only to the provider you pick.

### 3. Zoom (optional)

Most share tools leave Cue alone. For Zoom, use **Advanced capture with window filtering**. Avoid "without window filtering."

---

## How to use

- **Assist** (default Ctrl/Cmd+Enter): do the useful thing for what is on screen or being said.
- **Ctrl/Cmd+H**: solve a coding problem from a screenshot.
- **Listen** button: start/stop meeting capture. Green live dot means active.
- **Transcript** button: review You/Them turns, export, or clear.
- Type a question and press Enter.
- **Smart**: stronger model. **Compact**: denser layout. Opacity slider in Settings.
- Drag the top pill to move Cue. Hide collapses the panel. Quit with Ctrl/Cmd+Shift+X.

Empty space around the panel is click-through so Cue does not block the app underneath.

---

## Architecture

```
main process ──┬─ overlay window (frameless, transparent, always-on-top, content-protected)
               ├─ screenshot (desktopCapturer, display under cursor)
               ├─ speech-to-text (Whisper / Gemini)
               └─ LLM streaming (OpenAI / Anthropic / Gemini / Nvidia)
renderer ──────┴─ glass UI, GSAP motion, mic + system-audio loopback
```

Invisibility uses `setContentProtection(true)` (macOS window-sharing flag / Windows `WDA_EXCLUDEFROMCAPTURE`). Best-effort only.

---

## Feature roadmap ranking

Shipped in 0.2:

| Rank | Feature |
|---|---|
| S++ | Live transcript drawer + export + clear session |
| S++ | Copy response + retry last action |
| S+ | Panel opacity control |
| S | Compact density mode |
| A++ | Multi-monitor capture (display under cursor) |
| A+ | Windows-first packaging (NSIS + portable) |
| A | GSAP motion pass + responsive toolbar/panel |

Still open for contribution:

- [ ] Lower-latency streaming transcription (Deepgram optional)
- [ ] Linux packaging and QA
- [ ] Persist assist history across launches

---

## Docs

- [Windows guide](docs/windows.md)
- [Features](docs/features.md)
- [Development](docs/development.md)
- [Threat model](docs/threat-model.md)
- [Rollback](docs/rollback.md)
- [Release QA](docs/release-qa.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

---

## Troubleshooting

**Blank screenshots on Windows**  
Allow desktop capture when prompted. If thumbnails stay empty, try running Cue outside restricted remote-desktop sessions.

**403 on listening**  
Your OpenAI project key may block Whisper. Enable audio models, use an unrestricted key, or add Gemini for transcription.

**Cue appears in Zoom**  
Set window-filtering capture mode. Remember: exclusion is best-effort.

**macOS "damaged" app**  
Use a current notarized release. Do not strip the signature with `xattr` on signed builds.

---

## Privacy

- No accounts, no telemetry, no Cue servers.
- Keys and resume text stay in local `cue-data.json`.
- Screenshots and audio leave your machine only when a feature calls your chosen provider.
- Session transcript lives in memory until you clear it or quit.

## Contributing

Issues and PRs welcome. Keep the surface small: `main.js`, `renderer/`, `src/`. Plain HTML/CSS/JS. Run `npm test` before opening a PR.

### Platform support

- [x] Windows **x64** (official)
- [x] macOS **arm64 + x64** (official)
- [ ] Windows ARM (out of scope for official builds)
- [ ] Linux (community-supported only; not officially distributed or sold)

i18n is deferred; product copy is English-only for now.

## License

[GPL-3.0-or-later](LICENSE). See also [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and the [release QA runbook](docs/release-qa.md).

Built as an open study of meeting copilots. Related open projects: `pickle-com/glass`, `sohzm/cheating-daddy`.
