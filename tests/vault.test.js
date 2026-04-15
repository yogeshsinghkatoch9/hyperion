import { describe, it, expect } from 'vitest';

const vault = require('../services/vault');
const crypto = require('crypto');

// ── Encryption / Decryption Round-Trip ──
describe('AES-256-GCM Encryption', () => {
  const testKey = crypto.randomBytes(32);

  it('encrypts and decrypts a string correctly', () => {
    const plain = 'my-super-secret-api-key-12345';
    const encrypted = vault.encrypt(plain, testKey);
    const decrypted = vault.decrypt(encrypted, testKey);
    expect(decrypted).toBe(plain);
  });

  it('encrypted output is base64', () => {
    const encrypted = vault.encrypt('test', testKey);
    expect(typeof encrypted).toBe('string');
    // Should be valid base64
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
  });

  it('produces different ciphertexts for same plaintext (random IV)', () => {
    const plain = 'same-value';
    const a = vault.encrypt(plain, testKey);
    const b = vault.encrypt(plain, testKey);
    expect(a).not.toBe(b); // Different IVs
    expect(vault.decrypt(a, testKey)).toBe(plain);
    expect(vault.decrypt(b, testKey)).toBe(plain);
  });

  it('fails to decrypt with wrong key', () => {
    const wrongKey = crypto.randomBytes(32);
    const encrypted = vault.encrypt('secret', testKey);
    expect(() => vault.decrypt(encrypted, wrongKey)).toThrow();
  });

  it('handles unicode and special characters', () => {
    const plain = 'p@$$w0rd!#%^&*() 日本語 emoji: 🔑🔐';
    const encrypted = vault.encrypt(plain, testKey);
    expect(vault.decrypt(encrypted, testKey)).toBe(plain);
  });

  it('handles empty string', () => {
    const encrypted = vault.encrypt('', testKey);
    expect(vault.decrypt(encrypted, testKey)).toBe('');
  });

  it('handles long values', () => {
    const plain = 'x'.repeat(10000);
    const encrypted = vault.encrypt(plain, testKey);
    expect(vault.decrypt(encrypted, testKey)).toBe(plain);
  });
});

// ── Key Derivation ──
describe('PBKDF2 Key Derivation', () => {
  it('derives consistent key from same password + salt', () => {
    const salt = crypto.randomBytes(32);
    const key1 = vault.deriveKey('password123', salt);
    const key2 = vault.deriveKey('password123', salt);
    expect(key1.equals(key2)).toBe(true);
  });

  it('derives different keys for different passwords', () => {
    const salt = crypto.randomBytes(32);
    const key1 = vault.deriveKey('password1', salt);
    const key2 = vault.deriveKey('password2', salt);
    expect(key1.equals(key2)).toBe(false);
  });

  it('derives different keys for different salts', () => {
    const salt1 = crypto.randomBytes(32);
    const salt2 = crypto.randomBytes(32);
    const key1 = vault.deriveKey('same-password', salt1);
    const key2 = vault.deriveKey('same-password', salt2);
    expect(key1.equals(key2)).toBe(false);
  });

  it('produces 32-byte key', () => {
    const key = vault.deriveKey('test', crypto.randomBytes(32));
    expect(key.length).toBe(32);
  });
});

// ── Password Generator ──
describe('Password Generator', () => {
  it('generates password of specified length', () => {
    const pw = vault.generatePassword({ length: 20 });
    expect(pw.length).toBe(20);
  });

  it('default length is 32', () => {
    const pw = vault.generatePassword();
    expect(pw.length).toBe(32);
  });

  it('lowercase only', () => {
    const pw = vault.generatePassword({ length: 50, lowercase: true, uppercase: false, digits: false, symbols: false });
    expect(pw).toMatch(/^[a-z]+$/);
  });

  it('uppercase only', () => {
    const pw = vault.generatePassword({ length: 50, lowercase: false, uppercase: true, digits: false, symbols: false });
    expect(pw).toMatch(/^[A-Z]+$/);
  });

  it('digits only', () => {
    const pw = vault.generatePassword({ length: 50, lowercase: false, uppercase: false, digits: true, symbols: false });
    expect(pw).toMatch(/^[0-9]+$/);
  });

  it('excludeAmbiguous removes confusing chars', () => {
    const pw = vault.generatePassword({ length: 200, excludeAmbiguous: true });
    expect(pw).not.toMatch(/[0OIl1|]/);
  });

  it('generates unique passwords', () => {
    const set = new Set();
    for (let i = 0; i < 20; i++) set.add(vault.generatePassword());
    expect(set.size).toBe(20);
  });
});

// ── Token Generator ──
describe('Token Generator', () => {
  it('generates hex token of specified length', () => {
    const token = vault.generateToken(64, 'hex');
    expect(token.length).toBe(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it('generates base64 token', () => {
    const token = vault.generateToken(32, 'base64');
    expect(token.length).toBe(32);
  });

  it('default is 64 hex chars', () => {
    const token = vault.generateToken();
    expect(token.length).toBe(64);
  });
});

// ── UUID Generator ──
describe('UUID Generator', () => {
  it('generates valid UUID v4 format', () => {
    const uuid = vault.generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates unique UUIDs', () => {
    const a = vault.generateUUID();
    const b = vault.generateUUID();
    expect(a).not.toBe(b);
  });
});

// ── .env Parsing ──
describe('.env Parsing', () => {
  it('parses simple key=value pairs', () => {
    const result = vault.parseEnvString('API_KEY=abc123\nDB_HOST=localhost');
    expect(result).toEqual([
      { name: 'API_KEY', value: 'abc123' },
      { name: 'DB_HOST', value: 'localhost' },
    ]);
  });

  it('handles quoted values', () => {
    const result = vault.parseEnvString('SECRET="my secret value"\nTOKEN=\'quoted\'');
    expect(result[0].value).toBe('my secret value');
    expect(result[1].value).toBe('quoted');
  });

  it('skips comments and empty lines', () => {
    const result = vault.parseEnvString('# This is a comment\n\nKEY=value\n# Another comment');
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('KEY');
  });

  it('handles values with = sign', () => {
    const result = vault.parseEnvString('URL=postgres://user:pass@host/db?opt=true');
    expect(result[0].value).toBe('postgres://user:pass@host/db?opt=true');
  });

  it('handles empty input', () => {
    expect(vault.parseEnvString('')).toEqual([]);
    expect(vault.parseEnvString(null)).toEqual([]);
  });

  it('trims whitespace', () => {
    const result = vault.parseEnvString('  KEY  =  value  ');
    expect(result[0].name).toBe('KEY');
    expect(result[0].value).toBe('value');
  });
});

// ── Lock/Unlock State ──
describe('Vault Lock State', () => {
  it('starts locked', () => {
    vault.lock(); // Ensure clean state
    expect(vault.isUnlocked()).toBe(false);
  });

  it('lock clears derived key', () => {
    vault.lock();
    expect(vault.isUnlocked()).toBe(false);
  });
});

// ── Charsets ──
describe('Charsets', () => {
  it('has all expected character sets', () => {
    expect(vault.CHARSETS.lowercase).toBe('abcdefghijklmnopqrstuvwxyz');
    expect(vault.CHARSETS.uppercase).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(vault.CHARSETS.digits).toBe('0123456789');
    expect(vault.CHARSETS.hex).toBe('0123456789abcdef');
    expect(vault.CHARSETS.symbols.length).toBeGreaterThan(10);
  });
});

// ── PBKDF2 Iterations ──
describe('Security Constants', () => {
  it('uses at least 100000 PBKDF2 iterations', () => {
    expect(vault.PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(100000);
  });
});
