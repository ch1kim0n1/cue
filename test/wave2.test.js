const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseWindowsBuild,
  supportsContentProtection,
  contentProtectionWarning,
  screenshotFailureMessage
} = require('../src/capabilities');
const { withRetry, isRetryableError } = require('../src/retry');
const { MODES } = require('../src/prompts');
const { needsPrivacyAck, PRIVACY_NOTICE_VERSION } = require('../src/settings-model');

test('Windows build parsing and content-protection gate', () => {
  assert.equal(parseWindowsBuild('10.0.19041'), 19041);
  assert.equal(supportsContentProtection('win32', '10.0.18363'), false);
  assert.equal(supportsContentProtection('win32', '10.0.19045'), true);
  assert.equal(supportsContentProtection('darwin', '23.0.0'), true);
  assert.match(contentProtectionWarning('win32', '10.0.18363'), /2004/);
  assert.equal(contentProtectionWarning('win32', '10.0.19045'), null);
});

test('screenshot failure copy distinguishes RDP/no-sources', () => {
  assert.match(screenshotFailureMessage({ ok: false, reason: 'no-sources' }), /Remote Desktop/);
  assert.match(screenshotFailureMessage({ ok: false, reason: 'empty' }), /empty/);
});

test('retry helper retries 429 then succeeds', async () => {
  let n = 0;
  const out = await withRetry(async () => {
    n += 1;
    if (n === 1) {
      const err = new Error('rate');
      err.status = 429;
      throw err;
    }
    return 'ok';
  }, { retries: 1, delays: [1, 1] });
  assert.equal(out, 'ok');
  assert.equal(n, 2);
  assert.equal(isRetryableError({ status: 500 }), true);
  assert.equal(isRetryableError({ status: 400 }), false);
});

test('modes declare maxTokens budgets', () => {
  assert.equal(MODES.say.maxTokens, 1024);
  assert.equal(MODES.followup.maxTokens, 1024);
  assert.equal(MODES.recap.maxTokens, 1024);
  assert.equal(MODES.assist.maxTokens, 4096);
  assert.equal(MODES.leetcode.maxTokens, 4096);
});

test('privacy notice version re-gates acknowledgment', () => {
  assert.equal(needsPrivacyAck({ privacyAck: true, privacyNoticeVersion: 1 }), true);
  assert.equal(needsPrivacyAck({ privacyAck: true, privacyNoticeVersion: PRIVACY_NOTICE_VERSION }), false);
  assert.equal(needsPrivacyAck({ privacyAck: false }), true);
});
