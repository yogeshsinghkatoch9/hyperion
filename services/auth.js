const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const sessionStore = require('./sessionStore');

// In-memory fallback for when db is not available (WebSocket auth, etc.)
const _memSessions = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function createSession(userId, username, role, opts = {}) {
  const db = opts.db;
  if (db) {
    return sessionStore.createSession(db, {
      userId, username, role,
      ip: opts.ip, userAgent: opts.userAgent,
    });
  }
  // Fallback: in-memory
  const sid = crypto.randomBytes(32).toString('hex');
  _memSessions.set(sid, { userId, username, role, createdAt: Date.now() });
  return sid;
}

function getSession(sid, db) {
  if (!sid) return null;
  // Try DB first
  if (db) {
    const session = sessionStore.getSession(db, sid);
    if (session) return session;
  }
  // Fallback: in-memory
  const mem = _memSessions.get(sid);
  if (!mem) return null;
  if (Date.now() - mem.createdAt > SESSION_TTL) {
    _memSessions.delete(sid);
    return null;
  }
  return mem;
}

function destroySession(sid, db) {
  _memSessions.delete(sid);
  if (db) sessionStore.destroySession(db, sid);
}

// Clean up expired in-memory sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sid, session] of _memSessions) {
    if (now - session.createdAt > SESSION_TTL) _memSessions.delete(sid);
  }
}, 60 * 60 * 1000);

// Express middleware — supports session ID and API key auth
function requireAuth(req, res, next) {
  const sid = req.headers['x-session-id'];
  const db = req.app.locals.db;
  const session = getSession(sid, db);
  if (session) {
    req.session = session;
    return next();
  }

  // Try API key
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    try {
      const apiKeys = require('./apiKeys');
      const keySession = apiKeys.validateKey(db, apiKey);
      if (keySession) {
        req.session = keySession;
        return next();
      }
    } catch {}
  }

  return res.status(401).json({ error: 'Authentication required' });
}

function requireAdmin(req, res, next) {
  if (!req.session || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function getActiveSessions(db) {
  if (db) {
    return sessionStore.getActiveSessions(db).map(r => ({
      username: r.username,
      activeSessions: r.active_sessions,
    }));
  }
  // Fallback
  const counts = {};
  for (const [, session] of _memSessions) {
    const key = session.username || session.userId;
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).map(([username, count]) => ({ username, activeSessions: count }));
}

// WebSocket authentication
function authenticateWs(request, db) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const sid = url.searchParams.get('sid');
  return getSession(sid, db);
}

// Check if any users exist (first-run detection)
function hasUsers(db) {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
  return row.count > 0;
}

async function createUser(db, username, password, role = 'admin') {
  const id = crypto.randomUUID();
  const hash = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(id, username, hash, role);
  return { id, username, role };
}

async function verifyUser(db, username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password_hash);
  return valid ? user : null;
}

module.exports = {
  createSession, getSession, destroySession,
  requireAuth, requireAdmin, authenticateWs,
  hasUsers, createUser, verifyUser, getActiveSessions,
};
