import { describe, it, expect } from 'vitest';
const jwt = require('../services/jwtDebugger');

describe('Decode Valid JWT', () => {
  const token = jwt.encode({ sub: '1234', name: 'Test' }, 'secret');

  it('decodes header', () => {
    const r = jwt.decode(token);
    expect(r.header).toEqual({ alg: 'HS256', typ: 'JWT' });
  });
  it('decodes payload', () => {
    const r = jwt.decode(token);
    expect(r.payload.sub).toBe('1234');
    expect(r.payload.name).toBe('Test');
  });
  it('returns signature string', () => {
    const r = jwt.decode(token);
    expect(typeof r.signature).toBe('string');
    expect(r.signature.length).toBeGreaterThan(0);
  });
});

describe('Encode + Decode Roundtrip', () => {
  it('roundtrips with HS256', () => {
    const token = jwt.encode({ foo: 'bar' }, 'mysecret');
    const decoded = jwt.decode(token);
    expect(decoded.payload.foo).toBe('bar');
    expect(decoded.header.alg).toBe('HS256');
  });
  it('roundtrips with HS384', () => {
    const token = jwt.encode({ x: 1 }, 'key', { algorithm: 'HS384' });
    const decoded = jwt.decode(token);
    expect(decoded.header.alg).toBe('HS384');
    expect(decoded.payload.x).toBe(1);
  });
  it('roundtrips with HS512', () => {
    const token = jwt.encode({ y: 2 }, 'key', { algorithm: 'HS512' });
    const decoded = jwt.decode(token);
    expect(decoded.header.alg).toBe('HS512');
  });
});

describe('Verify', () => {
  const token = jwt.encode({ test: true }, 'correct-secret');

  it('verifies with correct secret', () => {
    const r = jwt.verify(token, 'correct-secret');
    expect(r.valid).toBe(true);
    expect(r.error).toBeNull();
  });
  it('fails with wrong secret', () => {
    const r = jwt.verify(token, 'wrong-secret');
    expect(r.valid).toBe(false);
  });
  it('fails with malformed token', () => {
    const r = jwt.verify('not.a.jwt', 'secret');
    expect(r.valid).toBe(false);
  });
  it('detects expired token', () => {
    const expired = jwt.encode({ data: 1 }, 'key', { expiresIn: -100 });
    const r = jwt.verify(expired, 'key');
    expect(r.valid).toBe(true);
    expect(r.expired).toBe(true);
  });
});

describe('Base64Url Encode/Decode', () => {
  it('encodes object to base64url', () => {
    const encoded = jwt.encodeBase64Url({ hello: 'world' });
    expect(typeof encoded).toBe('string');
  });
  it('decodes base64url to object', () => {
    const encoded = jwt.encodeBase64Url({ hello: 'world' });
    const decoded = jwt.decodeBase64Url(encoded);
    expect(decoded).toEqual({ hello: 'world' });
  });
  it('throws on invalid base64url', () => {
    expect(() => jwt.decodeBase64Url('!!!')).toThrow();
  });
});

describe('Expiry Check', () => {
  it('returns false for non-expired', () => {
    const token = jwt.encode({ data: 1 }, 'key', { expiresIn: 3600 });
    expect(jwt.isExpired(token)).toBe(false);
  });
  it('returns true for expired', () => {
    const token = jwt.encode({ data: 1 }, 'key', { expiresIn: -100 });
    expect(jwt.isExpired(token)).toBe(true);
  });
  it('returns false when no exp claim', () => {
    const token = jwt.encode({ data: 1 }, 'key');
    expect(jwt.isExpired(token)).toBe(false);
  });
});

describe('Algorithms', () => {
  it('returns supported algorithms', () => {
    const algs = jwt.getAlgorithms();
    expect(algs.length).toBe(3);
    expect(algs.map(a => a.name)).toContain('HS256');
  });
  it('each algorithm has name and hash', () => {
    const alg = jwt.getAlgorithms()[0];
    expect(alg).toHaveProperty('name');
    expect(alg).toHaveProperty('hash');
    expect(alg).toHaveProperty('description');
  });
});

describe('Timestamp Format', () => {
  it('formats epoch to ISO string', () => {
    const ts = jwt.formatTimestamp(1700000000);
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('returns valid date', () => {
    const ts = jwt.formatTimestamp(0);
    expect(ts).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('Edge Cases', () => {
  it('throws on missing token', () => {
    expect(() => jwt.decode('')).toThrow();
    expect(() => jwt.decode(null)).toThrow();
  });
});

describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof jwt.decode).toBe('function');
    expect(typeof jwt.encode).toBe('function');
    expect(typeof jwt.verify).toBe('function');
    expect(typeof jwt.decodeBase64Url).toBe('function');
    expect(typeof jwt.encodeBase64Url).toBe('function');
    expect(typeof jwt.getTokenInfo).toBe('function');
    expect(typeof jwt.isExpired).toBe('function');
    expect(typeof jwt.getAlgorithms).toBe('function');
    expect(typeof jwt.formatTimestamp).toBe('function');
  });
});
