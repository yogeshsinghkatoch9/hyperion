import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const sessionStore = require('../services/sessionStore');

function createTestDB() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      username TEXT,
      ip TEXT,
      user_agent TEXT,
      success INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
  `);
  return db;
}

describe('sessionStore', () => {
  let db;
  beforeEach(() => { db = createTestDB(); });

  describe('createSession', () => {
    it('creates a session and returns sid', () => {
      const sid = sessionStore.createSession(db, { userId: 'u1', username: 'alice', role: 'admin' });
      expect(sid).toHaveLength(64);
      const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
      expect(row.user_id).toBe('u1');
      expect(row.username).toBe('alice');
      expect(row.role).toBe('admin');
    });

    it('stores IP and user agent', () => {
      const sid = sessionStore.createSession(db, { userId: 'u1', username: 'alice', role: 'admin', ip: '1.2.3.4', userAgent: 'Mozilla/5.0' });
      const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
      expect(row.ip).toBe('1.2.3.4');
      expect(row.user_agent).toBe('Mozilla/5.0');
    });

    it('creates unique session IDs', () => {
      const sid1 = sessionStore.createSession(db, { userId: 'u1', username: 'a', role: 'admin' });
      const sid2 = sessionStore.createSession(db, { userId: 'u1', username: 'a', role: 'admin' });
      expect(sid1).not.toBe(sid2);
    });
  });

  describe('getSession', () => {
    it('returns session if valid', () => {
      const sid = sessionStore.createSession(db, { userId: 'u1', username: 'alice', role: 'admin' });
      const s = sessionStore.getSession(db, sid);
      expect(s).not.toBeNull();
      expect(s.userId).toBe('u1');
      expect(s.username).toBe('alice');
      expect(s.role).toBe('admin');
    });

    it('returns null for nonexistent sid', () => {
      expect(sessionStore.getSession(db, 'nonexistent')).toBeNull();
    });

    it('returns null for null/undefined', () => {
      expect(sessionStore.getSession(db, null)).toBeNull();
      expect(sessionStore.getSession(db, undefined)).toBeNull();
    });

    it('returns null for expired session', () => {
      const sid = sessionStore.createSession(db, { userId: 'u1', username: 'a', role: 'admin' });
      // Manually expire
      db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 hour') WHERE id = ?").run(sid);
      expect(sessionStore.getSession(db, sid)).toBeNull();
    });
  });

  describe('destroySession', () => {
    it('removes a specific session', () => {
      const sid = sessionStore.createSession(db, { userId: 'u1', username: 'a', role: 'admin' });
      sessionStore.destroySession(db, sid);
      expect(sessionStore.getSession(db, sid)).toBeNull();
    });

    it('handles null sid gracefully', () => {
      expect(() => sessionStore.destroySession(db, null)).not.toThrow();
    });
  });

  describe('destroyUserSessions', () => {
    it('removes all sessions for a user', () => {
      sessionStore.createSession(db, { userId: 'u1', username: 'a', role: 'admin' });
      sessionStore.createSession(db, { userId: 'u1', username: 'a', role: 'admin' });
      sessionStore.createSession(db, { userId: 'u2', username: 'b', role: 'viewer' });
      sessionStore.destroyUserSessions(db, 'u1');
      const rows = db.prepare('SELECT * FROM sessions WHERE user_id = ?').all('u1');
      expect(rows).toHaveLength(0);
      const u2 = db.prepare('SELECT * FROM sessions WHERE user_id = ?').all('u2');
      expect(u2).toHaveLength(1);
    });
  });

  describe('getActiveSessions', () => {
    it('returns grouped counts per user', () => {
      sessionStore.createSession(db, { userId: 'u1', username: 'alice', role: 'admin', ip: '1.1.1.1' });
      sessionStore.createSession(db, { userId: 'u1', username: 'alice', role: 'admin', ip: '2.2.2.2' });
      sessionStore.createSession(db, { userId: 'u2', username: 'bob', role: 'viewer' });
      const result = sessionStore.getActiveSessions(db);
      expect(result).toHaveLength(2);
      const alice = result.find(r => r.username === 'alice');
      expect(alice.active_sessions).toBe(2);
    });
  });

  describe('getUserSessions', () => {
    it('returns sessions for specific user', () => {
      sessionStore.createSession(db, { userId: 'u1', username: 'a', role: 'admin', ip: '1.1.1.1' });
      sessionStore.createSession(db, { userId: 'u1', username: 'a', role: 'admin', ip: '2.2.2.2' });
      const sessions = sessionStore.getUserSessions(db, 'u1');
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toHaveProperty('ip');
      expect(sessions[0]).toHaveProperty('user_agent');
    });
  });

  describe('getAllSessionsList', () => {
    it('returns all active sessions', () => {
      sessionStore.createSession(db, { userId: 'u1', username: 'alice', role: 'admin' });
      sessionStore.createSession(db, { userId: 'u2', username: 'bob', role: 'viewer' });
      const all = sessionStore.getAllSessionsList(db);
      expect(all).toHaveLength(2);
      expect(all[0]).toHaveProperty('username');
      expect(all[0]).toHaveProperty('role');
    });
  });

  describe('cleanExpired', () => {
    it('removes expired sessions', () => {
      const sid = sessionStore.createSession(db, { userId: 'u1', username: 'a', role: 'admin' });
      db.prepare("UPDATE sessions SET expires_at = datetime('now', '-1 hour') WHERE id = ?").run(sid);
      const removed = sessionStore.cleanExpired(db);
      expect(removed).toBe(1);
    });

    it('keeps active sessions', () => {
      sessionStore.createSession(db, { userId: 'u1', username: 'a', role: 'admin' });
      const removed = sessionStore.cleanExpired(db);
      expect(removed).toBe(0);
    });
  });

  describe('logLogin', () => {
    it('logs successful login', () => {
      sessionStore.logLogin(db, { userId: 'u1', username: 'alice', ip: '1.2.3.4', userAgent: 'test', success: true });
      const rows = db.prepare('SELECT * FROM login_history').all();
      expect(rows).toHaveLength(1);
      expect(rows[0].success).toBe(1);
      expect(rows[0].username).toBe('alice');
    });

    it('logs failed login', () => {
      sessionStore.logLogin(db, { userId: null, username: 'hacker', ip: '6.6.6.6', userAgent: 'bot', success: false });
      const rows = db.prepare('SELECT * FROM login_history').all();
      expect(rows).toHaveLength(1);
      expect(rows[0].success).toBe(0);
    });
  });

  describe('getLoginHistory', () => {
    it('returns all login history', () => {
      sessionStore.logLogin(db, { userId: 'u1', username: 'alice', success: true });
      sessionStore.logLogin(db, { userId: 'u2', username: 'bob', success: true });
      sessionStore.logLogin(db, { userId: null, username: 'hacker', success: false });
      const all = sessionStore.getLoginHistory(db, null, 50);
      expect(all).toHaveLength(3);
    });

    it('returns history for specific user', () => {
      sessionStore.logLogin(db, { userId: 'u1', username: 'alice', success: true });
      sessionStore.logLogin(db, { userId: 'u2', username: 'bob', success: true });
      const h = sessionStore.getLoginHistory(db, 'u1', 50);
      expect(h).toHaveLength(1);
      expect(h[0].username).toBe('alice');
    });

    it('respects limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        sessionStore.logLogin(db, { userId: 'u1', username: 'alice', success: true });
      }
      const h = sessionStore.getLoginHistory(db, 'u1', 5);
      expect(h).toHaveLength(5);
    });
  });

  describe('SESSION_TTL', () => {
    it('exports SESSION_TTL as 24 hours', () => {
      expect(sessionStore.SESSION_TTL).toBe(24 * 60 * 60 * 1000);
    });
  });
});
