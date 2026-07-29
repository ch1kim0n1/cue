# Release QA runbook

Use this checklist before marking a `v*` GitHub Release as production-ready.

## Build

1. Tag `vX.Y.Z` and let `release.yml` produce mac zips (arm64 + x64) and Windows NSIS/portable.
2. Confirm release assets include `bom.cdx.json` (SBOM), installers, and updater `*.yml` / `*.blockmap` when published.
3. Windows signing: `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD` (or `CSC_LINK`) must be set for Authenticode. Verify with:

```powershell
signtool verify /pa .\dist\Cue-*-win-x64.exe
```

4. macOS signing: `MAC_SIGN=1` + Apple notarization secrets. Gatekeeper should open without quarantine hacks.

## Clean install

| Platform | Steps |
|---|---|
| Windows 11 x64 | Install NSIS on a clean user profile. Confirm Start Menu shortcut, no SmartScreen block when signed. |
| macOS Apple Silicon | Unzip arm64 build into Applications. Confirm first-open Gatekeeper pass when notarized. |
| macOS Intel | Unzip x64 build. Same Gatekeeper checks. |

Windows ARM and Linux are **not** officially distributed (community-supported only).

## First-run

- [ ] Privacy notice appears and must be acknowledged (`privacyNoticeVersion` current).
- [ ] Onboarding Skip does **not** set `onboarded`; Settings opens instead.
- [ ] Done requires at least one provider key.
- [ ] Mic/screen permission prompts appear on first listen / Assist.
- [ ] Listen is blocked until the consent checkbox is checked.
- [ ] Data path is visible in Settings.
- [ ] Diagnostics panel returns platform/provider fields.

## Features (real key)

Run Assist, What should I say?, Follow-ups, Recap, Ask, Solve on screen, Copy, Retry, transcript export/clear, opacity, compact, zoom, shortcut recording.

## Capture / privacy

- [ ] Zoom with window-filtering mode hides Cue (best-effort).
- [ ] On Windows builds older than 10 2004, status warns that content protection is inactive.
- [ ] Over RDP/VM with empty `desktopCapturer` sources, status mentions Remote Desktop/VM.

## Auto-update

1. Install build N.
2. Publish build N+1 to GitHub Releases with updater metadata.
3. Launch N and confirm status shows an update download / "Update ready" on quit.

## Rollback

See [rollback.md](rollback.md). Keep at least the last five release artifacts.
