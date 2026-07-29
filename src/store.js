// Simple JSON-file settings store (avoids native modules so npm install stays clean).
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { DEFAULTS, deepMerge, clampOpacity, normalizeSettings } = require('./settings-model');

const FILE = path.join(app.getPath('userData'), 'cue-data.json');

let data = null;

function load() {
  if (data) return data;
  try { data = normalizeSettings(JSON.parse(fs.readFileSync(FILE, 'utf8'))); }
  catch { data = normalizeSettings({}); }
  return data;
}

function save() {
  try { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); } catch (_) { /* ignore */ }
}

module.exports = {
  DEFAULTS,
  deepMerge,
  clampOpacity,
  getSettings() { return load(); },
  setSettings(patch) {
    load();
    data = normalizeSettings(deepMerge(data, patch || {}));
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'opacity')) {
      data.opacity = clampOpacity(patch.opacity);
    }
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'compact')) {
      data.compact = !!patch.compact;
    }
    save();
    return data;
  }
};
