// Tiny in-memory rate limiter (per IP). Good enough for a single server;
// use Redis or your host's rate limiting if you run several instances.
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [k, v] of hits) if (v.start < cutoff) hits.delete(k);
  }, windowMs).unref();
  return (req, res, next) => {
    if (req.method === 'GET') return next();
    const key = req.ip;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      entry = { start: now, count: 0 };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) return res.status(429).json({ error: message, code: 'rate_limited' });
    next();
  };
}

module.exports = { rateLimit };
