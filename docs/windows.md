# Windows guide

Cue is a first-class Windows app in 0.2. Same overlay model as macOS: frameless transparent window, always on top, click-through gaps, content protection when the OS supports it.

## Install

1. Download the NSIS installer (`Cue-*-win-x64.exe`) from Releases, or use the portable build if you do not want an install.
2. Run the installer. Shortcuts land on the Desktop and Start Menu as **Cue**.
3. Or from source:

```powershell
npm install
npm start
```

```powershell
npm run dist:win
```

## Permissions

| Need | Where |
|---|---|
| Microphone | Windows Settings > Privacy & security > Microphone > allow desktop apps |
| Screen / system audio | Granted when Cue requests `getDisplayMedia` for listening. Pick a screen and enable system audio if shown. |

Cue does not need a separate helper binary. Capture runs inside the Electron process.

## Shortcuts (defaults)

| Action | Keys |
|---|---|
| Assist | Ctrl+Enter |
| Solve on screen | Ctrl+H |
| Settings | Ctrl+, |
| Quit | Ctrl+Shift+X |

Change Assist under Settings > Keyboard shortcuts.

## Screen share / invisibility

`setContentProtection(true)` maps to Windows `SetWindowDisplayAffinity` with `WDA_EXCLUDEFROMCAPTURE` on Windows 10 2004 and newer. Older builds may still capture Cue. Phone cameras always can. Treat this as best-effort.

For Zoom, use **Advanced capture with window filtering**.

## Known Windows notes

- Transparent frameless windows can flash briefly on some GPU drivers. Cue sets a transparent background color to reduce that.
- Remote Desktop / some VM tools may return empty `desktopCapturer` thumbnails.
- Multi-monitor: screenshots prefer the display under the mouse cursor.
- Antivirus may prompt on first run of unsigned local builds; release installers should be preferred for distribution.

## Data location

Settings file: `%APPDATA%\Cue\cue-data.json` (exact folder name follows electron `productName` / app userData).
