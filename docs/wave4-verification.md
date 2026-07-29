# Wave 4 empirical verification

Run these on real hardware before tagging a paid 0.4.x build. Check boxes as you go.

## crashReporter dumps

1. Dev build: temporarily call `process.crash()` from a main-process IPC (remove after).
2. Confirm a `.dmp` appears under `app.getPath('crashDumps')` (userData `/Crashpad`).
3. Confirm Settings → diagnostics shows `crashDumps` path and View logs / open dumps works.
4. If no dump with empty `submitURL`, retry with `crashReporter.start({ uploadToServer: false, compress: true })` only (already configured).

## safeStorage / DPAPI (Windows)

1. Create a fresh Windows user. Install Cue. Paste an API key. Quit.
2. Log out / log back in as the **same** user. Confirm the key still decrypts in Settings.
3. Copy `cue-data.json` to a **different** Windows user profile. Confirm Cue cannot decrypt (or shows encryption warning / empty keys).
4. Record result under Residual risks in `threat-model.md`.

## Accessibility

### NVDA (Windows) / VoiceOver (macOS)

Walk: privacy notice → onboarding → settings → paste key → listen consent → listen toggle → Assist → transcript → copy → export.

Log unlabeled controls, missing announcements, focus-trap escapes. Fix before paid launch.

### Color contrast

Audit panel text at opacity **70% / 75% / 92% / 100%** (minimum opacity is now 70%). Target WCAG AA 4.5:1 normal / 3:1 large.

### Keyboard Tab order

Expected: logo → hide → listen → transcript → action row (Assist → Say → Follow-ups → Recap) → composer → Smart → Compact → Settings → zoom − → zoom + → Send.

Repeat with Settings and Help open. Cancel button should be reachable while a request is busy.

## Packaged asar e2e

```bash
npm run test:e2e:packed
```

Confirms preload + diagnostics against `dist/win-unpacked/Cue.exe` (or mac app).

## Release QA runbook

Walk every checkbox in `release-qa.md` against a CI-built tag (prefer `v0.4.0-rc1` before the real `v0.4.0`).
