# Contributing

## Local setup

```bash
npm ci
npm start
```

Supported Node: 18+ (CI covers 18/20/22). Electron is pinned to 33.2.1.

## Pre-push checklist

```bash
npm run lint
npm test
npm run test:smoke
npm run verify:vendor
npm audit --omit=dev --audit-level=high
npm run test:e2e   # Windows recommended; launches Electron
```

Optional:

```bash
npm run sbom
npm run pack
```

## Layout

- `main.js` — window, IPC, capture flush, updater
- `preload.js` — contextBridge API
- `src/` — providers, settings, security helpers
- `renderer/` — UI scripts (no bundler)
- `e2e/` — Playwright Electron tests
- `test/` — Node unit tests

## Style

- Keep prompts short; no emoji or em dashes in product copy
- Prefer plain modules over new frameworks
- Do not commit `cue-data.json`, logs, or SBOM artifacts
