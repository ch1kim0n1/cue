const assert = require('node:assert/strict');
const test = require('node:test');
const { createLogger, redact } = require('../src/logger');
const { encryptApiKeys, decryptApiKeys, looksLikeKey, providerLabel } = require('../src/secrets');
const { friendlyProviderError, withTimeout } = require('../src/errors');

test('redacts API key shaped strings', () => {
  assert.match(redact('token sk-abcdefghijklmnopqrstuvwxyz'), /\[redacted\]/);
  assert.equal(redact({ apiKey: 'sk-secretvalue' }).apiKey, '[redacted]');
});

test('logger writes redacted lines through the sink', () => {
  const lines = [];
  const log = createLogger({ level: 'info', write: (c) => lines.push(c), prefix: 't' });
  log.info('using sk-abcdefghijklmnopqrstuvwxyz');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /\[redacted\]/);
  assert.doesNotMatch(lines[0], /sk-abcdefgh/);
});

test('encrypt/decrypt round-trip with mock safeStorage', () => {
  const fake = {
    isEncryptionAvailable: () => true,
    encryptString: (s) => Buffer.from('ENC:' + s, 'utf8'),
    decryptString: (buf) => buf.toString('utf8').slice(4)
  };
  const packed = encryptApiKeys({ openai: 'sk-test' }, fake);
  assert.equal(packed.encryption, 'safeStorage');
  assert.ok(packed.enc);
  const out = decryptApiKeys({ enc: packed.enc }, fake);
  assert.equal(out.apiKeys.openai, 'sk-test');
});

test('looksLikeKey validates common prefixes', () => {
  assert.equal(looksLikeKey('openai', 'sk-abc').ok, true);
  assert.equal(looksLikeKey('openai', 'nope').ok, false);
  assert.equal(looksLikeKey('anthropic', 'sk-ant-x').ok, true);
  assert.equal(looksLikeKey('gemini', 'AIza123').ok, true);
  assert.equal(looksLikeKey('nvidia', 'nvapi-1').ok, true);
  assert.equal(providerLabel('openai'), 'OpenAI');
});

test('friendlyProviderError maps status codes', () => {
  assert.match(friendlyProviderError({ status: 429 }, 'openai'), /rate-limited/i);
  assert.match(friendlyProviderError({ status: 401 }, 'anthropic'), /rejected/i);
  assert.match(friendlyProviderError({ message: 'ETIMEDOUT' }, 'gemini'), /timed out/i);
});

test('withTimeout rejects slow promises', async () => {
  await assert.rejects(
    () => withTimeout(new Promise(() => {}), 20, 'Slow'),
    /timed out/i
  );
});
