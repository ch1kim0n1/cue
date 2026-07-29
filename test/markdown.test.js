const assert = require('node:assert/strict');
const test = require('node:test');
const { renderMarkdown, esc } = require('../renderer/markdown');

test('esc escapes HTML special characters', () => {
  assert.equal(esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(esc('a & "b"'), 'a &amp; &quot;b&quot;');
});

test('renderMarkdown escapes script tags in paragraphs', () => {
  const html = renderMarkdown('Hello <script>alert(1)</script> world');
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('renderMarkdown escapes script tags inside code fences', () => {
  const html = renderMarkdown('```\n<script>alert(1)</script>\n```');
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('renderMarkdown does not turn javascript: links into anchors', () => {
  const html = renderMarkdown('[click](javascript:alert(1))');
  assert.doesNotMatch(html, /href=/i);
  assert.doesNotMatch(html, /<a\b/i);
  assert.match(html, /javascript:alert\(1\)/);
});

test('renderMarkdown escapes angle brackets in lists and bold', () => {
  const html = renderMarkdown('- **bold** <img onerror=alert(1)>\n');
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/i);
  assert.match(html, /<strong>bold<\/strong>/);
});
