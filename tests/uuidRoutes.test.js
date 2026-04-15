/**
 * Route tests for routes/uuid.js
 * Tests the /api/uuid/* HTTP endpoints via the test server.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { setup, teardown, authedFetch, getBaseUrl } = require('./setup');

let env;
beforeAll(async () => { env = await setup(); });
afterAll(async () => { await teardown(); });

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('GET /api/uuid/v4', () => {
  it('returns a valid v4 UUID', async () => {
    const res = await authedFetch('/api/uuid/v4');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.uuid).toMatch(V4_REGEX);
  });

  it('returns unique UUIDs on successive calls', async () => {
    const res1 = await authedFetch('/api/uuid/v4');
    const res2 = await authedFetch('/api/uuid/v4');
    const d1 = await res1.json();
    const d2 = await res2.json();
    expect(d1.uuid).not.toBe(d2.uuid);
  });
});

describe('GET /api/uuid/v1', () => {
  it('returns a valid v1 UUID', async () => {
    const res = await authedFetch('/api/uuid/v1');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.uuid).toMatch(UUID_REGEX);
    expect(data.uuid.charAt(14)).toBe('1');
  });

  it('returns unique UUIDs on successive calls', async () => {
    const res1 = await authedFetch('/api/uuid/v1');
    const res2 = await authedFetch('/api/uuid/v1');
    const d1 = await res1.json();
    const d2 = await res2.json();
    expect(d1.uuid).not.toBe(d2.uuid);
  });
});

describe('GET /api/uuid/nil', () => {
  it('returns the nil UUID', async () => {
    const res = await authedFetch('/api/uuid/nil');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.uuid).toBe('00000000-0000-0000-0000-000000000000');
  });
});

describe('POST /api/uuid/validate', () => {
  it('validates a correct v4 UUID', async () => {
    const uuidRes = await authedFetch('/api/uuid/v4');
    const { uuid } = await uuidRes.json();

    const res = await authedFetch('/api/uuid/validate', {
      method: 'POST',
      body: JSON.stringify({ uuid }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.version).toBe(4);
  });

  it('rejects an invalid UUID string', async () => {
    const res = await authedFetch('/api/uuid/validate', {
      method: 'POST',
      body: JSON.stringify({ uuid: 'not-a-uuid' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(false);
    expect(data.version).toBeNull();
  });

  it('validates the nil UUID', async () => {
    const res = await authedFetch('/api/uuid/validate', {
      method: 'POST',
      body: JSON.stringify({ uuid: '00000000-0000-0000-0000-000000000000' }),
    });
    const data = await res.json();
    expect(data.valid).toBe(true);
  });
});

describe('POST /api/uuid/parse', () => {
  it('parses a v4 UUID and returns version and variant', async () => {
    const uuidRes = await authedFetch('/api/uuid/v4');
    const { uuid } = await uuidRes.json();

    const res = await authedFetch('/api/uuid/parse', {
      method: 'POST',
      body: JSON.stringify({ uuid }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.parsed).toBeDefined();
    expect(data.parsed.version).toBe(4);
    expect(data.parsed.variant).toBe('RFC 4122');
  });

  it('returns 400 for an invalid UUID', async () => {
    const res = await authedFetch('/api/uuid/parse', {
      method: 'POST',
      body: JSON.stringify({ uuid: 'bad-string' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe('GET /api/uuid/batch', () => {
  it('returns the requested count of UUIDs', async () => {
    const res = await authedFetch('/api/uuid/batch?count=5');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.uuids)).toBe(true);
    expect(data.uuids).toHaveLength(5);
    data.uuids.forEach(u => expect(u).toMatch(V4_REGEX));
  });

  it('defaults to 5 when count is not provided', async () => {
    const res = await authedFetch('/api/uuid/batch');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.uuids).toHaveLength(5);
  });

  it('clamps count to maximum of 100', async () => {
    const res = await authedFetch('/api/uuid/batch?count=500');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.uuids.length).toBeLessThanOrEqual(100);
  });

  it('clamps count to minimum of 1', async () => {
    const res = await authedFetch('/api/uuid/batch?count=0');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.uuids.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Auth gate for uuid routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${getBaseUrl()}/api/uuid/v4`);
    expect(res.status).toBe(401);
  });
});
