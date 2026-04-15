import { describe, test, expect, vi, beforeEach } from 'vitest';

const apiKeys = await import('../services/apiKeys.js');

// ── generateApiKey ──
describe('generateApiKey', () => {
  test('returns key, prefix, hash', () => {
    const result = apiKeys.generateApiKey();
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('prefix');
    expect(result).toHaveProperty('hash');
  });

  test('key starts with hyp_', () => {
    const { key } = apiKeys.generateApiKey();
    expect(key).toMatch(/^hyp_[0-9a-f]{48}$/);
  });

  test('prefix is first 8 chars', () => {
    const { key, prefix } = apiKeys.generateApiKey();
    expect(prefix).toBe(key.slice(0, 8));
  });

  test('hash is sha256 hex', () => {
    const { hash } = apiKeys.generateApiKey();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('unique keys', () => {
    const keys = new Set(Array.from({ length: 20 }, () => apiKeys.generateApiKey().key));
    expect(keys.size).toBe(20);
  });
});

// ── createKey ──
describe('createKey', () => {
  function mockDb() {
    const run = vi.fn();
    return { prepare: vi.fn(() => ({ run })), _run: run };
  }

  test('inserts and returns full key once', () => {
    const db = mockDb();
    const result = apiKeys.createKey(db, 'user1', 'Test Key');
    expect(result.id).toBeTruthy();
    expect(result.key).toMatch(/^hyp_/);
    expect(result.name).toBe('Test Key');
    expect(result.permissions).toEqual(['*']);
    expect(db._run).toHaveBeenCalledOnce();
  });

  test('stores custom permissions', () => {
    const db = mockDb();
    const result = apiKeys.createKey(db, 'user1', 'Read Only', ['/api/search', '/api/files']);
    expect(result.permissions).toEqual(['/api/search', '/api/files']);
  });

  test('accepts expiry date', () => {
    const db = mockDb();
    apiKeys.createKey(db, 'user1', 'Temp', ['*'], '2030-01-01');
    const args = db._run.mock.calls[0];
    expect(args[6]).toBe('2030-01-01');
  });
});

// ── listKeys ──
describe('listKeys', () => {
  test('returns parsed permissions', () => {
    const db = {
      prepare: vi.fn(() => ({
        all: vi.fn(() => [
          { id: '1', name: 'k1', prefix: 'hyp_abc', permissions: '["*"]', last_used: null, expires_at: null, created_at: '2026-01-01' },
        ]),
      })),
    };
    const keys = apiKeys.listKeys(db, 'user1');
    expect(keys[0].permissions).toEqual(['*']);
  });

  test('empty array when no keys', () => {
    const db = { prepare: vi.fn(() => ({ all: vi.fn(() => []) })) };
    expect(apiKeys.listKeys(db, 'user1')).toEqual([]);
  });
});

// ── deleteKey ──
describe('deleteKey', () => {
  test('returns true when deleted', () => {
    const db = { prepare: vi.fn(() => ({ run: vi.fn(() => ({ changes: 1 })) })) };
    expect(apiKeys.deleteKey(db, 'user1', 'key1')).toBe(true);
  });

  test('returns false when not found', () => {
    const db = { prepare: vi.fn(() => ({ run: vi.fn(() => ({ changes: 0 })) })) };
    expect(apiKeys.deleteKey(db, 'user1', 'bad')).toBe(false);
  });
});

// ── validateKey ──
describe('validateKey', () => {
  test('returns null for non-hyp_ key', () => {
    const db = {};
    expect(apiKeys.validateKey(db, 'bad_key')).toBeNull();
  });

  test('returns null for empty/null', () => {
    expect(apiKeys.validateKey({}, null)).toBeNull();
    expect(apiKeys.validateKey({}, '')).toBeNull();
  });

  test('returns null when prefix not found', () => {
    const db = { prepare: vi.fn(() => ({ get: vi.fn(() => undefined), run: vi.fn() })) };
    expect(apiKeys.validateKey(db, 'hyp_' + '0'.repeat(48))).toBeNull();
  });

  test('returns null when hash mismatch', () => {
    const db = {
      prepare: vi.fn(() => ({
        get: vi.fn(() => ({ prefix: 'hyp_0000', key_hash: 'wronghash', user_id: 'u1', permissions: '["*"]' })),
        run: vi.fn(),
      })),
    };
    expect(apiKeys.validateKey(db, 'hyp_' + '0'.repeat(48))).toBeNull();
  });

  test('returns null for expired key', () => {
    const crypto = require('crypto');
    const { key, prefix, hash } = apiKeys.generateApiKey();
    const db = {
      prepare: vi.fn(() => ({
        get: vi.fn(() => ({ prefix, key_hash: hash, user_id: 'u1', permissions: '["*"]', expires_at: '2020-01-01' })),
        run: vi.fn(),
      })),
    };
    expect(apiKeys.validateKey(db, key)).toBeNull();
  });
});

// ── checkPermission ──
describe('checkPermission', () => {
  test('wildcard allows all', () => {
    expect(apiKeys.checkPermission(['*'], '/api/anything')).toBe(true);
  });

  test('null/undefined permissions default to allow', () => {
    expect(apiKeys.checkPermission(null, '/api/test')).toBe(true);
  });

  test('prefix match', () => {
    expect(apiKeys.checkPermission(['/api/files'], '/api/files/list')).toBe(true);
    expect(apiKeys.checkPermission(['/api/files'], '/api/search')).toBe(false);
  });

  test('multiple permissions', () => {
    const perms = ['/api/search', '/api/files'];
    expect(apiKeys.checkPermission(perms, '/api/search?q=test')).toBe(true);
    expect(apiKeys.checkPermission(perms, '/api/vault')).toBe(false);
  });
});
