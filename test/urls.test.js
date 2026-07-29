const assert = require('node:assert/strict');
const test = require('node:test');
const { isAllowedOpenUrl } = require('../src/urls');

test('allows https docs hosts and system settings schemes', () => {
  assert.equal(isAllowedOpenUrl('https://platform.openai.com/api-keys'), true);
  assert.equal(isAllowedOpenUrl('https://console.anthropic.com'), true);
  assert.equal(isAllowedOpenUrl('https://ai.google.dev/gemini-api/terms'), true);
  assert.equal(isAllowedOpenUrl('ms-settings:privacy-microphone'), true);
  assert.equal(isAllowedOpenUrl('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'), true);
});

test('rejects dangerous or unknown open targets', () => {
  assert.equal(isAllowedOpenUrl('file:///etc/passwd'), false);
  assert.equal(isAllowedOpenUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedOpenUrl('https://evil.example'), false);
  assert.equal(isAllowedOpenUrl(''), false);
  assert.equal(isAllowedOpenUrl(null), false);
});
