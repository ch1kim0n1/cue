/**
 * Approximate BYOK spend helpers (USD). Prices are rough list rates and may lag providers.
 * Used for UI estimates only — not billing.
 */

/** @typedef {{ inPerMTok: number, outPerMTok: number }} ModelPrice */

/** @type {Record<string, ModelPrice>} */
const MODEL_PRICES = {
  'gpt-4o-mini': { inPerMTok: 0.15, outPerMTok: 0.6 },
  'gpt-4o': { inPerMTok: 2.5, outPerMTok: 10 },
  'claude-3-5-haiku-latest': { inPerMTok: 0.8, outPerMTok: 4 },
  'claude-3-5-sonnet-latest': { inPerMTok: 3, outPerMTok: 15 },
  'gemini-2.5-flash': { inPerMTok: 0.15, outPerMTok: 0.6 },
  'gemini-2.5-pro': { inPerMTok: 1.25, outPerMTok: 10 },
  'meta/llama-3.2-11b-vision-instruct': { inPerMTok: 0.2, outPerMTok: 0.2 },
  'meta/llama-3.2-90b-vision-instruct': { inPerMTok: 0.9, outPerMTok: 0.9 }
};

const DEFAULT_PRICE = { inPerMTok: 1, outPerMTok: 3 };
const CHARS_PER_TOKEN = 4;

/**
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  const n = String(text || '').length;
  return Math.max(1, Math.ceil(n / CHARS_PER_TOKEN));
}

/**
 * @param {string} model
 * @returns {ModelPrice}
 */
function priceForModel(model) {
  if (MODEL_PRICES[model]) return MODEL_PRICES[model];
  const key = Object.keys(MODEL_PRICES).find((k) => model && String(model).includes(k.split('/').pop()));
  return key ? MODEL_PRICES[key] : DEFAULT_PRICE;
}

/**
 * @param {{ model?: string, inputText?: string, outputText?: string, hasImage?: boolean }} opts
 * @returns {{ usd: number, inTokens: number, outTokens: number }}
 */
function estimateCallCost(opts) {
  const price = priceForModel(opts.model || '');
  let inTokens = estimateTokens(opts.inputText || '');
  if (opts.hasImage) inTokens += 800;
  const outTokens = estimateTokens(opts.outputText || '');
  const usd = (inTokens / 1e6) * price.inPerMTok + (outTokens / 1e6) * price.outPerMTok;
  return { usd, inTokens, outTokens };
}

/**
 * @param {number} usd
 * @returns {string}
 */
function formatUsd(usd) {
  if (!Number.isFinite(usd) || usd <= 0) return '$0.000';
  if (usd < 0.01) return '≈ $' + usd.toFixed(3);
  return '≈ $' + usd.toFixed(2);
}

module.exports = {
  MODEL_PRICES,
  estimateTokens,
  estimateCallCost,
  formatUsd,
  priceForModel
};
