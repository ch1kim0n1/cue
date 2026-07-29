# Cue privacy policy

**Effective date:** 2026-07-29  
**Product:** Cue (local desktop overlay)

## Summary

Cue has no Cue account and no Cue server. Cue does not collect telemetry. Your API keys and optional resume text stay on this device. Screenshots and audio leave the device only when you trigger a feature, and only to the AI provider whose key you pasted.

## What stays on your device

- Provider API keys (encrypted with the OS keychain/DPAPI via Electron `safeStorage` when available)
- Optional resume / background text
- App settings in `cue-data.json` under the OS userData directory
- Local log file `cue.log` and optional crash dumps
- In-memory meeting transcript (cleared when Cue quits or you clear the session)

## What leaves your device

When you use Assist, Ask, Solve, listening transcription, or similar features, Cue may send:

- Screenshots of your display
- Short audio clips from your microphone and/or system/meeting audio
- Prompt text and conversation context

to OpenAI, Anthropic, Google Gemini, or Nvidia (whichever you configured). Those providers process data under their own terms and retention policies. Cue does not receive a copy of that traffic.

## Your responsibilities

You are responsible for:

- Complying with local consent and recording laws when capturing other people
- Not using Cue to violate exam, interview, or platform rules
- Choosing providers and reviewing their data-use terms

## Retention

Cue does not retain session transcripts after quit. Local settings remain until you delete them (Settings → Delete my data) or uninstall and remove userData.

## Contact

Privacy questions or bug reports: https://github.com/ch1kim0n1/cue/issues
