// Full-resolution screenshot via desktopCapturer (main process).
// Uses the display under the cursor when possible so multi-monitor setups work.
const { desktopCapturer, screen } = require('electron');

function pickTargetDisplay() {
  try {
    const point = screen.getCursorScreenPoint();
    const underCursor = screen.getDisplayNearestPoint(point);
    if (underCursor) return underCursor;
  } catch (_) { /* fall through */ }
  return screen.getPrimaryDisplay();
}

/**
 * @returns {Promise<{ ok: boolean, dataUrl?: string|null, reason?: string }>}
 */
async function captureScreenshot() {
  const target = pickTargetDisplay();
  const { width, height } = target.size;
  const scale = target.scaleFactor || 1;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.floor(width * scale), height: Math.floor(height * scale) }
  });
  if (!sources.length) return { ok: false, reason: 'no-sources', dataUrl: null };
  const src = sources.find((s) => String(s.display_id) === String(target.id)) || sources[0];
  const img = src.thumbnail;
  if (!img || img.isEmpty()) return { ok: false, reason: 'empty', dataUrl: null };
  return { ok: true, dataUrl: img.toDataURL(), reason: null };
}

module.exports = { captureScreenshot, pickTargetDisplay };
