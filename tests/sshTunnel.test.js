import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

// Mock ssh service
vi.mock('../services/ssh', () => ({
  getConnection: vi.fn((db, id) => {
    const row = db.prepare('SELECT * FROM ssh_connections WHERE id = ?').get(id);
    if (!row) throw new Error('Connection not found');
    return row;
  }),
  sanitizeHost: vi.fn(h => h),
}));

// Mock child_process spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    const EventEmitter = require('events');
    const proc = new EventEmitter();
    proc.pid = 12345;
    proc.kill = vi.fn();
    proc.stdin = { write: vi.fn() };
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    return proc;
  }),
}));

const { createTunnel, listTunnels, getTunnel, deleteTunnel, startTunnel, stopTunnel, stopAll, getStatus, MAX_RECONNECT_ATTEMPTS, RECONNECT_DELAY_MS } = await import('../services/sshTunnel.js');

describe('SSH Tunnel Manager', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS ssh_connections (
        id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL,
        host TEXT NOT NULL, port INTEGER DEFAULT 22, username TEXT NOT NULL,
        auth_type TEXT DEFAULT 'password', key_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ssh_tunnels (
        id TEXT PRIMARY KEY, connection_id TEXT NOT NULL, name TEXT NOT NULL,
        local_port INTEGER NOT NULL, remote_host TEXT NOT NULL, remote_port INTEGER NOT NULL,
        type TEXT DEFAULT 'local', status TEXT DEFAULT 'stopped',
        pid INTEGER, auto_reconnect INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.prepare("INSERT INTO ssh_connections (id, name, host, username) VALUES ('conn1', 'Test', 'example.com', 'user')").run();
  });

  describe('createTunnel', () => {
    it('creates a local tunnel', () => {
      const t = createTunnel(db, { connectionId: 'conn1', name: 'My Tunnel', localPort: 8080, remoteHost: 'localhost', remotePort: 80 });
      expect(t.id).toBeDefined();
      expect(t.name).toBe('My Tunnel');
      expect(t.localPort).toBe(8080);
      expect(t.remotePort).toBe(80);
      expect(t.type).toBe('local');
      expect(t.status).toBe('stopped');
    });

    it('creates a reverse tunnel', () => {
      const t = createTunnel(db, { connectionId: 'conn1', name: 'Reverse', localPort: 9090, remoteHost: 'db.local', remotePort: 5432, type: 'reverse' });
      expect(t.type).toBe('reverse');
    });

    it('throws if missing required fields', () => {
      expect(() => createTunnel(db, { connectionId: 'conn1' })).toThrow();
    });

    it('throws if connection not found', () => {
      expect(() => createTunnel(db, { connectionId: 'nope', name: 'T', localPort: 8080, remoteHost: 'x', remotePort: 80 })).toThrow();
    });
  });

  describe('listTunnels', () => {
    it('returns all tunnels', () => {
      createTunnel(db, { connectionId: 'conn1', name: 'A', localPort: 8080, remoteHost: 'localhost', remotePort: 80 });
      createTunnel(db, { connectionId: 'conn1', name: 'B', localPort: 9090, remoteHost: 'localhost', remotePort: 443 });
      const list = listTunnels(db);
      expect(list.length).toBe(2);
    });

    it('includes running status', () => {
      createTunnel(db, { connectionId: 'conn1', name: 'A', localPort: 8080, remoteHost: 'localhost', remotePort: 80 });
      const list = listTunnels(db);
      expect(list[0].running).toBe(false);
    });
  });

  describe('getTunnel', () => {
    it('returns tunnel by id', () => {
      const created = createTunnel(db, { connectionId: 'conn1', name: 'A', localPort: 8080, remoteHost: 'localhost', remotePort: 80 });
      const t = getTunnel(db, created.id);
      expect(t.name).toBe('A');
    });

    it('throws if not found', () => {
      expect(() => getTunnel(db, 'nope')).toThrow('Tunnel not found');
    });
  });

  describe('deleteTunnel', () => {
    it('deletes a tunnel', () => {
      const t = createTunnel(db, { connectionId: 'conn1', name: 'A', localPort: 8080, remoteHost: 'localhost', remotePort: 80 });
      const result = deleteTunnel(db, t.id);
      expect(result.deleted).toBe(true);
      expect(listTunnels(db).length).toBe(0);
    });

    it('throws if not found', () => {
      expect(() => deleteTunnel(db, 'nope')).toThrow();
    });
  });

  describe('getStatus', () => {
    it('returns not running for unknown tunnel', () => {
      const s = getStatus('nonexistent');
      expect(s.running).toBe(false);
    });
  });

  describe('stopTunnel', () => {
    it('stops tunnel that is not running', () => {
      const t = createTunnel(db, { connectionId: 'conn1', name: 'A', localPort: 8080, remoteHost: 'localhost', remotePort: 80 });
      const result = stopTunnel(db, t.id);
      expect(result.stopped).toBe(true);
    });
  });

  describe('stopAll', () => {
    it('runs without error', () => {
      expect(() => stopAll(db)).not.toThrow();
    });
  });

  describe('constants', () => {
    it('has reconnect settings', () => {
      expect(MAX_RECONNECT_ATTEMPTS).toBe(10);
      expect(RECONNECT_DELAY_MS).toBe(5000);
    });
  });
});
