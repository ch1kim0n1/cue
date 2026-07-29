// Platform-aware copy for permissions, capture, and installer docs.

function platformName(platform = process.platform) {
  if (platform === 'darwin') return 'macOS';
  if (platform === 'win32') return 'Windows';
  if (platform === 'linux') return 'Linux';
  return platform;
}

function isWindows(platform = process.platform) {
  return platform === 'win32';
}

function isMac(platform = process.platform) {
  return platform === 'darwin';
}

function screenPermissionMessage(platform = process.platform) {
  if (platform === 'darwin') {
    return 'Screen capture needs permission. Grant Screen Recording to Cue in System Settings, then quit and reopen.';
  }
  if (platform === 'win32') {
    return 'Screen capture failed. On Windows, allow desktop capture when prompted, and check Settings > Privacy > Screen recording if captures stay blank.';
  }
  return 'Screen capture failed. Grant screen-sharing permission to Cue, then try again.';
}

function micPermissionHint(platform = process.platform) {
  if (platform === 'darwin') {
    return 'System Settings > Privacy & Security > Microphone > Cue';
  }
  if (platform === 'win32') {
    return 'Windows Settings > Privacy & security > Microphone > allow desktop apps';
  }
  return 'Allow microphone access for Cue in your system privacy settings';
}

function productTagline() {
  return 'Private AI overlay for meetings and code';
}

function productName() {
  return 'Cue';
}

module.exports = {
  platformName,
  isWindows,
  isMac,
  screenPermissionMessage,
  micPermissionHint,
  productTagline,
  productName
};
