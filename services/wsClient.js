const { v4: uuidv4 } = require('uuid');

// ── URL Validation ──
function isValidWsUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const u = new URL(urlStr);
    return u.protocol === 'ws:' || u.protocol === 'wss:';
  } catch {
    return false;
  }
}

// ── URL Normalization ──
function normalizeWsUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return urlStr;
  let u = urlStr.trim();
  // Replace http(s):// with ws(s)://
  if (/^https:\/\//i.test(u)) {
    u = 'wss://' + u.slice(8);
  } else if (/^http:\/\//i.test(u)) {
    u = 'ws://' + u.slice(7);
  } else if (!/^wss?:\/\//i.test(u)) {
    u = 'ws://' + u;
  }
  // Remove trailing slash
  u = u.replace(/\/+$/, '');
  return u;
}

// ── Message Type Detection ──
function detectMessageType(payload) {
  if (payload === null || payload === undefined) return 'text';
  if (Buffer.isBuffer(payload)) return 'binary';
  if (typeof payload !== 'string') return 'text';
  const trimmed = payload.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try { JSON.parse(trimmed); return 'json'; } catch { /* fall through */ }
  }
  return 'text';
}

// ── Message Formatting ──
function formatMessage(payload, direction) {
  const type = detectMessageType(payload);
  const size = Buffer.isBuffer(payload) ? payload.length : Buffer.byteLength(String(payload || ''), 'utf8');
  return {
    direction: direction || 'sent',
    payload: String(payload || ''),
    type,
    size,
    timestamp: new Date().toISOString(),
  };
}

// ── Pretty Print JSON ──
function prettyPrintJson(payload) {
  if (!payload || typeof payload !== 'string') return payload || '';
  const trimmed = payload.trim();
  try {
    const obj = JSON.parse(trimmed);
    return JSON.stringify(obj, null, 2);
  } catch {
    return payload;
  }
}

// ── Truncate for Summary ──
function truncateForSummary(payload, maxLen) {
  const limit = maxLen || 100;
  if (!payload) return '';
  const str = String(payload);
  if (str.length <= limit) return str;
  return str.substring(0, limit) + '…';
}

// ── Saved Connections CRUD ──
function saveConnection(db, { name, url, headers, protocols }) {
  if (!url) throw new Error('URL required');
  let normalized = normalizeWsUrl(url);
  if (!isValidWsUrl(normalized)) throw new Error('Invalid WebSocket URL');
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO ws_connections (id, name, url, headers, protocols, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name || normalized, normalized, JSON.stringify(headers || {}), JSON.stringify(protocols || []), now);
  return { id, name: name || normalized, url: normalized };
}

function getConnections(db) {
  return db.prepare('SELECT * FROM ws_connections ORDER BY last_used DESC, created_at DESC').all().map(r => ({
    ...r,
    headers: JSON.parse(r.headers || '{}'),
    protocols: JSON.parse(r.protocols || '[]'),
  }));
}

function getConnection(db, id) {
  const row = db.prepare('SELECT * FROM ws_connections WHERE id = ?').get(id);
  if (!row) throw new Error('Connection not found');
  return { ...row, headers: JSON.parse(row.headers || '{}'), protocols: JSON.parse(row.protocols || '[]') };
}

function updateConnection(db, id, updates) {
  const conn = getConnection(db, id);
  const name = updates.name !== undefined ? updates.name : conn.name;
  const url = updates.url ? normalizeWsUrl(updates.url) : conn.url;
  const headers = updates.headers !== undefined ? JSON.stringify(updates.headers) : JSON.stringify(conn.headers);
  const protocols = updates.protocols !== undefined ? JSON.stringify(updates.protocols) : JSON.stringify(conn.protocols);
  db.prepare('UPDATE ws_connections SET name=?, url=?, headers=?, protocols=? WHERE id=?')
    .run(name, url, headers, protocols, id);
  return { id, name, url };
}

function deleteConnection(db, id) {
  const r = db.prepare('DELETE FROM ws_connections WHERE id = ?').run(id);
  if (r.changes === 0) throw new Error('Connection not found');
  db.prepare('DELETE FROM ws_messages WHERE conn_id = ?').run(id);
}

function touchConnection(db, id) {
  db.prepare('UPDATE ws_connections SET last_used = ? WHERE id = ?').run(new Date().toISOString(), id);
}

// ── Message History CRUD ──
function addMessage(db, connId, direction, payload, msgType) {
  const size = Buffer.byteLength(String(payload || ''), 'utf8');
  const now = new Date().toISOString();
  db.prepare('INSERT INTO ws_messages (conn_id, direction, payload, msg_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(connId, direction, String(payload || ''), msgType || detectMessageType(payload), size, now);
}

function getMessageHistory(db, connId, limit) {
  const lim = limit || 100;
  return db.prepare('SELECT * FROM ws_messages WHERE conn_id = ? ORDER BY created_at DESC LIMIT ?').all(connId, lim);
}

function clearMessageHistory(db, connId) {
  db.prepare('DELETE FROM ws_messages WHERE conn_id = ?').run(connId);
}

// ── Connection Stats ──
function getStats(db) {
  const totalConnections = db.prepare('SELECT COUNT(*) as cnt FROM ws_connections').get().cnt;
  const totalMessages = db.prepare('SELECT COUNT(*) as cnt FROM ws_messages').get().cnt;
  const sentMessages = db.prepare("SELECT COUNT(*) as cnt FROM ws_messages WHERE direction = 'sent'").get().cnt;
  const receivedMessages = db.prepare("SELECT COUNT(*) as cnt FROM ws_messages WHERE direction = 'received'").get().cnt;
  const totalBytes = db.prepare('SELECT COALESCE(SUM(size_bytes), 0) as total FROM ws_messages').get().total;
  return { totalConnections, totalMessages, sentMessages, receivedMessages, totalBytes };
}

module.exports = {
  isValidWsUrl,
  normalizeWsUrl,
  detectMessageType,
  formatMessage,
  prettyPrintJson,
  truncateForSummary,
  saveConnection,
  getConnections,
  getConnection,
  updateConnection,
  deleteConnection,
  touchConnection,
  addMessage,
  getMessageHistory,
  clearMessageHistory,
  getStats,
};
