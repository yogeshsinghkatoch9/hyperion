import { describe, it, expect } from 'vitest';

const toolkit = require('../services/devToolkit');

// ── Hash Generation ──
describe('Hash Generation', () => {
  it('generates MD5 hash', () => {
    expect(toolkit.generateHash('hello', 'md5')).toBe('5d41402abc4b2a76b9719d911017c592');
  });

  it('generates SHA1 hash', () => {
    expect(toolkit.generateHash('hello', 'sha1')).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('generates SHA256 hash', () => {
    expect(toolkit.generateHash('hello', 'sha256')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('generates SHA512 hash', () => {
    const hash = toolkit.generateHash('hello', 'sha512');
    expect(hash).toHaveLength(128);
  });

  it('defaults to SHA256 for invalid algorithm', () => {
    expect(toolkit.generateHash('hello', 'invalid')).toBe(toolkit.generateHash('hello', 'sha256'));
  });

  it('generates all hashes at once', () => {
    const all = toolkit.generateAllHashes('test');
    expect(all).toHaveProperty('md5');
    expect(all).toHaveProperty('sha1');
    expect(all).toHaveProperty('sha256');
    expect(all).toHaveProperty('sha512');
  });
});

// ── Base64 ──
describe('Base64', () => {
  it('encodes to base64', () => {
    expect(toolkit.base64Encode('hello world')).toBe('aGVsbG8gd29ybGQ=');
  });

  it('decodes from base64', () => {
    expect(toolkit.base64Decode('aGVsbG8gd29ybGQ=')).toBe('hello world');
  });

  it('round-trips correctly', () => {
    const original = 'Test string with special chars: @#$%^&*()';
    expect(toolkit.base64Decode(toolkit.base64Encode(original))).toBe(original);
  });
});

// ── URL Encoding ──
describe('URL Encoding', () => {
  it('encodes special characters', () => {
    expect(toolkit.urlEncode('hello world&foo=bar')).toBe('hello%20world%26foo%3Dbar');
  });

  it('decodes URL-encoded string', () => {
    expect(toolkit.urlDecode('hello%20world')).toBe('hello world');
  });

  it('round-trips correctly', () => {
    const original = 'key=value&param=hello world';
    expect(toolkit.urlDecode(toolkit.urlEncode(original))).toBe(original);
  });
});

// ── JSON ──
describe('JSON Tools', () => {
  it('formats JSON with indentation', () => {
    const formatted = toolkit.formatJson('{"a":1,"b":2}');
    expect(formatted).toContain('\n');
    expect(JSON.parse(formatted)).toEqual({ a: 1, b: 2 });
  });

  it('minifies JSON', () => {
    const minified = toolkit.minifyJson('{\n  "a": 1,\n  "b": 2\n}');
    expect(minified).toBe('{"a":1,"b":2}');
  });

  it('validates valid JSON', () => {
    expect(toolkit.validateJson('{"key": "value"}')).toEqual({ valid: true });
  });

  it('validates invalid JSON', () => {
    const result = toolkit.validateJson('{bad json}');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('formatJson throws on invalid input', () => {
    expect(() => toolkit.formatJson('not json')).toThrow();
  });
});

// ── Regex Tester ──
describe('Regex Tester', () => {
  it('finds matches', () => {
    const result = toolkit.testRegex('\\d+', 'g', 'abc 123 def 456');
    expect(result.valid).toBe(true);
    expect(result.matchCount).toBe(2);
    expect(result.matches[0].match).toBe('123');
    expect(result.matches[1].match).toBe('456');
  });

  it('returns match index', () => {
    const result = toolkit.testRegex('world', '', 'hello world');
    expect(result.matches[0].index).toBe(6);
  });

  it('captures groups', () => {
    const result = toolkit.testRegex('(\\w+)@(\\w+)', '', 'user@host');
    expect(result.matches[0].groups).toEqual(['user', 'host']);
  });

  it('handles invalid regex', () => {
    const result = toolkit.testRegex('[invalid', '', 'test');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('handles no matches', () => {
    const result = toolkit.testRegex('xyz', 'g', 'abc def');
    expect(result.matchCount).toBe(0);
  });
});

// ── Text Diff ──
describe('Text Diff', () => {
  it('detects no changes', () => {
    const result = toolkit.textDiff('hello\nworld', 'hello\nworld');
    expect(result.stats.added).toBe(0);
    expect(result.stats.removed).toBe(0);
  });

  it('detects additions', () => {
    const result = toolkit.textDiff('line1', 'line1\nline2');
    expect(result.stats.added).toBeGreaterThan(0);
  });

  it('detects removals', () => {
    const result = toolkit.textDiff('line1\nline2', 'line1');
    expect(result.stats.removed).toBeGreaterThan(0);
  });

  it('handles empty strings', () => {
    const result = toolkit.textDiff('', '');
    expect(result.diff).toHaveLength(1); // Single empty line
  });
});

// ── Timestamp ──
describe('Timestamp Converter', () => {
  it('converts unix timestamp to date', () => {
    const result = toolkit.timestampToDate(1704067200);
    expect(result.iso).toContain('2024-01-01');
  });

  it('converts millisecond timestamp', () => {
    const result = toolkit.timestampToDate(1704067200000);
    expect(result.iso).toContain('2024-01-01');
  });

  it('converts date string to timestamp', () => {
    const result = toolkit.dateToTimestamp('2024-01-01T00:00:00Z');
    expect(result.unix).toBe(1704067200);
  });

  it('throws on invalid date', () => {
    expect(() => toolkit.dateToTimestamp('not a date')).toThrow('Invalid date');
  });

  it('nowTimestamp returns current time', () => {
    const result = toolkit.nowTimestamp();
    expect(result.unixMs).toBeCloseTo(Date.now(), -2); // Within 100ms
  });
});

// ── UUID ──
describe('UUID', () => {
  it('generates valid UUID v4', () => {
    const uuid = toolkit.generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates unique UUIDs', () => {
    const a = toolkit.generateUUID();
    const b = toolkit.generateUUID();
    expect(a).not.toBe(b);
  });
});

// ── JWT Decode ──
describe('JWT Decode', () => {
  it('decodes a valid JWT', () => {
    // Test JWT with header: {"alg":"HS256"}, payload: {"sub":"1234567890","name":"Test"}
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlRlc3QifQ.signature';
    const result = toolkit.decodeJwt(token);
    expect(result.header.alg).toBe('HS256');
    expect(result.payload.sub).toBe('1234567890');
  });

  it('throws on invalid JWT', () => {
    expect(() => toolkit.decodeJwt('not.a.jwt')).toThrow();
  });

  it('throws on wrong number of parts', () => {
    expect(() => toolkit.decodeJwt('only-one-part')).toThrow('Invalid JWT format');
  });
});

// ── Color Conversion ──
describe('Color Conversion', () => {
  it('converts hex to RGB', () => {
    const result = toolkit.hexToRgb('#ff0000');
    expect(result).toEqual({ r: 255, g: 0, b: 0, css: 'rgb(255, 0, 0)' });
  });

  it('handles short hex', () => {
    const result = toolkit.hexToRgb('#f00');
    expect(result.r).toBe(255);
    expect(result.g).toBe(0);
  });

  it('handles hex without #', () => {
    const result = toolkit.hexToRgb('00ff88');
    expect(result.g).toBe(255);
  });

  it('converts RGB to hex', () => {
    expect(toolkit.rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(toolkit.rgbToHex(0, 255, 136)).toBe('#00ff88');
  });

  it('clamps RGB values', () => {
    expect(toolkit.rgbToHex(300, -10, 128)).toBe('#ff0080');
  });
});

// ── Exports ──
describe('Module Exports', () => {
  it('exports all expected functions', () => {
    const fns = [
      'generateHash', 'generateAllHashes',
      'base64Encode', 'base64Decode',
      'urlEncode', 'urlDecode',
      'formatJson', 'minifyJson', 'validateJson',
      'testRegex', 'textDiff',
      'timestampToDate', 'dateToTimestamp', 'nowTimestamp',
      'generateUUID', 'decodeJwt',
      'hexToRgb', 'rgbToHex',
    ];
    for (const fn of fns) {
      expect(typeof toolkit[fn]).toBe('function');
    }
  });
});
