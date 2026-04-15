import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

// Load the CJS module
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
  `);
  return db;
}

describe('auditLog service', () => {
  let db;

  beforeEach(() => {
    db = createTestDB();
  });

  // --- log() tests ---

  it('log() inserts a record and returns an id', () => {
    const id = auditLog.log(db, {
      userId: 'u1', username: 'alice', action: 'LOGIN',
      resource: '/api/auth/login', details: { method: 'POST' },
      ip: '127.0.0.1', userAgent: 'TestAgent/1.0',
    });
    expect(id).toBeTruthy();
    const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id);
    expect(row).toBeTruthy();
    expect(row.user_id).toBe('u1');
    expect(row.username).toBe('alice');
    expect(row.action).toBe('LOGIN');
  });

  it('log() stores details as JSON string when given an object', () => {
    const id = auditLog.log(db, {
      action: 'CREATE', details: { foo: 'bar' },
    });
    const row = db.prepare('SELECT details FROM audit_logs WHERE id = ?').get(id);
    expect(JSON.parse(row.details)).toEqual({ foo: 'bar' });
  });

  it('log() stores details as-is when given a string', () => {
    const id = auditLog.log(db, { action: 'DELETE', details: 'removed item' });
    const row = db.prepare('SELECT details FROM audit_logs WHERE id = ?').get(id);
    expect(row.details).toBe('removed item');
  });

  it('log() handles null/undefined optional fields gracefully', () => {
    const id = auditLog.log(db, { action: 'ACCESS' });
    const row = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id);
    expect(row.user_id).toBeNull();
    expect(row.username).toBeNull();
    expect(row.resource).toBeNull();
    expect(row.ip).toBeNull();
  });

  // --- query() tests ---

  it('query() returns all records when no filters given', () => {
    auditLog.log(db, { action: 'LOGIN', userId: 'u1' });
    auditLog.log(db, { action: 'CREATE', userId: 'u2' });
    const result = auditLog.query(db);
    expect(result.rows).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('query() filters by action', () => {
    auditLog.log(db, { action: 'LOGIN' });
    auditLog.log(db, { action: 'CREATE' });
    auditLog.log(db, { action: 'LOGIN' });
    const result = auditLog.query(db, { action: 'LOGIN' });
    expect(result.rows).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.rows.every(r => r.action === 'LOGIN')).toBe(true);
  });

  it('query() filters by userId', () => {
    auditLog.log(db, { action: 'LOGIN', userId: 'u1' });
    auditLog.log(db, { action: 'LOGIN', userId: 'u2' });
    const result = auditLog.query(db, { userId: 'u1' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].user_id).toBe('u1');
  });

  it('query() filters by resource', () => {
    auditLog.log(db, { action: 'CREATE', resource: '/api/agents' });
    auditLog.log(db, { action: 'CREATE', resource: '/api/notebooks' });
    const result = auditLog.query(db, { resource: '/api/agents' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].resource).toBe('/api/agents');
  });

  it('query() respects limit and offset', () => {
    for (let i = 0; i < 10; i++) {
      auditLog.log(db, { action: 'ACCESS', details: `item-${i}` });
    }
    const page1 = auditLog.query(db, { limit: 3, offset: 0 });
    expect(page1.rows).toHaveLength(3);
    expect(page1.total).toBe(10);

    const page2 = auditLog.query(db, { limit: 3, offset: 3 });
    expect(page2.rows).toHaveLength(3);
    expect(page2.rows[0].id).not.toBe(page1.rows[0].id);
  });

  // --- middleware() tests ---

  it('middleware() logs POST requests', () => {
    const mw = auditLog.middleware();
    let finishCb;
    const req = {
      method: 'POST',
      baseUrl: '/api',
      path: '/agents',
      body: { name: 'test' },
      ip: '10.0.0.1',
      headers: { 'user-agent': 'TestBot' },
      user: { id: 'u1', username: 'alice' },
      app: { locals: { db } },
    };
    const res = {
      statusCode: 201,
      on(event, cb) { if (event === 'finish') finishCb = cb; },
    };

    mw(req, res, () => {});
    expect(finishCb).toBeDefined();
    finishCb();

    const result = auditLog.query(db);
    expect(result.total).toBe(1);
    expect(result.rows[0].action).toBe('CREATE');
    expect(result.rows[0].resource).toBe('/api/agents');
    expect(result.rows[0].status_code).toBe(201);
  });

  it('middleware() skips GET requests', () => {
    const mw = auditLog.middleware();
    const req = { method: 'GET', baseUrl: '/api', path: '/agents', headers: {}, app: { locals: { db } } };
    const res = { on() {} };
    let nextCalled = false;

    mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);

    const result = auditLog.query(db);
    expect(result.total).toBe(0);
  });

  it('middleware() logs DELETE requests with correct action', () => {
    const mw = auditLog.middleware();
    let finishCb;
    const req = {
      method: 'DELETE',
      baseUrl: '/api',
      path: '/agents/abc',
      body: {},
      ip: '10.0.0.2',
      headers: { 'user-agent': 'TestBot' },
      user: { id: 'u2', username: 'bob' },
      app: { locals: { db } },
    };
    const res = {
      statusCode: 200,
      on(event, cb) { if (event === 'finish') finishCb = cb; },
    };

    mw(req, res, () => {});
    finishCb();

    const result = auditLog.query(db, { action: 'DELETE' });
    expect(result.total).toBe(1);
    expect(result.rows[0].username).toBe('bob');
  });

  // --- ACTIONS constant ---

  it('ACTIONS has all expected keys', () => {
    expect(auditLog.ACTIONS).toHaveProperty('LOGIN');
    expect(auditLog.ACTIONS).toHaveProperty('LOGOUT');
    expect(auditLog.ACTIONS).toHaveProperty('CREATE');
    expect(auditLog.ACTIONS).toHaveProperty('UPDATE');
    expect(auditLog.ACTIONS).toHaveProperty('DELETE');
    expect(auditLog.ACTIONS).toHaveProperty('ACCESS');
    expect(auditLog.ACTIONS).toHaveProperty('EXPORT');
    expect(Object.keys(auditLog.ACTIONS)).toHaveLength(7);
  });
});
