import { describe, it, expect } from 'vitest';

const lc = require('../services/linkChecker');

// ── URL Validation ──
describe('URL Validation', () => {
  it('accepts https URL', () => {
    expect(lc.isValidUrl('https://example.com')).toBe(true);
  });

  it('accepts http URL', () => {
    expect(lc.isValidUrl('http://example.com')).toBe(true);
  });

  it('rejects ftp URL', () => {
    expect(lc.isValidUrl('ftp://example.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(lc.isValidUrl('')).toBe(false);
  });

  it('rejects null', () => {
    expect(lc.isValidUrl(null)).toBe(false);
  });
});

// ── Result Categorization ──
describe('Result Categorization', () => {
  it('categorizes 200 as ok', () => {
    expect(lc.categorizeResult({ status: 200 })).toBe('ok');
  });

  it('categorizes 301 as redirect', () => {
    expect(lc.categorizeResult({ status: 301 })).toBe('redirect');
  });

  it('categorizes 404 as client-error', () => {
    expect(lc.categorizeResult({ status: 404 })).toBe('client-error');
  });

  it('categorizes 500 as server-error', () => {
    expect(lc.categorizeResult({ status: 500 })).toBe('server-error');
  });

  it('categorizes timeout', () => {
    expect(lc.categorizeResult({ error: 'timeout' })).toBe('timeout');
  });

  it('categorizes generic error', () => {
    expect(lc.categorizeResult({ error: 'ECONNREFUSED' })).toBe('error');
  });
});

// ── Link Extraction ──
describe('Link Extraction', () => {
  it('extracts absolute links', () => {
    const html = '<a href="https://example.com">Link</a>';
    const links = lc.extractLinks(html);
    expect(links).toContain('https://example.com');
  });

  it('resolves relative links with base URL', () => {
    const html = '<a href="/about">About</a>';
    const links = lc.extractLinks(html, 'https://example.com');
    expect(links).toContain('https://example.com/about');
  });

  it('skips mailto links', () => {
    const html = '<a href="mailto:test@example.com">Email</a>';
    const links = lc.extractLinks(html);
    expect(links).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(lc.extractLinks('')).toEqual([]);
    expect(lc.extractLinks(null)).toEqual([]);
  });
});

// ── Summary Building ──
describe('Summary Building', () => {
  it('builds summary from results', () => {
    const results = [
      { url: 'https://a.com', status: 200, latency: 100, category: 'ok' },
      { url: 'https://b.com', status: 404, latency: 200, category: 'client-error' },
      { url: 'https://c.com', status: 301, latency: 50, category: 'redirect' },
    ];
    const summary = lc.buildSummary(results);
    expect(summary.total).toBe(3);
    expect(summary.ok).toBe(1);
    expect(summary.clientError).toBe(1);
    expect(summary.redirect).toBe(1);
  });

  it('finds fastest and slowest', () => {
    const results = [
      { url: 'https://fast.com', status: 200, latency: 50, category: 'ok' },
      { url: 'https://slow.com', status: 200, latency: 500, category: 'ok' },
    ];
    const summary = lc.buildSummary(results);
    expect(summary.fastest.url).toBe('https://fast.com');
    expect(summary.slowest.url).toBe('https://slow.com');
  });

  it('handles empty results', () => {
    const summary = lc.buildSummary([]);
    expect(summary.total).toBe(0);
  });
});

// ── Normalize URL ──
describe('Normalize URL', () => {
  it('adds https:// prefix', () => {
    expect(lc.normalizeUrl('example.com')).toBe('https://example.com');
  });

  it('removes trailing slash', () => {
    expect(lc.normalizeUrl('https://example.com/')).toBe('https://example.com');
  });

  it('preserves existing http://', () => {
    expect(lc.normalizeUrl('http://example.com')).toBe('http://example.com');
  });
});

// ── Guards ──
describe('Guards', () => {
  it('categorizes null result as error', () => {
    expect(lc.categorizeResult(null)).toBe('error');
  });

  it('handles normalizeUrl with empty string', () => {
    expect(lc.normalizeUrl('')).toBe('');
  });
});

// ── Link Extraction Edge Cases ──
describe('Link Extraction Edge Cases', () => {
  it('skips hash links', () => {
    const html = '<a href="#section">Jump</a>';
    expect(lc.extractLinks(html)).toHaveLength(0);
  });

  it('skips javascript: links', () => {
    const html = '<a href="javascript:void(0)">Click</a>';
    expect(lc.extractLinks(html)).toHaveLength(0);
  });

  it('deduplicates same URL', () => {
    const html = '<a href="https://example.com">1</a><a href="https://example.com">2</a>';
    expect(lc.extractLinks(html)).toHaveLength(1);
  });
});

// ── Exports ──
describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof lc.isValidUrl).toBe('function');
    expect(typeof lc.normalizeUrl).toBe('function');
    expect(typeof lc.categorizeResult).toBe('function');
    expect(typeof lc.checkUrl).toBe('function');
    expect(typeof lc.checkUrls).toBe('function');
    expect(typeof lc.extractLinks).toBe('function');
    expect(typeof lc.buildSummary).toBe('function');
    expect(typeof lc.saveCheck).toBe('function');
    expect(typeof lc.getChecks).toBe('function');
    expect(typeof lc.getCheck).toBe('function');
    expect(typeof lc.deleteCheck).toBe('function');
  });
});
