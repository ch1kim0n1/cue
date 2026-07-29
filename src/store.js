// JSON settings store with schema migration, encrypted API keys, and 0600 perms.
const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const { DEFAULTS, deepMerge, clampOpacity, normalizeSettings, SCHEMA_VERSION } = require('./settings-model');
const { encryptApiKeys, decryptApiKeys } = require('./secrets');
const { createLogger } = require('./logger');

const log = createLogger({ prefix: 'store' });

let FILE = path.join(app.getPath('userData'), 'cue-data.json');
let data = null;
let lastSaveError = null;
let encryptionWarning = null;

function dataPath() { return FILE; }

function setFileForTests(nextPath) {
  FILE = nextPath;
  data = null;
  lastSaveError = null;
  encryptionWarning = null;
}

function backupCorrupt(rawText) {
  try {
    const backup = FILE.replace(/\.json$/i, '') + '.corrupt.' + Date.now() + '.json';
    fs.writeFileSync(backup, rawText, { encoding: 'utf8', mode: 0o600 });
    return backup;
  } catch {
    return null;
  }
}

function readDisk() {
  const raw = fs.readFileSync(FILE, 'utf8');
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) {
    const backup = backupCorrupt(raw);
    log.error('corrupt settings file; using defaults', { backup });
    throw Object.assign(new Error('Settings file was corrupt and was reset.'), { code: 'CORRUPT', backup });
  }
  return parsed;
}

function hydrate(parsed) {
  const bag = parsed.apiKeysEnc
    ? { enc: parsed.apiKeysEnc, plain: null }
    : (parsed.apiKeysPlain ? { enc: null, plain: parsed.apiKeysPlain } : parsed.apiKeys);
  const decrypted = decryptApiKeys(bag, safeStorage);
  encryptionWarning = decrypted.warning;
  const merged = { ...parsed, apiKeys: decrypted.apiKeys || {} };
  delete merged.apiKeysEnc;
  delete merged.apiKeysPlain;
  return normalizeSettings(merged);
}

function load() {
  if (data) return data;
  try {
    data = hydrate(readDisk());
  } catch (e) {
    if (e && e.code === 'CORRUPT') {
      data = normalizeSettings({});
      data._storeNotice = e.message + (e.backup ? ' Backup: ' + e.backup : '');
    } else if (e && e.code === 'ENOENT') {
      data = normalizeSettings({});
    } else {
      log.warn('settings load failed', e && e.message);
      data = normalizeSettings({});
    }
  }
  return data;
}

function persistable(snapshot) {
  const out = { ...snapshot };
  const packed = encryptApiKeys(out.apiKeys, safeStorage);
  delete out.apiKeys;
  delete out._storeNotice;
  if (packed.encryption === 'safeStorage') {
    out.apiKeysEnc = packed.enc;
    delete out.apiKeysPlain;
  } else {
    out.apiKeysPlain = packed.plain;
    delete out.apiKeysEnc;
    log.warn('safeStorage unavailable; API keys stored in plaintext');
  }
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

function save() {
  lastSaveError = null;
  try {
    const payload = JSON.stringify(persistable(data), null, 2);
    fs.writeFileSync(FILE, payload, { encoding: 'utf8', mode: 0o600 });
    try { fs.chmodSync(FILE, 0o600); } catch { /* windows may ignore */ }
    return { ok: true };
  } catch (e) {
    lastSaveError = e && e.message ? e.message : String(e);
    log.error('settings save failed', lastSaveError);
    return { ok: false, error: lastSaveError };
  }
}

function getSettings() {
  const settings = { ...load() };
  if (encryptionWarning) settings._encryptionWarning = encryptionWarning;
  if (lastSaveError) settings._saveError = lastSaveError;
  settings._dataPath = FILE;
  return settings;
}

function setSettings(patch) {
  load();
  data = normalizeSettings(deepMerge(data, patch || {}));
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'opacity')) {
    data.opacity = clampOpacity(patch.opacity);
  }
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'compact')) {
    data.compact = !!patch.compact;
  }
  const result = save();
  const out = getSettings();
  if (!result.ok) out._saveError = result.error;
  return out;
}

function wipeUserData() {
  data = normalizeSettings({});
  try {
    if (fs.existsSync(FILE)) fs.unlinkSync(FILE);
  } catch (e) {
    log.error('wipe failed', e && e.message);
    return { ok: false, error: e && e.message };
  }
  const result = save();
  return result.ok ? { ok: true } : result;
}

module.exports = {
  DEFAULTS,
  deepMerge,
  clampOpacity,
  dataPath,
  getSettings,
  setSettings,
  wipeUserData,
  setFileForTests,
  _resetForTests() { data = null; lastSaveError = null; encryptionWarning = null; }
};
