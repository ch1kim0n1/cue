// Safe markdown subset for Cue responses (escape-first).
// Supports paragraphs, fenced code, lists, headings, bold, inline code, and http(s) links.
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    return '&quot;';
  });
}

function safeHref(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

function inline(s) {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => {
    const safe = safeHref(href);
    if (!safe) return esc(label) + ' (' + esc(href) + ')';
    return '<a href="' + esc(safe) + '" rel="noreferrer noopener">' + esc(label) + '</a>';
  });
  return out;
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
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushP();
      if (inList) { html += '</ul>'; inList = false; }
      const level = heading[1].length;
      html += '<h' + level + '>' + inline(heading[2]) + '</h' + level + '>';
      continue;
    }
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
  module.exports = { renderMarkdown, esc, safeHref };
}
if (typeof window !== 'undefined') {
  window.CUE_MARKDOWN = { renderMarkdown, esc, safeHref };
}
