const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_ASSIST_SHORTCUT,
  normalizeShortcut,
  isReservedShortcut,
  validateAssistShortcut
} = require('../src/shortcuts');

test('normalizes whitespace out of accelerators', () => {
  assert.equal(normalizeShortcut('  CommandOrControl + Return  '), 'CommandOrControl+Return');
  assert.equal(normalizeShortcut(null), '');
});

test('flags reserved Cue shortcuts', () => {
  assert.equal(isReservedShortcut('CommandOrControl+H'), true);
  assert.equal(isReservedShortcut('CommandOrControl+Shift+X'), true);
  assert.equal(isReservedShortcut(DEFAULT_ASSIST_SHORTCUT), false);
});

test('validateAssistShortcut accepts defaults and rejects reserved keys', () => {
  assert.deepEqual(validateAssistShortcut(''), { ok: true, accelerator: DEFAULT_ASSIST_SHORTCUT });
  assert.equal(validateAssistShortcut('CommandOrControl+H').ok, false);
  assert.equal(validateAssistShortcut('a'.repeat(81)).ok, false);
  assert.deepEqual(validateAssistShortcut('Alt+A'), { ok: true, accelerator: 'Alt+A' });
});
