// Platform capability probes (pure where possible for unit tests).

function parseWindowsBuild(release) {
  // os.release() on Windows looks like "10.0.19045"
  const m = String(release || '').match(/^\d+\.\d+\.(\d+)/);
  return m ? Number(m[1]) : null;
}

/** WDA_EXCLUDEFROMCAPTURE needs Windows 10 2004 = build 19041+. */
function supportsContentProtection(platform, release) {
  if (platform !== 'win32') return true;
  const build = parseWindowsBuild(release);
  if (build == null) return true;
  return build >= 19041;
}

function contentProtectionWarning(platform, release) {
  if (supportsContentProtection(platform, release)) return null;
  return 'This Windows build is older than 10 version 2004, so Cue cannot exclude itself from screen capture. Other apps may see the overlay.';
}

function screenshotFailureMessage(result) {
  if (!result || result.ok) return null;
  if (result.reason === 'no-sources') {
    return 'No capture sources available. Cue may not work over Remote Desktop or some VMs.';
  }
  if (result.reason === 'empty') {
    return 'Screenshot came back empty. Grant screen capture permission, or try outside Remote Desktop/VM.';
  }
  return 'Screen capture failed.';
}

module.exports = {
  parseWindowsBuild,
  supportsContentProtection,
  contentProtectionWarning,
  screenshotFailureMessage
};
