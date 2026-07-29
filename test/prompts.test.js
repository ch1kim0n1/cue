const assert = require('node:assert/strict');
const test = require('node:test');
const { MODES, formatTranscript } = require('../src/prompts');

test('formats transcript speakers and preserves chronological order', () => {
  const transcript = [
    { channel: 'you', text: 'Hello' },
    { channel: 'them', text: 'Hi there' },
    { channel: 'you', text: 'How are you?' }
  ];

  assert.equal(formatTranscript(transcript), 'You: Hello\nThem: Hi there\nYou: How are you?');
});

test('limits transcript formatting to the most recent turns', () => {
  const transcript = [
    { channel: 'them', text: 'Earlier' },
    { channel: 'you', text: 'Middle' },
    { channel: 'them', text: 'Latest' }
  ];

  assert.equal(formatTranscript(transcript, 2), 'You: Middle\nThem: Latest');
});

test('builds an ask prompt from user text and recent conversation', () => {
  const prompt = MODES.ask.build({
    transcript: [{ channel: 'them', text: 'Can you send that today?' }],
    userText: 'Draft a concise reply.'
  });

  assert.match(prompt, /Them: Can you send that today\?/);
  assert.match(prompt, /Question: Draft a concise reply\./);
});

test('builds an empty-state prompt when no conversation has been captured', () => {
  const prompt = MODES.say.build({ transcript: [] });

  assert.match(prompt, /nothing heard yet/);
  assert.match(prompt, /What should I say next\?/);
});

test('assist and leetcode modes request the screen', () => {
  assert.equal(MODES.assist.needsScreen, true);
  assert.equal(MODES.leetcode.needsScreen, true);
  assert.equal(MODES.say.needsScreen, false);
});

test('recap uses the full transcript without a limit slice', () => {
  const transcript = Array.from({ length: 5 }, (_, i) => ({ channel: 'you', text: 't' + i }));
  const prompt = MODES.recap.build({ transcript });
  assert.match(prompt, /You: t0/);
  assert.match(prompt, /You: t4/);
});
