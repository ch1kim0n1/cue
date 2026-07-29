# Changelog

## 0.4.0

### Added
- Cancel in-flight LLM requests (AbortController)
- Approximate per-call cost + session/lifetime spend tracker
- HiDPI screenshot long-edge cap (2560px)
- rAF-batched token rendering, tok/s indicator, copy-on-code-blocks
- Mic device picker, start-on-login, beta updates toggle
- Offline race fix (local `isOnline` + awaited `netSetOnline`)
- NSIS uninstall prompt for cue-data.json / cue.log
- CSP violation logging + nosniff / frame / referrer headers
- Packaged-asar e2e helper (`npm run test:e2e:packed`)
- Support Cue link, landing doc, refund policy, verification runbook

### Fixed
- Lint budget restored to max-warnings 50 (store path allowlist + timingSafeEqual)
- Minimum panel opacity raised to 70% for contrast

### Known issues
- Full NVDA/VoiceOver and DPAPI dual-user checks remain manual (see docs/wave4-verification.md)
- marked+DOMPurify swap deferred; escape-first markdown expanded (headings + https links)
- Full renderer.js module split still deferred
- License-key DRM deferred in favor of Sponsors / storefront links

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
