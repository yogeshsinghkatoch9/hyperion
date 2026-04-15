import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const auditLog = require('../services/auditLog');

function createTestDB() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      action TEXT NOT NULL,
      resource TEXT,
      details TEXT,
      ip TEXT,
      user_agent TEXT,
      status_code INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE TABLE IF NOT EXISTS login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      username TEXT,
      ip TEXT,
      user_agent TEXT,
      success INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

function seedLogs(db, count = 5) {
  for (let i = 0; i < count; i++) {
    auditLog.log(db, {
      userId: `u${i % 3}`,
      username: `user${i % 3}`,
      action: i % 2 === 0 ? 'CREATE' : 'UPDATE',
      resource: `/api/test/${i}`,
      details: { idx: i },
      ip: `1.2.3.${i}`,
      statusCode: 200,
    });
  }
}

describe('auditLog enhanced', () => {
  let db;
  beforeEach(() => { db = createTestDB(); });

  describe('query', () => {
    it('returns logs with pagination', () => {
      seedLogs(db, 10);
      const result = auditLog.query(db, { limit: 5, offset: 0 });
      expect(result.rows).toHaveLength(5);
      expect(result.total).toBe(10);
    });

    it('filters by resource (LIKE match)', () => {
      seedLogs(db, 5);
      const result = auditLog.query(db, { resource: 'test/2' });
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      expect(result.rows[0].resource).toContain('test/2');
    });

    it('filters by action', () => {
      seedLogs(db, 10);
      const result = auditLog.query(db, { action: 'CREATE' });
      expect(result.rows.every(r => r.action === 'CREATE')).toBe(true);
    });
  });

  describe('getTimeline', () => {
    it('returns bucketed counts', () => {
      seedLogs(db, 5);
      const timeline = auditLog.getTimeline(db, {});
      expect(Array.isArray(timeline)).toBe(true);
      expect(timeline.length).toBeGreaterThanOrEqual(1);
      expect(timeline[0]).toHaveProperty('bucket');
      expect(timeline[0]).toHaveProperty('count');
    });

    it('handles empty db', () => {
      const timeline = auditLog.getTimeline(db, {});
      expect(timeline).toHaveLength(0);
    });
  });

  describe('getTopUsers', () => {
    it('returns users ranked by action count', () => {
      seedLogs(db, 9);
      const top = auditLog.getTopUsers(db, { limit: 3 });
      expect(top.length).toBeGreaterThanOrEqual(1);
      expect(top[0]).toHaveProperty('username');
      expect(top[0]).toHaveProperty('action_count');
      // First entry should have highest count
      if (top.length > 1) {
        expect(top[0].action_count).toBeGreaterThanOrEqual(top[1].action_count);
      }
    });

    it('respects limit', () => {
      seedLogs(db, 20);
      const top = auditLog.getTopUsers(db, { limit: 2 });
      expect(top.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getSuspiciousActivity', () => {
    it('returns empty array when no suspicious activity', () => {
      const alerts = auditLog.getSuspiciousActivity(db);
      expect(Array.isArray(alerts)).toBe(true);
      expect(alerts).toHaveLength(0);
    });

    it('detects mass deletes', () => {
      for (let i = 0; i < 12; i++) {
        auditLog.log(db, { userId: 'u1', username: 'baduser', action: 'DELETE', resource: `/api/thing/${i}`, statusCode: 200 });
      }
      const alerts = auditLog.getSuspiciousActivity(db);
      const massDelete = alerts.find(a => a.type === 'mass_delete');
      expect(massDelete).toBeDefined();
      expect(massDelete.severity).toBe('medium');
    });

    it('detects 401 bursts', () => {
      for (let i = 0; i < 6; i++) {
        auditLog.log(db, { userId: null, action: 'ACCESS', ip: '6.6.6.6', statusCode: 401 });
      }
      const alerts = auditLog.getSuspiciousActivity(db);
      const burst = alerts.find(a => a.type === 'auth_burst');
      expect(burst).toBeDefined();
    });
  });

  describe('exportCsv', () => {
    it('generates valid CSV', () => {
      seedLogs(db, 3);
      const csv = auditLog.exportCsv(db, {});
      const lines = csv.split('\n');
      expect(lines[0]).toContain('id,user_id,username,action');
      expect(lines.length).toBe(4); // header + 3 data rows
    });

    it('handles empty db', () => {
      const csv = auditLog.exportCsv(db, {});
      const lines = csv.split('\n').filter(l => l.trim());
      expect(lines).toHaveLength(1); // header only
    });

    it('escapes quotes in details', () => {
      auditLog.log(db, { action: 'CREATE', details: 'test "quoted" value' });
      const csv = auditLog.exportCsv(db, {});
      expect(csv).toContain('""quoted""');
    });
  });

  describe('ACTIONS constant', () => {
    it('exports expected actions', () => {
      expect(auditLog.ACTIONS).toHaveProperty('LOGIN');
      expect(auditLog.ACTIONS).toHaveProperty('CREATE');
      expect(auditLog.ACTIONS).toHaveProperty('DELETE');
      expect(auditLog.ACTIONS).toHaveProperty('EXPORT');
    });
  });

  describe('log', () => {
    it('inserts a record with all fields', () => {
      const id = auditLog.log(db, {
        userId: 'u1', username: 'alice', action: 'CREATE',
        resource: '/api/test', details: { key: 'val' },
        ip: '1.2.3.4', userAgent: 'TestAgent', statusCode: 201,
      });
      expect(id).toBeTruthy();
      const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id);
      expect(row.username).toBe('alice');
      expect(row.status_code).toBe(201);
    });
  });
});
