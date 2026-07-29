# Contributing

## Local setup

```bash
npm ci
npm start
```

Supported Node: 18+ (CI covers 18/20/22). Electron is pinned to 33.2.1.

## Pre-push checklist (same as CI)

```bash
npm run lint          # max-warnings 45
npm test
npm run test:smoke
npm run verify:vendor
npm audit --omit=dev --audit-level=high
```

```bash
npm run test:e2e          # needs a display (Windows/macOS); not for headless Linux CI job
npm run test:e2e:packed   # packs then launches dist/*/Cue — slower; Windows CI runs this
```

Optional:

```bash
npm run sbom
npm run pack
```

## Layout

- `main.js` — window, IPC, capture flush, updater
- `preload.js` — contextBridge API
- `src/` — providers, settings, security helpers (`types.js` JSDoc typedefs)
- `renderer/` — UI scripts (no bundler)
- `e2e/` — Playwright Electron tests
- `test/` — Node unit tests
- `docs/wave4-verification.md` — manual hardware / a11y checks

## Style

- Keep prompts short; no emoji or em dashes in product copy
- Prefer plain modules over new frameworks
- Do not commit `cue-data.json`, logs, or SBOM artifacts
