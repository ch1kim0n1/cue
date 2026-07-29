# Development

## Stack

- Electron 33
- Plain HTML/CSS/JS renderer (no bundler)
- GSAP vendored at `renderer/vendor/gsap.min.js`
- Node test runner (`node --test`)

## Scripts

```bash
npm start          # run app
npm test           # unit tests
npm run pack       # unpacked build
npm run dist:win   # Windows installer + portable
npm run dist       # mac zip
```

## Layout

```
main.js            window, IPC, capture flush, shortcuts
preload.js         contextBridge API
src/               providers, prompts, settings, wav, platform helpers
renderer/          UI, styles, icons, GSAP, audio worklet
test/              unit tests (no Electron required for most files)
```

## Testing notes

Prefer pure modules under `src/` (`settings-model`, `shortcuts`, `platform`, `prompts`, `wav`, `profile-context`). Avoid pulling `store.js` into tests; it needs Electron `app`.

CI runs syntax checks on JS files plus `npm test` on Node 18/20/22.

## Windows local run

```powershell
npm install
npm start
```

Set `CUE_NO_PROTECT=1` to disable content protection while debugging capture.

## Coding style

- Keep prompts short and direct.
- No emoji in product copy.
- Prefer plain punctuation over em dashes in user-facing text.
- Match existing file tone: small, readable, few abstractions.
