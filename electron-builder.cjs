/* electron-builder configuration.
 *
 * Signing is environment-gated (same idea as NitroAI):
 *   MAC_SIGN=1 + Developer ID / CSC_LINK + Apple notarization env => signed mac zip
 *   otherwise mac builds are unsigned (identity: null)
 * Windows builds produce an NSIS installer for x64.
 */

const hasCert = process.env.MAC_SIGN === "1";
const canNotarize =
  hasCert &&
  !!process.env.APPLE_ID &&
  !!process.env.APPLE_APP_SPECIFIC_PASSWORD &&
  !!process.env.APPLE_TEAM_ID;

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: "com.cue.overlay",
  productName: "Cue",
  asar: false,
  publish: null,
  files: [
    "main.js",
    "preload.js",
    "src/**/*",
    "renderer/**/*",
  ],
  directories: { buildResources: "build-resources" },
  mac: {
    target: [{ target: "zip", arch: ["arm64"] }],
    category: "public.app-category.productivity",
    identity: hasCert ? undefined : null,
    hardenedRuntime: hasCert,
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
