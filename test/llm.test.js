const assert = require('node:assert/strict');
const test = require('node:test');
const { createLLM } = require('../src/llm');

test('createLLM is not ready without an API key', () => {
  const llm = createLLM({
    provider: 'openai',
    smart: false,
    apiKeys: { openai: '' },
    models: { openai: { fast: 'gpt-4o-mini', smart: 'gpt-4o' } }
  });
  assert.equal(llm.ready, false);
  assert.equal(llm.model, 'gpt-4o-mini');
});

test('createLLM picks the smart model when Smart is on', () => {
  const llm = createLLM({
    provider: 'anthropic',
    smart: true,
    apiKeys: { anthropic: 'sk-ant' },
    models: {
      anthropic: { fast: 'claude-3-5-haiku-latest', smart: 'claude-3-5-sonnet-latest' }
    }
  });
  assert.equal(llm.ready, true);
  assert.equal(llm.provider, 'anthropic');
  assert.equal(llm.model, 'claude-3-5-sonnet-latest');
});

test('createLLM is ready for nvidia with a key and model', () => {
  const llm = createLLM({
    provider: 'nvidia',
    smart: false,
    apiKeys: { nvidia: 'nvapi' },
    models: {
      nvidia: { fast: 'meta/llama-3.2-11b-vision-instruct', smart: 'meta/llama-3.2-90b-vision-instruct' }
    }
  });
  assert.equal(llm.ready, true);
  assert.equal(llm.provider, 'nvidia');
});
