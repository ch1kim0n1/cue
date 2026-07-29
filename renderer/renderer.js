/* Cue renderer — UI, capture, IPC, GSAP motion. */
(function () {
  const { icon } = window.ICONS;
  const cue = window.cue;
  const gsap = window.gsap;
  const $ = (s) => document.querySelector(s);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cmdKey = cue.platform === 'darwin' ? '⌘' : 'Ctrl';
  const isCmdOrCtrl = (e) => cue.platform === 'darwin' ? e.metaKey : e.ctrlKey;
  const DEFAULT_ASSIST_SHORTCUT = 'CommandOrControl+Return';

  $('#logo-btn').innerHTML = icon('logo', { size: 18 });
  $('.tb-hide .chev').innerHTML = icon('chevron-down', { size: 14 });
  $('#stop-btn').innerHTML = icon('stop-square', { size: 15 });
  $('#transcript-btn').innerHTML = icon('list', { size: 15 });
  document.querySelector('.act[data-mode="assist"] .ic').innerHTML = icon('sparkles', { size: 15 });
  document.querySelector('.act[data-mode="say"] .ic').innerHTML = icon('wand-sparkles', { size: 15 });
  document.querySelector('.act[data-mode="followup"] .ic').innerHTML = icon('message-circle', { size: 15 });
  document.querySelector('.act[data-mode="recap"] .ic').innerHTML = icon('refresh-cw', { size: 15 });
  $('#smart-toggle .ic').innerHTML = icon('zap', { size: 13 });
  $('#more-btn').innerHTML = icon('more-horizontal', { size: 18 });
  $('#send-btn').innerHTML = icon('play', { size: 14 });

  let settings = null;
  let busy = false;
  let aiEl = null;
  let caretEl = null;
  let lastRawResponse = '';
  let assistShortcut = DEFAULT_ASSIST_SHORTCUT;
  let recordingShortcut = false;
  const localTranscript = [];

  const messages = $('#messages');
  const responseActions = $('#response-actions');

  function canAnimate() { return !!(gsap && !reduceMotion); }

  function animateIn(el, vars) {
    if (!el) return;
    if (!canAnimate()) {
      el.style.opacity = '1';
      el.style.transform = 'none';
      return;
    }
    gsap.fromTo(el, { opacity: 0, y: vars && vars.y != null ? vars.y : 8, scale: vars && vars.scale != null ? vars.scale : 0.985 }, {
      opacity: 1, y: 0, scale: 1, duration: vars && vars.duration || 0.34,
      ease: 'power3.out', overwrite: true
    });
  }

  function pulseLive(on) {
    const dot = $('#live-dot');
    if (!canAnimate() || !dot) return;
    gsap.killTweensOf(dot);
    if (on) {
      gsap.to(dot, { scale: 1.25, duration: 0.7, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    } else {
      gsap.set(dot, { scale: 1 });
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function shortcutParts(accelerator) {
    const labels = {
      CommandOrControl: cue.platform === 'darwin' ? '⌘' : 'Ctrl',
      Command: '⌘', Control: 'Ctrl', Super: 'Win',
      Alt: cue.platform === 'darwin' ? '⌥' : 'Alt',
      Shift: cue.platform === 'darwin' ? '⇧' : 'Shift',
      Return: 'Enter', Escape: 'Esc', Space: 'Space',
      Up: '↑', Down: '↓', Left: '←', Right: '→'
    };
    return (accelerator || DEFAULT_ASSIST_SHORTCUT).split('+').map((part) => labels[part] || part);
  }

  function shortcutKeycapsHtml(accelerator, className) {
    const cls = className || 'keycap';
    return shortcutParts(accelerator).map((part) => '<span class="' + cls + '">' + esc(part) + '</span>').join(' ');
  }

  function syncAssistShortcutLabels() {
    const shortcutBtn = $('#shortcut-assist');
    if (shortcutBtn && !recordingShortcut) shortcutBtn.textContent = shortcutParts(assistShortcut).join(' + ');
    const placeholder = $('#placeholder');
    if (placeholder) {
      placeholder.innerHTML = 'Ask about your screen or conversation, or ' +
        shortcutKeycapsHtml(assistShortcut) + ' for Assist';
    }
  }

  function renderMarkdown(text) {
    const lines = text.split('\n');
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

  function clearMessages() {
    messages.innerHTML = '';
    aiEl = null;
    caretEl = null;
    responseActions.classList.add('hidden');
  }

  function addUserBubble(text) {
    const b = document.createElement('div');
    b.className = 'user-bubble';
    b.textContent = text;
    messages.appendChild(b);
    animateIn(b, { y: 6, duration: 0.28 });
  }

  function startAi(small) {
    aiEl = document.createElement('div');
    aiEl.className = 'ai-text' + (small ? ' small' : '');
    aiEl.dataset.raw = '';
    caretEl = document.createElement('span');
    caretEl.className = 'ai-caret';
    aiEl.appendChild(caretEl);
    messages.appendChild(aiEl);
    animateIn(aiEl, { y: 4, duration: 0.22 });
  }

  function appendToken(t) {
    if (!aiEl) startAi(false);
    aiEl.dataset.raw += t;
    const span = document.createElement('span');
    span.className = 'w';
    span.textContent = t;
    aiEl.insertBefore(span, caretEl);
  }

  function finalizeAi() {
    if (!aiEl) return;
    const raw = aiEl.dataset.raw || '';
    lastRawResponse = raw;
    aiEl.innerHTML = renderMarkdown(raw);
    aiEl = null;
    caretEl = null;
    responseActions.classList.remove('hidden');
    animateIn(responseActions, { y: 4, duration: 0.24 });
  }

  function setBusy(v) {
    busy = v;
    $('#send-btn').classList.toggle('busy', v);
  }

  function applyOpacity(value) {
    const opacity = Math.min(1, Math.max(0.55, Number(value) || 0.92));
    document.documentElement.style.setProperty('--panel-opacity', String(opacity));
    const range = $('#opacity-range');
    const label = $('#opacity-value');
    if (range) range.value = String(Math.round(opacity * 100));
    if (label) label.textContent = Math.round(opacity * 100) + '%';
    return opacity;
  }

  function applyCompact(on) {
    document.body.classList.toggle('compact', !!on);
    $('#compact-toggle').classList.toggle('on', !!on);
  }

  function runMode(mode, text) {
    if (busy) return;
    setBusy(true);
    cue.ask({ mode, text: text || '' });
  }

  document.querySelectorAll('.act').forEach((btn) => {
    btn.addEventListener('click', () => runMode(btn.dataset.mode, ''));
  });

  const input = $('#input');
  const placeholder = $('#placeholder');
  const composer = $('#composer');

  function syncPlaceholder() {
    placeholder.classList.toggle('hidden', input.value.length > 0 || document.activeElement === input);
    // Textarea auto-grow still needs a measured height; kept as a CSS custom property write.
    document.documentElement.style.setProperty('--input-height', 'auto');
    const next = Math.min(Math.max(input.scrollHeight, 22), 140);
    document.documentElement.style.setProperty('--input-height', next + 'px');
  }

  input.addEventListener('input', syncPlaceholder);
  input.addEventListener('focus', () => {
    composer.classList.add('focused');
    placeholder.classList.add('hidden');
  });
  input.addEventListener('blur', () => {
    composer.classList.remove('focused');
    syncPlaceholder();
  });
  $('#input-area').addEventListener('click', () => input.focus());

  function send() {
    const text = input.value.trim();
    if (!text) { runMode('assist', ''); return; }
    input.value = '';
    syncPlaceholder();
    runMode('ask', text);
  }

  $('#send-btn').addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    const captured = keyEventToAccelerator(e);
    if (captured.accelerator && captured.accelerator.toLowerCase() === assistShortcut.toLowerCase()) {
      e.preventDefault();
      runMode('assist', '');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      send();
    }
  });

  const smartBtn = $('#smart-toggle');
  smartBtn.addEventListener('click', async () => {
    settings.smart = !settings.smart;
    smartBtn.classList.toggle('on', settings.smart);
    await cue.settingsSet({ smart: settings.smart });
  });

  $('#compact-toggle').addEventListener('click', async () => {
    settings.compact = !settings.compact;
    applyCompact(settings.compact);
    await cue.settingsSet({ compact: settings.compact });
  });

  $('#hide-btn').addEventListener('click', () => {
    const panel = $('#panel');
    const collapsed = !panel.classList.contains('collapsed');
    if (collapsed) {
      if (canAnimate()) {
        gsap.to(panel, {
          opacity: 0, y: -6, duration: 0.18, ease: 'power2.in',
          onComplete: () => {
            panel.classList.add('collapsed');
            gsap.set(panel, { clearProps: 'opacity,y' });
          }
        });
      } else {
        panel.classList.add('collapsed');
      }
    } else {
      panel.classList.remove('collapsed');
      animateIn(panel, { y: -6, duration: 0.28 });
    }
    $('#hide-btn').classList.toggle('collapsed', collapsed);
    $('#live-dot').classList.toggle('is-collapsed-away', collapsed);
  });

  $('#stop-btn').addEventListener('click', async () => {
    const turningOn = !$('#stop-btn').classList.contains('active');
    if (turningOn) {
      if (!settings.listenConsent) {
        showStatus('Confirm meeting-audio consent in Settings before listening.');
        openSettings();
        return;
      }
      try {
        const perms = await cue.capturePermissions();
        if (perms.microphone === 'denied') {
          showStatus('Microphone access is denied. Enable Cue in your system privacy settings.');
          return;
        }
        if (perms.screen === 'denied') {
          showStatus('Screen recording access is denied. Enable Cue in your system privacy settings.');
          return;
        }
      } catch (_) { /* non-mac platforms may not report */ }
      startSystemAudio();
    }
    const active = await cue.captureToggle();
    if (turningOn && active === false) {
      stopSystemAudio();
    }
  });

  $('#copy-btn').addEventListener('click', async () => {
    if (!lastRawResponse) return;
    try {
      await navigator.clipboard.writeText(lastRawResponse);
      $('#copy-btn').textContent = 'Copied';
      setTimeout(() => { $('#copy-btn').textContent = 'Copy'; }, 1200);
    } catch (_) {
      showStatus('Could not copy to clipboard.');
    }
  });

  $('#retry-btn').addEventListener('click', async () => {
    if (busy) return;
    const result = await cue.featureRetry();
    if (!result.ok) showStatus(result.error || 'Nothing to retry yet.');
  });

  $('#clear-session-btn').addEventListener('click', async () => {
    await cue.transcriptClear();
    localTranscript.length = 0;
    renderTranscriptList();
    showStatus('Session transcript cleared.');
  });

  // Mic
  let audioCtx = null, micStream = null, micNode = null, micProc = null;
  async function startMic() {
    if (micStream) return;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }
      });
      audioCtx = new AudioContext({ sampleRate: 16000 });
      await audioCtx.audioWorklet.addModule('./pcm-processor.js');
      micNode = audioCtx.createMediaStreamSource(micStream);
      micProc = new AudioWorkletNode(audioCtx, 'pcm-processor');
      micProc.port.onmessage = (e) => cue.micPcm(e.data);
      const sink = audioCtx.createGain();
      sink.gain.value = 0;
      micNode.connect(micProc);
      micProc.connect(sink);
      sink.connect(audioCtx.destination);
    } catch (err) {
      cue.log('mic error: ' + (err && err.message));
      showStatus('Microphone blocked. Allow Cue in your system privacy settings.');
    }
  }

  function stopMic() {
    if (micProc) { micProc.port.onmessage = null; micProc.disconnect(); micProc = null; }
    if (micNode) { micNode.disconnect(); micNode = null; }
    if (audioCtx) { audioCtx.close(); audioCtx = null; }
    if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
  }

  let sysStream = null, sysCtx = null, sysNode = null, sysProc = null;
  async function startSystemAudio() {
    if (sysStream) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      stream.getVideoTracks().forEach((t) => t.stop());
      const tracks = stream.getAudioTracks();
      if (!tracks.length) {
        cue.log('system audio: no loopback track');
        stream.getTracks().forEach((t) => t.stop());
        showStatus(cue.platform === 'win32'
          ? 'No system audio track. Share a screen/window with audio enabled when prompted.'
          : 'No system audio track available for meeting capture.');
        return;
      }
      sysStream = stream;
      sysCtx = new AudioContext({ sampleRate: 16000 });
      await sysCtx.audioWorklet.addModule('./pcm-processor.js');
      sysNode = sysCtx.createMediaStreamSource(new MediaStream(tracks));
      sysProc = new AudioWorkletNode(sysCtx, 'pcm-processor');
      sysProc.port.onmessage = (e) => cue.systemPcm(e.data);
      const sink = sysCtx.createGain();
      sink.gain.value = 0;
      sysNode.connect(sysProc);
      sysProc.connect(sink);
      sink.connect(sysCtx.destination);
      cue.log('system audio: capturing loopback');
    } catch (err) {
      cue.log('system audio error: ' + (err && err.message));
      showStatus('System audio capture was cancelled or blocked.');
    }
  }

  function stopSystemAudio() {
    if (sysProc) { sysProc.port.onmessage = null; sysProc.disconnect(); sysProc = null; }
    if (sysNode) { sysNode.disconnect(); sysNode = null; }
    if (sysCtx) { sysCtx.close(); sysCtx = null; }
    if (sysStream) { sysStream.getTracks().forEach((t) => t.stop()); sysStream = null; }
  }

  cue.on('capture:state', ({ active }) => {
    $('#live-dot').classList.toggle('off', !active);
    $('#stop-btn').classList.toggle('active', active);
    pulseLive(active);
    if (active) startMic();
    else { stopMic(); stopSystemAudio(); }
  });

  cue.on('llm:start', ({ userBubble, small }) => {
    clearMessages();
    if (userBubble) addUserBubble(userBubble);
    startAi(!!small);
    setBusy(true);
  });
  cue.on('llm:token', ({ text }) => appendToken(text));
  cue.on('llm:done', () => { finalizeAi(); setBusy(false); });
  cue.on('llm:error', ({ message }) => {
    if (!aiEl) startAi(true);
    aiEl.dataset.raw = message;
    finalizeAi();
    setBusy(false);
  });

  let statusTimer = null;
  function showStatus(message) {
    let el = document.getElementById('cue-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cue-status';
      const panel = document.getElementById('panel');
      panel.insertBefore(el, document.getElementById('response-actions'));
    }
    el.textContent = message;
    el.classList.add('show');
    animateIn(el, { y: 4, duration: 0.22 });
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => el.classList.remove('show'), 11000);
  }
  cue.on('status', ({ message }) => { cue.log('[status] ' + message); showStatus(message); });

  function renderTranscriptList() {
    const list = $('#transcript-list');
    const empty = $('#transcript-empty');
    list.innerHTML = '';
    if (!localTranscript.length) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    localTranscript.forEach((turn) => {
      const row = document.createElement('div');
      row.className = 'td-turn ' + (turn.channel === 'them' ? 'them' : 'you');
      row.innerHTML = '<div class="who">' + (turn.channel === 'them' ? 'Them' : 'You') +
        '</div><div class="txt">' + esc(turn.text) + '</div>';
      list.appendChild(row);
    });
    list.scrollTop = list.scrollHeight;
  }

  cue.on('transcript', (turn) => {
    localTranscript.push(turn);
    renderTranscriptList();
  });
  cue.on('transcript:cleared', () => {
    localTranscript.length = 0;
    renderTranscriptList();
  });

  const drawer = $('#transcript-drawer');
  function openTranscript() {
    drawer.classList.remove('hidden');
    renderTranscriptList();
    animateIn(drawer, { y: 10, duration: 0.3 });
    setIgnore(false);
  }
  function closeTranscript() { drawer.classList.add('hidden'); }

  $('#transcript-btn').addEventListener('click', () => {
    if (drawer.classList.contains('hidden')) openTranscript();
    else closeTranscript();
  });
  $('#close-transcript').addEventListener('click', closeTranscript);
  $('#clear-transcript').addEventListener('click', async () => {
    await cue.transcriptClear();
    localTranscript.length = 0;
    renderTranscriptList();
  });
  $('#export-transcript').addEventListener('click', async () => {
    const turns = localTranscript.length ? localTranscript : await cue.transcriptGet();
    if (!turns.length) {
      showStatus('No transcript to export yet.');
      return;
    }
    const text = turns.map((t) => (t.channel === 'them' ? 'Them: ' : 'You: ') + t.text).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showStatus('Transcript copied to clipboard.');
    } catch (_) {
      showStatus('Could not copy transcript.');
    }
  });

  const scrim = $('#settings-scrim');
  let releaseSettingsFocus = null;
  let releaseOnboardFocus = null;
  let releasePrivacyFocus = null;

  function openSettings() {
    fillSettings();
    scrim.classList.remove('hidden');
    animateIn($('#settings'), { y: 12, scale: 0.97, duration: 0.32 });
    if (window.CUE_FOCUS) releaseSettingsFocus = window.CUE_FOCUS.trapFocus($('#settings'), { initialFocus: '#s-close' });
  }
  function closeSettings() {
    cancelShortcutRecording();
    saveSettings();
    scrim.classList.add('hidden');
    if (releaseSettingsFocus) { releaseSettingsFocus(); releaseSettingsFocus = null; }
  }
  $('#more-btn').addEventListener('click', openSettings);
  $('#s-close').addEventListener('click', closeSettings);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) closeSettings(); });

  function fillSettings() {
    document.querySelectorAll('#provider-seg button').forEach((b) => {
      b.classList.toggle('on', b.dataset.provider === settings.provider);
    });
    $('#key-openai').value = settings.apiKeys.openai || '';
    $('#key-anthropic').value = settings.apiKeys.anthropic || '';
    $('#key-gemini').value = settings.apiKeys.gemini || '';
    $('#key-nvidia').value = settings.apiKeys.nvidia || '';
    $('#resume-context').value = settings.resumeContext || '';
    const m = settings.models[settings.provider] || { fast: '', smart: '' };
    $('#model-fast').value = m.fast;
    $('#model-smart').value = m.smart;
    applyOpacity(settings.opacity);
    const consent = $('#listen-consent');
    if (consent) consent.checked = !!settings.listenConsent;
    syncAssistShortcutLabels();
    $('#s-status').textContent = statusText();
    refreshPathsAndDiagnostics();
  }

  async function refreshPathsAndDiagnostics() {
    try {
      const paths = await cue.appPaths();
      const pathEl = $('#data-path');
      if (pathEl) pathEl.textContent = paths.dataPath || 'Unavailable';
      const diag = await cue.diagnosticsGet();
      const box = $('#diagnostics-box');
      if (box) box.textContent = JSON.stringify(diag, null, 2);
    } catch (_) {
      const pathEl = $('#data-path');
      if (pathEl) pathEl.textContent = settings && settings._dataPath ? settings._dataPath : 'Unavailable';
    }
  }

  $('#listen-consent').addEventListener('change', async (e) => {
    settings.listenConsent = !!e.target.checked;
    await cue.settingsSet({ listenConsent: settings.listenConsent });
  });

  $('#clear-keys').addEventListener('click', async () => {
    settings.apiKeys = { openai: '', anthropic: '', gemini: '', deepgram: '', nvidia: '' };
    $('#key-openai').value = '';
    $('#key-anthropic').value = '';
    $('#key-gemini').value = '';
    $('#key-nvidia').value = '';
    await cue.settingsSet({ apiKeys: settings.apiKeys });
    $('#s-status').textContent = statusText();
    showStatus('All API keys cleared.');
  });

  $('#wipe-data').addEventListener('click', async () => {
    const ok = window.confirm('Delete all Cue settings, keys, and resume text on this device?');
    if (!ok) return;
    const result = await cue.settingsWipe();
    if (!result.ok) {
      showStatus(result.error || 'Could not delete local data.');
      return;
    }
    settings = await cue.settingsGet();
    fillSettings();
    applyCompact(!!settings.compact);
    applyOpacity(settings.opacity != null ? settings.opacity : 0.92);
    showStatus('Local Cue data deleted.');
  });

  $('#clear-resume').addEventListener('click', async () => {
    $('#resume-context').value = '';
    settings.resumeContext = '';
    await cue.settingsSet({ resumeContext: '' });
  });

  $('#opacity-range').addEventListener('input', async (e) => {
    const opacity = applyOpacity(Number(e.target.value) / 100);
    settings.opacity = opacity;
    await cue.settingsSet({ opacity });
  });

  function statusText() {
    const k = settings.apiKeys;
    const has = [k.openai && 'OpenAI', k.anthropic && 'Anthropic', k.gemini && 'Gemini', k.nvidia && 'Nvidia'].filter(Boolean);
    const stt = k.openai ? 'Whisper' : (k.gemini ? 'Gemini' : 'none');
    return 'Active: ' + settings.provider + ' · keys: ' + (has.join(', ') || 'none set') + ' · transcription: ' + stt;
  }

  document.querySelectorAll('#provider-seg button').forEach((b) => b.addEventListener('click', () => {
    settings.provider = b.dataset.provider;
    document.querySelectorAll('#provider-seg button').forEach((x) => x.classList.toggle('on', x === b));
    const m = settings.models[settings.provider] || { fast: '', smart: '' };
    $('#model-fast').value = m.fast;
    $('#model-smart').value = m.smart;
    $('#s-status').textContent = statusText();
  }));

  async function saveSettings() {
    settings.apiKeys.openai = $('#key-openai').value.trim();
    settings.apiKeys.anthropic = $('#key-anthropic').value.trim();
    settings.apiKeys.gemini = $('#key-gemini').value.trim();
    settings.apiKeys.nvidia = $('#key-nvidia').value.trim();
    settings.resumeContext = $('#resume-context').value.trim();
    settings.listenConsent = !!($('#listen-consent') && $('#listen-consent').checked);
    if (!settings.models[settings.provider]) settings.models[settings.provider] = {};
    settings.models[settings.provider].fast = $('#model-fast').value.trim();
    settings.models[settings.provider].smart = $('#model-smart').value.trim();
    settings.opacity = applyOpacity(Number($('#opacity-range').value) / 100);
    settings = await cue.settingsSet(settings);
    if (settings._saveError) showStatus('Could not save settings: ' + settings._saveError);
  }

  const shortcutBtn = $('#shortcut-assist');
  const shortcutHint = $('#shortcut-hint');

  function setShortcutHint(message, kind) {
    shortcutHint.textContent = message;
    shortcutHint.classList.toggle('error', kind === 'error');
    shortcutHint.classList.toggle('success', kind === 'success');
  }

  function cancelShortcutRecording() {
    recordingShortcut = false;
    shortcutBtn.classList.remove('recording');
    syncAssistShortcutLabels();
  }

  function keyEventToAccelerator(e) {
    const modifierKeys = new Set(['Meta', 'Control', 'Alt', 'Shift']);
    if (modifierKeys.has(e.key)) return { error: 'Press a modifier together with another key.' };

    const parts = [];
    const primaryDown = cue.platform === 'darwin' ? e.metaKey : e.ctrlKey;
    if (primaryDown) parts.push('CommandOrControl');
    if (cue.platform === 'darwin' && e.ctrlKey) parts.push('Control');
    if (cue.platform !== 'darwin' && e.metaKey) parts.push('Super');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    const named = {
      Enter: 'Return', ' ': 'Space', Tab: 'Tab', Backspace: 'Backspace',
      Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End',
      PageUp: 'PageUp', PageDown: 'PageDown', ArrowUp: 'Up', ArrowDown: 'Down',
      ArrowLeft: 'Left', ArrowRight: 'Right'
    };
    const punctuation = { '+': 'Plus', '-': '-', '=': '=', ',': ',', '.': '.', '/': '/', ';': ';', "'": "'", '[': '[', ']': ']', '\\': '\\', '`': '`' };
    let key = named[e.key] || punctuation[e.key] || '';
    if (!key && /^[a-z]$/i.test(e.key)) key = e.key.toUpperCase();
    if (!key && /^[0-9]$/.test(e.key)) key = e.key;
    if (!key && /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(e.key)) key = e.key;
    if (!key) return { error: 'Use a letter, number, function key, arrow, or common navigation key.' };
    if (!parts.length && !/^F/.test(key)) return { error: 'Include Ctrl/Cmd, Alt, or Shift in the shortcut.' };
    parts.push(key);
    return { accelerator: parts.join('+') };
  }

  async function applyAssistShortcut(accelerator) {
    const wasRecording = recordingShortcut;
    recordingShortcut = false;
    shortcutBtn.classList.remove('recording');
    shortcutBtn.textContent = 'Saving...';
    let result;
    try {
      result = await cue.shortcutAssistSet(accelerator);
    } catch (_) {
      result = { ok: false, error: 'Cue could not update the shortcut. Try again.' };
    }
    if (!result.ok) {
      setShortcutHint(result.error, 'error');
      recordingShortcut = wasRecording;
      shortcutBtn.classList.toggle('recording', recordingShortcut);
      if (recordingShortcut) shortcutBtn.textContent = 'Press keys...';
      else syncAssistShortcutLabels();
      return;
    }
    assistShortcut = result.accelerator;
    if (!settings.shortcuts) settings.shortcuts = {};
    settings.shortcuts.assist = assistShortcut;
    cancelShortcutRecording();
    setShortcutHint('Assist shortcut updated.', 'success');
  }

  shortcutBtn.addEventListener('click', () => {
    recordingShortcut = true;
    shortcutBtn.classList.add('recording');
    shortcutBtn.textContent = 'Press keys...';
    setShortcutHint('Press Escape to cancel.', '');
  });

  $('#shortcut-reset').addEventListener('click', () => applyAssistShortcut(DEFAULT_ASSIST_SHORTCUT));

  document.addEventListener('keydown', (e) => {
    if (!recordingShortcut) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Escape') {
      cancelShortcutRecording();
      setShortcutHint('Shortcut change cancelled.', '');
      return;
    }
    const captured = keyEventToAccelerator(e);
    if (captured.error) {
      setShortcutHint(captured.error, 'error');
      return;
    }
    applyAssistShortcut(captured.accelerator);
  }, true);

  function showExample() {
    clearMessages();
    addUserBubble('What should I say?');
    const ai = document.createElement('div');
    ai.className = 'ai-text';
    ai.textContent = 'A discounted cash flow model values a company by projecting future free cash flows and discounting them to present value using the weighted average cost of capital.';
    messages.appendChild(ai);
    lastRawResponse = ai.textContent;
    responseActions.classList.remove('hidden');
    animateIn(ai, { y: 4, duration: 0.28 });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !scrim.classList.contains('hidden')) closeSettings();
    if (e.key === 'Escape' && !drawer.classList.contains('hidden')) closeTranscript();
    if (isCmdOrCtrl(e) && e.key === ',') {
      e.preventDefault();
      openSettings();
    }
  });

  let currentZoom = 1;
  function updateZoom(delta) {
    currentZoom = Math.max(0.5, Math.min(3, currentZoom + delta));
    document.documentElement.style.setProperty('--text-zoom', currentZoom);
  }
  $('#zoom-in-btn').addEventListener('click', () => updateZoom(0.1));
  $('#zoom-out-btn').addEventListener('click', () => updateZoom(-0.1));

  let ignoring = null;
  function setIgnore(v) {
    if (v !== ignoring) {
      ignoring = v;
      cue.setIgnoreMouse(v);
    }
  }
  document.addEventListener('mousemove', (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const overUI = !!(el && el.closest && el.closest('#toolbar, #panel-wrap, #settings-scrim, #onboard-scrim, #transcript-drawer, #privacy-scrim'));
    setIgnore(!overUI);
  });
  setIgnore(true);

  const obScrim = $('#onboard-scrim');
  const privacyScrim = $('#privacy-scrim');

  function hasAnyKey(s) {
    const k = (s && s.apiKeys) || {};
    return !!(k.openai || k.anthropic || k.gemini || k.nvidia);
  }

  const OB_STEPS = [
    {
      mark: 'logo',
      title: 'Welcome to Cue',
      body: 'Cue is a private AI overlay for meetings and code. It can <strong>see your screen</strong>, <strong>hear your conversation</strong>, and stay out of most screen shares.<br><br>About one minute to set up.'
    },
    ...(cue.platform === 'darwin' ? [{
      mark: 'settings',
      title: 'Allow Cue to see and hear',
      body: 'Cue needs two macOS permissions. Click each button, turn <strong>Cue</strong> on, then return here.<ul><li><strong>Microphone</strong> so Cue can hear you</li><li><strong>Screen Recording</strong> so Cue can see your screen and capture meeting audio</li></ul>',
      buttons: [
        { label: 'Open Microphone settings', action: () => cue.openPane('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone') },
        { label: 'Open Screen Recording settings', action: () => cue.openPane('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture') }
      ]
    }] : cue.platform === 'win32' ? [{
      mark: 'settings',
      title: 'Windows permissions',
      body: 'Cue runs as a desktop app on Windows.<ul><li>Allow <strong>microphone</strong> access when Windows asks (Settings &gt; Privacy &amp; security &gt; Microphone)</li><li>When you start listening, choose a screen/window and keep <strong>Share system audio</strong> on if available</li><li>Screen capture uses Electron desktopCapturer; no extra helper binary</li></ul>',
      buttons: [
        { label: 'Open Microphone settings', action: () => cue.openPane('ms-settings:privacy-microphone') }
      ]
    }] : []),
    {
      mark: 'zap',
      title: 'Connect an AI provider',
      body: 'Cue uses <strong>your</strong> API key. Pick <span class="hl">OpenAI</span>, <span class="hl">Anthropic</span>, <span class="hl">Gemini</span>, or <span class="hl">Nvidia</span>, then paste the key in Settings.<br><br>Listening needs speech-to-text (OpenAI with Whisper, or Gemini). A chat-only key still powers screen and coding help.',
      buttons: [{ label: 'Open Settings', action: () => { openSettings(); } }]
    },
    {
      mark: 'list',
      title: 'Stay hidden in Zoom',
      body: 'Cue asks the OS to exclude this window from capture. That is best-effort, not a guarantee.<br><br><strong>Zoom:</strong> Settings &gt; Share Screen &gt; Advanced &gt; Screen capture mode &gt; <strong>Advanced capture with window filtering</strong>.'
    },
    {
      mark: 'sparkles',
      title: 'Ready',
      body: () => {
        const keyNote = hasAnyKey(settings)
          ? 'A provider key is saved on this device.'
          : '<strong class="hl">No provider key yet.</strong> Open Settings and paste one before Assist will work.';
        return `${keyNote}<ul><li>${shortcutKeycapsHtml(assistShortcut, 'kbd')} Assist</li><li><span class="kbd">${cmdKey}</span> <span class="kbd">H</span> Solve the coding problem on screen</li><li>Top-bar listen button starts meeting capture (consent required)</li><li>Transcript drawer shows You / Them turns (memory only)</li><li>Quit with <span class="kbd">${cmdKey}</span> <span class="kbd">Shift</span> <span class="kbd">X</span></li></ul>Reopen this guide from the Cue logo.`;
      }
    }
  ];

  let obIndex = 0;
  function renderOnboard() {
    const step = OB_STEPS[obIndex];
    $('#ob-icon').innerHTML = icon(step.mark || 'logo', { size: 22 });
    $('#ob-title').textContent = step.title;
    $('#ob-body').innerHTML = typeof step.body === 'function' ? step.body() : step.body;
    const btns = $('#ob-buttons');
    btns.innerHTML = '';
    (step.buttons || []).forEach((b) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = b.label;
      el.addEventListener('click', b.action);
      btns.appendChild(el);
    });
    const dots = $('#ob-dots');
    dots.innerHTML = '';
    OB_STEPS.forEach((_, i) => {
      const d = document.createElement('span');
      if (i === obIndex) d.className = 'on';
      dots.appendChild(d);
    });
    $('#ob-back').classList.toggle('vis-hidden', obIndex === 0);
    const last = obIndex === OB_STEPS.length - 1;
    $('#ob-next').textContent = last ? (hasAnyKey(settings) ? 'Done' : 'Add a key first') : 'Next';
    $('#ob-next').disabled = last && !hasAnyKey(settings);
    $('#ob-skip').classList.toggle('vis-hidden', last);
    animateIn($('#onboard'), { y: 10, scale: 0.98, duration: 0.3 });
  }

  function showOnboard() {
    obIndex = 0;
    renderOnboard();
    obScrim.classList.remove('hidden');
    setIgnore(false);
    if (window.CUE_FOCUS) releaseOnboardFocus = window.CUE_FOCUS.trapFocus($('#onboard'), { initialFocus: '#ob-next' });
  }

  async function finishOnboard() {
    settings = await cue.settingsGet();
    if (!hasAnyKey(settings)) {
      showStatus('Add at least one API key before finishing setup.');
      openSettings();
      return;
    }
    settings.onboarded = true;
    await cue.settingsSet({ onboarded: true });
    settings = await cue.settingsGet();
    obScrim.classList.add('hidden');
    if (releaseOnboardFocus) { releaseOnboardFocus(); releaseOnboardFocus = null; }
  }

  function showPrivacy() {
    privacyScrim.classList.remove('hidden');
    setIgnore(false);
    animateIn($('#privacy'), { y: 10, scale: 0.98, duration: 0.3 });
    if (window.CUE_FOCUS) releasePrivacyFocus = window.CUE_FOCUS.trapFocus($('#privacy'), { initialFocus: '#privacy-ack' });
  }

  $('#privacy-ack').addEventListener('click', async () => {
    settings.privacyAck = true;
    await cue.settingsSet({ privacyAck: true, privacyNoticeVersion: 2 });
    settings = await cue.settingsGet();
    privacyScrim.classList.add('hidden');
    if (releasePrivacyFocus) { releasePrivacyFocus(); releasePrivacyFocus = null; }
    if (!settings.onboarded) showOnboard();
  });

  $('#ob-next').addEventListener('click', () => {
    if (obIndex === OB_STEPS.length - 1) finishOnboard();
    else { obIndex++; renderOnboard(); }
  });
  $('#ob-back').addEventListener('click', () => {
    if (obIndex > 0) { obIndex--; renderOnboard(); }
  });
  $('#ob-skip').addEventListener('click', async () => {
    // Skip never marks onboarded. Hide the guide and open Settings so the user can add a key.
    obScrim.classList.add('hidden');
    if (releaseOnboardFocus) { releaseOnboardFocus(); releaseOnboardFocus = null; }
    showStatus('Setup is not finished. Add an API key in Settings, then reopen the guide from the Cue logo.');
    openSettings();
  });
  $('#logo-btn').addEventListener('click', showOnboard);

  document.querySelectorAll('.linkish[data-docs]').forEach((btn) => {
    btn.addEventListener('click', () => cue.openPane(btn.getAttribute('data-docs')));
  });

  (async function boot() {
    settings = await cue.settingsGet();
    if (settings._storeNotice) showStatus(settings._storeNotice);
    if (settings._encryptionWarning) showStatus(settings._encryptionWarning);
    if (settings._saveError) showStatus('Could not save settings: ' + settings._saveError);
    assistShortcut = (settings.shortcuts && settings.shortcuts.assist) || DEFAULT_ASSIST_SHORTCUT;
    syncAssistShortcutLabels();
    smartBtn.classList.toggle('on', !!settings.smart);
    applyCompact(!!settings.compact);
    applyOpacity(settings.opacity != null ? settings.opacity : 0.92);
    showExample();
    syncPlaceholder();
    const st = await cue.captureState();
    $('#live-dot').classList.toggle('off', !st.active);
    $('#stop-btn').classList.toggle('active', st.active);
    pulseLive(!!st.active);
    animateIn($('#toolbar'), { y: -8, duration: 0.4 });
    animateIn($('#panel'), { y: 10, duration: 0.42 });
    const privacyStale = !settings.privacyAck || Number(settings.privacyNoticeVersion || 0) < 2;
    if (privacyStale) showPrivacy();
    else if (!settings.onboarded) showOnboard();
  })();
})();
