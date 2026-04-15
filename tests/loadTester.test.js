import { describe, it, expect } from 'vitest';

const lt = require('../services/loadTester');

// ── Config Validation ──
describe('Config Validation', () => {
  it('requires URL', () => {
    const r = lt.validateConfig({});
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('URL is required');
  });

  it('rejects invalid URL', () => {
    const r = lt.validateConfig({ url: 'not-a-url' });
    expect(r.valid).toBe(false);
  });

  it('accepts valid config', () => {
    const r = lt.validateConfig({ url: 'https://example.com', concurrency: 10, totalRequests: 50 });
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('rejects concurrency > 500', () => {
    const r = lt.validateConfig({ url: 'https://example.com', concurrency: 501 });
    expect(r.valid).toBe(false);
  });

  it('rejects totalRequests > 10000', () => {
    const r = lt.validateConfig({ url: 'https://example.com', totalRequests: 10001 });
    expect(r.valid).toBe(false);
  });
});

// ── Percentile Calculation ──
describe('Percentile Calculation', () => {
  it('calculates p50 from sorted array', () => {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(lt.calculatePercentile(arr, 50)).toBe(50);
  });

  it('calculates p95 from sorted array', () => {
    const arr = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(lt.calculatePercentile(arr, 95)).toBe(100);
  });

  it('returns 0 for empty array', () => {
    expect(lt.calculatePercentile([], 50)).toBe(0);
  });

  it('handles single-element array', () => {
    expect(lt.calculatePercentile([42], 99)).toBe(42);
  });
});

// ── Duration Format ──
describe('Duration Format', () => {
  it('formats milliseconds', () => {
    expect(lt.formatDuration(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(lt.formatDuration(3500)).toBe('3.5s');
  });

  it('formats minutes', () => {
    expect(lt.formatDuration(120000)).toBe('2.0m');
  });
});

// ── Result Aggregation ──
describe('Result Aggregation Guards', () => {
  it('rejects config with 0 concurrency', () => {
    const r = lt.validateConfig({ url: 'https://example.com', concurrency: 0 });
    expect(r.valid).toBe(false);
  });

  it('rejects config with negative totalRequests', () => {
    const r = lt.validateConfig({ url: 'https://example.com', totalRequests: -1 });
    expect(r.valid).toBe(false);
  });

  it('rejects timeout below 100', () => {
    const r = lt.validateConfig({ url: 'https://example.com', timeout: 50 });
    expect(r.valid).toBe(false);
  });

  it('accepts timeout at 60000', () => {
    const r = lt.validateConfig({ url: 'https://example.com', timeout: 60000 });
    expect(r.valid).toBe(true);
  });
});

// ── Guards ──
describe('Guards', () => {
  it('accepts min concurrency of 1', () => {
    const r = lt.validateConfig({ url: 'https://example.com', concurrency: 1 });
    expect(r.valid).toBe(true);
  });

  it('accepts max concurrency of 500', () => {
    const r = lt.validateConfig({ url: 'https://example.com', concurrency: 500 });
    expect(r.valid).toBe(true);
  });

  it('accepts max totalRequests of 10000', () => {
    const r = lt.validateConfig({ url: 'https://example.com', totalRequests: 10000 });
    expect(r.valid).toBe(true);
  });
});

// ── Exports ──
describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof lt.validateConfig).toBe('function');
    expect(typeof lt.calculatePercentile).toBe('function');
    expect(typeof lt.formatDuration).toBe('function');
    expect(typeof lt.runLoadTest).toBe('function');
    expect(typeof lt.saveTest).toBe('function');
    expect(typeof lt.getTests).toBe('function');
    expect(typeof lt.getTest).toBe('function');
    expect(typeof lt.deleteTest).toBe('function');
    expect(typeof lt.sendRequest).toBe('function');
  });
});

// ── Percentile Edge Cases ──
describe('Percentile Edge Cases', () => {
  it('calculates p1 correctly', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(lt.calculatePercentile(arr, 1)).toBe(1);
  });

  it('calculates p100 correctly', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(lt.calculatePercentile(arr, 100)).toBe(5);
  });

  it('handles null array', () => {
    expect(lt.calculatePercentile(null, 50)).toBe(0);
  });
});

// ── Config Validation Edge Cases ──
describe('Config Validation Edge Cases', () => {
  it('rejects private/localhost URLs (SSRF protection)', () => {
    const r = lt.validateConfig({ url: 'http://localhost:3000' });
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Cannot target private/internal IP addresses');
  });

  it('accepts public http URL', () => {
    const r = lt.validateConfig({ url: 'http://example.com' });
    expect(r.valid).toBe(true);
  });

  it('rejects timeout above 60000', () => {
    const r = lt.validateConfig({ url: 'https://example.com', timeout: 70000 });
    expect(r.valid).toBe(false);
  });
});
