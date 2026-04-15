/**
 * TOTP (Time-based One-Time Password) — RFC 6238
 * No external dependencies — uses Node crypto only.
 */
'use strict';
const crypto = require('crypto');

// ── Base32 (RFC 4648) ──
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    out += B32[parseInt(chunk, 2)];
  }
  return out;
}

function base32Decode(str) {
  let bits = '';
  for (const c of str.toUpperCase().replace(/=+$/, '')) {
    const idx = B32.indexOf(c);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// ── TOTP Core ──

function generateSecret() {
  const buf = crypto.randomBytes(20);
  return base32Encode(buf);
}

function generateTOTP(secret, timeStep = 30, digits = 6) {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  return hotpCode(key, counter, digits);
}

function hotpCode(key, counter, digits) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 |
    (hmac[offset + 1] & 0xff) << 16 |
    (hmac[offset + 2] & 0xff) << 8 |
    (hmac[offset + 3] & 0xff)) % (10 ** digits);

  return String(code).padStart(digits, '0');
}

function verifyTOTP(secret, token, window = 1) {
  const key = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    const code = hotpCode(key, now + i, 6);
    if (code === token) return true;
  }
  return false;
}

function generateQRUri(secret, username, issuer = 'Hyperion') {
  const enc = encodeURIComponent;
  return `otpauth://totp/${enc(issuer)}:${enc(username)}?secret=${secret}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex'));
  }
  return codes;
}

// ── Encryption helpers (AES-256-GCM) ──

function getOrCreateTotpKey(db) {
  const row = db.prepare("SELECT value FROM vault_config WHERE key = 'totp_key'").get();
  if (row) return Buffer.from(row.value, 'hex');
  const key = crypto.randomBytes(32);
  db.prepare("INSERT INTO vault_config (key, value) VALUES ('totp_key', ?)").run(key.toString('hex'));
  return key;
}

function encryptSecret(db, plainSecret) {
  const key = getOrCreateTotpKey(db);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(plainSecret, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return iv.toString('hex') + ':' + enc + ':' + tag;
}

function decryptSecret(db, encrypted) {
  const key = getOrCreateTotpKey(db);
  const [ivHex, encHex, tagHex] = encrypted.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec = decipher.update(encHex, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

module.exports = {
  base32Encode, base32Decode,
  generateSecret, generateTOTP, verifyTOTP,
  generateQRUri, generateBackupCodes,
  encryptSecret, decryptSecret,
  getOrCreateTotpKey,
};
