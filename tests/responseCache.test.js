import { describe, it, expect, beforeEach } from 'vitest';
const { ResponseCache, metricsCache, analyticsCache } = require('../services/responseCache');

describe('ResponseCache', () => {
  let cache;

  beforeEach(() => {
    cache = new ResponseCache(100); // 100ms TTL for tests
  });

  it('returns undefined for missing key', () => {
    expect(cache.get('nope')).toBeUndefined();
  });

  it('stores and retrieves values', () => {
    cache.set('k', { data: 42 });
    expect(cache.get('k')).toEqual({ data: 42 });
  });

  it('expires entries after TTL', async () => {
    cache.set('k', 'val', 10); // 10ms TTL
    expect(cache.get('k')).toBe('val');
    await new Promise(r => setTimeout(r, 20));
    expect(cache.get('k')).toBeUndefined();
  });

  it('invalidates a specific key', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.invalidate('a');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
  });

  it('clears all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('reports size correctly', () => {
    expect(cache.size).toBe(0);
    cache.set('x', 1);
    cache.set('y', 2);
    expect(cache.size).toBe(2);
  });

  it('overwrites existing key', () => {
    cache.set('k', 'old');
    cache.set('k', 'new');
    expect(cache.get('k')).toBe('new');
  });
});

describe('Shared cache instances', () => {
  it('metricsCache is a ResponseCache', () => {
    expect(metricsCache).toBeInstanceOf(ResponseCache);
  });

  it('analyticsCache is a ResponseCache', () => {
    expect(analyticsCache).toBeInstanceOf(ResponseCache);
  });
});

describe('ResponseCache middleware', () => {
  it('returns a function', () => {
    const cache = new ResponseCache();
    const mw = cache.middleware(1000);
    expect(typeof mw).toBe('function');
  });

  it('calls next() for non-GET requests', () => {
    const cache = new ResponseCache();
    const mw = cache.middleware(1000);
    let nextCalled = false;
    mw({ method: 'POST' }, {}, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('serves cached response on cache hit', () => {
    const cache = new ResponseCache(5000);
    cache.set('/test', { cached: true });
    const mw = cache.middleware(5000);
    let sentData = null;
    const res = { json: (d) => { sentData = d; }, statusCode: 200 };
    const req = { method: 'GET', originalUrl: '/test' };
    let nextCalled = false;
    mw(req, res, () => { nextCalled = true; });
    expect(sentData).toEqual({ cached: true });
    expect(nextCalled).toBe(false);
  });

  it('caches response on cache miss', () => {
    const cache = new ResponseCache(5000);
    const mw = cache.middleware(5000);
    const origJson = (d) => d;
    const res = { json: origJson, statusCode: 200 };
    const req = { method: 'GET', originalUrl: '/new' };
    let nextCalled = false;
    mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    // Call the wrapped json — should cache
    res.json({ fresh: true });
    expect(cache.get('/new')).toEqual({ fresh: true });
  });
});
