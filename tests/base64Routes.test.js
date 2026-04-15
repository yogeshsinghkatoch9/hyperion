/**
 * Route tests for routes/base64.js
 * Tests the /api/base64/* HTTP endpoints via the test server.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { setup, teardown, authedFetch, getBaseUrl } = require('./setup');

let env;
beforeAll(async () => { env = await setup(); });
afterAll(async () => { await teardown(); });

describe('POST /api/base64/encode', () => {
  it('encodes ASCII text to base64', async () => {
    const res = await authedFetch('/api/base64/encode', {
      method: 'POST',
      body: JSON.stringify({ text: 'Hello World' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBe('SGVsbG8gV29ybGQ=');
  });

  it('encodes empty string to empty base64', async () => {
    const res = await authedFetch('/api/base64/encode', {
      method: 'POST',
      body: JSON.stringify({ text: '' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBe('');
  });

  it('returns 400 when text is null', async () => {
    const res = await authedFetch('/api/base64/encode', {
      method: 'POST',
      body: JSON.stringify({ text: null }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe('POST /api/base64/decode', () => {
  it('decodes valid base64 to text', async () => {
    const res = await authedFetch('/api/base64/decode', {
      method: 'POST',
      body: JSON.stringify({ text: 'SGVsbG8gV29ybGQ=' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBe('Hello World');
  });

  it('returns 400 when text is null', async () => {
    const res = await authedFetch('/api/base64/decode', {
      method: 'POST',
      body: JSON.stringify({ text: null }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe('POST /api/base64/encode-url', () => {
  it('encodes text to URL-safe base64 without + / or =', async () => {
    const res = await authedFetch('/api/base64/encode-url', {
      method: 'POST',
      body: JSON.stringify({ text: '>>??>><<' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).not.toContain('+');
    expect(data.result).not.toContain('/');
    expect(data.result).not.toContain('=');
  });
});

describe('POST /api/base64/decode-url', () => {
  it('roundtrips encode-url then decode-url', async () => {
    const original = 'test data with special chars: >>??';
    const encRes = await authedFetch('/api/base64/encode-url', {
      method: 'POST',
      body: JSON.stringify({ text: original }),
    });
    const { result: encoded } = await encRes.json();

    const decRes = await authedFetch('/api/base64/decode-url', {
      method: 'POST',
      body: JSON.stringify({ text: encoded }),
    });
    const { result: decoded } = await decRes.json();
    expect(decoded).toBe(original);
  });
});

describe('POST /api/base64/validate', () => {
  it('returns valid:true for valid base64', async () => {
    const res = await authedFetch('/api/base64/validate', {
      method: 'POST',
      body: JSON.stringify({ text: 'SGVsbG8=' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
  });

  it('returns valid:false for invalid base64', async () => {
    const res = await authedFetch('/api/base64/validate', {
      method: 'POST',
      body: JSON.stringify({ text: '!!!invalid!!!' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(false);
  });
});

describe('POST /api/base64/encode-file', () => {
  it('encodes buffer data to a data URI', async () => {
    const rawBase64 = Buffer.from('Hello file content').toString('base64');
    const res = await authedFetch('/api/base64/encode-file', {
      method: 'POST',
      body: JSON.stringify({ data: rawBase64, mime: 'text/plain' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toMatch(/^data:text\/plain;base64,/);
  });

  it('returns 400 when mime type is missing', async () => {
    const rawBase64 = Buffer.from('test').toString('base64');
    const res = await authedFetch('/api/base64/encode-file', {
      method: 'POST',
      body: JSON.stringify({ data: rawBase64, mime: '' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe('Auth gate for base64 routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${getBaseUrl()}/api/base64/encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test' }),
    });
    expect(res.status).toBe(401);
  });
});
