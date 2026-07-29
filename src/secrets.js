// Encrypt/decrypt API key bags with Electron safeStorage when available.

function encryptApiKeys(apiKeys, safeStorage) {
  const plaintext = JSON.stringify(apiKeys || {});
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    return { enc: null, plain: apiKeys || {}, encryption: 'none' };
  }
  const buf = safeStorage.encryptString(plaintext);
  return { enc: buf.toString('base64'), plain: null, encryption: 'safeStorage' };
}

function decryptApiKeys(payload, safeStorage) {
  if (!payload) return { apiKeys: {}, encryption: 'none', warning: null };
  if (payload.enc && safeStorage && safeStorage.isEncryptionAvailable()) {
    try {
      const raw = safeStorage.decryptString(Buffer.from(payload.enc, 'base64'));
      return { apiKeys: JSON.parse(raw), encryption: 'safeStorage', warning: null };
    } catch (e) {
      return { apiKeys: {}, encryption: 'safeStorage', warning: 'Could not decrypt saved API keys. Re-enter them in Settings.' };
    }
  }
  if (payload.plain && typeof payload.plain === 'object') {
    return { apiKeys: payload.plain, encryption: 'none', warning: null };
  }
  // Legacy: apiKeys stored inline on the settings object
  if (payload.openai !== undefined || payload.anthropic !== undefined) {
    return { apiKeys: payload, encryption: 'legacy', warning: null };
  }
  return { apiKeys: {}, encryption: 'none', warning: null };
}

function providerLabel(provider) {
  const map = { openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Gemini', nvidia: 'Nvidia' };
  return map[provider] || String(provider || 'provider');
}

function looksLikeKey(provider, value) {
  const v = String(value || '').trim();
  if (!v) return { ok: true, empty: true };
  if (provider === 'openai') return { ok: /^sk-/.test(v), empty: false, hint: 'OpenAI keys usually start with sk-' };
  if (provider === 'anthropic') return { ok: /^sk-ant-/.test(v), empty: false, hint: 'Anthropic keys usually start with sk-ant-' };
  if (provider === 'gemini') return { ok: /^AIza/.test(v), empty: false, hint: 'Gemini keys usually start with AIza' };
  if (provider === 'nvidia') return { ok: /^nvapi-/.test(v), empty: false, hint: 'Nvidia keys usually start with nvapi-' };
  return { ok: true, empty: false };
}

module.exports = { encryptApiKeys, decryptApiKeys, providerLabel, looksLikeKey };
