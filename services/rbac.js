'use strict';
const crypto = require('crypto');

const SYSTEM_ROLES = [
  {
    id: 'role_admin',
    name: 'admin',
    description: 'Full system access',
    permissions: ['admin.*'],
    is_system: 1,
  },
  {
    id: 'role_operator',
    name: 'operator',
    description: 'Agent/workflow management, terminal & SSH access, read system',
    permissions: ['agents.read', 'agents.write', 'agents.execute', 'workflows.read', 'workflows.write', 'workflows.execute', 'terminal.access', 'ssh.access', 'system.read'],
    is_system: 1,
  },
  {
    id: 'role_developer',
    name: 'developer',
    description: 'Files, notebooks, snippets, read workflows',
    permissions: ['files.read', 'files.write', 'notebooks.read', 'notebooks.write', 'snippets.read', 'snippets.write', 'workflows.read'],
    is_system: 1,
  },
  {
    id: 'role_viewer',
    name: 'viewer',
    description: 'Read-only access',
    permissions: ['*.read'],
    is_system: 1,
  },
];

const ALL_PERMISSIONS = [
  'admin.*',
  'agents.read', 'agents.write', 'agents.execute',
  'files.read', 'files.write',
  'notebooks.read', 'notebooks.write',
  'workflows.read', 'workflows.write', 'workflows.execute',
  'terminal.access', 'ssh.access',
  'vault.read', 'vault.write',
  'system.read', 'system.config',
  'users.manage',
  'snippets.read', 'snippets.write',
];

function seedRoles(db) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system)
     VALUES (?, ?, ?, ?, ?)`
  );
  const tx = db.transaction(() => {
    for (const role of SYSTEM_ROLES) {
      insert.run(role.id, role.name, role.description, JSON.stringify(role.permissions), role.is_system);
    }
  });
  tx();
}

function getRoles(db) {
  const rows = db.prepare('SELECT * FROM roles ORDER BY is_system DESC, name').all();
  return rows.map(r => ({ ...r, permissions: JSON.parse(r.permissions || '[]') }));
}

function getRole(db, roleId) {
  const row = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
  if (!row) return null;
  return { ...row, permissions: JSON.parse(row.permissions || '[]') };
}

function createRole(db, { name, description, permissions }) {
  const id = `role_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(
    `INSERT INTO roles (id, name, description, permissions, is_system) VALUES (?, ?, ?, ?, 0)`
  ).run(id, name, description || '', JSON.stringify(permissions || []));
  return { id, name, description, permissions: permissions || [], is_system: 0 };
}

function updateRole(db, roleId, { name, description, permissions }) {
  const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
  if (!existing) return null;
  const updates = [];
  const params = [];
  if (name !== undefined)        { updates.push('name = ?');        params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (permissions !== undefined)  { updates.push('permissions = ?'); params.push(JSON.stringify(permissions)); }
  if (updates.length === 0) return getRole(db, roleId);
  params.push(roleId);
  db.prepare(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  return getRole(db, roleId);
}

function deleteRole(db, roleId) {
  const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
  if (!role) return false;
  if (role.is_system) return false;
  db.prepare('DELETE FROM user_roles WHERE role_id = ?').run(roleId);
  db.prepare('DELETE FROM roles WHERE id = ?').run(roleId);
  return true;
}

function assignRole(db, userId, roleId) {
  db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, roleId);
}

function removeRole(db, userId, roleId) {
  db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?').run(userId, roleId);
}

function setUserRoles(db, userId, roleIds) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
    const ins = db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
    for (const rid of roleIds) {
      ins.run(userId, rid);
    }
  });
  tx();
}

function getUserRoles(db, userId) {
  return db.prepare(
    `SELECT r.* FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?`
  ).all(userId).map(r => ({ ...r, permissions: JSON.parse(r.permissions || '[]') }));
}

function getUserPermissions(db, userId) {
  // Check the user's legacy role first
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  const permissions = new Set();

  // Legacy role mapping
  if (user && user.role === 'admin') {
    permissions.add('admin.*');
  }

  // RBAC roles
  const roles = getUserRoles(db, userId);
  for (const role of roles) {
    for (const perm of role.permissions) {
      permissions.add(perm);
    }
  }

  return Array.from(permissions);
}

function hasPermission(permissions, required) {
  if (!permissions || !required) return false;
  // admin.* grants everything
  if (permissions.includes('admin.*')) return true;
  // Exact match
  if (permissions.includes(required)) return true;
  // Wildcard prefix: *.read matches agents.read, files.read, etc.
  const [, suffix] = required.split('.');
  if (suffix && permissions.includes(`*.${suffix}`)) return true;
  // Category wildcard: agents.* matches agents.read, agents.write
  const [prefix] = required.split('.');
  if (prefix && permissions.includes(`${prefix}.*`)) return true;
  return false;
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.session) return res.status(401).json({ error: 'Authentication required' });
    const db = req.app.locals.db;
    const perms = getUserPermissions(db, req.session.userId);
    if (hasPermission(perms, permission)) {
      req.session.permissions = perms;
      return next();
    }
    return res.status(403).json({ error: `Permission '${permission}' required` });
  };
}

module.exports = {
  SYSTEM_ROLES,
  ALL_PERMISSIONS,
  seedRoles,
  getRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  assignRole,
  removeRole,
  setUserRoles,
  getUserRoles,
  getUserPermissions,
  hasPermission,
  requirePermission,
};
