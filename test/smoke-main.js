const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('main process hardens window and IPC surface', () => {
  const src = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  assert.match(src, /sandbox:\s*true/);
  assert.match(src, /setWindowOpenHandler/);
  assert.match(src, /will-navigate/);
  assert.match(src, /isAllowedOpenUrl/);
  assert.match(src, /setupAutoUpdater|autoUpdater/);
  assert.match(src, /uncaughtException/);
  assert.match(src, /listenConsent/);
  for (const channel of [
    'settings:get',
    'settings:set',
    'settings:wipe',
    'capture:permissions',
    'diagnostics:get',
    'app:paths',
    'feature:retry'
  ]) {
    assert.ok(src.includes(channel), 'missing channel ' + channel);
  }
});

test('preload allowlists inbound event channels', () => {
  const src = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
  assert.match(src, /settingsWipe/);
  assert.match(src, /capturePermissions/);
  assert.match(src, /diagnosticsGet/);
  assert.match(src, /'transcript:cleared'/);
});

test('renderer CSP does not load remote fonts', () => {
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.doesNotMatch(html, /fonts\.gstatic\.com/);
  assert.match(html, /fonts\.css/);
  assert.match(html, /privacy-scrim/);
});

test('packaging enables asar and multi-arch mac targets', () => {
  const cfg = fs.readFileSync(path.join(root, 'electron-builder.cjs'), 'utf8');
  assert.match(cfg, /asar:\s*true/);
  assert.match(cfg, /arm64/);
  assert.match(cfg, /x64/);
  assert.match(cfg, /provider:\s*"github"/);
});
