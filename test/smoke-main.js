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
  assert.match(src, /requestSingleInstanceLock/);
  assert.match(src, /MAX_TRANSCRIPT_TURNS/);
  assert.match(src, /crashReporter/);
  for (const channel of [
    'settings:get',
    'settings:set',
    'settings:wipe',
    'settings:needs-privacy-ack',
    'capture:permissions',
    'diagnostics:get',
    'app:paths',
    'feature:retry',
    'provider:test',
    'update:check-latest',
    'net:set-online'
  ]) {
    assert.ok(src.includes(channel), 'missing channel ' + channel);
  }
});

test('preload allowlists inbound event channels', () => {
  const src = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
  assert.match(src, /settingsWipe/);
  assert.match(src, /settingsNeedsPrivacyAck/);
  assert.match(src, /capturePermissions/);
  assert.match(src, /diagnosticsGet/);
  assert.match(src, /providerTest/);
  assert.match(src, /'transcript:cleared'/);
  assert.match(src, /'update:available'/);
  assert.match(src, /'net:status'/);
});

test('renderer CSP does not load remote fonts', () => {
  const html = fs.readFileSync(path.join(root, 'renderer', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.doesNotMatch(html, /fonts\.gstatic\.com/);
  assert.match(html, /fonts\.css/);
  assert.match(html, /privacy-scrim/);
  assert.match(html, /aria-live="assertive"/);
  assert.match(html, /markdown\.js/);
});

test('packaging enables asar and multi-arch mac targets', () => {
  const cfg = fs.readFileSync(path.join(root, 'electron-builder.cjs'), 'utf8');
  assert.match(cfg, /asar:\s*true/);
  assert.match(cfg, /arm64/);
  assert.match(cfg, /x64/);
  assert.match(cfg, /provider:\s*"github"/);
  assert.match(cfg, /deleteAppDataOnUninstall:\s*false/);
  assert.match(cfg, /installer\.nsh/);
  assert.doesNotMatch(cfg, /certificateFile:\s*hasWinCert\s*\?\s*undefined\s*:\s*undefined/);
});

test('release workflow hard-fails signature verification', () => {
  const yml = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.match(yml, /signtool\.exe/);
  assert.match(yml, /stapler staple/);
  assert.doesNotMatch(yml, /continue-on-error:\s*true/);
});

test('wave4 surfaces cancel and security hardening', () => {
  const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
  assert.match(main, /feature:cancel/);
  assert.match(main, /X-Content-Type-Options/);
  assert.match(main, /csp:report/);
  assert.match(main, /MAX_LONG_EDGE|cappedThumbnailSize|estimateCallCost/);
  const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');
  assert.match(preload, /featureCancel/);
  assert.match(preload, /reportCsp/);
});
