import { describe, test, expect, vi, beforeEach } from 'vitest';

const totp = await import('../services/totp.js');

// ── Base32 Encode/Decode ──
describe('base32Encode / base32Decode', () => {
  test('round-trip identity', () => {
    const buf = Buffer.from('Hello, World!');
    const encoded = totp.base32Encode(buf);
    const decoded = totp.base32Decode(encoded);
    expect(decoded.toString()).toBe('Hello, World!');
  });

  test('encodes known value', () => {
    const encoded = totp.base32Encode(Buffer.from('test'));
    expect(encoded).toMatch(/^[A-Z2-7]+$/);
  });

  test('decode handles lowercase', () => {
    const buf = Buffer.from('abc');
    const encoded = totp.base32Encode(buf);
    const decoded = totp.base32Decode(encoded.toLowerCase());
    expect(decoded.toString()).toBe('abc');
  });

  test('decode strips padding', () => {
    const buf = Buffer.from('x');
    const encoded = totp.base32Encode(buf) + '===';
    const decoded = totp.base32Decode(encoded);
    expect(decoded.toString()).toBe('x');
  });

  test('decode ignores invalid chars', () => {
    const decoded = totp.base32Decode('JBSWY3DP!!!');
    expect(decoded).toBeTruthy();
  });
});

// ── Secret Generation ──
describe('generateSecret', () => {
  test('returns base32 string', () => {
    const secret = totp.generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  test('produces unique secrets', () => {
    const secrets = new Set(Array.from({ length: 10 }, () => totp.generateSecret()));
    expect(secrets.size).toBe(10);
  });
});

// ── TOTP Generation ──
describe('generateTOTP', () => {
  test('returns 6-digit string', () => {
    const secret = totp.generateSecret();
    const code = totp.generateTOTP(secret);
    expect(code).toMatch(/^\d{6}$/);
  });

  test('same secret + time = same code', () => {
    const secret = totp.generateSecret();
    const code1 = totp.generateTOTP(secret);
    const code2 = totp.generateTOTP(secret);
    expect(code1).toBe(code2);
  });
});

// ── TOTP Verification ──
describe('verifyTOTP', () => {
  test('verifies correct code', () => {
    const secret = totp.generateSecret();
    const code = totp.generateTOTP(secret);
    expect(totp.verifyTOTP(secret, code)).toBe(true);
  });

  test('rejects invalid code', () => {
    const secret = totp.generateSecret();
    expect(totp.verifyTOTP(secret, '000000')).toBe(false);
  });

  test('rejects wrong length', () => {
    const secret = totp.generateSecret();
    expect(totp.verifyTOTP(secret, '12345')).toBe(false);
  });

  test('rejects empty token', () => {
    const secret = totp.generateSecret();
    expect(totp.verifyTOTP(secret, '')).toBe(false);
  });
});

// ── QR URI ──
describe('generateQRUri', () => {
  test('returns otpauth URI', () => {
    const uri = totp.generateQRUri('JBSWY3DPEHPK3PXP', 'alice', 'TestApp');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=TestApp');
    expect(uri).toContain('alice');
  });

  test('defaults issuer to Hyperion', () => {
    const uri = totp.generateQRUri('SECRET', 'bob');
    expect(uri).toContain('issuer=Hyperion');
  });

  test('encodes special characters', () => {
    const uri = totp.generateQRUri('SECRET', 'user@example.com', 'My App');
    expect(uri).toContain('user%40example.com');
    expect(uri).toContain('My%20App');
  });
});

// ── Backup Codes ──
describe('generateBackupCodes', () => {
  test('returns 8 codes by default', () => {
    const codes = totp.generateBackupCodes();
    expect(codes).toHaveLength(8);
    codes.forEach(c => expect(c).toMatch(/^[0-9a-f]{8}$/));
  });

  test('custom count', () => {
    expect(totp.generateBackupCodes(4)).toHaveLength(4);
  });

  test('codes are unique', () => {
    const codes = totp.generateBackupCodes(20);
    expect(new Set(codes).size).toBe(20);
  });
});

// ── Encryption ──
describe('encryptSecret / decryptSecret', () => {
  function mockDb() {
    let totpKeyHex = null;
    return {
      prepare: vi.fn((sql) => ({
        get: vi.fn(() => totpKeyHex ? { value: totpKeyHex } : undefined),
        run: vi.fn((...args) => { if (sql.includes('INSERT')) totpKeyHex = args[0]; }),
      })),
    };
  }

  test('round-trip encryption', () => {
    const db = mockDb();
    const secret = 'MYSECRETBASE32KEY';
    const encrypted = totp.encryptSecret(db, secret);
    expect(encrypted).toContain(':');
    expect(encrypted).not.toBe(secret);
    const decrypted = totp.decryptSecret(db, encrypted);
    expect(decrypted).toBe(secret);
  });

  test('different ciphertexts for same plaintext', () => {
    const db = mockDb();
    const secret = 'SAMESECRET';
    const e1 = totp.encryptSecret(db, secret);
    const e2 = totp.encryptSecret(db, secret);
    expect(e1).not.toBe(e2); // random IV
    expect(totp.decryptSecret(db, e1)).toBe(secret);
    expect(totp.decryptSecret(db, e2)).toBe(secret);
  });
});

// ── getOrCreateTotpKey ──
describe('getOrCreateTotpKey', () => {
  test('creates key on first call', () => {
    let storedKey = null;
    const db = {
      prepare: vi.fn((sql) => ({
        get: vi.fn(() => storedKey ? { value: storedKey } : undefined),
        run: vi.fn((...args) => { storedKey = args[0]; }),
      })),
    };
    const key = totp.getOrCreateTotpKey(db);
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  test('reuses existing key', () => {
    const hexKey = require('crypto').randomBytes(32).toString('hex');
    const db = {
      prepare: vi.fn(() => ({
        get: vi.fn(() => ({ value: hexKey })),
        run: vi.fn(),
      })),
    };
    const key = totp.getOrCreateTotpKey(db);
    expect(key.toString('hex')).toBe(hexKey);
  });
});
