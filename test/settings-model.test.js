const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULTS,
  deepMerge,
  clampOpacity,
  normalizeSettings
} = require('../src/settings-model');

test('deepMerge nests objects without dropping siblings', () => {
  const merged = deepMerge(
    { a: 1, nested: { x: 1, y: 2 }, apiKeys: { openai: '' } },
    { nested: { y: 9 }, apiKeys: { openai: 'sk' } }
  );
  assert.equal(merged.a, 1);
  assert.equal(merged.nested.x, 1);
  assert.equal(merged.nested.y, 9);
  assert.equal(merged.apiKeys.openai, 'sk');
});

test('clampOpacity keeps values inside the UI range', () => {
  assert.equal(clampOpacity(0.2), 0.55);
  assert.equal(clampOpacity(1.4), 1);
  assert.equal(clampOpacity('0.8'), 0.8);
  assert.equal(clampOpacity('nope'), DEFAULTS.opacity);
});

test('normalizeSettings fills defaults and switches provider to a keyed one', () => {
  const settings = normalizeSettings({
    provider: 'openai',
    apiKeys: { openai: '', anthropic: 'sk-ant', gemini: '', nvidia: '' },
    opacity: 0.3,
    compact: 1
  });
  assert.equal(settings.provider, 'anthropic');
  assert.equal(settings.opacity, 0.55);
  assert.equal(settings.compact, true);
  assert.equal(settings.models.openai.fast, DEFAULTS.models.openai.fast);
});
