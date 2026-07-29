const assert = require('node:assert/strict');
const test = require('node:test');
const {
  platformName,
  isWindows,
  isMac,
  screenPermissionMessage,
  micPermissionHint,
  productName,
  productTagline
} = require('../src/platform');

test('maps platform ids to product names', () => {
  assert.equal(platformName('win32'), 'Windows');
  assert.equal(platformName('darwin'), 'macOS');
  assert.equal(platformName('linux'), 'Linux');
  assert.equal(isWindows('win32'), true);
  assert.equal(isMac('darwin'), true);
  assert.equal(isWindows('darwin'), false);
});

test('permission copy is platform-specific', () => {
  assert.match(screenPermissionMessage('darwin'), /Screen Recording/);
  assert.match(screenPermissionMessage('win32'), /Windows/);
  assert.match(micPermissionHint('win32'), /Microphone/);
  assert.match(micPermissionHint('darwin'), /Privacy & Security/);
});

test('product identity strings stay stable', () => {
  assert.equal(productName(), 'Cue');
  assert.match(productTagline(), /Private AI overlay/);
});
