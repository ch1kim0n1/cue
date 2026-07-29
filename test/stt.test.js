const assert = require('node:assert/strict');
const test = require('node:test');
const { createSTT } = require('../src/stt');

test('STT reports unavailable when no audio-capable keys exist', () => {
  const stt = createSTT({ apiKeys: { openai: '', gemini: '', anthropic: 'x' } });
  assert.equal(stt.available, false);
  assert.deepEqual(stt.providers, []);
});

test('STT lists OpenAI then Gemini when both keys exist', () => {
  const stt = createSTT({ apiKeys: { openai: 'sk', gemini: 'AIza' } });
  assert.equal(stt.available, true);
  assert.deepEqual(stt.providers, ['openai', 'gemini']);
});

test('STT returns empty text for tiny PCM buffers without calling providers', async () => {
  const stt = createSTT({ apiKeys: { openai: 'sk' } });
  const res = await stt.transcribe(Buffer.alloc(100));
  assert.deepEqual(res, { text: '' });
});
