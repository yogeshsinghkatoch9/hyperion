import { describe, it, expect } from 'vitest';
const hg = require('../services/hashGenerator');

describe('Hash Algorithms', () => {
  it('md5 produces a 32-character hex string', () => {
    const result = hg.hash('hello', 'md5');
    expect(result).toHaveLength(32);
    expect(result).toMatch(/^[0-9a-f]{32}$/);
  });

  it('sha1 produces a 40-character hex string', () => {
    const result = hg.hash('hello', 'sha1');
    expect(result).toHaveLength(40);
    expect(result).toMatch(/^[0-9a-f]{40}$/);
  });

  it('sha256 produces a 64-character hex string', () => {
    const result = hg.hash('hello', 'sha256');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sha512 produces a 128-character hex string', () => {
    const result = hg.hash('hello', 'sha512');
    expect(result).toHaveLength(128);
    expect(result).toMatch(/^[0-9a-f]{128}$/);
  });

  it('default algorithm is sha256', () => {
    const withDefault = hg.hash('test');
    const withExplicit = hg.hash('test', 'sha256');
    expect(withDefault).toBe(withExplicit);
  });

  it('throws for unsupported algorithm', () => {
    expect(() => hg.hash('test', 'sha384')).toThrow('Unsupported algorithm');
  });
});

describe('Deterministic Hashing', () => {
  it('same input produces same hash', () => {
    const a = hg.hash('deterministic', 'sha256');
    const b = hg.hash('deterministic', 'sha256');
    expect(a).toBe(b);
  });

  it('different input produces different hash', () => {
    const a = hg.hash('hello', 'sha256');
    const b = hg.hash('world', 'sha256');
    expect(a).not.toBe(b);
  });
});

describe('hashFile', () => {
  it('hashes a buffer and returns hex string', () => {
    const buf = Buffer.from('hello');
    const result = hg.hashFile(buf, 'sha256');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('buffer hash matches string hash for same content', () => {
    const text = 'test content';
    const fromString = hg.hash(text, 'sha256');
    const fromBuffer = hg.hashFile(Buffer.from(text), 'sha256');
    expect(fromBuffer).toBe(fromString);
  });

  it('throws for non-Buffer input', () => {
    expect(() => hg.hashFile('not a buffer')).toThrow('First argument must be a Buffer');
  });
});

describe('HMAC', () => {
  it('produces a hex string of correct length for sha256', () => {
    const result = hg.hmac('hello', 'secret', 'sha256');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('hmac produces different output than hash', () => {
    const hashResult = hg.hash('hello', 'sha256');
    const hmacResult = hg.hmac('hello', 'secret', 'sha256');
    expect(hmacResult).not.toBe(hashResult);
  });

  it('hmac with same key is deterministic', () => {
    const a = hg.hmac('message', 'key123', 'sha256');
    const b = hg.hmac('message', 'key123', 'sha256');
    expect(a).toBe(b);
  });

  it('hmac with different keys produces different output', () => {
    const a = hg.hmac('message', 'key1', 'sha256');
    const b = hg.hmac('message', 'key2', 'sha256');
    expect(a).not.toBe(b);
  });

  it('throws when key is missing', () => {
    expect(() => hg.hmac('hello', null)).toThrow('Key is required');
  });
});

describe('getAlgorithms', () => {
  it('returns an array of 4 algorithms', () => {
    const algos = hg.getAlgorithms();
    expect(algos).toHaveLength(4);
  });

  it('includes md5, sha1, sha256, sha512', () => {
    const algos = hg.getAlgorithms();
    expect(algos).toContain('md5');
    expect(algos).toContain('sha1');
    expect(algos).toContain('sha256');
    expect(algos).toContain('sha512');
  });

  it('returns a new array each time (not a reference)', () => {
    const a = hg.getAlgorithms();
    const b = hg.getAlgorithms();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('Compare', () => {
  it('matches correct algorithm for a known hash', () => {
    const sha256Hash = hg.hash('test', 'sha256');
    const result = hg.compare('test', sha256Hash);
    expect(result.match).toBe(true);
    expect(result.algorithm).toBe('sha256');
  });

  it('matches md5 hash correctly', () => {
    const md5Hash = hg.hash('hello', 'md5');
    const result = hg.compare('hello', md5Hash);
    expect(result.match).toBe(true);
    expect(result.algorithm).toBe('md5');
  });

  it('returns no match for wrong plaintext', () => {
    const sha256Hash = hg.hash('correct', 'sha256');
    const result = hg.compare('wrong', sha256Hash);
    expect(result.match).toBe(false);
    expect(result.algorithm).toBeNull();
  });

  it('returns no match for garbage hash', () => {
    const result = hg.compare('test', 'not_a_real_hash');
    expect(result.match).toBe(false);
    expect(result.algorithm).toBeNull();
  });
});

describe('Bcrypt', () => {
  it('bcryptHash returns a hash starting with $2', async () => {
    const result = await hg.bcryptHash('password123');
    expect(result).toMatch(/^\$2[aby]?\$/);
  });

  it('bcryptCompare returns true for correct password', async () => {
    const hash = await hg.bcryptHash('mypassword', 4);
    const result = await hg.bcryptCompare('mypassword', hash);
    expect(result).toBe(true);
  });

  it('bcryptCompare returns false for wrong password', async () => {
    const hash = await hg.bcryptHash('correctpassword', 4);
    const result = await hg.bcryptCompare('wrongpassword', hash);
    expect(result).toBe(false);
  });

  it('bcryptHash throws for null input', async () => {
    await expect(hg.bcryptHash(null)).rejects.toThrow('Text is required');
  });
});
