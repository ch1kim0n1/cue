# Wave 5 Part B — manual QA ledger

Automated gates run on every push. Fill Pass? during a human run against `npm start` or a packed build.

## Automated (CI / local scripts)

| Gate | Result |
|---|---|
| `npm run lint` (≤45) | see latest CI / local |
| `npm test` | see latest CI / local |
| `npm run test:smoke` | see latest CI / local |
| `npm run verify:vendor` | see latest CI / local |
| `npm audit --omit=dev --audit-level=high` | see latest CI / local |
| `npm run test:e2e` | Playwright UI + Recent + diagnostics.cpu |
| `npm run test:e2e:packed` | Windows CI / local after pack |

## Human checklist

Use the tables in the Wave 5 brief (B1–B25, items 1–131). Mark Pass? here by section as you finish:

| Section | Items | Pass? | Notes |
|---|---|---|---|
| B1 First-run | 1–10 | | Wipe `%APPDATA%\Cue\cue-data.json` first |
| B2 Provider + keys | 11–20 | | Confirm encrypted `apiKeysEnc` |
| B3 Consent | 21–24 | | |
| B4 Audio + startup | 25–29 | | Reboot for 27–28 |
| B5 Appearance + diag | 30–38 | | cpu / spend fields in JSON |
| B6 Toolbar + window | 39–46 | | |
| B7 Assist | 47–56 | | Cancel + cost + code Copy |
| B8–B12 Features | 57–68 | | Needs live key |
| B13 Listening | 69–76 | | |
| B14 Smart | 77–79 | | |
| B15 Offline | 80–83 | | |
| B16 Errors | 84–87 | | |
| B17 Updates | 88–92 | | Packaged only |
| B18 Data | 93–95 | | |
| B19 Keyboard | 96–100 | | |
| B20 NVDA/VO | 101–108 | | |
| B21 Contrast | 109–113 | | |
| B22 crashReporter | 114–116 | | Dev-only crash IPC |
| B23 safeStorage | 117–120 | | Second Windows user |
| B24 Packaged asar | 121–123 | | |
| B25 Release QA | 124–131 | | Against RC / final tag |

## Do not tag v0.4.0 until

All Wave 5 “If any of these fail” blockers are green, including packed asar e2e, NSIS uninstall prompt, consent gate, encrypted keys, cancel, offline disable, crash dumps, and DPAPI cross-user.
