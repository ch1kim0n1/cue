# Changelog

## 0.3.1

### Added
- Single-instance lock and restore-on-second-launch
- Window position/size persistence
- Offline detection and faster connectivity probes before provider calls
- Update banner with download / install / defer controls
- Privacy notice versioning via IPC (`needsPrivacyAck`)
- Diagnostics copy, log viewer, Help modal, bug report link
- Test connection + key format warnings
- Transcript turn cap, screenshot buffer cleanup, memory-pressure auto-stop listening
- Crash dump path surfaced in diagnostics
- Privacy policy and Terms docs
- Playwright Electron e2e coverage (Wave 2+)

### Fixed
- Hardcoded privacy notice version in the renderer
- Dead Windows `certificateFile` config (Wave 2)
- Onboarding Skip marking setup complete without a key (Wave 2)

### Security
- CSP `style-src 'unsafe-inline'` formally accepted for GSAP (see threat model)
- Markdown XSS unit tests
- `api.github.com` allowlisted for manual update checks

### Known issues
- Windows SmartScreen reputation requires a signed release history / EV cert
- Full screen-reader QA (NVDA/VoiceOver) still recommended before paid launch
- Packaged-asar e2e is not yet the default CI path
- Full `renderer.js` module split deferred (markdown extracted; rest still one IIFE)

## 0.3.0

Production hardening: encrypted keys, sandbox, asar, updater hooks, consent gates, logging.

## 0.2.0

Cue brand refresh, Windows packaging, GSAP UI, transcript drawer, expanded tests.
