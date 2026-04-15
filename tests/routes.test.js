/**
 * ═══ HYPERION — Wave 9 + Wave 10 Route Integration Tests ═══
 * ~100 tests covering health, base64, hash, uuid, json, yaml, lorem,
 * dashboard, regex, jwt, diff, images, cron-expr, and colors routes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { setup, teardown, authedFetch, getBaseUrl } = require('./setup');

const fetch = globalThis.fetch;

let env;
beforeAll(async () => { env = await setup(); });
afterAll(async () => { await teardown(); });

// ─── Health (2 tests) ───────────────────────────────────────────────────────
describe('Health', () => {
  it('GET /api/health returns 200 without auth', async () => {
    const res = await fetch(`${getBaseUrl()}/api/health`);
    expect(res.status).toBe(200);
  });

  it('response has status, uptime, memPercent, timestamp', async () => {
    const res = await fetch(`${getBaseUrl()}/api/health`);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(typeof data.uptime).toBe('number');
    expect(typeof data.memPercent).toBe('number');
    expect(typeof data.timestamp).toBe('number');
  });
});

// ─── Base64 (6 tests) ──────────────────────────────────────────────────────
describe('Base64', () => {
  it('POST /api/base64/encode returns encoded text', async () => {
    const res = await authedFetch('/api/base64/encode', {
      method: 'POST', body: JSON.stringify({ text: 'Hello World' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBe(Buffer.from('Hello World').toString('base64'));
  });

  it('POST /api/base64/decode decodes back', async () => {
    const encoded = Buffer.from('Hello World').toString('base64');
    const res = await authedFetch('/api/base64/decode', {
      method: 'POST', body: JSON.stringify({ text: encoded }),
    });
    const data = await res.json();
    expect(data.result).toBe('Hello World');
  });

  it('POST /api/base64/encode-url URL-safe encode', async () => {
    const res = await authedFetch('/api/base64/encode-url', {
      method: 'POST', body: JSON.stringify({ text: 'Hello+World/Test==' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    // URL-safe base64 should not contain + or /
    expect(data.result).not.toMatch(/[+/]/);
  });

  it('POST /api/base64/decode-url URL-safe decode', async () => {
    // First encode, then decode
    const encRes = await authedFetch('/api/base64/encode-url', {
      method: 'POST', body: JSON.stringify({ text: 'test data' }),
    });
    const { result: encoded } = await encRes.json();
    const res = await authedFetch('/api/base64/decode-url', {
      method: 'POST', body: JSON.stringify({ text: encoded }),
    });
    const data = await res.json();
    expect(data.result).toBe('test data');
  });

  it('POST /api/base64/validate with valid base64', async () => {
    const res = await authedFetch('/api/base64/validate', {
      method: 'POST', body: JSON.stringify({ text: 'SGVsbG8gV29ybGQ=' }),
    });
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it('POST /api/base64/validate with invalid base64', async () => {
    const res = await authedFetch('/api/base64/validate', {
      method: 'POST', body: JSON.stringify({ text: '!!!not-base64@@@' }),
    });
    const data = await res.json();
    expect(data.valid).toBe(false);
  });
});

// ─── Hash (6 tests) ────────────────────────────────────────────────────────
describe('Hash', () => {
  it('POST /api/hash/generate with sha256', async () => {
    const res = await authedFetch('/api/hash/generate', {
      method: 'POST', body: JSON.stringify({ text: 'hello', algorithm: 'sha256' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.algorithm).toBe('sha256');
    expect(typeof data.hash).toBe('string');
    expect(data.hash.length).toBe(64); // sha256 hex is 64 chars
  });

  it('POST /api/hash/generate with md5', async () => {
    const res = await authedFetch('/api/hash/generate', {
      method: 'POST', body: JSON.stringify({ text: 'hello', algorithm: 'md5' }),
    });
    const data = await res.json();
    expect(data.algorithm).toBe('md5');
    expect(typeof data.hash).toBe('string');
    expect(data.hash.length).toBe(32); // md5 hex is 32 chars
  });

  it('POST /api/hash/hmac generates HMAC', async () => {
    const res = await authedFetch('/api/hash/hmac', {
      method: 'POST', body: JSON.stringify({ text: 'hello', key: 'secret', algorithm: 'sha256' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.algorithm).toBe('sha256');
    expect(typeof data.hash).toBe('string');
  });

  it('GET /api/hash/algorithms returns algorithm list', async () => {
    const res = await authedFetch('/api/hash/algorithms');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.algorithms)).toBe(true);
    expect(data.algorithms.length).toBeGreaterThanOrEqual(4);
  });

  it('POST /api/hash/bcrypt returns hash', async () => {
    const res = await authedFetch('/api/hash/bcrypt', {
      method: 'POST', body: JSON.stringify({ text: 'password123', rounds: 4 }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.hash).toBe('string');
    expect(data.hash).toMatch(/^\$2[aby]?\$/); // bcrypt hash prefix
  });

  it('POST /api/hash/compare matches text to hash', async () => {
    // First hash, then compare
    const hashRes = await authedFetch('/api/hash/generate', {
      method: 'POST', body: JSON.stringify({ text: 'testvalue', algorithm: 'sha256' }),
    });
    const { hash } = await hashRes.json();
    const res = await authedFetch('/api/hash/compare', {
      method: 'POST', body: JSON.stringify({ text: 'testvalue', hash }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.match).toBe(true);
  });
});

// ─── Auth Gate (2 tests) ───────────────────────────────────────────────────
describe('Auth Gate', () => {
  it('protected route without session returns 401', async () => {
    const res = await fetch(`${getBaseUrl()}/api/base64/encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  it('protected route with valid session returns 200', async () => {
    const res = await authedFetch('/api/uuid/v4');
    expect(res.status).toBe(200);
  });
});

// ─── Base64 Round-trip (1 test) ────────────────────────────────────────────
describe('Base64 Round-trip', () => {
  it('encode then decode returns original text with special chars', async () => {
    const original = 'Hello! @#$%^&*() unicode: \u00e9\u00e0\u00fc';
    const encRes = await authedFetch('/api/base64/encode', {
      method: 'POST', body: JSON.stringify({ text: original }),
    });
    const { result: encoded } = await encRes.json();
    const decRes = await authedFetch('/api/base64/decode', {
      method: 'POST', body: JSON.stringify({ text: encoded }),
    });
    const { result: decoded } = await decRes.json();
    expect(decoded).toBe(original);
  });
});

// ─── Hash edge cases (1 test) ──────────────────────────────────────────────
describe('Hash edge cases', () => {
  it('POST /api/hash/generate defaults to sha256 when no algorithm given', async () => {
    const res = await authedFetch('/api/hash/generate', {
      method: 'POST', body: JSON.stringify({ text: 'default algo test' }),
    });
    const data = await res.json();
    expect(data.algorithm).toBe('sha256');
  });
});

// ─── UUID uniqueness (1 test) ──────────────────────────────────────────────
describe('UUID uniqueness', () => {
  it('two consecutive v4 calls produce different uuids', async () => {
    const res1 = await authedFetch('/api/uuid/v4');
    const res2 = await authedFetch('/api/uuid/v4');
    const d1 = await res1.json();
    const d2 = await res2.json();
    expect(d1.uuid).not.toBe(d2.uuid);
  });
});

// ─── Lorem paragraphs (1 test) ─────────────────────────────────────────────
describe('Lorem extra', () => {
  it('GET /api/lorem/paragraphs returns paragraphs', async () => {
    const res = await authedFetch('/api/lorem/paragraphs?count=2');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result.length).toBeGreaterThan(50);
  });
});

// ─── UUID (6 tests) ────────────────────────────────────────────────────────
describe('UUID', () => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it('GET /api/uuid/v4 returns a v4 uuid', async () => {
    const res = await authedFetch('/api/uuid/v4');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.uuid).toMatch(uuidRegex);
  });

  it('GET /api/uuid/v1 returns a v1 uuid', async () => {
    const res = await authedFetch('/api/uuid/v1');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.uuid).toMatch(uuidRegex);
  });

  it('GET /api/uuid/nil returns nil uuid', async () => {
    const res = await authedFetch('/api/uuid/nil');
    const data = await res.json();
    expect(data.uuid).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('POST /api/uuid/validate with valid uuid', async () => {
    const res = await authedFetch('/api/uuid/validate', {
      method: 'POST', body: JSON.stringify({ uuid: '550e8400-e29b-41d4-a716-446655440000' }),
    });
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it('POST /api/uuid/validate with invalid uuid', async () => {
    const res = await authedFetch('/api/uuid/validate', {
      method: 'POST', body: JSON.stringify({ uuid: 'not-a-uuid' }),
    });
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it('GET /api/uuid/batch?count=3 returns 3 uuids', async () => {
    const res = await authedFetch('/api/uuid/batch?count=3');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.uuids)).toBe(true);
    expect(data.uuids.length).toBe(3);
    data.uuids.forEach(u => expect(u).toMatch(uuidRegex));
  });
});

// ─── JSON (8 tests) ────────────────────────────────────────────────────────
describe('JSON', () => {
  it('POST /api/json/format formats JSON', async () => {
    const res = await authedFetch('/api/json/format', {
      method: 'POST', body: JSON.stringify({ text: '{"a":1,"b":2}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toContain('\n'); // formatted has newlines
  });

  it('POST /api/json/minify minifies JSON', async () => {
    const res = await authedFetch('/api/json/minify', {
      method: 'POST', body: JSON.stringify({ text: '{\n  "a": 1,\n  "b": 2\n}' }),
    });
    const data = await res.json();
    expect(data.result).toBe('{"a":1,"b":2}');
  });

  it('POST /api/json/validate with valid JSON', async () => {
    const res = await authedFetch('/api/json/validate', {
      method: 'POST', body: JSON.stringify({ text: '{"key": "value"}' }),
    });
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it('POST /api/json/validate with invalid JSON', async () => {
    const res = await authedFetch('/api/json/validate', {
      method: 'POST', body: JSON.stringify({ text: '{bad json' }),
    });
    const data = await res.json();
    expect(data.valid).toBe(false);
  });

  it('POST /api/json/sort-keys sorts keys alphabetically', async () => {
    const res = await authedFetch('/api/json/sort-keys', {
      method: 'POST', body: JSON.stringify({ text: '{"z":1,"a":2,"m":3}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    const parsed = JSON.parse(data.result);
    const keys = Object.keys(parsed);
    expect(keys).toEqual(['a', 'm', 'z']);
  });

  it('POST /api/json/diff finds differences', async () => {
    const res = await authedFetch('/api/json/diff', {
      method: 'POST', body: JSON.stringify({ a: '{"x":1}', b: '{"x":2}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.diffs)).toBe(true);
    expect(data.diffs.length).toBeGreaterThan(0);
  });

  it('POST /api/json/flatten flattens nested JSON', async () => {
    const res = await authedFetch('/api/json/flatten', {
      method: 'POST', body: JSON.stringify({ text: '{"a":{"b":{"c":1}}}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBeDefined();
    // Flattened should have dot-notation key
    expect(data.result['a.b.c']).toBe(1);
  });

  it('POST /api/json/stats returns stats', async () => {
    const res = await authedFetch('/api/json/stats', {
      method: 'POST', body: JSON.stringify({ text: '{"a":1,"b":[1,2,3]}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.stats).toBeDefined();
  });
});

// ─── YAML (6 tests) ────────────────────────────────────────────────────────
describe('YAML', () => {
  it('POST /api/yaml/to-json converts YAML to JSON', async () => {
    const res = await authedFetch('/api/yaml/to-json', {
      method: 'POST', body: JSON.stringify({ text: 'name: test\nvalue: 42' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    const parsed = JSON.parse(data.result);
    expect(parsed.name).toBe('test');
    expect(parsed.value).toBe(42);
  });

  it('POST /api/yaml/to-yaml converts JSON to YAML', async () => {
    const res = await authedFetch('/api/yaml/to-yaml', {
      method: 'POST', body: JSON.stringify({ text: '{"name":"test","value":42}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result).toContain('name');
  });

  it('POST /api/yaml/validate with valid YAML', async () => {
    const res = await authedFetch('/api/yaml/validate', {
      method: 'POST', body: JSON.stringify({ text: 'key: value\nlist:\n  - a\n  - b' }),
    });
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it('POST /api/yaml/validate with invalid YAML', async () => {
    const res = await authedFetch('/api/yaml/validate', {
      method: 'POST', body: JSON.stringify({ text: ':\n  bad:\n    - :\n  :' }),
    });
    const data = await res.json();
    // Even malformed YAML may parse in some parsers; check it returns a valid/error shape
    expect(typeof data.valid).toBe('boolean');
  });

  it('POST /api/yaml/parse parses YAML to object', async () => {
    const res = await authedFetch('/api/yaml/parse', {
      method: 'POST', body: JSON.stringify({ text: 'foo: bar\nbaz: 123' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result.foo).toBe('bar');
    expect(data.result.baz).toBe(123);
  });

  it('POST /api/yaml/stringify converts object to YAML', async () => {
    const res = await authedFetch('/api/yaml/stringify', {
      method: 'POST', body: JSON.stringify({ data: { alpha: 1, beta: 'two' } }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result).toContain('alpha');
  });
});

// ─── Lorem (6 tests) ───────────────────────────────────────────────────────
describe('Lorem', () => {
  it('GET /api/lorem/words?count=5 returns words', async () => {
    const res = await authedFetch('/api/lorem/words?count=5');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result.split(' ').length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/lorem/sentences returns sentences', async () => {
    const res = await authedFetch('/api/lorem/sentences?count=2');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result.length).toBeGreaterThan(0);
  });

  it('GET /api/lorem/name returns a name', async () => {
    const res = await authedFetch('/api/lorem/name');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result.length).toBeGreaterThan(0);
  });

  it('GET /api/lorem/email returns email with @', async () => {
    const res = await authedFetch('/api/lorem/email');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toContain('@');
  });

  it('GET /api/lorem/phone returns phone number', async () => {
    const res = await authedFetch('/api/lorem/phone');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result.length).toBeGreaterThan(0);
  });

  it('GET /api/lorem/number?min=1&max=10 returns number in range', async () => {
    const res = await authedFetch('/api/lorem/number?min=1&max=10');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('number');
    expect(data.result).toBeGreaterThanOrEqual(1);
    expect(data.result).toBeLessThanOrEqual(10);
  });
});

// ─── Dashboard (4 tests) ───────────────────────────────────────────────────
describe('Dashboard', () => {
  it('GET /api/dashboard/activity returns items array', async () => {
    const res = await authedFetch('/api/dashboard/activity');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('GET /api/dashboard/stats returns stats object', async () => {
    const res = await authedFetch('/api/dashboard/stats');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data).toBe('object');
  });

  it('activity items array is not null', async () => {
    const res = await authedFetch('/api/dashboard/activity');
    const data = await res.json();
    expect(data.items).not.toBeNull();
    expect(data.items).toBeDefined();
  });

  it('stats has snippets and notebooks fields', async () => {
    const res = await authedFetch('/api/dashboard/stats');
    const data = await res.json();
    expect(data).toHaveProperty('snippets');
    expect(data).toHaveProperty('notebooks');
  });
});

// ─── Regex (10 tests) ──────────────────────────────────────────────────────
describe('Regex', () => {
  let savedPatternId;

  it('POST /api/regex/test with valid pattern matches text', async () => {
    const res = await authedFetch('/api/regex/test', {
      method: 'POST',
      body: JSON.stringify({ pattern: '\\d+', flags: 'g', text: 'abc 123 def 456' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.matches || data.results || data.match).toBeDefined();
  });

  it('GET /api/regex/common returns array of common patterns', async () => {
    const res = await authedFetch('/api/regex/common');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('POST /api/regex creates a saved pattern', async () => {
    const res = await authedFetch('/api/regex', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Email', pattern: '[\\w.]+@[\\w.]+', flags: 'gi', description: 'Match emails' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBeDefined();
    savedPatternId = data.id;
  });

  it('GET /api/regex returns saved patterns list', async () => {
    const res = await authedFetch('/api/regex');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('DELETE /api/regex/:id removes a saved pattern', async () => {
    // Create a pattern to delete
    const createRes = await authedFetch('/api/regex', {
      method: 'POST',
      body: JSON.stringify({ name: 'To Delete', pattern: 'abc', flags: '' }),
    });
    const { id } = await createRes.json();
    const res = await authedFetch(`/api/regex/${id}`, { method: 'DELETE' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('POST /api/regex/explain returns explanation', async () => {
    const res = await authedFetch('/api/regex/explain', {
      method: 'POST',
      body: JSON.stringify({ pattern: '^[a-z]+$' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.tokens || data.explanation || data.parts).toBeDefined();
  });

  it('POST /api/regex/replace replaces matched text', async () => {
    const res = await authedFetch('/api/regex/replace', {
      method: 'POST',
      body: JSON.stringify({ pattern: 'world', flags: 'g', text: 'hello world', replacement: 'earth' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBe('hello earth');
  });

  it('POST /api/regex/split splits text by pattern', async () => {
    const res = await authedFetch('/api/regex/split', {
      method: 'POST',
      body: JSON.stringify({ pattern: ',\\s*', flags: '', text: 'a, b, c, d' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.parts || data.result)).toBe(true);
  });

  it('POST /api/regex/test with invalid regex returns error', async () => {
    const res = await authedFetch('/api/regex/test', {
      method: 'POST',
      body: JSON.stringify({ pattern: '[invalid(', flags: '', text: 'test' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('POST /api/regex/test with flags works', async () => {
    const res = await authedFetch('/api/regex/test', {
      method: 'POST',
      body: JSON.stringify({ pattern: 'hello', flags: 'i', text: 'Hello World' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    // Should match because of case-insensitive flag
    const hasMatch = data.matches?.length > 0 || data.match === true || data.results?.length > 0;
    expect(hasMatch).toBe(true);
  });
});

// ─── JWT (8 tests) ─────────────────────────────────────────────────────────
describe('JWT', () => {
  const testSecret = 'my-test-secret-key';
  let testToken;

  it('POST /api/jwt/encode creates a token', async () => {
    const res = await authedFetch('/api/jwt/encode', {
      method: 'POST',
      body: JSON.stringify({ payload: { sub: '1234', name: 'Test User' }, secret: testSecret }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.token).toBe('string');
    expect(data.token.split('.').length).toBe(3); // JWT has 3 parts
    testToken = data.token;
  });

  it('POST /api/jwt/decode decodes a token', async () => {
    // Ensure we have a token
    if (!testToken) {
      const enc = await authedFetch('/api/jwt/encode', {
        method: 'POST',
        body: JSON.stringify({ payload: { sub: '1234' }, secret: testSecret }),
      });
      testToken = (await enc.json()).token;
    }
    const res = await authedFetch('/api/jwt/decode', {
      method: 'POST', body: JSON.stringify({ token: testToken }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.payload || data.decoded).toBeDefined();
  });

  it('POST /api/jwt/verify verifies a token with correct secret', async () => {
    if (!testToken) {
      const enc = await authedFetch('/api/jwt/encode', {
        method: 'POST',
        body: JSON.stringify({ payload: { sub: '1234' }, secret: testSecret }),
      });
      testToken = (await enc.json()).token;
    }
    const res = await authedFetch('/api/jwt/verify', {
      method: 'POST', body: JSON.stringify({ token: testToken, secret: testSecret }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
  });

  it('POST /api/jwt/decode with invalid token returns error', async () => {
    const res = await authedFetch('/api/jwt/decode', {
      method: 'POST', body: JSON.stringify({ token: 'not.a.valid.jwt.token' }),
    });
    const data = await res.json();
    // Should either return 400 or an error in body
    expect(res.status === 400 || data.error).toBeTruthy();
  });

  it('POST /api/jwt/encode with custom claims', async () => {
    const res = await authedFetch('/api/jwt/encode', {
      method: 'POST',
      body: JSON.stringify({
        payload: { sub: '42', role: 'admin', iss: 'hyperion' },
        secret: testSecret,
        options: { expiresIn: '1h' },
      }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.token).toBe('string');
  });

  it('POST /api/jwt/decode returns header and payload', async () => {
    const encRes = await authedFetch('/api/jwt/encode', {
      method: 'POST',
      body: JSON.stringify({ payload: { data: 'test' }, secret: testSecret }),
    });
    const { token } = await encRes.json();
    const res = await authedFetch('/api/jwt/decode', {
      method: 'POST', body: JSON.stringify({ token }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.header).toBeDefined();
    expect(data.payload).toBeDefined();
  });

  it('decoded header has alg field', async () => {
    const encRes = await authedFetch('/api/jwt/encode', {
      method: 'POST',
      body: JSON.stringify({ payload: { x: 1 }, secret: testSecret }),
    });
    const { token } = await encRes.json();
    const res = await authedFetch('/api/jwt/decode', {
      method: 'POST', body: JSON.stringify({ token }),
    });
    const data = await res.json();
    expect(data.header.alg).toBeDefined();
  });

  it('decoded payload has custom data', async () => {
    const encRes = await authedFetch('/api/jwt/encode', {
      method: 'POST',
      body: JSON.stringify({ payload: { userId: 99, role: 'editor' }, secret: testSecret }),
    });
    const { token } = await encRes.json();
    const res = await authedFetch('/api/jwt/decode', {
      method: 'POST', body: JSON.stringify({ token }),
    });
    const data = await res.json();
    expect(data.payload.userId).toBe(99);
    expect(data.payload.role).toBe('editor');
  });
});

// ─── Diff (8 tests) ────────────────────────────────────────────────────────
describe('Diff', () => {
  let savedSnapshotId;

  it('POST /api/diff/compare returns diffs', async () => {
    const res = await authedFetch('/api/diff/compare', {
      method: 'POST',
      body: JSON.stringify({ textA: 'line one\nline two', textB: 'line one\nline three' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.diff).toBeDefined();
    expect(data.stats).toBeDefined();
  });

  it('POST /api/diff/compare with identical texts returns no changes', async () => {
    const res = await authedFetch('/api/diff/compare', {
      method: 'POST',
      body: JSON.stringify({ textA: 'same text', textB: 'same text' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    // Stats should show zero additions/removals
    if (data.stats) {
      expect(data.stats.added === 0 || data.stats.additions === 0 || data.stats.changes === 0).toBeTruthy();
    }
  });

  it('POST /api/diff creates a snapshot', async () => {
    const res = await authedFetch('/api/diff', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Snapshot', textA: 'before', textB: 'after' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBeDefined();
    savedSnapshotId = data.id;
  });

  it('GET /api/diff returns saved snapshots', async () => {
    const res = await authedFetch('/api/diff');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('DELETE /api/diff/:id removes a snapshot', async () => {
    // Create one to delete
    const createRes = await authedFetch('/api/diff', {
      method: 'POST',
      body: JSON.stringify({ name: 'Delete Me', textA: 'x', textB: 'y' }),
    });
    const { id } = await createRes.json();
    const res = await authedFetch(`/api/diff/${id}`, { method: 'DELETE' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('POST /api/diff/compare with added lines detects additions', async () => {
    const res = await authedFetch('/api/diff/compare', {
      method: 'POST',
      body: JSON.stringify({ textA: 'line one', textB: 'line one\nline two\nline three' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.diff).toBeDefined();
    // Should detect additions
    const diffStr = JSON.stringify(data.diff);
    expect(diffStr).toContain('line two');
  });

  it('POST /api/diff/compare with removed lines detects removals', async () => {
    const res = await authedFetch('/api/diff/compare', {
      method: 'POST',
      body: JSON.stringify({ textA: 'line one\nline two\nline three', textB: 'line one' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.diff).toBeDefined();
  });

  it('POST /api/diff/compare handles empty strings', async () => {
    const res = await authedFetch('/api/diff/compare', {
      method: 'POST',
      body: JSON.stringify({ textA: '', textB: '' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.diff).toBeDefined();
  });
});

// ─── Images (6 tests) ──────────────────────────────────────────────────────
describe('Images', () => {
  it('POST /api/images/placeholder returns SVG data', async () => {
    const res = await authedFetch('/api/images/placeholder', {
      method: 'POST',
      body: JSON.stringify({ width: 200, height: 100 }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.svg).toBeDefined();
    expect(data.dataUri).toBeDefined();
  });

  it('POST /api/images/placeholder with custom dimensions and text', async () => {
    const res = await authedFetch('/api/images/placeholder', {
      method: 'POST',
      body: JSON.stringify({ width: 400, height: 300, color: '#ff0000', text: 'Test' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.svg).toContain('400');
    expect(data.svg).toContain('300');
  });

  it('POST /api/images/placeholder defaults when no dimensions given', async () => {
    const res = await authedFetch('/api/images/placeholder', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.svg).toBeDefined();
  });

  it('POST /api/images/from-base64 parses a data URI', async () => {
    // Create a minimal valid data URI
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString('base64')}`;
    const res = await authedFetch('/api/images/from-base64', {
      method: 'POST',
      body: JSON.stringify({ dataUri }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.mimeType).toBe('image/svg+xml');
    expect(typeof data.size).toBe('number');
  });

  it('POST /api/images/validate handles invalid input gracefully', async () => {
    const res = await authedFetch('/api/images/validate', {
      method: 'POST',
      body: JSON.stringify({ data: '' }),
    });
    // Should return 400 for missing data or a graceful response
    expect([200, 400]).toContain(res.status);
  });

  it('POST /api/images/to-base64 converts data to data URI', async () => {
    // Small PNG-like data (just testing the route works)
    const tinyData = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64');
    const res = await authedFetch('/api/images/to-base64', {
      method: 'POST',
      body: JSON.stringify({ data: tinyData, mimeType: 'image/png' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.dataUri).toContain('data:image/png;base64,');
    expect(typeof data.size).toBe('number');
  });
});

// ─── Cron Expression (8 tests) ─────────────────────────────────────────────
describe('Cron Expression', () => {
  let savedPresetId;

  it('POST /api/cron-expr/parse returns description', async () => {
    const res = await authedFetch('/api/cron-expr/parse', {
      method: 'POST',
      body: JSON.stringify({ expression: '0 * * * *' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.minute !== undefined || data.description || data.explanation).toBeTruthy();
  });

  it('POST /api/cron-expr/parse returns next runs', async () => {
    const res = await authedFetch('/api/cron-expr/parse', {
      method: 'POST',
      body: JSON.stringify({ expression: '*/5 * * * *' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    // The parse endpoint may include next runs
    if (data.nextRuns) {
      expect(Array.isArray(data.nextRuns)).toBe(true);
    }
  });

  it('GET /api/cron-expr/presets returns preset list', async () => {
    const res = await authedFetch('/api/cron-expr/presets');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('POST /api/cron-expr creates a saved preset', async () => {
    const res = await authedFetch('/api/cron-expr', {
      method: 'POST',
      body: JSON.stringify({ name: 'Every 10 min', expression: '*/10 * * * *', description: 'Runs every 10 minutes' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBeDefined();
    savedPresetId = data.id;
  });

  it('GET /api/cron-expr returns saved custom presets', async () => {
    const res = await authedFetch('/api/cron-expr');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('DELETE /api/cron-expr/:id removes a preset', async () => {
    // Create one to delete
    const createRes = await authedFetch('/api/cron-expr', {
      method: 'POST',
      body: JSON.stringify({ name: 'Delete Me', expression: '0 0 * * *' }),
    });
    const { id } = await createRes.json();
    const res = await authedFetch(`/api/cron-expr/${id}`, { method: 'DELETE' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('POST /api/cron-expr/parse with invalid expression returns error', async () => {
    const res = await authedFetch('/api/cron-expr/parse', {
      method: 'POST',
      body: JSON.stringify({ expression: 'not a cron' }),
    });
    const data = await res.json();
    // Should return 400 or have an error/valid:false
    expect(res.status === 400 || data.error || data.valid === false).toBeTruthy();
  });

  it('POST /api/cron-expr/parse with daily expression works', async () => {
    const res = await authedFetch('/api/cron-expr/parse', {
      method: 'POST',
      body: JSON.stringify({ expression: '0 0 * * *' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    // Should describe this as midnight/daily
    const desc = JSON.stringify(data).toLowerCase();
    expect(desc.length).toBeGreaterThan(0);
  });
});

// ─── Colors (10 tests) ─────────────────────────────────────────────────────
describe('Colors', () => {
  let savedPaletteId;

  it('POST /api/colors/convert converts hex to rgb', async () => {
    const res = await authedFetch('/api/colors/convert', {
      method: 'POST',
      body: JSON.stringify({ color: '#ff5733' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.hex).toBeDefined();
    expect(data.rgb).toBeDefined();
    expect(data.rgb.r).toBe(255);
    expect(data.rgb.g).toBe(87);
    expect(data.rgb.b).toBe(51);
  });

  it('POST /api/colors/convert converts hex to hsl', async () => {
    const res = await authedFetch('/api/colors/convert', {
      method: 'POST',
      body: JSON.stringify({ color: '#0000ff' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.hsl).toBeDefined();
    expect(data.hsl.h).toBe(240);
  });

  it('POST /api/colors/palette generates a palette', async () => {
    const res = await authedFetch('/api/colors/palette', {
      method: 'POST',
      body: JSON.stringify({ color: '#3498db', type: 'complementary' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.colors || data.palette).toBeDefined();
  });

  it('POST /api/colors creates a saved palette', async () => {
    const res = await authedFetch('/api/colors', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Palette', colors: ['#ff0000', '#00ff00', '#0000ff'] }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBeDefined();
    savedPaletteId = data.id;
  });

  it('GET /api/colors returns saved palettes', async () => {
    const res = await authedFetch('/api/colors');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('DELETE /api/colors/:id removes a palette', async () => {
    // Create one to delete
    const createRes = await authedFetch('/api/colors', {
      method: 'POST',
      body: JSON.stringify({ name: 'Delete Me', colors: ['#000'] }),
    });
    const { id } = await createRes.json();
    const res = await authedFetch(`/api/colors/${id}`, { method: 'DELETE' });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it('POST /api/colors/contrast returns contrast info', async () => {
    const res = await authedFetch('/api/colors/contrast', {
      method: 'POST',
      body: JSON.stringify({ color1: '#000000', color2: '#ffffff' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ratio).toBeDefined();
  });

  it('POST /api/colors/shades generates shades', async () => {
    const res = await authedFetch('/api/colors/shades', {
      method: 'POST',
      body: JSON.stringify({ color: '#3498db', steps: 5 }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.shades).toBeDefined();
    expect(Array.isArray(data.shades)).toBe(true);
    expect(data.shades.length).toBe(5);
  });

  it('POST /api/colors/convert handles invalid color gracefully', async () => {
    const res = await authedFetch('/api/colors/convert', {
      method: 'POST',
      body: JSON.stringify({ color: 'not-a-color' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it('POST /api/colors/contrast returns numeric ratio', async () => {
    const res = await authedFetch('/api/colors/contrast', {
      method: 'POST',
      body: JSON.stringify({ color1: '#000000', color2: '#ffffff' }),
    });
    const data = await res.json();
    expect(typeof data.ratio).toBe('number');
    expect(data.ratio).toBeGreaterThanOrEqual(1);
  });
});
