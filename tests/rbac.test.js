import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const rbac = require('../services/rbac');

function createTestDB() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT DEFAULT '[]',
      is_system INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY(user_id, role_id)
    );
  `);
  // Insert test user
  db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES ('u1', 'admin', 'hash', 'admin')").run();
  db.prepare("INSERT INTO users (id, username, password_hash, role) VALUES ('u2', 'viewer', 'hash', 'viewer')").run();
  return db;
}

describe('RBAC', () => {
  let db;
  beforeEach(() => {
    db = createTestDB();
    rbac.seedRoles(db);
  });

  describe('seedRoles', () => {
    it('creates 4 system roles', () => {
      const roles = rbac.getRoles(db);
      expect(roles.length).toBeGreaterThanOrEqual(4);
      const names = roles.map(r => r.name);
      expect(names).toContain('admin');
      expect(names).toContain('operator');
      expect(names).toContain('developer');
      expect(names).toContain('viewer');
    });

    it('is idempotent', () => {
      rbac.seedRoles(db);
      rbac.seedRoles(db);
      const roles = rbac.getRoles(db);
      const adminRoles = roles.filter(r => r.name === 'admin');
      expect(adminRoles).toHaveLength(1);
    });

    it('marks system roles as is_system=1', () => {
      const roles = rbac.getRoles(db);
      const admin = roles.find(r => r.name === 'admin');
      expect(admin.is_system).toBe(1);
    });
  });

  describe('createRole', () => {
    it('creates a custom role', () => {
      const role = rbac.createRole(db, { name: 'tester', description: 'Testing role', permissions: ['agents.read'] });
      expect(role.name).toBe('tester');
      expect(role.is_system).toBe(0);
      expect(role.permissions).toEqual(['agents.read']);
    });

    it('generates a unique ID', () => {
      const r1 = rbac.createRole(db, { name: 'r1', permissions: [] });
      const r2 = rbac.createRole(db, { name: 'r2', permissions: [] });
      expect(r1.id).not.toBe(r2.id);
    });
  });

  describe('updateRole', () => {
    it('updates role name and permissions', () => {
      const role = rbac.createRole(db, { name: 'test', permissions: ['agents.read'] });
      const updated = rbac.updateRole(db, role.id, { name: 'updated', permissions: ['agents.write'] });
      expect(updated.name).toBe('updated');
      expect(updated.permissions).toEqual(['agents.write']);
    });

    it('returns null for nonexistent role', () => {
      expect(rbac.updateRole(db, 'nonexistent', { name: 'x' })).toBeNull();
    });
  });

  describe('deleteRole', () => {
    it('deletes a custom role', () => {
      const role = rbac.createRole(db, { name: 'deleteme', permissions: [] });
      expect(rbac.deleteRole(db, role.id)).toBe(true);
      expect(rbac.getRole(db, role.id)).toBeNull();
    });

    it('refuses to delete system roles', () => {
      expect(rbac.deleteRole(db, 'role_admin')).toBe(false);
    });

    it('cleans up user_roles on delete', () => {
      const role = rbac.createRole(db, { name: 'temp', permissions: [] });
      rbac.assignRole(db, 'u1', role.id);
      rbac.deleteRole(db, role.id);
      const assignments = db.prepare('SELECT * FROM user_roles WHERE role_id = ?').all(role.id);
      expect(assignments).toHaveLength(0);
    });
  });

  describe('assignRole / removeRole', () => {
    it('assigns a role to user', () => {
      rbac.assignRole(db, 'u1', 'role_operator');
      const roles = rbac.getUserRoles(db, 'u1');
      expect(roles.find(r => r.name === 'operator')).toBeDefined();
    });

    it('handles duplicate assignment gracefully', () => {
      rbac.assignRole(db, 'u1', 'role_operator');
      rbac.assignRole(db, 'u1', 'role_operator');
      const roles = rbac.getUserRoles(db, 'u1');
      const ops = roles.filter(r => r.name === 'operator');
      expect(ops).toHaveLength(1);
    });

    it('removes a role from user', () => {
      rbac.assignRole(db, 'u1', 'role_operator');
      rbac.removeRole(db, 'u1', 'role_operator');
      const roles = rbac.getUserRoles(db, 'u1');
      expect(roles.find(r => r.name === 'operator')).toBeUndefined();
    });
  });

  describe('setUserRoles', () => {
    it('replaces all roles for a user', () => {
      rbac.assignRole(db, 'u2', 'role_operator');
      rbac.setUserRoles(db, 'u2', ['role_developer', 'role_viewer']);
      const roles = rbac.getUserRoles(db, 'u2');
      const names = roles.map(r => r.name);
      expect(names).toContain('developer');
      expect(names).toContain('viewer');
      expect(names).not.toContain('operator');
    });
  });

  describe('getUserPermissions', () => {
    it('returns admin.* for admin users', () => {
      const perms = rbac.getUserPermissions(db, 'u1');
      expect(perms).toContain('admin.*');
    });

    it('returns union of role permissions', () => {
      rbac.assignRole(db, 'u2', 'role_operator');
      rbac.assignRole(db, 'u2', 'role_developer');
      const perms = rbac.getUserPermissions(db, 'u2');
      expect(perms).toContain('agents.read');
      expect(perms).toContain('files.write');
      expect(perms).toContain('terminal.access');
    });
  });

  describe('hasPermission', () => {
    it('admin.* grants everything', () => {
      expect(rbac.hasPermission(['admin.*'], 'agents.write')).toBe(true);
      expect(rbac.hasPermission(['admin.*'], 'system.config')).toBe(true);
    });

    it('exact match works', () => {
      expect(rbac.hasPermission(['agents.read'], 'agents.read')).toBe(true);
      expect(rbac.hasPermission(['agents.read'], 'agents.write')).toBe(false);
    });

    it('*.read wildcard works', () => {
      expect(rbac.hasPermission(['*.read'], 'agents.read')).toBe(true);
      expect(rbac.hasPermission(['*.read'], 'files.read')).toBe(true);
      expect(rbac.hasPermission(['*.read'], 'agents.write')).toBe(false);
    });

    it('category wildcard works (agents.*)', () => {
      expect(rbac.hasPermission(['agents.*'], 'agents.read')).toBe(true);
      expect(rbac.hasPermission(['agents.*'], 'agents.execute')).toBe(true);
      expect(rbac.hasPermission(['agents.*'], 'files.read')).toBe(false);
    });

    it('returns false for null/empty', () => {
      expect(rbac.hasPermission(null, 'agents.read')).toBe(false);
      expect(rbac.hasPermission([], 'agents.read')).toBe(false);
      expect(rbac.hasPermission(['agents.read'], null)).toBe(false);
    });
  });

  describe('requirePermission middleware', () => {
    it('returns a function', () => {
      const mw = rbac.requirePermission('agents.read');
      expect(typeof mw).toBe('function');
    });

    it('blocks unauthenticated requests', () => {
      const mw = rbac.requirePermission('agents.read');
      let status, json;
      const res = { status(c) { status = c; return res; }, json(j) { json = j; } };
      mw({ session: null }, res, () => {});
      expect(status).toBe(401);
    });

    it('blocks unauthorized requests', () => {
      const mw = rbac.requirePermission('agents.write');
      let status, json;
      const res = { status(c) { status = c; return res; }, json(j) { json = j; } };
      const req = { session: { userId: 'u2' }, app: { locals: { db } } };
      mw(req, res, () => {});
      expect(status).toBe(403);
    });

    it('allows authorized admin', () => {
      const mw = rbac.requirePermission('agents.write');
      let called = false;
      const res = { status() { return res; }, json() {} };
      const req = { session: { userId: 'u1' }, app: { locals: { db } } };
      mw(req, res, () => { called = true; });
      expect(called).toBe(true);
    });
  });

  describe('ALL_PERMISSIONS', () => {
    it('exports a permissions list', () => {
      expect(rbac.ALL_PERMISSIONS.length).toBeGreaterThan(10);
      expect(rbac.ALL_PERMISSIONS).toContain('admin.*');
      expect(rbac.ALL_PERMISSIONS).toContain('terminal.access');
    });
  });
});
