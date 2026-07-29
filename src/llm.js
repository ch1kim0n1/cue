// LLM factory — OpenAI / Anthropic / Gemini behind one streaming interface.
// stream({ system, turns, imageDataUrl, maxTokens, onToken, signal }) -> Promise<fullText>
const { withRetry } = require('./retry');

function stripDataUrl(dataUrl) {
  const m = /^data:(.+?);base64,(.*)$/s.exec(dataUrl || '');
  return m ? { mime: m[1], b64: m[2] } : null;
}

function throwIfAborted(signal) {
  if (signal && signal.aborted) {
    const err = new Error('Request cancelled');
    err.name = 'AbortError';
    err.code = 'ABORT_ERR';
    throw err;
  }
}

async function streamOpenAI({ apiKey, model, system, turns, imageDataUrl, maxTokens, onToken, baseURL, signal }) {
  const OpenAI = require('openai');
  const client = new OpenAI({ apiKey, baseURL });
  const messages = [{ role: 'system', content: system }];
  turns.forEach((t, i) => {
    const last = i === turns.length - 1;
    if (last && imageDataUrl && t.role === 'user') {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: t.text },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      });
    } else {
      messages.push({ role: t.role, content: t.text });
    }
  });

  return withRetry(async () => {
    throwIfAborted(signal);
    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
      max_tokens: maxTokens
    }, { signal });
    let full = '';
    for await (const part of stream) {
      throwIfAborted(signal);
      const d = part.choices && part.choices[0] && part.choices[0].delta && part.choices[0].delta.content;
      if (d) { full += d; onToken(d); }
    }
    return full;
  });
}

async function streamAnthropic({ apiKey, model, system, turns, imageDataUrl, maxTokens, onToken, signal }) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const messages = turns.map((t, i) => {
    const last = i === turns.length - 1;
    if (last && imageDataUrl && t.role === 'user') {
      const img = stripDataUrl(imageDataUrl);
      const content = [];
      if (img) content.push({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.b64 } });
      content.push({ type: 'text', text: t.text });
      return { role: 'user', content };
    }
    return { role: t.role, content: t.text };
  });

  return withRetry(async () => {
    throwIfAborted(signal);
    const stream = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages,
      stream: true
    }, { signal });
    let full = '';
    for await (const ev of stream) {
      throwIfAborted(signal);
      if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
        full += ev.delta.text;
        onToken(ev.delta.text);
      }
    }
    return full;
  });
}

async function streamGemini({ apiKey, model, system, turns, imageDataUrl, maxTokens, onToken, signal }) {
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const contents = turns.map((t, i) => {
    const last = i === turns.length - 1;
    const parts = [{ text: t.text }];
    if (last && imageDataUrl && t.role === 'user') {
      const img = stripDataUrl(imageDataUrl);
      if (img) parts.push({ inlineData: { mimeType: img.mime, data: img.b64 } });
    }
    return { role: t.role === 'assistant' ? 'model' : 'user', parts };
  });

  return withRetry(async () => {
    throwIfAborted(signal);
    const stream = await ai.models.generateContentStream({
      model,
      contents,
      config: { systemInstruction: system, maxOutputTokens: maxTokens, abortSignal: signal }
    });
    let full = '';
    for await (const chunk of stream) {
      throwIfAborted(signal);
      const t = chunk && chunk.text;
      if (t) { full += t; onToken(t); }
    }
    return full;
  });
}

const FALLBACK_MODELS = {
  openai: { fast: 'gpt-4o-mini', smart: 'gpt-4o' },
  anthropic: { fast: 'claude-3-5-haiku-latest', smart: 'claude-3-5-sonnet-latest' },
  gemini: { fast: 'gemini-2.5-flash', smart: 'gemini-2.5-pro' },
  nvidia: { fast: 'meta/llama-3.2-11b-vision-instruct', smart: 'meta/llama-3.2-90b-vision-instruct' }
};

function isModelMissing(err) {
  const code = err && err.code;
  const status = err && (err.status || err.statusCode);
  const msg = String((err && err.message) || '');
  return code === 'model_not_found' || status === 404 || /model[_ ]?not[_ ]?found|does not exist|deprecated/i.test(msg);
}

function createLLM(settings) {
  const provider = settings.provider;
  const keys = settings.apiKeys || {};
  const apiKey = keys[provider];
  const tier = settings.smart ? 'smart' : 'fast';
  let model = (settings.models[provider] || {})[tier];
  const defaultMaxTokens = 4096;

  return {
    provider,
    model,
    apiKey,
    ready: !!apiKey && !!model,
    usedFallback: false,
    fallbackModel: null,
    async stream(params) {
      const maxTokens = params.maxTokens || defaultMaxTokens;
      this.usedFallback = false;
      this.fallbackModel = null;
      const run = async (useModel) => {
        const args = { apiKey, model: useModel, maxTokens, ...params };
        if (provider === 'openai') return streamOpenAI(args);
        if (provider === 'nvidia') return streamOpenAI({ ...args, baseURL: 'https://integrate.api.nvidia.com/v1' });
        if (provider === 'anthropic') return streamAnthropic(args);
        if (provider === 'gemini') return streamGemini(args);
        throw new Error('unknown provider: ' + provider);
      };
      try {
        return await run(model);
      } catch (err) {
        if (err && (err.name === 'AbortError' || err.code === 'ABORT_ERR')) throw err;
        const fallback = (FALLBACK_MODELS[provider] || {})[tier];
        if (fallback && fallback !== model && isModelMissing(err)) {
          model = fallback;
          this.usedFallback = true;
          this.fallbackModel = fallback;
          this.model = fallback;
          return run(fallback);
        }
        throw err;
      }
    }
  };
}

module.exports = { createLLM, FALLBACK_MODELS, isModelMissing };
