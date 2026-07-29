const {
  app, BrowserWindow, ipcMain, globalShortcut, screen, session,
  desktopCapturer, shell, systemPreferences, crashReporter, net
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const store = require('./src/store');
const { captureScreenshot } = require('./src/screen');
const { createSTT } = require('./src/stt');
const { createLLM } = require('./src/llm');
const { MODES } = require('./src/prompts');
const { appendResumeContext } = require('./src/profile-context');
const { rms16 } = require('./src/wav');
const { DEFAULT_ASSIST_SHORTCUT, validateAssistShortcut } = require('./src/shortcuts');
const { screenPermissionMessage, isMac, isWindows } = require('./src/platform');
const { isAllowedOpenUrl } = require('./src/urls');
const { friendlyProviderError, withTimeout } = require('./src/errors');
const { providerLabel, looksLikeKey } = require('./src/secrets');
const { createLogger } = require('./src/logger');
const { hasProviderKey, needsPrivacyAck, PRIVACY_NOTICE_VERSION } = require('./src/settings-model');
const { contentProtectionWarning, screenshotFailureMessage } = require('./src/capabilities');
const { estimateCallCost, formatUsd } = require('./src/pricing');
require('./src/types');

const FEATURE_TIMEOUT_MS = 45000;
const STT_TIMEOUT_MS = 30000;
const FEATURE_COOLDOWN_MS = 400;
const CONNECT_TIMEOUT_MS = 2000;
const MAX_BUFFER_BYTES = 16000 * 2 * 30;
const MAX_TRANSCRIPT_TURNS = 500;
const MAX_RECENT_FEATURES = 10;
const MEMORY_WARN_PERCENT = 8;
const FLUSH_MS = 3500;
const MIN_BYTES = Math.floor(16000 * 2 * 0.6);
const RMS_GATE = 240;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let win = null;
let registeredAssistShortcut = null;
let lastFeature = null;
let lastFeatureAt = 0;
let lastError = null;
let flushTimer = null;
let logStream = null;
let memoryTimer = null;
let pendingUpdate = null;
let autoUpdaterRef = null;
let boundsSaveTimer = null;
let featureAbort = null;
let sessionSpend = 0;

const state = { capturing: false, busy: false, transcribing: { you: false, them: false }, offline: false };
let sttDisabled = false;
const buffers = { you: [], them: [] };
const transcript = [];

const log = createLogger({
  prefix: 'cue',
  level: process.env.CUE_LOG_LEVEL || 'info'
});

function attachLogFile() {
  try {
    const logPath = path.join(app.getPath('userData'), 'cue.log');
    logStream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8', mode: 0o600 });
    log.setWriter((chunk) => {
      if (logStream) logStream.write(chunk);
      try {
        const stat = fs.statSync(logPath);
        if (stat.size > 2 * 1024 * 1024) {
          logStream.end();
          const rotated = logPath + '.1';
          try { fs.renameSync(logPath, rotated); } catch { /* ignore */ }
          logStream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8', mode: 0o600 });
        }
      } catch { /* ignore */ }
    });
    log.info('log file attached', logPath);
  } catch (e) {
    log.warn('could not open log file', e && e.message);
  }
}

function send(channel, data) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, data);
}

function pushTranscript(turn) {
  transcript.push(turn);
  while (transcript.length > MAX_TRANSCRIPT_TURNS) transcript.shift();
}

function pushBuffer(channel, buf) {
  const list = buffers[channel];
  list.push(buf);
  let total = 0;
  for (const chunk of list) total += chunk.length;
  while (total > MAX_BUFFER_BYTES && list.length) {
    total -= list.shift().length;
  }
}

function mediaAccessStatus() {
  const out = { microphone: 'unknown', screen: 'unknown', platform: process.platform };
  if (!isMac()) return out;
  try {
    out.microphone = systemPreferences.getMediaAccessStatus('microphone');
    out.screen = systemPreferences.getMediaAccessStatus('screen');
  } catch (e) {
    log.warn('media access status failed', e && e.message);
  }
  return out;
}

function clampBoundsToDisplay(bounds) {
  if (!bounds || typeof bounds !== 'object') return null;
  const displays = screen.getAllDisplays();
  const matches = displays.some((d) => {
    const a = d.workArea;
    return bounds.x < a.x + a.width && bounds.x + Math.min(bounds.width || 100, a.width) > a.x &&
      bounds.y < a.y + a.height && bounds.y + Math.min(bounds.height || 100, a.height) > a.y;
  });
  if (!matches) return null;
  return {
    width: Math.max(480, Math.min(Number(bounds.width) || 720, 1600)),
    height: Math.max(360, Math.min(Number(bounds.height) || 640, 1200)),
    x: Math.round(Number(bounds.x)),
    y: Math.round(Number(bounds.y))
  };
}

function scheduleBoundsSave() {
  if (!win || win.isDestroyed()) return;
  clearTimeout(boundsSaveTimer);
  boundsSaveTimer = setTimeout(() => {
    if (!win || win.isDestroyed()) return;
    const b = win.getBounds();
    store.setSettings({ windowBounds: b });
  }, 400);
}

function focusExistingWindow() {
  if (!win || win.isDestroyed()) {
    createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  send('capture:state', { active: state.capturing });
}

function createWindow() {
  const settings = store.getSettings();
  const saved = clampBoundsToDisplay(settings.windowBounds);
  const { workArea } = screen.getPrimaryDisplay();
  const defaults = {
    width: 720,
    height: 640,
    x: Math.round(workArea.x + (workArea.width - 720) / 2),
    y: workArea.y + 8
  };
  const bounds = saved || defaults;

  win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    fullscreenable: false,
    thickFrame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  win.setContentProtection(!process.env.CUE_NO_PROTECT);

  if (isMac()) {
    win.setAlwaysOnTop(true, 'screen-saver', 1);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    if (typeof win.setHiddenInMissionControl === 'function') win.setHiddenInMissionControl(true);
  } else if (isWindows()) {
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setBackgroundColor('#00000000');
  } else {
    win.setAlwaysOnTop(true);
  }

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      log.warn('blocked navigation', url);
    }
  });

  win.on('move', scheduleBoundsSave);
  win.on('resize', scheduleBoundsSave);

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => win.showInactive());
  win.webContents.on('render-process-gone', (_e, details) => {
    log.error('renderer gone', details);
    lastError = 'Renderer crashed: ' + (details && details.reason);
    const dumpDir = app.getPath('crashDumps');
    send('status', { message: 'Cue hit a display error and is recovering. Crash dumps: ' + dumpDir });
    setTimeout(() => {
      if (!win || win.isDestroyed()) createWindow();
      else win.reload();
    }, 400);
  });
}

function checkMemoryPressure() {
  try {
    if (typeof process.getSystemMemoryInfo !== 'function') return;
    const info = process.getSystemMemoryInfo();
    if (!info || !info.total) return;
    const freePct = (info.free / info.total) * 100;
    if (freePct < MEMORY_WARN_PERCENT && state.capturing) {
      setCapturing(false);
      send('status', { message: 'Listening stopped: system memory is low. Free RAM and try again.' });
    }
  } catch (e) {
    log.debug('memory check failed', e && e.message);
  }
}

async function flushChannel(channel) {
  if (state.transcribing[channel]) return;
  const chunks = buffers[channel];
  if (!chunks.length) return;
  const pcm = Buffer.concat(chunks);
  buffers[channel] = [];
  if (pcm.length < MIN_BYTES) return;
  if (rms16(pcm) < RMS_GATE) return;

  state.transcribing[channel] = true;
  try {
    const settings = store.getSettings();
    const stt = createSTT(settings);
    if (!stt.available) {
      if (!sttDisabled) {
        sttDisabled = true;
        send('status', { message: 'No transcription key set. Add an OpenAI (Whisper) or Gemini key in Settings to enable listening.' });
      }
      return;
    }
    const res = await withTimeout(stt.transcribe(pcm), STT_TIMEOUT_MS, 'Transcription');
    if (res.error) {
      handleSttError(res.error);
      return;
    }
    if (res.text && res.text.trim()) {
      const turn = { channel, text: res.text.trim(), ts: Date.now() };
      pushTranscript(turn);
      send('transcript', turn);
    }
  } catch (e) {
    lastError = friendlyProviderError(e, 'stt');
    log.error('stt flush failed', e && e.message);
    send('status', { message: lastError });
  } finally {
    state.transcribing[channel] = false;
  }
}

function handleSttError(err) {
  log.error('stt error', { provider: err.provider, status: err.status, code: err.code });
  if (sttDisabled) return;
  const noAccess = err.status === 403 || err.status === 401 || err.code === 'model_not_found';
  if (noAccess || err.status === 429) sttDisabled = true;
  lastError = friendlyProviderError(err, err.provider);
  if (err.status === 401) {
    send('status', {
      message: 'Your ' + providerLabel(err.provider) +
        ' key may have expired or been revoked. Open Settings to update it.'
    });
    send('settings:open', {});
  } else if (noAccess) {
    send('status', {
      message: 'Transcription off: your ' + providerLabel(err.provider) +
        ' key cannot use speech-to-text. Screen and coding help still work. Enable Whisper access or add a Gemini key.'
    });
  } else {
    send('status', { message: lastError });
  }
}

function startFlushLoop() {
  if (flushTimer) return;
  flushTimer = setInterval(() => { flushChannel('you'); flushChannel('them'); }, FLUSH_MS);
  if (!memoryTimer) memoryTimer = setInterval(checkMemoryPressure, 15000);
}

function stopFlushLoop() {
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
}

function setCapturing(active) {
  const settings = store.getSettings();
  if (active && !settings.listenConsent) {
    send('status', { message: 'Confirm meeting-audio consent in Settings before listening.' });
    return false;
  }
  if (active && state.offline) {
    send('status', { message: 'Cue is offline. Listening needs a network connection for transcription.' });
    return false;
  }
  if (active && isMac()) {
    const access = mediaAccessStatus();
    if (access.microphone === 'denied') {
      send('status', { message: 'Microphone access is denied. Enable Cue in System Settings > Privacy & Security > Microphone.' });
      return false;
    }
    if (access.screen === 'denied') {
      send('status', { message: screenPermissionMessage() });
      return false;
    }
  }

  state.capturing = !!active;
  if (state.capturing) startFlushLoop();
  else {
    stopFlushLoop();
    buffers.you = [];
    buffers.them = [];
  }
  send('capture:state', { active: state.capturing });
  return state.capturing;
}

function clearTranscript() {
  transcript.length = 0;
  buffers.you = [];
  buffers.them = [];
  send('transcript:cleared', {});
  return { ok: true };
}

function probeHost(hostname, timeoutMs) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname,
      path: '/',
      method: 'HEAD',
      timeout: timeoutMs
    }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function ensureOnline(provider) {
  if (state.offline) {
    const err = Object.assign(new Error('Cue is offline'), { code: 'ENOTFOUND', network: true });
    throw err;
  }
  const hosts = {
    openai: 'api.openai.com',
    anthropic: 'api.anthropic.com',
    gemini: 'generativelanguage.googleapis.com',
    nvidia: 'integrate.api.nvidia.com'
  };
  const host = hosts[provider] || 'api.openai.com';
  const ok = await withTimeout(probeHost(host, CONNECT_TIMEOUT_MS), CONNECT_TIMEOUT_MS + 200, 'Connectivity');
  if (!ok) {
    throw Object.assign(new Error('Could not reach ' + host), { code: 'ENOTFOUND', network: true });
  }
}

async function runFeature(mode, userText) {
  if (state.busy) return;
  const now = Date.now();
  if (now - lastFeatureAt < FEATURE_COOLDOWN_MS) return;
  const def = MODES[mode];
  if (!def) return;
  state.busy = true;
  lastFeatureAt = now;
  lastFeature = { mode, userText: userText || '' };
  if (featureAbort) {
    try { featureAbort.abort(); } catch { /* ignore */ }
  }
  featureAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const signal = featureAbort && featureAbort.signal;
  let imageDataUrl = null;
  let fullText = '';
  try {
    const settings = store.getSettings();
    const llm = createLLM(settings);
    const userBubble = def.userBubble !== null ? def.userBubble : (mode === 'ask' ? userText : null);
    send('llm:start', { userBubble, small: !!def.small });

    if (!llm.ready) {
      const msg = 'Add your ' + providerLabel(settings.provider) + ' API key in Settings to start. Model: ' + (llm.model || 'unset') + '.';
      lastError = msg;
      send('llm:error', { message: msg });
      return;
    }

    if (state.offline) {
      const msg = 'Cue is offline. Reconnect to use Assist and other AI features.';
      lastError = msg;
      send('status', { message: msg, kind: 'network' });
      send('llm:error', { message: msg, kind: 'network' });
      return;
    }

    try {
      await ensureOnline(settings.provider);
    } catch (e) {
      const msg = friendlyProviderError(e, settings.provider);
      lastError = msg;
      send('status', { message: msg, kind: 'network' });
      send('llm:error', { message: msg, kind: 'network' });
      return;
    }

    if (def.needsScreen) {
      try {
        const shot = await captureScreenshot();
        if (!shot.ok) {
          send('status', { message: screenshotFailureMessage(shot) || screenPermissionMessage() });
        } else {
          imageDataUrl = shot.dataUrl;
        }
      } catch (e) {
        log.error('screenshot failed', e && e.message);
        send('status', { message: screenPermissionMessage() });
      }
    }

    const built = def.build({ transcript, userText: userText || '' });
    const system = appendResumeContext(def.system, settings.resumeContext);
    fullText = await withTimeout(llm.stream({
      system,
      turns: [{ role: 'user', text: built }],
      imageDataUrl,
      maxTokens: def.maxTokens || 4096,
      signal,
      onToken: (t) => send('llm:token', { text: t })
    }), FEATURE_TIMEOUT_MS, 'Model response');

    const cost = estimateCallCost({
      model: llm.model,
      inputText: system + '\n' + built,
      outputText: fullText,
      hasImage: !!imageDataUrl
    });
    sessionSpend += cost.usd;
    const lifetime = Number(settings.lifetimeSpend) || 0;
    const recent = Array.isArray(settings.recentFeatures) ? settings.recentFeatures.slice() : [];
    recent.unshift({ mode, userText: userText || '', at: Date.now() });
    while (recent.length > MAX_RECENT_FEATURES) recent.pop();
    store.setSettings({
      lifetimeSpend: lifetime + cost.usd,
      recentFeatures: recent
    });
    send('llm:cost', {
      usd: cost.usd,
      label: formatUsd(cost.usd),
      sessionSpend,
      lifetimeSpend: lifetime + cost.usd
    });

    if (llm.usedFallback && llm.fallbackModel) {
      send('status', {
        message: 'Model unavailable; used fallback ' + llm.fallbackModel + '. Update Models in Settings.'
      });
    }
    send('llm:done', {});
  } catch (e) {
    if (e && (e.name === 'AbortError' || e.code === 'ABORT_ERR' || /cancelled|aborted/i.test(String(e.message || '')))) {
      send('llm:error', { message: 'Cancelled.', kind: 'cancel' });
      return;
    }
    const settings = store.getSettings();
    lastError = friendlyProviderError(e, settings.provider);
    log.error('feature failed', mode, e && e.message);
    if (e && (e.status === 401 || e.statusCode === 401)) {
      send('status', {
        message: 'Your ' + providerLabel(settings.provider) +
          ' key may have expired or been revoked. Open Settings to update it.'
      });
      send('settings:open', {});
    }
    const kind = (e && (e.network || e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED')) ? 'network' : 'error';
    send('llm:error', { message: lastError, kind });
    if (kind === 'network') send('status', { message: lastError, kind: 'network' });
  } finally {
    imageDataUrl = null;
    featureAbort = null;
    state.busy = false;
  }
}

function cancelFeature() {
  if (featureAbort) {
    try { featureAbort.abort(); } catch { /* ignore */ }
  }
  return { ok: true, busy: state.busy };
}

async function testProviderConnection(provider) {
  const settings = store.getSettings();
  const key = (settings.apiKeys || {})[provider];
  if (!key) return { ok: false, error: 'No ' + providerLabel(provider) + ' key saved.' };
  const format = looksLikeKey(provider, key);
  if (!format.ok) return { ok: false, error: format.hint || 'Key format looks wrong.', warn: true };
  try {
    await ensureOnline(provider);
    if (provider === 'openai' || provider === 'nvidia') {
      const OpenAI = require('openai');
      const client = new OpenAI({
        apiKey: key,
        baseURL: provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' : undefined
      });
      await withTimeout(client.models.list(), 8000, 'Connection test');
      return { ok: true, message: providerLabel(provider) + ' connection ok.' };
    }
    if (provider === 'anthropic') {
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: key });
      await withTimeout(client.messages.create({
        model: (settings.models.anthropic && settings.models.anthropic.fast) || 'claude-3-5-haiku-latest',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      }), 8000, 'Connection test');
      return { ok: true, message: 'Anthropic connection ok.' };
    }
    if (provider === 'gemini') {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey: key });
      await withTimeout(ai.models.generateContent({
        model: (settings.models.gemini && settings.models.gemini.fast) || 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
      }), 8000, 'Connection test');
      return { ok: true, message: 'Gemini connection ok.' };
    }
    return { ok: false, error: 'Unknown provider.' };
  } catch (e) {
    return { ok: false, error: friendlyProviderError(e, provider) };
  }
}

function diagnostics() {
  const settings = store.getSettings();
  let memory = null;
  let cpu = null;
  try {
    if (typeof process.getSystemMemoryInfo === 'function') memory = process.getSystemMemoryInfo();
  } catch { /* ignore */ }
  try {
    if (typeof process.getCPUUsage === 'function') cpu = process.getCPUUsage();
  } catch { /* ignore */ }
  return {
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    provider: settings.provider,
    model: ((settings.models || {})[settings.provider] || {})[settings.smart ? 'smart' : 'fast'] || null,
    hasKey: hasProviderKey(settings),
    capturing: state.capturing,
    busy: state.busy,
    offline: state.offline,
    lastError,
    dataPath: store.dataPath(),
    media: mediaAccessStatus(),
    encryptionWarning: settings._encryptionWarning || null,
    saveError: settings._saveError || null,
    crashDumps: app.getPath('crashDumps'),
    logPath: path.join(app.getPath('userData'), 'cue.log'),
    pendingUpdate: pendingUpdate,
    memory,
    cpu,
    sessionSpend,
    lifetimeSpend: Number(settings.lifetimeSpend) || 0,
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION
  };
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    log.info('auto-update skipped (dev); checking GitHub latest');
    setTimeout(() => {
      checkLatestRelease().then((info) => {
        if (info && info.ok && info.newer) {
          send('status', { message: 'Cue ' + info.latest + ' is available — download from GitHub Releases.' });
        }
      }).catch(() => {});
    }, 2500);
    return;
  }
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdaterRef = autoUpdater;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    const settings = store.getSettings();
    autoUpdater.allowPrerelease = !!settings.betaUpdates;
    autoUpdater.on('error', (err) => log.warn('updater error', err && err.message));
    autoUpdater.on('update-available', (info) => {
      pendingUpdate = { version: info && info.version, state: 'available' };
      log.info('update available', info && info.version);
      send('update:available', pendingUpdate);
    });
    autoUpdater.on('update-downloaded', (info) => {
      pendingUpdate = { version: info && info.version, state: 'downloaded' };
      log.info('update downloaded', info && info.version);
      send('update:downloaded', pendingUpdate);
    });
    autoUpdater.checkForUpdates().catch((e) => log.warn('update check failed', e && e.message));
  } catch (e) {
    log.warn('autoUpdater unavailable', e && e.message);
  }
}

function applySecurityHeaders() {
  try {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...(details.responseHeaders || {}) };
      headers['X-Content-Type-Options'] = ['nosniff'];
      headers['X-Frame-Options'] = ['DENY'];
      headers['Referrer-Policy'] = ['no-referrer'];
      callback({ responseHeaders: headers });
    });
  } catch (e) {
    log.warn('security headers unavailable', e && e.message);
  }
}

function applyLoginItem(enabled) {
  try {
    app.setLoginItemSettings({ openAtLogin: !!enabled, openAsHidden: true });
  } catch (e) {
    log.warn('setLoginItemSettings failed', e && e.message);
  }
}

function checkLatestRelease() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.github.com',
      path: '/repos/ch1kim0n1/cue/releases/latest',
      method: 'GET',
      headers: { 'User-Agent': 'cue-updater', Accept: 'application/vnd.github+json' },
      timeout: 5000
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          const tag = String(json.tag_name || '').replace(/^v/i, '');
          const current = app.getVersion();
          const newer = !!(tag && tag !== current && tag.localeCompare(current, undefined, { numeric: true, sensitivity: 'base' }) > 0);
          resolve({
            ok: true,
            tag: json.tag_name || null,
            latest: tag || null,
            newer,
            url: json.html_url || 'https://github.com/ch1kim0n1/cue/releases',
            current
          });
        } catch (e) {
          resolve({ ok: false, error: 'Could not parse GitHub release response.' });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'GitHub release check timed out.' }); });
    req.on('error', () => resolve({ ok: false, error: 'Could not reach GitHub releases.' }));
    req.end();
  });
}

if (gotLock) {
  app.on('second-instance', () => {
    focusExistingWindow();
  });

  /** @returns {object} */
  ipcMain.handle('settings:get', () => store.getSettings());
  /**
   * @param {Electron.IpcMainInvokeEvent} _e
   * @param {object} patch
   * @returns {object}
   */
  ipcMain.handle('settings:set', (_e, patch) => {
    sttDisabled = false;
    const next = store.setSettings(patch);
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'openAtLogin')) {
      applyLoginItem(next.openAtLogin);
    }
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'betaUpdates') && autoUpdaterRef) {
      autoUpdaterRef.allowPrerelease = !!next.betaUpdates;
    }
    if (next._saveError) send('status', { message: 'Could not save settings: ' + next._saveError });
    return next;
  });
  /** @returns {{ ok: boolean, error?: string }} */
  ipcMain.handle('settings:wipe', () => {
    clearTranscript();
    sessionSpend = 0;
    const result = store.wipeUserData();
    sttDisabled = false;
    lastFeature = null;
    return result;
  });
  /** @returns {boolean} */
  ipcMain.handle('settings:needs-privacy-ack', () => needsPrivacyAck(store.getSettings()));
  /** @returns {number} */
  ipcMain.handle('settings:privacy-version', () => PRIVACY_NOTICE_VERSION);
  /**
   * @param {Electron.IpcMainInvokeEvent} _e
   * @param {string} accelerator
   * @returns {{ ok: boolean, accelerator?: string, error?: string }}
   */
  ipcMain.handle('shortcut:assist:set', (_e, accelerator) => setAssistShortcut(accelerator));
  /** @returns {boolean} */
  ipcMain.handle('capture:toggle', () => setCapturing(!state.capturing));
  /** @returns {{ active: boolean }} */
  ipcMain.handle('capture:state', () => ({ active: state.capturing }));
  /** @returns {{ microphone: string, screen: string, platform: string }} */
  ipcMain.handle('capture:permissions', () => mediaAccessStatus());
  /** @returns {import('./src/types').TranscriptTurn[]} */
  ipcMain.handle('transcript:get', () => transcript.slice());
  /** @returns {{ ok: boolean }} */
  ipcMain.handle('transcript:clear', () => clearTranscript());
  /** @returns {object} */
  ipcMain.handle('diagnostics:get', () => diagnostics());
  /**
   * @param {Electron.IpcMainInvokeEvent} _e
   * @param {string} provider
   * @returns {Promise<{ ok: boolean, message?: string, error?: string }>}
   */
  ipcMain.handle('provider:test', (_e, provider) => testProviderConnection(provider));
  /**
   * @param {Electron.IpcMainInvokeEvent} _e
   * @param {{ provider: string, value: string }} payload
   * @returns {{ ok: boolean, hint?: string, empty?: boolean }}
   */
  ipcMain.handle('provider:validate-key', (_e, payload) => {
    const provider = payload && payload.provider;
    const value = payload && payload.value;
    return looksLikeKey(provider, value);
  });
  /** @returns {{ dataPath: string, userData: string, logPath: string, crashDumps: string }} */
  ipcMain.handle('app:paths', () => ({
    dataPath: store.dataPath(),
    userData: app.getPath('userData'),
    logPath: path.join(app.getPath('userData'), 'cue.log'),
    crashDumps: app.getPath('crashDumps')
  }));
  /** @returns {Promise<{ ok: boolean, error?: string|null }>} */
  ipcMain.handle('app:open-log', async () => {
    const logPath = path.join(app.getPath('userData'), 'cue.log');
    const err = await shell.openPath(logPath);
    return { ok: !err, error: err || null };
  });
  /** @returns {Promise<{ ok: boolean, error?: string|null }>} */
  ipcMain.handle('app:open-crash-dumps', async () => {
    const dir = app.getPath('crashDumps');
    const err = await shell.openPath(dir);
    return { ok: !err, error: err || null };
  });
  /** @returns {Promise<{ ok: boolean, error?: string }>} */
  ipcMain.handle('update:download', async () => {
    if (!autoUpdaterRef) return { ok: false, error: 'Updater unavailable in this build.' };
    try {
      await autoUpdaterRef.downloadUpdate();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e && e.message };
    }
  });
  /** @returns {{ ok: boolean }} */
  ipcMain.handle('update:defer', () => {
    pendingUpdate = pendingUpdate ? { ...pendingUpdate, state: 'deferred' } : null;
    return { ok: true };
  });
  /** @returns {{ ok: boolean, error?: string }} */
  ipcMain.handle('update:install', () => {
    if (!autoUpdaterRef) return { ok: false, error: 'Updater unavailable.' };
    setImmediate(() => autoUpdaterRef.quitAndInstall());
    return { ok: true };
  });
  /** @returns {Promise<object>} */
  ipcMain.handle('update:check-latest', () => checkLatestRelease());
  /** @returns {{ ok: boolean, error?: string, mode?: string, userText?: string }} */
  ipcMain.handle('feature:retry', () => {
    if (!lastFeature) return { ok: false, error: 'Nothing to retry yet.' };
    runFeature(lastFeature.mode, lastFeature.userText);
    return { ok: true, ...lastFeature };
  });
  /** @returns {{ ok: boolean, busy: boolean }} */
  ipcMain.handle('feature:cancel', () => cancelFeature());
  /**
   * @param {Electron.IpcMainInvokeEvent} _e
   * @param {boolean} online
   * @returns {{ online: boolean }}
   */
  ipcMain.handle('net:set-online', (_e, online) => {
    state.offline = !online;
    send('net:status', { online: !!online });
    return { online: !!online };
  });
  /**
   * @param {Electron.IpcMainInvokeEvent} _e
   * @param {string} message
   * @returns {{ ok: boolean }}
   */
  ipcMain.handle('csp:report', (_e, message) => {
    log.warn('CSP violation', typeof message === 'string' ? message.slice(0, 500) : message);
    return { ok: true };
  });
  /** @returns {{ openAtLogin: boolean }} */
  ipcMain.handle('app:login-item-get', () => {
    try {
      return app.getLoginItemSettings();
    } catch {
      return { openAtLogin: false };
    }
  });

  ipcMain.on('ask', (_e, payload) => {
    if (!payload || typeof payload !== 'object') return;
    runFeature(payload.mode, payload.text);
  });
  ipcMain.on('mic:pcm', (_e, arrayBuffer) => {
    if (state.capturing) pushBuffer('you', Buffer.from(arrayBuffer));
  });
  ipcMain.on('system:pcm', (_e, arrayBuffer) => {
    if (state.capturing) pushBuffer('them', Buffer.from(arrayBuffer));
  });
  ipcMain.on('mouse:ignore', (_e, v) => {
    if (win) win.setIgnoreMouseEvents(!!v, { forward: true });
  });
  ipcMain.on('open-pane', (_e, url) => {
    if (!isAllowedOpenUrl(url)) {
      log.warn('blocked open-pane url', typeof url === 'string' ? url.slice(0, 120) : typeof url);
      return;
    }
    shell.openExternal(url).catch((e) => log.warn('openExternal failed', e && e.message));
  });
  ipcMain.on('log', (_e, msg) => log.info('renderer', typeof msg === 'string' ? msg.slice(0, 500) : msg));

  function registerAssistShortcut(accelerator) {
    const checked = validateAssistShortcut(accelerator);
    if (!checked.ok) return checked;
    const next = checked.accelerator;
    const previous = registeredAssistShortcut;
    if (previous) globalShortcut.unregister(previous);
    try {
      if (!globalShortcut.register(next, () => runFeature('assist', ''))) {
        if (previous) globalShortcut.register(previous, () => runFeature('assist', ''));
        return { ok: false, error: 'That shortcut is already in use by another application.' };
      }
    } catch (_) {
      if (previous) globalShortcut.register(previous, () => runFeature('assist', ''));
      return { ok: false, error: 'That key combination is not a valid global shortcut.' };
    }
    registeredAssistShortcut = next;
    return { ok: true, accelerator: next };
  }

  function setAssistShortcut(accelerator) {
    const result = registerAssistShortcut(accelerator);
    if (result.ok) store.setSettings({ shortcuts: { assist: result.accelerator } });
    return result;
  }

  function registerShortcuts() {
    globalShortcut.register('CommandOrControl+H', () => runFeature('leetcode', ''));
    globalShortcut.register('CommandOrControl+Shift+X', () => app.quit());
    const settings = store.getSettings();
    const configured = settings.shortcuts && settings.shortcuts.assist;
    const result = registerAssistShortcut(configured || DEFAULT_ASSIST_SHORTCUT);
    if (!result.ok && configured && configured !== DEFAULT_ASSIST_SHORTCUT) {
      log.warn('assist shortcut unavailable, falling back', result.error);
      const fallback = registerAssistShortcut(DEFAULT_ASSIST_SHORTCUT);
      if (fallback.ok) store.setSettings({ shortcuts: { assist: DEFAULT_ASSIST_SHORTCUT } });
    }
  }

  process.on('uncaughtException', (err) => {
    log.error('uncaughtException', err && err.stack ? err.stack : err);
    lastError = err && err.message ? err.message : String(err);
  });
  process.on('unhandledRejection', (reason) => {
    log.error('unhandledRejection', reason && reason.stack ? reason.stack : reason);
    lastError = reason && reason.message ? reason.message : String(reason);
  });

  app.whenReady().then(() => {
    try {
      const dumpDir = path.join(app.getPath('userData'), 'Crashpad');
      app.setPath('crashDumps', dumpDir);
    } catch (e) {
      log.warn('crashDumps path unavailable', e && e.message);
    }
    try {
      crashReporter.start({
        productName: 'Cue',
        companyName: 'Cue',
        submitURL: '',
        uploadToServer: false,
        compress: true
      });
    } catch (e) {
      log.warn('crashReporter unavailable', e && e.message);
    }

    attachLogFile();
    applySecurityHeaders();
    if (app.dock) app.dock.hide();

    const settings = store.getSettings();
    applyLoginItem(!!settings.openAtLogin);
    const allowMedia = (permission) =>
      permission === 'media' ||
      permission === 'microphone' ||
      permission === 'audioCapture' ||
      permission === 'display-capture';

    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowMedia(permission)));
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowMedia(permission));
    session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
      desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
        if (sources.length) callback({ video: sources[0], audio: 'loopback' });
        else callback();
      }).catch(() => callback());
    }, { useSystemPicker: false });

    createWindow();
    registerShortcuts();
    setupAutoUpdater();

    const protectWarn = contentProtectionWarning(process.platform, os.release());
    if (protectWarn) {
      log.warn(protectWarn);
      setTimeout(() => send('status', { message: protectWarn }), 1200);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => {
    send('capture:stop', {});
    if (state.capturing) setCapturing(false);
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (memoryTimer) clearInterval(memoryTimer);
    try { if (logStream) logStream.end(); } catch { /* ignore */ }
  });
  app.on('window-all-closed', () => app.quit());
}
