/**
 * API Key Management — generate, validate, revoke
 */
'use strict';
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const PREFIX = 'hyp_';
const KEY_LENGTH = 48; // hex chars after prefix

function generateApiKey() {
  const raw = crypto.randomBytes(KEY_LENGTH / 2).toString('hex');
  const key = PREFIX + raw;
  const prefix = key.slice(0, 8); // hyp_XXXX for display/lookup
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  return { key, prefix, hash };
}

function createKey(db, userId, name, permissions = ['*'], expiresAt = null) {
  const { key, prefix, hash } = generateApiKey();
  const id = uuidv4();
  db.prepare(
    'INSERT INTO api_keys (id, user_id, name, key_hash, prefix, permissions, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
  ).run(id, userId, name, hash, prefix, JSON.stringify(permissions), expiresAt);
  return { id, key, prefix, name, permissions };
}

function listKeys(db, userId) {
  return db.prepare(
    'SELECT id, name, prefix, permissions, last_used, expires_at, created_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId).map(r => ({
    ...r,
    permissions: JSON.parse(r.permissions || '["*"]'),
  }));
}

function deleteKey(db, userId, keyId) {
  const info = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(keyId, userId);
  return info.changes > 0;
}

function validateKey(db, apiKey) {
  if (!apiKey || !apiKey.startsWith(PREFIX)) return null;
  const prefix = apiKey.slice(0, 8);
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const row = db.prepare('SELECT * FROM api_keys WHERE prefix = ?').get(prefix);
  if (!row) return null;
  if (row.key_hash !== hash) return null;

  // Check expiry
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

  // Update last_used
  db.prepare("UPDATE api_keys SET last_used = datetime('now') WHERE id = ?").run(row.id);

  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(row.user_id);
  if (!user) return null;

  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    isApiKey: true,
    keyId: row.id,
    permissions: JSON.parse(row.permissions || '["*"]'),
  };
}

function checkPermission(permissions, routePath) {
  if (!permissions || permissions.includes('*')) return true;
  return permissions.some(p => routePath.startsWith(p));
}

module.exports = { generateApiKey, createKey, listKeys, deleteKey, validateKey, checkPermission };
