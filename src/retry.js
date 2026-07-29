// Retry helper for transient provider failures (429 / 5xx).

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err) {
  const status = err && (err.status || err.statusCode);
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  const msg = String((err && err.message) || '');
  return /ECONNRESET|ETIMEDOUT|socket hang up|529|overloaded/i.test(msg);
}

async function withRetry(fn, options = {}) {
  const retries = options.retries != null ? options.retries : 1;
  const delays = options.delays || [500, 1500];
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt >= retries || !isRetryableError(err)) throw err;
      await sleep(delays[Math.min(attempt, delays.length - 1)]);
    }
  }
  throw lastErr;
}

module.exports = { withRetry, isRetryableError, sleep };
