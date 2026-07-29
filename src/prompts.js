// Feature definitions: each mode picks which inputs to attach and how to prompt.
// ctx = { transcript: [{channel:'you'|'them', text}], userText }

function formatTranscript(turns, limit) {
  const recent = limit ? turns.slice(-limit) : turns;
  return recent.map((t) => (t.channel === 'them' ? 'Them: ' : 'You: ') + t.text).join('\n');
}

const MODES = {
  assist: {
    needsScreen: true,
    userBubble: null,
    small: false,
    maxTokens: 4096,
    system:
      'You are Cue, a discreet real-time copilot overlaid on the user\'s screen during a call or coding session. ' +
      'Look at the screenshot and the recent conversation, decide what the user needs right now, and deliver it directly with no preamble. ' +
      'If the screen shows a coding problem: give a short approach, then a correct solution in a fenced code block, then time and space complexity. ' +
      'If it is a conversation: answer the current question or say exactly what the user should say next, in the first person. ' +
      'Be concise and confident. Never say "I can see" or describe the screenshot.',
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 12);
      return 'Recent conversation:\n' + (t || '(none)') + '\n\nRespond with what I need right now.';
    }
  },

  say: {
    needsScreen: false,
    userBubble: 'What should I say?',
    small: false,
    maxTokens: 1024,
    system:
      'You are Cue, whispering suggested replies to the user during a live conversation. ' +
      '"Them" is the other person; "You" is the user. Based on what Them just said and what You already said, ' +
      'draft ONE short, natural, confident reply the user can say out loud, in the first person. No quotes, no preamble, 1 to 3 sentences.',
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 14);
      return 'Conversation so far:\n' + (t || '(nothing heard yet; the user opened Cue without audio)') +
        '\n\nWhat should I say next?';
    }
  },

  followup: {
    needsScreen: false,
    userBubble: 'Follow-up questions',
    small: true,
    maxTokens: 1024,
    system:
      'You are Cue. Given the conversation, suggest 2 to 4 sharp, relevant follow-up questions the user could ask next ' +
      'to sound engaged and drive the discussion. Return them as a short bullet list, nothing else.',
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 20);
      return 'Conversation so far:\n' + (t || '(none)') + '\n\nSuggest follow-up questions.';
    }
  },

  recap: {
    needsScreen: false,
    userBubble: 'Recap',
    small: true,
    maxTokens: 1024,
    system:
      'You are Cue. Summarize the conversation so far for someone who joined late: ' +
      'a few key points, any decisions, and action items. Use short bullets under bold headers. Be brief.',
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 0);
      return 'Full transcript:\n' + (t || '(nothing captured yet)') + '\n\nRecap this.';
    }
  },

  ask: {
    needsScreen: true,
    userBubble: null,
    small: false,
    maxTokens: 4096,
    system:
      'You are Cue, a real-time copilot with access to the user\'s screen and live conversation. ' +
      'Answer the user\'s question directly and concisely, grounded in what is on screen and what was said. No preamble.',
    build(ctx) {
      const t = formatTranscript(ctx.transcript, 12);
      return (t ? 'Recent conversation:\n' + t + '\n\n' : '') + 'Question: ' + ctx.userText;
    }
  },

  leetcode: {
    needsScreen: true,
    userBubble: 'Solve what\'s on screen',
    small: false,
    maxTokens: 4096,
    system:
      'You are an expert competitive programmer. The screenshot contains a coding problem. ' +
      'Respond with: (1) a one-line restatement, (2) a short approach, (3) a clean, correct, idiomatic solution in a fenced code block ' +
      '(use the language shown on screen, else Python), (4) time and space complexity.',
    build() { return 'Solve the coding problem shown in the screenshot.'; }
  }
};

module.exports = { MODES, formatTranscript };
