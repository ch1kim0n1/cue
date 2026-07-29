// Map provider/SDK failures to short user-facing copy.

const { providerLabel } = require('./secrets');

function friendlyProviderError(err, provider) {
  const status = err && (err.status || err.statusCode);
  const code = err && err.code;
  const name = providerLabel(provider || (err && err.provider));
  const msg = (err && err.message) || String(err || 'Unknown error');

  if (status === 401 || status === 403 || code === 'model_not_found') {
    return `${name} rejected the key or model. Check API access in Settings.`;
  }
  if (status === 429) {
    return `${name} rate-limited the request. Wait a moment, then retry.`;
  }
  if (status >= 500) {
    return `${name} is having server issues. Try again shortly.`;
  }
  if (/timeout|ETIMEDOUT|AbortError/i.test(msg)) {
    return `${name} timed out. Check your network and retry.`;
  }
  if (/ENOTFOUND|ECONNREFUSED|network/i.test(msg)) {
    return `Could not reach ${name}. Check your network connection.`;
  }
  return `${name} error: ${msg}`;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error((label || 'Operation') + ' timed out'), { code: 'ETIMEDOUT' })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { friendlyProviderError, withTimeout };
