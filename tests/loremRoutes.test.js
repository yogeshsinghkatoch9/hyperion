/**
 * Route tests for routes/lorem.js
 * Tests the /api/lorem/* HTTP endpoints via the test server.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { setup, teardown, authedFetch, getBaseUrl } = require('./setup');

let env;
beforeAll(async () => { env = await setup(); });
afterAll(async () => { await teardown(); });

describe('GET /api/lorem/words', () => {
  it('returns the requested number of words', async () => {
    const res = await authedFetch('/api/lorem/words?count=5');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result.split(' ')).toHaveLength(5);
  });

  it('defaults to 10 words when count is not specified', async () => {
    const res = await authedFetch('/api/lorem/words');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result.split(' ')).toHaveLength(10);
  });

  it('returns a single word when count is 1', async () => {
    const res = await authedFetch('/api/lorem/words?count=1');
    const data = await res.json();
    expect(data.result.split(' ')).toHaveLength(1);
  });
});

describe('GET /api/lorem/sentences', () => {
  it('returns the requested number of sentences', async () => {
    const res = await authedFetch('/api/lorem/sentences?count=3');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    const periods = (data.result.match(/\./g) || []).length;
    expect(periods).toBe(3);
  });

  it('defaults to 3 sentences when count is not specified', async () => {
    const res = await authedFetch('/api/lorem/sentences');
    const data = await res.json();
    const periods = (data.result.match(/\./g) || []).length;
    expect(periods).toBe(3);
  });

  it('sentences start with uppercase letter', async () => {
    const res = await authedFetch('/api/lorem/sentences?count=1');
    const data = await res.json();
    expect(data.result.charAt(0)).toMatch(/[A-Z]/);
  });
});

describe('GET /api/lorem/paragraphs', () => {
  it('returns the requested number of paragraphs', async () => {
    const res = await authedFetch('/api/lorem/paragraphs?count=3');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result.split('\n\n')).toHaveLength(3);
  });

  it('defaults to 2 paragraphs when count is not specified', async () => {
    const res = await authedFetch('/api/lorem/paragraphs');
    const data = await res.json();
    expect(data.result.split('\n\n')).toHaveLength(2);
  });
});

describe('GET /api/lorem/name', () => {
  it('returns a name with first and last parts', async () => {
    const res = await authedFetch('/api/lorem/name');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result).toContain(' ');
    expect(data.result.split(' ')).toHaveLength(2);
  });
});

describe('GET /api/lorem/email', () => {
  it('returns an email with @ symbol', async () => {
    const res = await authedFetch('/api/lorem/email');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toContain('@');
    const parts = data.result.split('@');
    expect(parts).toHaveLength(2);
    expect(parts[1]).toContain('.');
  });
});

describe('GET /api/lorem/phone', () => {
  it('returns a phone number in US format', async () => {
    const res = await authedFetch('/api/lorem/phone');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
  });
});

describe('GET /api/lorem/address', () => {
  it('returns a non-empty address string', async () => {
    const res = await authedFetch('/api/lorem/address');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result.length).toBeGreaterThan(0);
    expect(data.result).toContain(',');
  });
});

describe('GET /api/lorem/company', () => {
  it('returns a non-empty company name', async () => {
    const res = await authedFetch('/api/lorem/company');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result.length).toBeGreaterThan(0);
  });
});

describe('GET /api/lorem/date', () => {
  it('returns a date value', async () => {
    const res = await authedFetch('/api/lorem/date');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBeDefined();
    // The result should be parseable as a date
    const parsed = new Date(data.result);
    expect(parsed.getTime()).toBeGreaterThan(0);
  });

  it('returns a date within the specified range', async () => {
    const res = await authedFetch('/api/lorem/date?from=2023-01-01&to=2023-12-31');
    const data = await res.json();
    const dt = new Date(data.result);
    expect(dt.getFullYear()).toBe(2023);
  });
});

describe('GET /api/lorem/number', () => {
  it('returns a number within the specified range', async () => {
    const res = await authedFetch('/api/lorem/number?min=1&max=10');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('number');
    expect(data.result).toBeGreaterThanOrEqual(1);
    expect(data.result).toBeLessThanOrEqual(10);
  });

  it('returns a number with no args', async () => {
    const res = await authedFetch('/api/lorem/number');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('number');
  });
});

describe('Auth gate for lorem routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${getBaseUrl()}/api/lorem/words`);
    expect(res.status).toBe(401);
  });
});
