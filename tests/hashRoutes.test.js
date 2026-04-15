/**
 * Route tests for routes/hash.js
 * Tests the /api/hash/* HTTP endpoints via the test server.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { setup, teardown, authedFetch, getBaseUrl } = require('./setup');

let env;
beforeAll(async () => { env = await setup(); });
afterAll(async () => { await teardown(); });

describe('POST /api/hash/generate', () => {
  it('generates sha256 hash by default', async () => {
    const res = await authedFetch('/api/hash/generate', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.algorithm).toBe('sha256');
    expect(data.hash).toHaveLength(64);
    expect(data.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates md5 hash when specified', async () => {
    const res = await authedFetch('/api/hash/generate', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello', algorithm: 'md5' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.algorithm).toBe('md5');
    expect(data.hash).toHaveLength(32);
  });

  it('generates sha512 hash when specified', async () => {
    const res = await authedFetch('/api/hash/generate', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello', algorithm: 'sha512' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.algorithm).toBe('sha512');
    expect(data.hash).toHaveLength(128);
  });

  it('is deterministic - same input yields same hash', async () => {
    const body = JSON.stringify({ text: 'deterministic', algorithm: 'sha256' });
    const res1 = await authedFetch('/api/hash/generate', { method: 'POST', body });
    const res2 = await authedFetch('/api/hash/generate', { method: 'POST', body });
    const d1 = await res1.json();
    const d2 = await res2.json();
    expect(d1.hash).toBe(d2.hash);
  });

  it('returns 400 for unsupported algorithm', async () => {
    const res = await authedFetch('/api/hash/generate', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello', algorithm: 'sha384' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe('POST /api/hash/hmac', () => {
  it('generates HMAC with sha256', async () => {
    const res = await authedFetch('/api/hash/hmac', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello', key: 'secret', algorithm: 'sha256' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.algorithm).toBe('sha256');
    expect(data.hash).toHaveLength(64);
  });

  it('returns 400 when key is missing', async () => {
    const res = await authedFetch('/api/hash/hmac', {
      method: 'POST',
      body: JSON.stringify({ text: 'hello', key: null }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe('POST /api/hash/compare', () => {
  it('matches text against its own sha256 hash', async () => {
    const hashRes = await authedFetch('/api/hash/generate', {
      method: 'POST',
      body: JSON.stringify({ text: 'testvalue', algorithm: 'sha256' }),
    });
    const { hash } = await hashRes.json();

    const res = await authedFetch('/api/hash/compare', {
      method: 'POST',
      body: JSON.stringify({ text: 'testvalue', hash }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.match).toBe(true);
    expect(data.algorithm).toBe('sha256');
  });

  it('returns no match for wrong text', async () => {
    const hashRes = await authedFetch('/api/hash/generate', {
      method: 'POST',
      body: JSON.stringify({ text: 'correct', algorithm: 'sha256' }),
    });
    const { hash } = await hashRes.json();

    const res = await authedFetch('/api/hash/compare', {
      method: 'POST',
      body: JSON.stringify({ text: 'wrong', hash }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.match).toBe(false);
    expect(data.algorithm).toBeNull();
  });
});

describe('POST /api/hash/bcrypt', () => {
  it('returns a bcrypt hash starting with $2', async () => {
    const res = await authedFetch('/api/hash/bcrypt', {
      method: 'POST',
      body: JSON.stringify({ text: 'password123', rounds: 4 }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.hash).toMatch(/^\$2[aby]?\$/);
  });

  it('returns 400 when text is null', async () => {
    const res = await authedFetch('/api/hash/bcrypt', {
      method: 'POST',
      body: JSON.stringify({ text: null }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe('POST /api/hash/bcrypt-compare', () => {
  it('returns true for correct password', async () => {
    const hashRes = await authedFetch('/api/hash/bcrypt', {
      method: 'POST',
      body: JSON.stringify({ text: 'mypassword', rounds: 4 }),
    });
    const { hash } = await hashRes.json();

    const res = await authedFetch('/api/hash/bcrypt-compare', {
      method: 'POST',
      body: JSON.stringify({ text: 'mypassword', hash }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.match).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hashRes = await authedFetch('/api/hash/bcrypt', {
      method: 'POST',
      body: JSON.stringify({ text: 'correct', rounds: 4 }),
    });
    const { hash } = await hashRes.json();

    const res = await authedFetch('/api/hash/bcrypt-compare', {
      method: 'POST',
      body: JSON.stringify({ text: 'wrong', hash }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.match).toBe(false);
  });
});

describe('GET /api/hash/algorithms', () => {
  it('returns a list of supported algorithms', async () => {
    const res = await authedFetch('/api/hash/algorithms');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.algorithms)).toBe(true);
    expect(data.algorithms).toContain('md5');
    expect(data.algorithms).toContain('sha1');
    expect(data.algorithms).toContain('sha256');
    expect(data.algorithms).toContain('sha512');
  });
});

describe('Auth gate for hash routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${getBaseUrl()}/api/hash/algorithms`);
    expect(res.status).toBe(401);
  });
});
