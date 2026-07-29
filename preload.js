const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('cue', {
  setZoomLevel: (level) => webFrame.setZoomLevel(level),
  getZoomLevel: () => webFrame.getZoomLevel(),
  platform: process.platform,
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (patch) => ipcRenderer.invoke('settings:set', patch),
  settingsWipe: () => ipcRenderer.invoke('settings:wipe'),
  settingsNeedsPrivacyAck: () => ipcRenderer.invoke('settings:needs-privacy-ack'),
  settingsPrivacyVersion: () => ipcRenderer.invoke('settings:privacy-version'),
  shortcutAssistSet: (accelerator) => ipcRenderer.invoke('shortcut:assist:set', accelerator),
  ask: (payload) => ipcRenderer.send('ask', payload),
  featureCancel: () => ipcRenderer.invoke('feature:cancel'),
  captureToggle: () => ipcRenderer.invoke('capture:toggle'),
  captureState: () => ipcRenderer.invoke('capture:state'),
  capturePermissions: () => ipcRenderer.invoke('capture:permissions'),
  transcriptGet: () => ipcRenderer.invoke('transcript:get'),
  transcriptClear: () => ipcRenderer.invoke('transcript:clear'),
  featureRetry: () => ipcRenderer.invoke('feature:retry'),
  diagnosticsGet: () => ipcRenderer.invoke('diagnostics:get'),
  providerTest: (provider) => ipcRenderer.invoke('provider:test', provider),
  providerValidateKey: (provider, value) => ipcRenderer.invoke('provider:validate-key', { provider, value }),
  appPaths: () => ipcRenderer.invoke('app:paths'),
  openLog: () => ipcRenderer.invoke('app:open-log'),
  openCrashDumps: () => ipcRenderer.invoke('app:open-crash-dumps'),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  updateDefer: () => ipcRenderer.invoke('update:defer'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  updateCheckLatest: () => ipcRenderer.invoke('update:check-latest'),
  netSetOnline: (online) => ipcRenderer.invoke('net:set-online', online),
  reportCsp: (message) => ipcRenderer.invoke('csp:report', message),
  loginItemGet: () => ipcRenderer.invoke('app:login-item-get'),
  micPcm: (arrayBuffer) => ipcRenderer.send('mic:pcm', arrayBuffer),
  systemPcm: (arrayBuffer) => ipcRenderer.send('system:pcm', arrayBuffer),
  setIgnoreMouse: (v) => ipcRenderer.send('mouse:ignore', v),
  openPane: (url) => ipcRenderer.send('open-pane', url),
  log: (msg) => ipcRenderer.send('log', msg),
  on: (channel, cb) => {
    const allowed = [
      'capture:state', 'capture:stop', 'llm:start', 'llm:token', 'llm:done', 'llm:error', 'llm:cost',
      'status', 'transcript', 'transcript:cleared', 'update:available', 'update:downloaded',
      'settings:open', 'net:status'
    ];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_e, data) => cb(data));
  }
});
