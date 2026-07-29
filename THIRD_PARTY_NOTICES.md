# Third-party notices

Cue bundles or depends on the following third-party software.

## GSAP (GreenSock)

- Path: `renderer/vendor/gsap.min.js`
- Package: `gsap` (npm)
- License: GSAP standard license. Since the Webflow acquisition, GSAP is free for the vast majority of use cases including commercial apps. Club GreenSock plugins are not bundled. See https://gsap.com/community/free/
- Hash: verified in CI via `npm run verify:vendor`

## Outfit / IBM Plex Mono (Fontsource)

- Paths: `renderer/fonts/*.woff2`
- Packages: `@fontsource/outfit`, `@fontsource/ibm-plex-mono`
- License: SIL Open Font License 1.1

## Lucide icons

- Package: `lucide-static` (paths inlined in `renderer/icons.js`)
- License: ISC

## Electron and Chromium

- Package: `electron` 33.2.1
- Licenses: MIT (Electron) + Chromium third-party notices shipped with the Electron binary

## AI provider SDKs

- `openai` 4.73.0 — Apache-2.0 / MIT (see package)
- `@anthropic-ai/sdk` 0.32.1 — MIT
- `@google/genai` 0.3.0 — Apache-2.0

## electron-updater / electron-builder

- `electron-updater` 6.3.9 — MIT
- `electron-builder` 24.13.3 — MIT

Full license texts for npm packages are available in `node_modules/<package>/LICENSE` after install, and in release SBOMs when published.
