// Pure settings helpers (no Electron) so unit tests can run in plain Node.

const DEFAULTS = {
  provider: 'openai',
  smart: false,
  resumeContext: '',
  opacity: 0.92,
  compact: false,
  shortcuts: { assist: 'CommandOrControl+Return' },
  apiKeys: { openai: '', anthropic: '', gemini: '', deepgram: '', nvidia: '' },
  models: {
    openai: { fast: 'gpt-4o-mini', smart: 'gpt-4o' },
    anthropic: { fast: 'claude-3-5-haiku-latest', smart: 'claude-3-5-sonnet-latest' },
    gemini: { fast: 'gemini-2.5-flash', smart: 'gemini-2.5-pro' },
    nvidia: { fast: 'meta/llama-3.2-11b-vision-instruct', smart: 'meta/llama-3.2-90b-vision-instruct' }
  }
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
  return Math.min(1, Math.max(0.55, n));
}

function normalizeSettings(raw) {
  const data = deepMerge(DEFAULTS, raw || {});
  data.opacity = clampOpacity(data.opacity);
  data.compact = !!data.compact;
  if (!data.apiKeys[data.provider]) {
    const validProviders = ['openai', 'anthropic', 'gemini', 'nvidia'];
    const active = validProviders.find((p) => data.apiKeys[p]);
    if (active) data.provider = active;
  }
  return data;
}

module.exports = { DEFAULTS, deepMerge, clampOpacity, normalizeSettings };
