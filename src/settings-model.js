// Pure settings helpers (no Electron) so unit tests can run in plain Node.

const SCHEMA_VERSION = 2;
const PRIVACY_NOTICE_VERSION = 2;

const DEFAULTS = {
  schemaVersion: SCHEMA_VERSION,
  privacyNoticeVersion: 0,
  provider: 'openai',
  smart: false,
  resumeContext: '',
  opacity: 0.92,
  compact: false,
  onboarded: false,
  privacyAck: false,
  listenConsent: false,
  windowBounds: null,
  shortcuts: { assist: 'CommandOrControl+Return' },
  apiKeys: { openai: '', anthropic: '', gemini: '', deepgram: '', nvidia: '' },
  models: {
    openai: { fast: 'gpt-4o-mini', smart: 'gpt-4o' },
    anthropic: { fast: 'claude-3-5-haiku-latest', smart: 'claude-3-5-sonnet-latest' },
    gemini: { fast: 'gemini-2.5-flash', smart: 'gemini-2.5-pro' },
    nvidia: { fast: 'meta/llama-3.2-11b-vision-instruct', smart: 'meta/llama-3.2-90b-vision-instruct' }
  },
  audioDeviceId: '',
  openAtLogin: false,
  betaUpdates: false,
  lifetimeSpend: 0,
  recentFeatures: [],
  language: 'en',
  licenseKey: ''
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(over || {})) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], over[k]);
    } else {
      out[k] = over[k];
    }
  }
  return out;
}

function clampOpacity(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULTS.opacity;
  // Floor raised for WCAG AA readability over glass at low opacity.
  return Math.min(1, Math.max(0.7, n));
}

function migrateSettings(raw) {
  const data = deepMerge(DEFAULTS, raw || {});
  const from = Number(raw && raw.schemaVersion) || 1;
  // v1 -> v2: introduce privacy/consent flags (default false so first-run shows notices)
  if (from < 2) {
    if (raw && raw.onboarded && raw.privacyAck == null) data.privacyAck = true;
  }
  data.schemaVersion = SCHEMA_VERSION;
  return data;
}

function needsPrivacyAck(settings) {
  if (!settings) return true;
  if (!settings.privacyAck) return true;
  const seen = Number(settings.privacyNoticeVersion) || 0;
  return seen < PRIVACY_NOTICE_VERSION;
}

function normalizeSettings(raw) {
  const data = migrateSettings(raw);
  data.opacity = clampOpacity(data.opacity);
  data.compact = !!data.compact;
  data.onboarded = !!data.onboarded;
  data.privacyAck = !!data.privacyAck;
  data.listenConsent = !!data.listenConsent;
  data.privacyNoticeVersion = Number(data.privacyNoticeVersion) || 0;
  if (!data.apiKeys[data.provider]) {
    const validProviders = ['openai', 'anthropic', 'gemini', 'nvidia'];
    const active = validProviders.find((p) => data.apiKeys[p]);
    if (active) data.provider = active;
  }
  return data;
}

function hasProviderKey(settings) {
  const keys = (settings && settings.apiKeys) || {};
  return !!(keys.openai || keys.anthropic || keys.gemini || keys.nvidia);
}

module.exports = {
  SCHEMA_VERSION,
  PRIVACY_NOTICE_VERSION,
  DEFAULTS,
  deepMerge,
  clampOpacity,
  migrateSettings,
  normalizeSettings,
  hasProviderKey,
  needsPrivacyAck
};
