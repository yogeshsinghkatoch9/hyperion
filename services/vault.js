/**
 * Hyperion Vault — Encrypted Secrets Manager
 * AES-256-GCM encryption, PBKDF2 key derivation, auto-lock, password generation
 */
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ── Encryption Constants ──
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;        // 256 bits
const IV_LENGTH = 16;         // 128 bits
const AUTH_TAG_LENGTH = 16;   // 128 bits
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 32;

// ── State ──
let _derivedKey = null;       // In-memory only — never persisted
let _unlockTime = 0;
let _autoLockMs = 15 * 60 * 1000; // 15 min default

// ═══ KEY DERIVATION ═══

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
}

// ═══ ENCRYPTION / DECRYPTION ═══

function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: base64(salt is separate, iv + authTag + ciphertext)
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decrypt(encryptedB64, key) {
  const data = Buffer.from(encryptedB64, 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

// ═══ MASTER PASSWORD ═══

function setupMasterPassword(db, password) {
  if (!password || password.length < 6) {
    throw new Error('Master password must be at least 6 characters');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);

  // Store a known test string encrypted with the key to verify on unlock
  const testPlain = 'HYPERION_VAULT_OK';
  const testEncrypted = encrypt(testPlain, key);

  // Hash the password for quick verification
  const passHash = crypto.createHash('sha256').update(password + salt.toString('hex')).digest('hex');

  db.prepare(`INSERT OR REPLACE INTO vault_config (key, value) VALUES ('salt', ?)`).run(salt.toString('hex'));
  db.prepare(`INSERT OR REPLACE INTO vault_config (key, value) VALUES ('test_cipher', ?)`).run(testEncrypted);
  db.prepare(`INSERT OR REPLACE INTO vault_config (key, value) VALUES ('pass_hash', ?)`).run(passHash);

  _derivedKey = key;
  _unlockTime = Date.now();

  return true;
}

function hasMasterPassword(db) {
  try {
    const row = db.prepare("SELECT value FROM vault_config WHERE key = 'salt'").get();
    return !!row;
  } catch {
    return false;
  }
}

function unlock(db, password) {
  const saltRow = db.prepare("SELECT value FROM vault_config WHERE key = 'salt'").get();
  const testRow = db.prepare("SELECT value FROM vault_config WHERE key = 'test_cipher'").get();

  if (!saltRow || !testRow) throw new Error('Vault not initialized — set a master password first');

  const salt = Buffer.from(saltRow.value, 'hex');
  const key = deriveKey(password, salt);

  // Verify by decrypting test cipher
  try {
    const result = decrypt(testRow.value, key);
    if (result !== 'HYPERION_VAULT_OK') throw new Error('Verification failed');
  } catch {
    throw new Error('Invalid master password');
  }

  _derivedKey = key;
  _unlockTime = Date.now();
  return true;
}

function lock() {
  _derivedKey = null;
  _unlockTime = 0;
}

function isUnlocked() {
  if (!_derivedKey) return false;

  // Auto-lock check
  if (_autoLockMs > 0 && Date.now() - _unlockTime > _autoLockMs) {
    lock();
    return false;
  }

  return true;
}

function touchActivity() {
  if (_derivedKey) _unlockTime = Date.now();
}

function setAutoLock(minutes) {
  _autoLockMs = Math.max(0, minutes) * 60 * 1000;
}

function requireUnlocked() {
  if (!isUnlocked()) throw new Error('Vault is locked');
  touchActivity();
}

// ═══ SECRETS CRUD ═══

function addSecret(db, { name, value, category, notes }) {
  requireUnlocked();
  if (!name || !value) throw new Error('Name and value are required');

  const id = uuidv4();
  const encryptedValue = encrypt(value, _derivedKey);
  const encryptedNotes = notes ? encrypt(notes, _derivedKey) : null;

  db.prepare('INSERT INTO vault_secrets (id, name, encrypted_value, category, encrypted_notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))')
    .run(id, name, encryptedValue, category || 'general', encryptedNotes);

  return { id, name, category: category || 'general' };
}

function getSecrets(db) {
  requireUnlocked();

  const rows = db.prepare('SELECT id, name, category, created_at, updated_at FROM vault_secrets ORDER BY category, name').all();
  return rows;
}

function getSecret(db, id) {
  requireUnlocked();

  const row = db.prepare('SELECT * FROM vault_secrets WHERE id = ?').get(id);
  if (!row) throw new Error('Secret not found');

  return {
    id: row.id,
    name: row.name,
    value: decrypt(row.encrypted_value, _derivedKey),
    category: row.category,
    notes: row.encrypted_notes ? decrypt(row.encrypted_notes, _derivedKey) : '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function updateSecret(db, id, { name, value, category, notes }) {
  requireUnlocked();

  const existing = db.prepare('SELECT id FROM vault_secrets WHERE id = ?').get(id);
  if (!existing) throw new Error('Secret not found');

  const updates = [];
  const values = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (value !== undefined) { updates.push('encrypted_value = ?'); values.push(encrypt(value, _derivedKey)); }
  if (category !== undefined) { updates.push('category = ?'); values.push(category); }
  if (notes !== undefined) { updates.push('encrypted_notes = ?'); values.push(notes ? encrypt(notes, _derivedKey) : null); }

  updates.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE vault_secrets SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return true;
}

function deleteSecret(db, id) {
  requireUnlocked();
  db.prepare('DELETE FROM vault_secrets WHERE id = ?').run(id);
  return true;
}

function searchSecrets(db, query) {
  requireUnlocked();
  const q = `%${query}%`;
  return db.prepare('SELECT id, name, category, created_at, updated_at FROM vault_secrets WHERE name LIKE ? OR category LIKE ? ORDER BY name').all(q, q);
}

// ═══ PASSWORD GENERATOR ═══

const CHARSETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  hex: '0123456789abcdef',
};

function generatePassword(options = {}) {
  const {
    length = 32,
    lowercase = true,
    uppercase = true,
    digits = true,
    symbols = true,
    excludeAmbiguous = false,
  } = options;

  let charset = '';
  if (lowercase) charset += CHARSETS.lowercase;
  if (uppercase) charset += CHARSETS.uppercase;
  if (digits) charset += CHARSETS.digits;
  if (symbols) charset += CHARSETS.symbols;

  if (!charset) charset = CHARSETS.lowercase + CHARSETS.uppercase + CHARSETS.digits;

  if (excludeAmbiguous) {
    charset = charset.replace(/[0OIl1|]/g, '');
  }

  const bytes = crypto.randomBytes(length);
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }

  return password;
}

function generateToken(length = 64, encoding = 'hex') {
  // For hex: 2 chars per byte. For base64: ~4/3 chars per byte
  const byteCount = encoding === 'base64' ? Math.ceil(length * 3 / 4) : Math.ceil(length / 2);
  const bytes = crypto.randomBytes(byteCount);
  return bytes.toString(encoding === 'base64' ? 'base64' : 'hex').slice(0, length);
}

function generateUUID() {
  return uuidv4();
}

// ═══ .ENV IMPORT / EXPORT ═══

function parseEnvString(envStr) {
  const secrets = [];
  if (!envStr) return secrets;

  for (const line of envStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    secrets.push({ name: key, value });
  }

  return secrets;
}

function importEnv(db, envStr, category = 'env') {
  requireUnlocked();
  const parsed = parseEnvString(envStr);
  const imported = [];

  for (const { name, value } of parsed) {
    const result = addSecret(db, { name, value, category });
    imported.push(result);
  }

  return imported;
}

function exportEnv(db, category) {
  requireUnlocked();

  let rows;
  if (category) {
    rows = db.prepare('SELECT * FROM vault_secrets WHERE category = ? ORDER BY name').all(category);
  } else {
    rows = db.prepare('SELECT * FROM vault_secrets ORDER BY name').all();
  }

  const lines = [];
  for (const row of rows) {
    const value = decrypt(row.encrypted_value, _derivedKey);
    // Quote values with spaces or special chars
    const needsQuotes = /[\s#=]/.test(value);
    lines.push(`${row.name}=${needsQuotes ? `"${value}"` : value}`);
  }

  return lines.join('\n');
}

// ═══ CATEGORIES ═══

function getCategories(db) {
  requireUnlocked();
  try {
    const rows = db.prepare('SELECT DISTINCT category FROM vault_secrets ORDER BY category').all();
    return rows.map(r => r.category);
  } catch { return []; }
}

// ═══ EXPORTS ═══
module.exports = {
  // Crypto primitives (for testing)
  deriveKey,
  encrypt,
  decrypt,
  PBKDF2_ITERATIONS,

  // Master password
  setupMasterPassword,
  hasMasterPassword,
  unlock,
  lock,
  isUnlocked,
  setAutoLock,

  // Secrets
  addSecret,
  getSecrets,
  getSecret,
  updateSecret,
  deleteSecret,
  searchSecrets,
  getCategories,

  // Generator
  generatePassword,
  generateToken,
  generateUUID,
  CHARSETS,

  // .env
  parseEnvString,
  importEnv,
  exportEnv,
};
