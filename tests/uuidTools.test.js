import { describe, it, expect } from 'vitest';
const uuid = require('../services/uuidTools');

const V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('v4', () => {
  it('returns a valid v4 UUID format', () => {
    const result = uuid.v4();
    expect(result).toMatch(V4_REGEX);
  });

  it('generates unique values on successive calls', () => {
    const a = uuid.v4();
    const b = uuid.v4();
    expect(a).not.toBe(b);
  });

  it('always has version digit 4 at position 14', () => {
    const result = uuid.v4();
    expect(result.charAt(14)).toBe('4');
  });

  it('always has variant bits 8, 9, a, or b at position 19', () => {
    const result = uuid.v4();
    expect(['8', '9', 'a', 'b']).toContain(result.charAt(19));
  });
});

describe('v1', () => {
  it('returns a valid UUID format', () => {
    const result = uuid.v1();
    expect(result).toMatch(UUID_REGEX);
  });

  it('has version digit 1 at position 14', () => {
    const result = uuid.v1();
    expect(result.charAt(14)).toBe('1');
  });

  it('generates unique values', () => {
    const a = uuid.v1();
    const b = uuid.v1();
    expect(a).not.toBe(b);
  });
});

describe('nil', () => {
  it('returns all zeros UUID', () => {
    expect(uuid.nil()).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('is a valid UUID format', () => {
    expect(uuid.nil()).toMatch(UUID_REGEX);
  });
});

describe('validate', () => {
  it('accepts a valid v4 UUID', () => {
    expect(uuid.validate(uuid.v4())).toBe(true);
  });

  it('accepts a valid v1 UUID', () => {
    expect(uuid.validate(uuid.v1())).toBe(true);
  });

  it('accepts the nil UUID', () => {
    expect(uuid.validate(uuid.nil())).toBe(true);
  });

  it('rejects an invalid string', () => {
    expect(uuid.validate('not-a-uuid')).toBe(false);
  });

  it('rejects null', () => {
    expect(uuid.validate(null)).toBe(false);
  });

  it('rejects a UUID with wrong length', () => {
    expect(uuid.validate('12345678-1234-1234-1234-12345678')).toBe(false);
  });
});

describe('version', () => {
  it('extracts version 4 from a v4 UUID', () => {
    expect(uuid.version(uuid.v4())).toBe(4);
  });

  it('extracts version 1 from a v1 UUID', () => {
    expect(uuid.version(uuid.v1())).toBe(1);
  });

  it('returns null for invalid UUID', () => {
    expect(uuid.version('invalid')).toBeNull();
  });
});

describe('parse', () => {
  it('returns version and variant for a v4 UUID', () => {
    const result = uuid.parse(uuid.v4());
    expect(result.version).toBe(4);
    expect(result.variant).toBe('RFC 4122');
  });

  it('returns timestamp for a v1 UUID', () => {
    const result = uuid.parse(uuid.v1());
    expect(result.version).toBe(1);
    expect(result.timestamp).toBeTypeOf('number');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('throws for invalid UUID string', () => {
    expect(() => uuid.parse('bad-string')).toThrow('Invalid UUID');
  });
});

describe('generateBatch', () => {
  it('returns the correct count of UUIDs', () => {
    const batch = uuid.generateBatch(5);
    expect(batch).toHaveLength(5);
  });

  it('all UUIDs in the batch are valid v4', () => {
    const batch = uuid.generateBatch(10);
    for (const id of batch) {
      expect(id).toMatch(V4_REGEX);
    }
  });

  it('clamps count to a maximum of 10000', () => {
    const batch = uuid.generateBatch(20000);
    expect(batch).toHaveLength(10000);
  });

  it('clamps count to a minimum of 1', () => {
    const batch = uuid.generateBatch(0);
    expect(batch).toHaveLength(1);
  });
});

describe('isNil', () => {
  it('returns true for the nil UUID', () => {
    expect(uuid.isNil('00000000-0000-0000-0000-000000000000')).toBe(true);
  });

  it('returns false for a v4 UUID', () => {
    expect(uuid.isNil(uuid.v4())).toBe(false);
  });

  it('returns false for null input', () => {
    expect(uuid.isNil(null)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(uuid.isNil('00000000-0000-0000-0000-000000000000')).toBe(true);
  });
});
