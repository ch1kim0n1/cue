const assert = require('node:assert/strict');
const test = require('node:test');
const { estimateCallCost, formatUsd, estimateTokens } = require('../src/pricing');
const { renderMarkdown, safeHref } = require('../renderer/markdown');

test('estimateCallCost returns a positive usd estimate', () => {
  const cost = estimateCallCost({
    model: 'gpt-4o-mini',
    inputText: 'hello world '.repeat(100),
    outputText: 'answer '.repeat(50),
    hasImage: true
  });
  assert.ok(cost.usd > 0);
  assert.ok(cost.inTokens > 800);
  assert.match(formatUsd(cost.usd), /^≈ \$/);
});

test('estimateTokens is at least 1', () => {
  assert.equal(estimateTokens(''), 1);
  assert.ok(estimateTokens('abcd') >= 1);
});

test('HiDPI long-edge cap math', () => {
  const MAX = 2560;
  let w = Math.floor(3840 * 2);
  let h = Math.floor(2160 * 2);
  const long = Math.max(w, h);
  const ratio = MAX / long;
  w = Math.floor(w * ratio);
  h = Math.floor(h * ratio);
  assert.ok(Math.max(w, h) <= MAX);
});

test('safeHref rejects javascript: urls', () => {
  assert.equal(safeHref('javascript:alert(1)'), null);
  assert.ok(safeHref('https://example.com/a'));
});

test('renderMarkdown allows https links and escapes others', () => {
  const html = renderMarkdown('[ok](https://example.com) [bad](javascript:alert(1))');
  assert.match(html, /href="https:\/\/example\.com\/?"/);
  assert.doesNotMatch(html, /href=["']javascript:/i);
});
