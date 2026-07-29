// Pure shortcut helpers shared by main and tests.

const DEFAULT_ASSIST_SHORTCUT = 'CommandOrControl+Return';

const RESERVED_SHORTCUTS = new Set([
  'commandorcontrol+h',
  'commandorcontrol+shift+x'
]);

function normalizeShortcut(accelerator) {
  return typeof accelerator === 'string' ? accelerator.trim().replace(/\s+/g, '') : '';
}

function isReservedShortcut(accelerator) {
  return RESERVED_SHORTCUTS.has(normalizeShortcut(accelerator).toLowerCase());
}

function validateAssistShortcut(accelerator) {
  const next = normalizeShortcut(accelerator) || DEFAULT_ASSIST_SHORTCUT;
  if (next.length > 80) return { ok: false, error: 'That shortcut is too long.' };
  if (isReservedShortcut(next)) {
    return { ok: false, error: 'That shortcut is reserved by another Cue action.' };
  }
  return { ok: true, accelerator: next };
}

module.exports = {
  DEFAULT_ASSIST_SHORTCUT,
  RESERVED_SHORTCUTS,
  normalizeShortcut,
  isReservedShortcut,
  validateAssistShortcut
};
