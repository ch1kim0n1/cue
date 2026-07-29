# Threat model (Cue)

Cue is a local Electron overlay. It has no Cue backend and no user accounts. The main assets to protect are **provider API keys**, **screenshots/audio in transit to providers**, and **user trust that the overlay is private**.

## Assets

| Asset | Where it lives | Sensitivity |
|---|---|---|
| Provider API keys | `cue-data.json` (encrypted with OS `safeStorage` when available) | High |
| Resume / profile text | `cue-data.json` | Medium |
| Live transcript | Process memory only | Medium |
| Screenshots / PCM | Transient, sent to chosen provider | High (may include others) |
| Overlay invisibility | OS window flag | Best-effort only |

## Trust boundaries

1. **Renderer ↔ main**: contextIsolation + sandboxed preload IPC. Renderer must not receive Node.
2. **Main ↔ OS**: screen/mic permissions, content protection, keychain/DPAPI via `safeStorage`.
3. **Main ↔ AI providers**: HTTPS SDKs; keys leave the machine only as Authorization material.

## Threats and mitigations

| Threat | Mitigation | Residual risk |
|---|---|---|
| Local malware reads `cue-data.json` | `safeStorage` encryption + `0600` file mode | Root/admin malware can still abuse OS crypto APIs |
| Compromised renderer opens arbitrary URLs | `open-pane` scheme/host allowlist; `will-navigate` file-only; `setWindowOpenHandler` deny | Zero-days in Chromium |
| Tampered install | Code signing (mac notarize + Windows Authenticode when certs configured); `asar: true` | Unsigned CI builds remain tamperable |
| Screen-capture bypass | `setContentProtection` | Documented best-effort; phone cameras; old Windows; some macOS tools |
| Prompt injection via pasted resume | Explicit "untrusted data" framing in `profile-context.js` | Models can still leak or follow injected text |
| Malicious provider response | Render as text/markdown only; no `innerHTML` of raw model HTML beyond escaped markdown subset | Markdown subset bugs |
| Meeting recording without consent | In-app privacy notice + listen consent checkbox gated before capture | User can still ignore legal duties |
| Spend abuse / runaway STT | Feature cooldown, busy flag, buffer cap, provider timeouts | User still controls their own API quotas |

## Out of scope

- Cue does not authenticate users.
- Cue does not provide a secure enclave against a hostile local admin.
- Cue does not guarantee invisibility against determined capture tooling.

## Related docs

- [Privacy sections in README](../README.md)
- [Windows guide](windows.md)
- [Rollback notes](rollback.md)
