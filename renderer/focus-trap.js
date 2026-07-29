/* Minimal focus trap for modal dialogs. */
(function (global) {
  function focusable(root) {
    return Array.from(root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  function trapFocus(root, options) {
    options = options || {};
    const previouslyFocused = document.activeElement;
    const nodes = focusable(root);
    const initial = options.initialFocus
      ? root.querySelector(options.initialFocus)
      : (nodes[0] || root);
    if (initial && typeof initial.focus === 'function') {
      try { initial.focus(); } catch (_) { /* ignore */ }
    }

    function onKeyDown(e) {
      if (e.key !== 'Tab') return;
      const list = focusable(root);
      if (!list.length) {
        e.preventDefault();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    root.addEventListener('keydown', onKeyDown);

    return function release() {
      root.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try { previouslyFocused.focus(); } catch (_) { /* ignore */ }
      }
    };
  }

  global.CUE_FOCUS = { trapFocus };
})(window);
