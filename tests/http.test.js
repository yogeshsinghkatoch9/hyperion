import { describe, it, expect } from 'vitest';

const httpClient = require('../services/httpClient');

// ── Environment Variable Interpolation ──
describe('Environment Variable Interpolation', () => {
  it('replaces {{var}} placeholders', () => {
    const result = httpClient.interpolateEnv('https://{{host}}/api/{{version}}', { host: 'example.com', version: 'v2' });
    expect(result).toBe('https://example.com/api/v2');
  });

  it('leaves unmatched placeholders intact', () => {
    const result = httpClient.interpolateEnv('{{base}}/{{missing}}', { base: 'http://x' });
    expect(result).toBe('http://x/{{missing}}');
  });

  it('handles null/undefined input', () => {
    expect(httpClient.interpolateEnv(null, { x: 1 })).toBeNull();
    expect(httpClient.interpolateEnv('test', null)).toBe('test');
  });

  it('interpolates full request object', () => {
    const req = {
      url: '{{base}}/users',
      headers: { 'Authorization': 'Bearer {{token}}', 'X-Custom': '{{custom}}' },
      body: '{"key": "{{apiKey}}"}',
    };
    const env = { base: 'https://api.test.com', token: 'abc123', apiKey: 'key456', custom: 'val' };
    const result = httpClient.interpolateRequest(req, env);

    expect(result.url).toBe('https://api.test.com/users');
    expect(result.headers['Authorization']).toBe('Bearer abc123');
    expect(result.headers['X-Custom']).toBe('val');
    expect(result.body).toBe('{"key": "key456"}');
  });

  it('does not mutate original request', () => {
    const req = { url: '{{base}}/test', headers: { h: '{{v}}' }, body: '{{b}}' };
    const env = { base: 'http://x', v: 'y', b: 'z' };
    httpClient.interpolateRequest(req, env);
    expect(req.url).toBe('{{base}}/test');
  });
});

// ── cURL Parsing ──
describe('cURL Parsing', () => {
  it('parses simple GET', () => {
    const result = httpClient.parseCurl("curl https://api.example.com/data");
    expect(result.method).toBe('GET');
    expect(result.url).toBe('https://api.example.com/data');
  });

  it('parses POST with data', () => {
    const result = httpClient.parseCurl("curl -X POST https://api.example.com/data -d '{\"key\":\"value\"}'");
    expect(result.method).toBe('POST');
    expect(result.url).toBe('https://api.example.com/data');
    expect(result.body).toBe('{"key":"value"}');
  });

  it('parses headers', () => {
    const result = httpClient.parseCurl("curl -H 'Content-Type: application/json' -H 'Authorization: Bearer token123' https://api.test.com");
    expect(result.headers['Content-Type']).toBe('application/json');
    expect(result.headers['Authorization']).toBe('Bearer token123');
  });

  it('infers POST from -d flag', () => {
    const result = httpClient.parseCurl("curl https://api.test.com -d 'hello'");
    expect(result.method).toBe('POST');
    expect(result.body).toBe('hello');
  });

  it('parses basic auth', () => {
    const result = httpClient.parseCurl("curl -u user:pass https://api.test.com");
    expect(result.headers['Authorization']).toBe('Basic ' + Buffer.from('user:pass').toString('base64'));
  });

  it('handles --data-raw flag', () => {
    const result = httpClient.parseCurl("curl --data-raw '{\"test\":true}' https://api.test.com");
    expect(result.body).toBe('{"test":true}');
    expect(result.method).toBe('POST');
  });

  it('handles multiline cURL with backslash continuation', () => {
    const result = httpClient.parseCurl("curl -X PUT \\\nhttps://api.test.com \\\n-H 'Accept: */*'");
    expect(result.method).toBe('PUT');
    expect(result.url).toBe('https://api.test.com');
    expect(result.headers['Accept']).toBe('*/*');
  });

  it('rejects empty input', () => {
    expect(() => httpClient.parseCurl('')).toThrow();
  });
});

// ── cURL Export ──
describe('cURL Export', () => {
  it('exports simple GET', () => {
    const curl = httpClient.toCurl({ method: 'GET', url: 'https://api.test.com' });
    expect(curl).toContain('https://api.test.com');
    expect(curl).not.toContain('-X');
  });

  it('exports POST with body and headers', () => {
    const curl = httpClient.toCurl({
      method: 'POST',
      url: 'https://api.test.com',
      headers: { 'Content-Type': 'application/json' },
      body: '{"key":"val"}',
    });
    expect(curl).toContain('-X POST');
    expect(curl).toContain("Content-Type: application/json");
    expect(curl).toContain("-d");
  });

  it('round-trips: export then parse', () => {
    const original = { method: 'PUT', url: 'https://api.test.com/items', headers: { 'Accept': 'application/json' }, body: '{"update":true}' };
    const curl = httpClient.toCurl(original);
    const parsed = httpClient.parseCurl(curl);
    expect(parsed.method).toBe('PUT');
    expect(parsed.url).toBe('https://api.test.com/items');
    expect(parsed.headers['Accept']).toBe('application/json');
  });
});

// ── Header Parsing ──
describe('Header Parsing', () => {
  it('parses multi-line header string', () => {
    const headers = httpClient.parseHeaderString('Content-Type: application/json\nAuthorization: Bearer abc\nX-Custom: value');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer abc');
    expect(headers['X-Custom']).toBe('value');
  });

  it('handles empty input', () => {
    expect(httpClient.parseHeaderString('')).toEqual({});
    expect(httpClient.parseHeaderString(null)).toEqual({});
  });

  it('skips blank lines', () => {
    const headers = httpClient.parseHeaderString('A: 1\n\nB: 2\n');
    expect(Object.keys(headers).length).toBe(2);
  });

  it('converts headers object to string', () => {
    const str = httpClient.headersToString({ 'Content-Type': 'application/json', 'Accept': '*/*' });
    expect(str).toContain('Content-Type: application/json');
    expect(str).toContain('Accept: */*');
  });
});

// ── Tokenizer ──
describe('Tokenizer', () => {
  it('handles single quotes', () => {
    const tokens = httpClient.tokenize("one 'two three' four");
    expect(tokens).toEqual(['one', 'two three', 'four']);
  });

  it('handles double quotes', () => {
    const tokens = httpClient.tokenize('one "two three" four');
    expect(tokens).toEqual(['one', 'two three', 'four']);
  });

  it('handles escaped characters in quotes', () => {
    const tokens = httpClient.tokenize("'hello\\'world'");
    expect(tokens[0]).toBe("hello'world");
  });

  it('handles adjacent tokens', () => {
    const tokens = httpClient.tokenize('-X POST');
    expect(tokens).toEqual(['-X', 'POST']);
  });
});

// ── Common Headers ──
describe('Common Headers', () => {
  it('COMMON_HEADERS has expected keys', () => {
    expect(httpClient.COMMON_HEADERS).toHaveProperty('Content-Type');
    expect(httpClient.COMMON_HEADERS).toHaveProperty('Accept');
    expect(httpClient.COMMON_HEADERS).toHaveProperty('Authorization');
    expect(Array.isArray(httpClient.COMMON_HEADERS['Content-Type'])).toBe(true);
  });
});

// ── Request Validation ──
describe('Request Sending', () => {
  it('rejects empty URL', async () => {
    await expect(httpClient.sendRequest({ method: 'GET', url: '' })).rejects.toThrow('URL is required');
  });

  it('rejects null URL', async () => {
    await expect(httpClient.sendRequest({ method: 'GET' })).rejects.toThrow('URL is required');
  });
});

// ── Collection Data Shapes ──
describe('Collection Data Shapes', () => {
  it('getCollections returns array with in-memory DB', () => {
    // Without DB, should return empty array
    const result = httpClient.getCollections(null);
    expect(Array.isArray(result)).toBe(true);
  });

  it('getHistory returns array without DB', () => {
    const result = httpClient.getHistory(null);
    expect(Array.isArray(result)).toBe(true);
  });

  it('getEnvironments returns array without DB', () => {
    const result = httpClient.getEnvironments(null);
    expect(Array.isArray(result)).toBe(true);
  });
});
