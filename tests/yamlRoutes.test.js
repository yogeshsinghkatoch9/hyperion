/**
 * Route tests for routes/yaml.js
 * Tests the /api/yaml/* HTTP endpoints via the test server.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { setup, teardown, authedFetch, getBaseUrl } = require('./setup');

let env;
beforeAll(async () => { env = await setup(); });
afterAll(async () => { await teardown(); });

describe('POST /api/yaml/to-json', () => {
  it('converts simple YAML to JSON string', async () => {
    const res = await authedFetch('/api/yaml/to-json', {
      method: 'POST',
      body: JSON.stringify({ text: 'name: Alice\nage: 30' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    const parsed = JSON.parse(data.result);
    expect(parsed.name).toBe('Alice');
    expect(parsed.age).toBe(30);
  });

  it('converts nested YAML to JSON', async () => {
    const res = await authedFetch('/api/yaml/to-json', {
      method: 'POST',
      body: JSON.stringify({ text: 'person:\n  name: Bob\n  age: 25' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    const parsed = JSON.parse(data.result);
    expect(parsed.person.name).toBe('Bob');
    expect(parsed.person.age).toBe(25);
  });

  it('converts YAML lists to JSON arrays', async () => {
    const res = await authedFetch('/api/yaml/to-json', {
      method: 'POST',
      body: JSON.stringify({ text: 'fruits:\n  - apple\n  - banana' }),
    });
    const data = await res.json();
    const parsed = JSON.parse(data.result);
    expect(parsed.fruits).toEqual(['apple', 'banana']);
  });
});

describe('POST /api/yaml/to-yaml', () => {
  it('converts JSON string to YAML', async () => {
    const res = await authedFetch('/api/yaml/to-yaml', {
      method: 'POST',
      body: JSON.stringify({ text: '{"name":"Alice","age":30}' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toContain('name: Alice');
    expect(data.result).toContain('age: 30');
  });

  it('roundtrips to-yaml then to-json preserving data', async () => {
    const original = '{"x":1,"y":"hello","z":true}';
    const yamlRes = await authedFetch('/api/yaml/to-yaml', {
      method: 'POST',
      body: JSON.stringify({ text: original }),
    });
    const { result: yamlStr } = await yamlRes.json();

    const jsonRes = await authedFetch('/api/yaml/to-json', {
      method: 'POST',
      body: JSON.stringify({ text: yamlStr }),
    });
    const { result: jsonStr } = await jsonRes.json();
    const parsed = JSON.parse(jsonStr);
    expect(parsed.x).toBe(1);
    expect(parsed.y).toBe('hello');
    expect(parsed.z).toBe(true);
  });
});

describe('POST /api/yaml/validate', () => {
  it('returns valid:true for correct YAML', async () => {
    const res = await authedFetch('/api/yaml/validate', {
      method: 'POST',
      body: JSON.stringify({ text: 'name: Alice\nage: 30' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.error).toBeNull();
  });

  it('returns a valid/error shape for malformed YAML', async () => {
    const res = await authedFetch('/api/yaml/validate', {
      method: 'POST',
      body: JSON.stringify({ text: ':\n  bad:\n    - :\n  :' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.valid).toBe('boolean');
  });

  it('validates simple scalar values', async () => {
    const res = await authedFetch('/api/yaml/validate', {
      method: 'POST',
      body: JSON.stringify({ text: '42' }),
    });
    const data = await res.json();
    expect(data.valid).toBe(true);
  });
});

describe('POST /api/yaml/parse', () => {
  it('parses YAML into a JS object', async () => {
    const res = await authedFetch('/api/yaml/parse', {
      method: 'POST',
      body: JSON.stringify({ text: 'foo: bar\nbaz: 123' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result.foo).toBe('bar');
    expect(data.result.baz).toBe(123);
  });

  it('parses booleans and null correctly', async () => {
    const res = await authedFetch('/api/yaml/parse', {
      method: 'POST',
      body: JSON.stringify({ text: 'enabled: true\ndisabled: false\nempty: null' }),
    });
    const data = await res.json();
    expect(data.result.enabled).toBe(true);
    expect(data.result.disabled).toBe(false);
    expect(data.result.empty).toBeNull();
  });

  it('returns null for empty string input', async () => {
    const res = await authedFetch('/api/yaml/parse', {
      method: 'POST',
      body: JSON.stringify({ text: '' }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.result).toBeNull();
  });
});

describe('POST /api/yaml/stringify', () => {
  it('converts object to YAML string', async () => {
    const res = await authedFetch('/api/yaml/stringify', {
      method: 'POST',
      body: JSON.stringify({ data: { alpha: 1, beta: 'two' } }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.result).toBe('string');
    expect(data.result).toContain('alpha');
    expect(data.result).toContain('beta');
  });

  it('handles arrays in the input', async () => {
    const res = await authedFetch('/api/yaml/stringify', {
      method: 'POST',
      body: JSON.stringify({ data: { items: ['a', 'b', 'c'] } }),
    });
    const data = await res.json();
    expect(data.result).toContain('- a');
    expect(data.result).toContain('- b');
    expect(data.result).toContain('- c');
  });
});

describe('Auth gate for yaml routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${getBaseUrl()}/api/yaml/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'key: value' }),
    });
    expect(res.status).toBe(401);
  });
});
