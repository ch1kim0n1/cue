# Agent notes (Cue)

## Verify before push

```bash
npm run lint && npm test && npm run test:smoke && npm run verify:vendor && npm audit --omit=dev --audit-level=high
```

`npm run test:e2e` needs a GUI (Windows/macOS). Packaged asar path: `npm run test:e2e:packed`.

## Product constraints

- No Cue server; BYOK only
- English UI only for now (`language` setting is a placeholder)
- GPL-3.0-or-later source; paid binaries use Sponsors/storefront + 14-day refund policy
- Do not push straight to Gerrit review refs for this GitHub project — use GitHub `main` / PRs
