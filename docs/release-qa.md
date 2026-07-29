# Release QA runbook

Use this checklist before marking a `v*` GitHub Release as production-ready.

## Build

1. Tag `vX.Y.Z` and let `release.yml` produce mac zips (arm64 + x64) and Windows NSIS/portable.
2. Confirm release assets include `bom.cdx.json` (SBOM), installers, and updater `*.yml` / `*.blockmap` when published.
3. Windows signing: `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD` (or `CSC_LINK`) must be set for Authenticode. CI locates `signtool.exe` dynamically and **fails the job** if verification fails:

```powershell
signtool verify /pa .\dist\Cue-*-win-x64.exe
```

4. macOS signing: `MAC_SIGN=1` + Apple notarization secrets. CI runs `xcrun stapler staple` and `spctl --assess`. Gatekeeper should open without quarantine hacks.

## Windows SmartScreen reputation

A brand-new Authenticode certificate has little or no SmartScreen reputation. Expect warnings for the first ~1000 downloads while reputation builds.

- Sign every public release with the **same** subject/issuer.
- Prefer frequent, consistent releases over one-off certs.
- An **EV code-signing certificate** (~$300/year) bypasses the reputation period for immediate trust.
- Track reputation via Windows Defender Security Center / SmartScreen feedback after publishing signed builds.
- Document any SmartScreen false positives in the release notes.

## Empirical verification (manual)

See [wave4-verification.md](wave4-verification.md) for crashReporter dumps, safeStorage DPAPI, NVDA/VoiceOver, contrast, and Tab-order checklists.

## Clean install

| Platform | Steps |
|---|---|
| Windows 11 x64 | Install NSIS on a clean user profile. Confirm Start Menu shortcut, no SmartScreen block when signed. |
| macOS Apple Silicon | Unzip arm64 build into Applications. Confirm first-open Gatekeeper pass when notarized + stapled. |
| macOS Intel | Unzip x64 build. Same Gatekeeper checks. |

Windows ARM and Linux are **not** officially distributed (community-supported only).

### Upgrade path

- [ ] Install 0.3.0 (or previous), set a key, quit.
- [ ] Install 0.3.1 over it. Confirm `cue-data.json` in userData still loads (keys + privacyAck).
- [ ] Confirm userData path did not change between versions (`app.getPath('userData')`).

### Uninstall (Windows NSIS)

- [ ] Uninstaller removes app files, Start Menu, and Desktop shortcuts.
- [ ] `cue-data.json` remains by default (`deleteAppDataOnUninstall: false`) so encrypted keys are not silently wiped.
- [ ] Users who want a full wipe use Settings → Delete my data, or delete `%APPDATA%\Cue` after uninstall.

## First-run

- [ ] Privacy notice appears and must be acknowledged (`privacyNoticeVersion` current via IPC).
- [ ] Onboarding Skip does **not** set `onboarded`; Settings opens instead.
- [ ] Done requires at least one provider key.
- [ ] Mic/screen permission prompts appear on first listen / Assist.
- [ ] Listen is blocked until the consent checkbox is checked.
- [ ] Data path is visible in Settings.
- [ ] Diagnostics panel returns platform/provider fields; Copy diagnostics works.
- [ ] Help / Report a bug / View logs buttons work.
- [ ] Test connection reports success/failure for the selected provider.

## Features (real key)

Run Assist, What should I say?, Follow-ups, Recap, Ask, Solve on screen, Copy, Retry, transcript export/clear, opacity, compact, zoom, shortcut recording.

Also verify:

- [ ] Second app launch focuses the existing window (single-instance).
- [ ] Window position survives quit/relaunch (including a second monitor when still visible).
- [ ] Offline: Assist/Listen disabled; network status toast shown.
- [ ] Update banner: available → Download → ready → Install / Defer (auto-download off).

## Capture / privacy

- [ ] Zoom with window-filtering mode hides Cue (best-effort).
- [ ] On Windows builds older than 10 2004, status warns that content protection is inactive.
- [ ] Over RDP/VM with empty `desktopCapturer` sources, status mentions Remote Desktop/VM.

## Auto-update

1. Install build N.
2. Publish build N+1 to GitHub Releases with updater metadata.
3. Launch N and confirm the update banner (not silent download). Download, then install on quit or Install now.

## Rollback

See [rollback.md](rollback.md). Keep at least the last five release artifacts.
