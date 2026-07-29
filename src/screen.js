// Screenshot via desktopCapturer (main process), capped for HiDPI / 4K.
// Uses the display under the cursor when possible so multi-monitor setups work.
const { desktopCapturer, screen } = require('electron');

const MAX_LONG_EDGE = 2560;

function pickTargetDisplay() {
  try {
    const point = screen.getCursorScreenPoint();
    const underCursor = screen.getDisplayNearestPoint(point);
    if (underCursor) return underCursor;
  } catch (_) { /* fall through */ }
  return screen.getPrimaryDisplay();
}

/**
 * Cap thumbnail size so 4K@200% does not become a ~100MB data URL.
 * @param {number} width
 * @param {number} height
 * @param {number} scale
 * @returns {{ width: number, height: number }}
 */
function cappedThumbnailSize(width, height, scale) {
  let w = Math.max(1, Math.floor(width * scale));
  let h = Math.max(1, Math.floor(height * scale));
  const long = Math.max(w, h);
  if (long > MAX_LONG_EDGE) {
    const ratio = MAX_LONG_EDGE / long;
    w = Math.max(1, Math.floor(w * ratio));
    h = Math.max(1, Math.floor(h * ratio));
  }
  return { width: w, height: h };
}

/**
 * @returns {Promise<{ ok: boolean, dataUrl?: string|null, reason?: string }>}
 */
async function captureScreenshot() {
  const target = pickTargetDisplay();
  const { width, height } = target.size;
  const scale = target.scaleFactor || 1;
  const thumbnailSize = cappedThumbnailSize(width, height, scale);
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize
  });
  if (!sources.length) return { ok: false, reason: 'no-sources', dataUrl: null };
  const src = sources.find((s) => String(s.display_id) === String(target.id)) || sources[0];
  const img = src.thumbnail;
  if (!img || img.isEmpty()) return { ok: false, reason: 'empty', dataUrl: null };
  return { ok: true, dataUrl: img.toDataURL(), reason: null };
}

module.exports = { captureScreenshot, pickTargetDisplay, cappedThumbnailSize, MAX_LONG_EDGE };
