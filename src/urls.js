// Allowlist for shell.openExternal targets from the renderer.

const ALLOWED_SCHEMES = new Set([
  'https:',
  'http:',
  'x-apple.systempreferences:',
  'ms-settings:'
]);

const ALLOWED_HOST_SUFFIXES = [
  'openai.com',
  'anthropic.com',
  'google.com',
  'aistudio.google.com',
  'ai.google.dev',
  'nvidia.com',
  'github.com'
];

function isAllowedOpenUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  let url;
  try { url = new URL(raw); } catch { return false; }
  if (!ALLOWED_SCHEMES.has(url.protocol)) return false;
  if (url.protocol === 'x-apple.systempreferences:' || url.protocol === 'ms-settings:') return true;
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    const host = url.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith('.' + suffix));
  }
  return false;
}

module.exports = { isAllowedOpenUrl, ALLOWED_SCHEMES, ALLOWED_HOST_SUFFIXES };
