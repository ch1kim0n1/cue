const { app, BrowserWindow, ipcMain, globalShortcut, screen, session, desktopCapturer, shell, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
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
const { providerLabel } = require('./src/secrets');
const { createLogger } = require('./src/logger');
const { hasProviderKey } = require('./src/settings-model');
const { contentProtectionWarning, screenshotFailureMessage } = require('./src/capabilities');
const os = require('os');

const FEATURE_TIMEOUT_MS = 45000;
const STT_TIMEOUT_MS = 30000;
const FEATURE_COOLDOWN_MS = 400;
const MAX_BUFFER_BYTES = 16000 * 2 * 30; // ~30s PCM per channel
const FLUSH_MS = 3500;
const MIN_BYTES = Math.floor(16000 * 2 * 0.6);
const RMS_GATE = 240;

let win = null;
let registeredAssistShortcut = null;
let lastFeature = null;
let lastFeatureAt = 0;
let lastError = null;
let flushTimer = null;
let logStream = null;

const state = { capturing: false, busy: false, transcribing: { you: false, them: false } };
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

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const W = 720;
  const H = 640;
  win = new BrowserWindow({
    width: W,
    height: H,
    x: Math.round(workArea.x + (workArea.width - W) / 2),
    y: workArea.y + 8,
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
    const allowed = url.startsWith('file://');
    if (!allowed) {
      event.preventDefault();
      log.warn('blocked navigation', url);
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => win.showInactive());
  win.webContents.on('render-process-gone', (_e, details) => {
    log.error('renderer gone', details);
    lastError = 'Renderer crashed: ' + (details && details.reason);
    send('status', { message: 'Cue hit a display error and is recovering.' });
    setTimeout(() => {
      if (!win || win.isDestroyed()) createWindow();
      else win.reload();
    }, 400);
  });
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
      transcript.push(turn);
      log.debug('transcript', channel, turn.text.slice(0, 80));
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
  if (noAccess) {
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

async function runFeature(mode, userText) {
  if (state.busy) return;
  const now = Date.now();
  if (now - lastFeatureAt < FEATURE_COOLDOWN_MS) return;
  const def = MODES[mode];
  if (!def) return;
  state.busy = true;
  lastFeatureAt = now;
  lastFeature = { mode, userText: userText || '' };
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

    let imageDataUrl = null;
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
    await withTimeout(llm.stream({
      system: appendResumeContext(def.system, settings.resumeContext),
      turns: [{ role: 'user', text: built }],
      imageDataUrl,
      maxTokens: def.maxTokens || 4096,
      onToken: (t) => send('llm:token', { text: t })
    }), FEATURE_TIMEOUT_MS, 'Model response');
    send('llm:done', {});
  } catch (e) {
    lastError = friendlyProviderError(e, store.getSettings().provider);
    log.error('feature failed', mode, e && e.message);
    send('llm:error', { message: lastError });
  } finally {
    state.busy = false;
  }
}

function diagnostics() {
  const settings = store.getSettings();
  return {
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    provider: settings.provider,
    model: ((settings.models || {})[settings.provider] || {})[settings.smart ? 'smart' : 'fast'] || null,
    hasKey: hasProviderKey(settings),
    capturing: state.capturing,
    busy: state.busy,
    lastError,
    dataPath: store.dataPath(),
    media: mediaAccessStatus(),
    encryptionWarning: settings._encryptionWarning || null,
    saveError: settings._saveError || null
  };
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    log.info('auto-update skipped (dev)');
    return;
  }
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('error', (err) => log.warn('updater error', err && err.message));
    autoUpdater.on('update-available', (info) => {
      log.info('update available', info && info.version);
      send('status', { message: 'Update ' + (info && info.version) + ' downloading in the background.' });
    });
    autoUpdater.on('update-downloaded', (info) => {
      log.info('update downloaded', info && info.version);
      send('status', { message: 'Update ready. It installs when you quit Cue.' });
    });
    autoUpdater.checkForUpdates().catch((e) => log.warn('update check failed', e && e.message));
  } catch (e) {
    log.warn('autoUpdater unavailable', e && e.message);
  }
}

ipcMain.handle('settings:get', () => store.getSettings());
ipcMain.handle('settings:set', (_e, patch) => {
  sttDisabled = false;
  const next = store.setSettings(patch);
  if (next._saveError) send('status', { message: 'Could not save settings: ' + next._saveError });
  return next;
});
ipcMain.handle('settings:wipe', () => {
  clearTranscript();
  const result = store.wipeUserData();
  sttDisabled = false;
  lastFeature = null;
  return result;
});
ipcMain.handle('shortcut:assist:set', (_e, accelerator) => setAssistShortcut(accelerator));
ipcMain.handle('capture:toggle', () => setCapturing(!state.capturing));
ipcMain.handle('capture:state', () => ({ active: state.capturing }));
ipcMain.handle('capture:permissions', () => mediaAccessStatus());
ipcMain.handle('transcript:get', () => transcript.slice());
ipcMain.handle('transcript:clear', () => clearTranscript());
ipcMain.handle('diagnostics:get', () => diagnostics());
ipcMain.handle('app:paths', () => ({
  dataPath: store.dataPath(),
  userData: app.getPath('userData'),
  logPath: path.join(app.getPath('userData'), 'cue.log')
}));
ipcMain.handle('feature:retry', () => {
  if (!lastFeature) return { ok: false, error: 'Nothing to retry yet.' };
  runFeature(lastFeature.mode, lastFeature.userText);
  return { ok: true, ...lastFeature };
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
  attachLogFile();
  if (app.dock) app.dock.hide();

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

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  try { if (logStream) logStream.end(); } catch { /* ignore */ }
});
app.on('window-all-closed', () => app.quit());
