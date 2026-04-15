import { describe, it, expect } from 'vitest';
const b64 = require('../services/base64Tools');

describe('Encode / Decode Roundtrip', () => {
  it('encodes and decodes simple ASCII text', () => {
    const text = 'Hello, World!';
    expect(b64.decode(b64.encode(text))).toBe(text);
  });

  it('encodes text to valid base64', () => {
    const result = b64.encode('Hello');
    expect(result).toBe('SGVsbG8=');
  });

  it('decodes base64 back to original text', () => {
    expect(b64.decode('SGVsbG8=')).toBe('Hello');
  });

  it('handles empty string encode and decode', () => {
    const encoded = b64.encode('');
    expect(encoded).toBe('');
    expect(b64.decode(encoded)).toBe('');
  });

  it('handles unicode text roundtrip', () => {
    const text = 'Hola mundo! \u00e9\u00e0\u00fc \u2603 \u2764';
    expect(b64.decode(b64.encode(text))).toBe(text);
  });

  it('handles long strings', () => {
    const text = 'A'.repeat(10000);
    expect(b64.decode(b64.encode(text))).toBe(text);
  });

  it('handles strings with newlines and tabs', () => {
    const text = 'line1\nline2\ttab';
    expect(b64.decode(b64.encode(text))).toBe(text);
  });
});

describe('URL-safe Encode / Decode Roundtrip', () => {
  it('encodes and decodes via URL-safe roundtrip', () => {
    const text = 'Hello, World!';
    expect(b64.decodeUrl(b64.encodeUrl(text))).toBe(text);
  });

  it('URL-safe encoding strips padding characters', () => {
    const encoded = b64.encodeUrl('Hello');
    expect(encoded).not.toContain('=');
  });

  it('URL-safe encoding replaces + and / with - and _', () => {
    // A string whose base64 contains + or /
    const text = '>>??>>'; // base64: Pj4/Pz4+
    const encoded = b64.encodeUrl(text);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
  });

  it('URL-safe handles unicode text', () => {
    const text = 'caf\u00e9 cr\u00e8me';
    expect(b64.decodeUrl(b64.encodeUrl(text))).toBe(text);
  });

  it('URL-safe handles empty string', () => {
    const encoded = b64.encodeUrl('');
    expect(b64.decodeUrl(encoded)).toBe('');
  });
});

describe('isValid', () => {
  it('returns true for valid standard base64', () => {
    expect(b64.isValid('SGVsbG8=')).toBe(true);
  });

  it('returns true for valid base64 without padding', () => {
    expect(b64.isValid('SGVsbG8')).toBe(true);
  });

  it('returns true for URL-safe base64 chars', () => {
    expect(b64.isValid('abc-def_ghi')).toBe(true);
  });

  it('returns false for invalid characters', () => {
    expect(b64.isValid('not valid base64!!!')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(b64.isValid('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(b64.isValid(null)).toBe(false);
  });

  it('returns false for non-string', () => {
    expect(b64.isValid(12345)).toBe(false);
  });
});

describe('encodeFile / decodeToBuffer', () => {
  it('encodeFile creates a data URI with correct MIME type', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const uri = b64.encodeFile(buf, 'image/png');
    expect(uri).toMatch(/^data:image\/png;base64,/);
  });

  it('decodeToBuffer strips data URI prefix and returns buffer', () => {
    const buf = Buffer.from('Hello, World!');
    const uri = b64.encodeFile(buf, 'text/plain');
    const decoded = b64.decodeToBuffer(uri);
    expect(Buffer.isBuffer(decoded)).toBe(true);
    expect(decoded.toString('utf-8')).toBe('Hello, World!');
  });

  it('decodeToBuffer handles raw base64 without data URI prefix', () => {
    const encoded = b64.encode('test data');
    const decoded = b64.decodeToBuffer(encoded);
    expect(decoded.toString('utf-8')).toBe('test data');
  });

  it('encodeFile throws for non-Buffer input', () => {
    expect(() => b64.encodeFile('not a buffer', 'text/plain')).toThrow('First argument must be a Buffer');
  });

  it('encodeFile throws when MIME type is missing', () => {
    expect(() => b64.encodeFile(Buffer.from('hi'), '')).toThrow('MIME type is required');
  });
});

describe('Error Handling', () => {
  it('encode throws for null input', () => {
    expect(() => b64.encode(null)).toThrow('Text is required');
  });

  it('decode throws for null input', () => {
    expect(() => b64.decode(null)).toThrow('Base64 string is required');
  });

  it('decodeToBuffer throws for null input', () => {
    expect(() => b64.decodeToBuffer(null)).toThrow('Base64 string is required');
  });
});
