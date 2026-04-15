'use strict';
const crypto = require('crypto');

const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(db, { userId, username, role, ip, userAgent }) {
  const sid = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL).toISOString();
  db.prepare(
    `INSERT INTO sessions (id, user_id, username, role, ip, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sid, userId, username, role, ip || null, userAgent || null, expiresAt);
  return sid;
}

function getSession(db, sid) {
  if (!sid) return null;
  const row = db.prepare(
    `SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')`
  ).get(sid);
  if (!row) return null;
  // Update last_activity
  db.prepare(`UPDATE sessions SET last_activity = datetime('now') WHERE id = ?`).run(sid);
  return { userId: row.user_id, username: row.username, role: row.role, createdAt: row.created_at };
}

function destroySession(db, sid) {
  if (!sid) return;
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
}

function destroyUserSessions(db, userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

function getActiveSessions(db) {
  return db.prepare(
    `SELECT user_id, username, COUNT(*) as active_sessions,
            GROUP_CONCAT(DISTINCT ip) as ips
     FROM sessions WHERE expires_at > datetime('now')
     GROUP BY user_id, username`
  ).all();
}

function getUserSessions(db, userId) {
  return db.prepare(
    `SELECT id, ip, user_agent, created_at, last_activity, expires_at
     FROM sessions WHERE user_id = ? AND expires_at > datetime('now')
     ORDER BY last_activity DESC`
  ).all(userId);
}

function getAllSessionsList(db) {
  return db.prepare(
    `SELECT id, user_id, username, role, ip, user_agent, created_at, last_activity, expires_at
     FROM sessions WHERE expires_at > datetime('now')
     ORDER BY last_activity DESC`
  ).all();
}

function cleanExpired(db) {
  const info = db.prepare(`DELETE FROM sessions WHERE expires_at <= datetime('now')`).run();
  return info.changes;
}

function logLogin(db, { userId, username, ip, userAgent, success }) {
  db.prepare(
    `INSERT INTO login_history (user_id, username, ip, user_agent, success)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId || null, username || null, ip || null, userAgent || null, success ? 1 : 0);
}

function getLoginHistory(db, userId, limit = 50) {
  if (userId) {
    return db.prepare(
      `SELECT * FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(userId, limit);
  }
  return db.prepare(
    `SELECT * FROM login_history ORDER BY created_at DESC LIMIT ?`
  ).all(limit);
}

module.exports = {
  SESSION_TTL,
  createSession,
  getSession,
  destroySession,
  destroyUserSessions,
  getActiveSessions,
  getUserSessions,
  getAllSessionsList,
  cleanExpired,
  logLogin,
  getLoginHistory,
};
