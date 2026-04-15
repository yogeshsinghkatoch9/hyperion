/**
 * Admin Routes — User Management (requires admin role)
 */
'use strict';
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const auth = require('../services/auth');
const sessionStore = require('../services/sessionStore');

// ── Middleware: admin only ──
function requireAdmin(req, res, next) {
  if (!req.session || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.use(requireAdmin);

// GET /api/admin/users — list all users (no password_hash)
router.get('/users', (req, res) => {
  const db = req.app.locals.db;
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at').all();
  res.json(users);
});

// POST /api/admin/users — create user
router.post('/users', async (req, res) => {
  const db = req.app.locals.db;
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const validRoles = ['admin', 'viewer'];
  const userRole = validRoles.includes(role) ? role : 'viewer';
  try {
    const user = await auth.createUser(db, username, password, userRole);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id — delete user (cannot delete self)
router.delete('/users/:id', (req, res) => {
  const db = req.app.locals.db;
  if (req.params.id === req.session.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  // Also destroy their sessions
  sessionStore.destroyUserSessions(db, req.params.id);
  res.json({ ok: true });
});

// PUT /api/admin/users/:id/role — change role
router.put('/users/:id/role', (req, res) => {
  const db = req.app.locals.db;
  const { role } = req.body;
  const validRoles = ['admin', 'viewer'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const info = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

// POST /api/admin/users/:id/reset-password — admin reset password
router.post('/users/:id/reset-password', async (req, res) => {
  const db = req.app.locals.db;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const hash = await bcrypt.hash(newPassword, 10);
  const info = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

// ═══ SESSION MANAGEMENT ═══

// GET /api/admin/sessions — enhanced: full session list with details
router.get('/sessions', (req, res) => {
  const db = req.app.locals.db;
  const sessions = sessionStore.getAllSessionsList(db);
  res.json(sessions);
});

// DELETE /api/admin/sessions/:sid — revoke specific session
router.delete('/sessions/:sid', (req, res) => {
  const db = req.app.locals.db;
  sessionStore.destroySession(db, req.params.sid);
  res.json({ ok: true });
});

// DELETE /api/admin/sessions/user/:userId — revoke all sessions for user
router.delete('/sessions/user/:userId', (req, res) => {
  const db = req.app.locals.db;
  sessionStore.destroyUserSessions(db, req.params.userId);
  res.json({ ok: true });
});

// ═══ LOGIN HISTORY ═══

// GET /api/admin/login-history — paginated login history
router.get('/login-history', (req, res) => {
  const db = req.app.locals.db;
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const history = sessionStore.getLoginHistory(db, null, limit);
  res.json(history);
});

// GET /api/admin/login-history/:userId — per-user history
router.get('/login-history/:userId', (req, res) => {
  const db = req.app.locals.db;
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const history = sessionStore.getLoginHistory(db, req.params.userId, limit);
  res.json(history);
});

// ═══ RBAC ROLE MANAGEMENT ═══

// GET /api/admin/roles
router.get('/roles', (req, res) => {
  try {
    const rbac = require('../services/rbac');
    const db = req.app.locals.db;
    res.json(rbac.getRoles(db));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/roles
router.post('/roles', (req, res) => {
  try {
    const rbac = require('../services/rbac');
    const db = req.app.locals.db;
    const { name, description, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const role = rbac.createRole(db, { name, description, permissions: permissions || [] });
    res.json(role);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/admin/roles/:id
router.put('/roles/:id', (req, res) => {
  try {
    const rbac = require('../services/rbac');
    const db = req.app.locals.db;
    const { name, description, permissions } = req.body;
    const role = rbac.updateRole(db, req.params.id, { name, description, permissions });
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json(role);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/admin/roles/:id
router.delete('/roles/:id', (req, res) => {
  try {
    const rbac = require('../services/rbac');
    const db = req.app.locals.db;
    const ok = rbac.deleteRole(db, req.params.id);
    if (!ok) return res.status(400).json({ error: 'Cannot delete system role' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id/roles — assign roles
router.put('/users/:id/roles', (req, res) => {
  try {
    const rbac = require('../services/rbac');
    const db = req.app.locals.db;
    const { roleIds } = req.body;
    if (!Array.isArray(roleIds)) return res.status(400).json({ error: 'roleIds array required' });
    rbac.setUserRoles(db, req.params.id, roleIds);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
module.exports.requireAdmin = requireAdmin;
