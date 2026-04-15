import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';

const {
  createSession,
  getSession,
  destroySession,
  requireAuth,
  authenticateWs,
  hasUsers,
  createUser,
  verifyUser,
} = await import('../services/auth.js');

// Helpers
function createMockDb({ getReturn = undefined } = {}) {
  const run = vi.fn();
  const get = vi.fn(() => getReturn);
  return { prepare: vi.fn(() => ({ get, run })), _run: run, _get: get };
}
function mockReq(headers = {}) { return { headers, session: null, app: { locals: { db: null } } }; }
function mockRes() {
  const res = { _status: null, _json: null, status(c) { res._status = c; return res; }, json(j) { res._json = j; } };
  return res;
}

// 1. Session Management
describe('Session management', () => {
  test('createSession returns 64-char hex id', () => {
    expect(createSession('u1', 'alice', 'admin')).toMatch(/^[0-9a-f]{64}$/);
  });

  test('getSession retrieves stored session', () => {
    const sid = createSession('u2', 'bob', 'viewer');
    expect(getSession(sid)).toMatchObject({ userId: 'u2', username: 'bob', role: 'viewer' });
  });

  test('unique ids per call', () => {
    const ids = new Set(Array.from({ length: 10 }, (_, i) => createSession(`u${i}`, `u${i}`, 'admin')));
    expect(ids.size).toBe(10);
  });

  test('getSession returns null for invalid/null/undefined/empty', () => {
    expect(getSession('nonexistent')).toBeNull();
    expect(getSession(null)).toBeNull();
    expect(getSession(undefined)).toBeNull();
    expect(getSession('')).toBeNull();
  });

  test('destroySession removes session', () => {
    const sid = createSession('u3', 'carol', 'admin');
    destroySession(sid);
    expect(getSession(sid)).toBeNull();
  });

  test('destroySession safe with invalid/undefined', () => {
    expect(() => destroySession('nope')).not.toThrow();
    expect(() => destroySession(undefined)).not.toThrow();
  });
});

// 2. Session Expiry
describe('Session expiry', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-04-11T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  test('valid before 24h', () => {
    const sid = createSession('u4', 'dave', 'admin');
    vi.setSystemTime(new Date('2026-04-12T11:59:59Z'));
    expect(getSession(sid)).not.toBeNull();
  });

  test('expires after 24h', () => {
    const sid = createSession('u5', 'eve', 'admin');
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000 + 1);
    expect(getSession(sid)).toBeNull();
  });

  test('expired session deleted on access', () => {
    const sid = createSession('u6', 'frank', 'admin');
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    getSession(sid);
    vi.setSystemTime(new Date('2026-04-11T12:00:01Z'));
    expect(getSession(sid)).toBeNull();
  });
});

// 3. requireAuth
describe('requireAuth', () => {
  test('401 without session header', () => {
    const res = mockRes();
    requireAuth(mockReq({}), res, vi.fn());
    expect(res._status).toBe(401);
  });

  test('401 for invalid session', () => {
    const res = mockRes();
    requireAuth(mockReq({ 'x-session-id': 'bogus' }), res, vi.fn());
    expect(res._status).toBe(401);
  });

  test('calls next for valid session', () => {
    const sid = createSession('u7', 'grace', 'admin');
    const req = mockReq({ 'x-session-id': sid });
    const next = vi.fn();
    requireAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.session.username).toBe('grace');
  });
});

// 4. authenticateWs
describe('authenticateWs', () => {
  test('returns session for valid sid', () => {
    const sid = createSession('u9', 'ivy', 'admin');
    expect(authenticateWs({ url: `/ws?sid=${sid}`, headers: { host: 'localhost' } })).toMatchObject({ username: 'ivy' });
  });

  test('null for missing/invalid sid', () => {
    expect(authenticateWs({ url: '/ws', headers: { host: 'localhost' } })).toBeNull();
    expect(authenticateWs({ url: '/ws?sid=bad', headers: { host: 'localhost' } })).toBeNull();
  });
});

// 5. hasUsers
describe('hasUsers', () => {
  test('true when count > 0', () => {
    expect(hasUsers(createMockDb({ getReturn: { count: 3 } }))).toBe(true);
  });
  test('false when count = 0', () => {
    expect(hasUsers(createMockDb({ getReturn: { count: 0 } }))).toBe(false);
  });
});

// 6. createUser (uses real bcrypt)
describe('createUser', () => {
  test('creates user with hashed password', async () => {
    const db = createMockDb();
    const user = await createUser(db, 'testuser', 'mypassword', 'admin');
    expect(user).toEqual({ id: expect.any(String), username: 'testuser', role: 'admin' });
    expect(user.id).toMatch(/^[0-9a-f]{8}-/);
    // Verify hash was stored (not plaintext)
    const storedHash = db._run.mock.calls[0][2];
    expect(storedHash).toMatch(/^\$2[ab]\$/);
    expect(await bcrypt.compare('mypassword', storedHash)).toBe(true);
  }, 10000);

  test('defaults role to admin', async () => {
    const db = createMockDb();
    const user = await createUser(db, 'alice', 'pass');
    expect(user.role).toBe('admin');
  }, 10000);
});

// 7. verifyUser (uses real bcrypt)
describe('verifyUser', () => {
  test('returns user for correct password', async () => {
    const hash = await bcrypt.hash('correctpass', 10);
    const stored = { id: 'uid-1', username: 'alice', password_hash: hash, role: 'admin' };
    const db = createMockDb({ getReturn: stored });
    const result = await verifyUser(db, 'alice', 'correctpass');
    expect(result).toEqual(stored);
  }, 10000);

  test('returns null for wrong password', async () => {
    const hash = await bcrypt.hash('realpass', 10);
    const stored = { id: 'uid-2', username: 'bob', password_hash: hash, role: 'viewer' };
    const db = createMockDb({ getReturn: stored });
    expect(await verifyUser(db, 'bob', 'wrongpass')).toBeNull();
  }, 10000);

  test('returns null for missing user', async () => {
    const db = createMockDb({ getReturn: undefined });
    expect(await verifyUser(db, 'nobody', 'pass')).toBeNull();
  });
});

// 8. Edge Cases
describe('Edge cases', () => {
  test('createSession with empty/undefined args', () => {
    expect(getSession(createSession('', '', ''))).toMatchObject({ userId: '', username: '' });
    expect(getSession(createSession(undefined, undefined, undefined))).toBeTruthy();
  });

  test('authenticateWs with extra query params', () => {
    const sid = createSession('u11', 'kate', 'admin');
    const s = authenticateWs({ url: `/ws?foo=bar&sid=${sid}&baz=1`, headers: { host: 'x.com' } });
    expect(s.username).toBe('kate');
  });
});
