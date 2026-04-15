/**
 * Route tests for routes/json.js
 * Tests the /api/json/* HTTP endpoints via the test server.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { setup, teardown, authedFetch, getBaseUrl } = require('./setup');

let env;
beforeAll(async () => { env = await setup(); });
afterAll(async () => { await teardown(); });

describe('POST /api/json/format', () => {
  it('formats minified JSON with default indent', async () => {
    const res = await authedFetch('/api/json/format', {
      method: 'POST',
      body: JSON.stringify({ text: '{"a":1,"b":2}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('formats JSON with custom indent', async () => {
    const res = await authedFetch('/api/json/format', {
      method: 'POST',
      body: JSON.stringify({ text: '{"a":1}', indent: 4 }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBe('{\n    "a": 1\n}');
  });

  it('returns 400 for invalid JSON input', async () => {
    const res = await authedFetch('/api/json/format', {
      method: 'POST',
      body: JSON.stringify({ text: 'not json' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe('POST /api/json/minify', () => {
  it('removes all whitespace from formatted JSON', async () => {
    const res = await authedFetch('/api/json/minify', {
      method: 'POST',
      body: JSON.stringify({ text: '{\n  "a": 1,\n  "b": 2\n}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBe('{"a":1,"b":2}');
  });

  it('returns same result for already minified JSON', async () => {
    const res = await authedFetch('/api/json/minify', {
      method: 'POST',
      body: JSON.stringify({ text: '{"x":true}' }),
    });
    const data = await res.json();
    expect(data.result).toBe('{"x":true}');
  });
});

describe('POST /api/json/validate', () => {
  it('returns valid:true for valid JSON', async () => {
    const res = await authedFetch('/api/json/validate', {
      method: 'POST',
      body: JSON.stringify({ text: '{"key": "value"}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.error).toBeNull();
  });

  it('returns valid:false with error for invalid JSON', async () => {
    const res = await authedFetch('/api/json/validate', {
      method: 'POST',
      body: JSON.stringify({ text: '{bad json' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(false);
    expect(data.error).toBeTypeOf('string');
  });

  it('validates arrays as valid JSON', async () => {
    const res = await authedFetch('/api/json/validate', {
      method: 'POST',
      body: JSON.stringify({ text: '[1,2,3]' }),
    });
    const data = await res.json();
    expect(data.valid).toBe(true);
  });
});

describe('POST /api/json/sort-keys', () => {
  it('sorts top-level keys alphabetically', async () => {
    const res = await authedFetch('/api/json/sort-keys', {
      method: 'POST',
      body: JSON.stringify({ text: '{"z":1,"a":2,"m":3}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    const parsed = JSON.parse(data.result);
    expect(Object.keys(parsed)).toEqual(['a', 'm', 'z']);
  });

  it('sorts nested keys recursively', async () => {
    const res = await authedFetch('/api/json/sort-keys', {
      method: 'POST',
      body: JSON.stringify({ text: '{"z":{"b":2,"a":1},"y":0}' }),
    });
    const data = await res.json();
    const parsed = JSON.parse(data.result);
    expect(Object.keys(parsed)).toEqual(['y', 'z']);
    expect(Object.keys(parsed.z)).toEqual(['a', 'b']);
  });
});

describe('POST /api/json/diff', () => {
  it('detects changed values', async () => {
    const res = await authedFetch('/api/json/diff', {
      method: 'POST',
      body: JSON.stringify({ a: '{"x":1}', b: '{"x":99}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.diffs)).toBe(true);
    expect(data.diffs.length).toBeGreaterThan(0);
    expect(data.diffs[0].type).toBe('changed');
  });

  it('returns empty array for identical JSON', async () => {
    const json = '{"a":1,"b":[2,3]}';
    const res = await authedFetch('/api/json/diff', {
      method: 'POST',
      body: JSON.stringify({ a: json, b: json }),
    });
    const data = await res.json();
    expect(data.diffs).toEqual([]);
  });
});

describe('POST /api/json/query', () => {
  it('traverses dot notation paths', async () => {
    const res = await authedFetch('/api/json/query', {
      method: 'POST',
      body: JSON.stringify({ text: '{"a":{"b":{"c":42}}}', path: 'a.b.c' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBe(42);
  });

  it('handles array index with bracket notation', async () => {
    const res = await authedFetch('/api/json/query', {
      method: 'POST',
      body: JSON.stringify({ text: '{"items":["zero","one","two"]}', path: 'items[1]' }),
    });
    const data = await res.json();
    expect(data.result).toBe('one');
  });
});

describe('POST /api/json/flatten', () => {
  it('flattens nested objects to dot-notation keys', async () => {
    const res = await authedFetch('/api/json/flatten', {
      method: 'POST',
      body: JSON.stringify({ text: '{"a":{"b":1,"c":2}}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result['a.b']).toBe(1);
    expect(data.result['a.c']).toBe(2);
  });
});

describe('POST /api/json/unflatten', () => {
  it('reconstructs nested structure from flat keys', async () => {
    const res = await authedFetch('/api/json/unflatten', {
      method: 'POST',
      body: JSON.stringify({ text: '{"a.b":1,"a.c":2,"d":3}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result.a.b).toBe(1);
    expect(data.result.a.c).toBe(2);
    expect(data.result.d).toBe(3);
  });
});

describe('POST /api/json/stats', () => {
  it('returns correct stats for a JSON object', async () => {
    const res = await authedFetch('/api/json/stats', {
      method: 'POST',
      body: JSON.stringify({ text: '{"a":1,"b":"two","c":null}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.stats).toBeDefined();
    expect(data.stats.keys).toBe(3);
    expect(data.stats.nulls).toBe(1);
    expect(data.stats.objects).toBe(1);
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await authedFetch('/api/json/stats', {
      method: 'POST',
      body: JSON.stringify({ text: 'not json' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('Auth gate for json routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${getBaseUrl()}/api/json/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '{}' }),
    });
    expect(res.status).toBe(401);
  });
});
