// Safe markdown subset for Cue responses (escape-first).
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    return '&quot;';
  });
}

function renderMarkdown(text) {
  const lines = String(text || '').split('\n');
  let html = '';
  let inCode = false;
  let inList = false;
  let buf = [];
  const flushP = () => {
    if (buf.length) { html += '<p>' + inline(buf.join(' ')) + '</p>'; buf = []; }
  };
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  for (const raw of lines) {
    const line = raw;
    if (/^```/.test(line.trim())) {
      if (!inCode) {
        flushP();
        if (inList) { html += '</ul>'; inList = false; }
        html += '<pre><code>';
        inCode = true;
      } else {
        html += '</code></pre>';
        inCode = false;
      }
      continue;
    }
    if (inCode) { html += esc(line) + '\n'; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      flushP();
      if (!inList) { html += '<ul>'; inList = true; }
      html += '<li>' + inline(line.replace(/^\s*[-*]\s+/, '')) + '</li>';
      continue;
    }
    if (line.trim() === '') {
      flushP();
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }
    buf.push(line.trim());
  }
  flushP();
  if (inList) html += '</ul>';
  if (inCode) html += '</code></pre>';
  return html;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderMarkdown, esc };
}
if (typeof window !== 'undefined') {
  window.CUE_MARKDOWN = { renderMarkdown, esc };
}
