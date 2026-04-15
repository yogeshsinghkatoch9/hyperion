'use strict';

/**
 * Simple in-memory TTL cache for API responses.
 * No external dependencies — uses a Map with expiry timestamps.
 */
class ResponseCache {
  constructor(defaultTtlMs = 30000) {
    this._cache = new Map();
    this._defaultTtl = defaultTtlMs;
  }

  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    this._cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs || this._defaultTtl),
    });
  }

  invalidate(key) {
    this._cache.delete(key);
  }

  clear() {
    this._cache.clear();
  }

  get size() {
    return this._cache.size;
  }

  /**
   * Express middleware factory: caches JSON responses for GET requests.
   * Usage: router.get('/path', cache.middleware(30000), handler)
   */
  middleware(ttlMs) {
    const cache = this;
    return (req, res, next) => {
      if (req.method !== 'GET') return next();
      const key = req.originalUrl || req.url;
      const cached = cache.get(key);
      if (cached !== undefined) {
        return res.json(cached);
      }
      const origJson = res.json.bind(res);
      res.json = (data) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cache.set(key, data, ttlMs);
        }
        return origJson(data);
      };
      next();
    };
  }
}

// Shared instances
const metricsCache = new ResponseCache(30000);   // 30s for system metrics
const analyticsCache = new ResponseCache(300000); // 5m for analytics

module.exports = { ResponseCache, metricsCache, analyticsCache };
