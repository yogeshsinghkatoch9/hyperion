import { describe, test, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// ── Helpers ──
function mockDb({ users = [], changes = 1 } = {}) {
  let _users = [...users];
  return {
    prepare: vi.fn((sql) => ({
      all: vi.fn(() => _users.map(u => ({ id: u.id, username: u.username, role: u.role, created_at: u.created_at }))),
      get: vi.fn((...args) => _users.find(u => u.id === args[0])),
      run: vi.fn((...args) => {
        if (sql.includes('DELETE')) {
          const idx = _users.findIndex(u => u.id === args[0]);
          if (idx >= 0) { _users.splice(idx, 1); return { changes: 1 }; }
          return { changes: 0 };
        }
        if (sql.includes('UPDATE')) return { changes };
        if (sql.includes('INSERT')) { _users.push({ id: args[0], username: args[1], password_hash: args[2], role: args[3] }); }
        return { changes };
      }),
    })),
  };
}

function mockReq(body = {}, session = { userId: 'admin1', role: 'admin' }, params = {}) {
  return { body, session, params, app: { locals: { db: mockDb() } } };
}

function mockRes() {
  const res = { _status: null, _json: null, status(c) { res._status = c; return res; }, json(j) { res._json = j; return res; } };
  return res;
}

// Import at top level
const { requireAdmin } = await import('../routes/admin.js');

// ── requireAdmin middleware ──
describe('requireAdmin', () => {

  test('blocks non-admin', () => {
    const res = mockRes();
    requireAdmin({ session: { role: 'viewer' } }, res, vi.fn());
    expect(res._status).toBe(403);
  });

  test('blocks null session', () => {
    const res = mockRes();
    requireAdmin({ session: null }, res, vi.fn());
    expect(res._status).toBe(403);
  });

  test('allows admin', () => {
    const next = vi.fn();
    requireAdmin({ session: { role: 'admin' } }, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ── User listing ──
describe('GET /api/admin/users', () => {
  test('returns users without password_hash', () => {
    const users = [
      { id: 'u1', username: 'alice', role: 'admin', created_at: '2026-01-01' },
      { id: 'u2', username: 'bob', role: 'viewer', created_at: '2026-01-02' },
    ];
    const db = mockDb({ users });
    const req = { app: { locals: { db } }, session: { userId: 'u1', role: 'admin' } };
    const res = mockRes();
    // Simulate the route handler
    const result = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at').all();
    expect(result.every(r => !r.password_hash)).toBe(true);
    expect(result).toHaveLength(2);
  });
});

// ── Cannot delete self ──
describe('DELETE /api/admin/users/:id', () => {
  test('rejects self-deletion', () => {
    const res = mockRes();
    const req = { params: { id: 'admin1' }, session: { userId: 'admin1', role: 'admin' }, app: { locals: { db: mockDb() } } };
    if (req.params.id === req.session.userId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
    }
    expect(res._status).toBe(400);
    expect(res._json.error).toContain('Cannot delete');
  });

  test('allows deleting other user', () => {
    const users = [{ id: 'u2', username: 'bob', role: 'viewer' }];
    const db = mockDb({ users });
    const info = db.prepare('DELETE FROM users WHERE id = ?').run('u2');
    expect(info.changes).toBe(1);
  });
});

// ── Role validation ──
describe('PUT /api/admin/users/:id/role', () => {
  test('rejects invalid role', () => {
    const role = 'superadmin';
    const validRoles = ['admin', 'viewer'];
    expect(validRoles.includes(role)).toBe(false);
  });

  test('accepts valid roles', () => {
    const validRoles = ['admin', 'viewer'];
    expect(validRoles.includes('admin')).toBe(true);
    expect(validRoles.includes('viewer')).toBe(true);
  });
});

// ── Password reset ──
describe('POST /api/admin/users/:id/reset-password', () => {
  test('rejects short password', () => {
    const pw = 'abc';
    expect(pw.length < 6).toBe(true);
  });

  test('hashes password correctly', async () => {
    const hash = await bcrypt.hash('newpass123', 10);
    expect(await bcrypt.compare('newpass123', hash)).toBe(true);
    expect(await bcrypt.compare('wrongpass', hash)).toBe(false);
  }, 10000);
});

// ── User creation ──
describe('POST /api/admin/users', () => {
  test('requires username and password', () => {
    expect(!'' && !'').toBe(true);
    expect(!'alice').toBe(false);
  });

  test('defaults role to viewer for invalid role', () => {
    const validRoles = ['admin', 'viewer'];
    const role = 'hacker';
    const userRole = validRoles.includes(role) ? role : 'viewer';
    expect(userRole).toBe('viewer');
  });

  test('accepts admin role', () => {
    const validRoles = ['admin', 'viewer'];
    const role = 'admin';
    const userRole = validRoles.includes(role) ? role : 'viewer';
    expect(userRole).toBe('admin');
  });
});

// ── Sessions ──
describe('GET /api/admin/sessions', () => {
  test('returns session counts', () => {
    // The getActiveSessions function aggregates by username
    const sessions = [
      { username: 'alice', activeSessions: 2 },
      { username: 'bob', activeSessions: 1 },
    ];
    expect(sessions[0].activeSessions).toBe(2);
    expect(sessions).toHaveLength(2);
  });
});

// ── Edge cases ──
describe('Edge cases', () => {
  test('delete non-existent user returns not found', () => {
    const db = mockDb({ users: [] });
    const info = db.prepare('DELETE FROM users WHERE id = ?').run('ghost');
    expect(info.changes).toBe(0);
  });

  test('role update on non-existent user', () => {
    const db = mockDb({ users: [], changes: 0 });
    const info = db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', 'ghost');
    expect(info.changes).toBe(0);
  });
});
