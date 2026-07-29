// Leveled logger with redaction and optional rotating file sink.

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const SECRET_KEYS = /api[_-]?key|authorization|token|password|secret|sk-[a-z0-9]|sk-ant-|AIza|nvapi-/i;

function redact(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (SECRET_KEYS.test(value) && value.length > 8) return '[redacted]';
    return value.replace(/\b(sk-[A-Za-z0-9_-]{8,}|sk-ant-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{8,}|nvapi-[A-Za-z0-9_-]{8,})\b/g, '[redacted]');
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEYS.test(k) ? '[redacted]' : redact(v);
    }
    return out;
  }
  return value;
}

function formatArgs(args) {
  return args.map((a) => {
    if (typeof a === 'string') return redact(a);
    try { return JSON.stringify(redact(a)); } catch { return String(a); }
  }).join(' ');
}

function createLogger(options = {}) {
  let level = LEVELS[options.level || 'info'] ?? LEVELS.info;
  let writeFile = typeof options.write === 'function' ? options.write : null;
  const prefix = options.prefix || 'cue';

  function log(lvl, args) {
    if ((LEVELS[lvl] ?? 99) > level) return;
    const line = `${new Date().toISOString()} [${prefix}] ${lvl.toUpperCase()} ${formatArgs(args)}`;
    if (lvl === 'error') console.error(line);
    else if (lvl === 'warn') console.warn(line);
    else console.log(line);
    if (writeFile) {
      try { writeFile(line + '\n'); } catch { /* ignore sink errors */ }
    }
  }

  return {
    setLevel(next) { if (LEVELS[next] != null) level = LEVELS[next]; },
    setWriter(fn) { writeFile = fn; },
    error(...args) { log('error', args); },
    warn(...args) { log('warn', args); },
    info(...args) { log('info', args); },
    debug(...args) { log('debug', args); },
    redact
  };
}

module.exports = { createLogger, redact, LEVELS };
