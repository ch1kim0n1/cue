/* electron-builder configuration.
 *
 * macOS signing: MAC_SIGN=1 + Developer ID / CSC_LINK + Apple notarization env
 * Windows signing: WIN_CSC_LINK (or CSC_LINK) + WIN_CSC_KEY_PASSWORD
 * Auto-updates publish to GitHub Releases (owner/repo inferred from package/git).
 */

const hasMacCert = process.env.MAC_SIGN === "1";
const canNotarize =
  hasMacCert &&
  !!process.env.APPLE_ID &&
  !!process.env.APPLE_APP_SPECIFIC_PASSWORD &&
  !!process.env.APPLE_TEAM_ID;

const winCert = process.env.WIN_CSC_LINK || process.env.CSC_LINK || "";
const hasWinCert = !!winCert;

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "com.cue.overlay",
  productName: "Cue",
  asar: true,
  publish: [
    {
      provider: "github",
      owner: "ch1kim0n1",
      repo: "cue",
      releaseType: "release",
    },
  ],
  files: [
    "main.js",
    "preload.js",
    "src/**/*",
    "renderer/**/*",
    "THIRD_PARTY_NOTICES.md",
  ],
  directories: { buildResources: "build-resources" },
  mac: {
    target: [
      { target: "zip", arch: ["arm64", "x64"] },
    ],
    category: "public.app-category.productivity",
    identity: hasMacCert ? undefined : null,
    hardenedRuntime: hasMacCert,
    gatekeeperAssess: false,
    entitlements: "build-resources/entitlements.mac.plist",
    entitlementsInherit: "build-resources/entitlements.mac.plist",
    notarize: canNotarize,
    extendInfo: {
      LSUIElement: true,
      NSMicrophoneUsageDescription:
        "Cue transcribes your microphone so it can help you in conversations.",
      NSCameraUsageDescription: "Cue does not use the camera.",
      NSAudioCaptureUsageDescription:
        "Cue captures system audio to transcribe the other participant in a call.",
    },
  },
  win: {
    target: [
      { target: "nsis", arch: ["x64"] },
      { target: "portable", arch: ["x64"] },
    ],
    artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
    // electron-builder picks CSC_LINK; prefer WIN_CSC_LINK when set in CI.
    certificateFile: hasWinCert ? undefined : undefined,
    signingHashAlgorithms: hasWinCert ? ["sha256"] : undefined,
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "Cue",
    uninstallDisplayName: "Cue",
  },
};
