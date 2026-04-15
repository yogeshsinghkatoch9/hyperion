const express = require('express');
const router = express.Router();
const { validate, sanitize } = require('../services/validation');
const configPorter = require('../services/configPorter');
const themeManager = require('../services/themeManager');

// GET /api/settings — all settings as {key: value}
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId);
  const obj = {};
  rows.forEach(r => { try { obj[r.key] = JSON.parse(r.value); } catch { obj[r.key] = r.value; } });
  res.json(obj);
});

// PUT /api/settings — bulk upsert {key: value, ...}
router.put('/', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  const entries = req.body;
  if (!entries || typeof entries !== 'object') return res.status(400).json({ error: 'Object required' });

  const upsert = db.prepare(
    'INSERT INTO settings (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime(\'now\')) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')'
  );
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(entries)) {
      upsert.run(userId, k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  });
  tx();
  res.json({ ok: true });
});

// GET /api/settings/:key — single key
router.get('/:key', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  const row = db.prepare('SELECT value FROM settings WHERE user_id = ? AND key = ?').get(userId, req.params.key);
  if (!row) return res.status(404).json({ error: 'Setting not found' });
  try { res.json({ key: req.params.key, value: JSON.parse(row.value) }); }
  catch { res.json({ key: req.params.key, value: row.value }); }
});

// DELETE /api/settings/:key — remove setting
router.delete('/:key', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  db.prepare('DELETE FROM settings WHERE user_id = ? AND key = ?').run(userId, req.params.key);
  res.json({ ok: true });
});

// POST /api/settings/change-password
router.post('/change-password', async (req, res) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const bcrypt = require('bcryptjs');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
  res.json({ ok: true });
});

// ═══ API KEYS ═══

router.get('/api-keys', (req, res) => {
  const apiKeys = require('../services/apiKeys');
  const db = req.app.locals.db;
  res.json(apiKeys.listKeys(db, req.session.userId));
});

router.post('/api-keys', (req, res) => {
  const apiKeys = require('../services/apiKeys');
  const db = req.app.locals.db;
  const { name, permissions, expiresAt } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = apiKeys.createKey(db, req.session.userId, name, permissions, expiresAt);
  res.json(result);
});

router.delete('/api-keys/:id', (req, res) => {
  const apiKeys = require('../services/apiKeys');
  const db = req.app.locals.db;
  const deleted = apiKeys.deleteKey(db, req.session.userId, req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Key not found' });
  res.json({ ok: true });
});

// ═══ NOTIFICATION PREFERENCES ═══

const NOTIF_CATEGORIES = ['agent_complete', 'workflow_complete', 'backup_complete', 'system_alert', 'security_alert'];

router.get('/notifications', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  const rows = db.prepare('SELECT category, enabled FROM notification_preferences WHERE user_id = ?').all(userId);
  const prefs = {};
  for (const cat of NOTIF_CATEGORIES) prefs[cat] = 1; // defaults on
  for (const r of rows) prefs[r.category] = r.enabled;
  res.json(prefs);
});

router.put('/notifications', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  const updates = req.body;
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Object required' });

  const upsert = db.prepare(
    "INSERT INTO notification_preferences (user_id, category, enabled) VALUES (?, ?, ?) ON CONFLICT(user_id, category) DO UPDATE SET enabled = excluded.enabled"
  );
  const tx = db.transaction(() => {
    for (const [cat, enabled] of Object.entries(updates)) {
      if (NOTIF_CATEGORIES.includes(cat)) {
        upsert.run(userId, cat, enabled ? 1 : 0);
      }
    }
  });
  tx();
  res.json({ ok: true });
});

// ═══ IMPORT / EXPORT CONFIG ═══

// GET /api/settings/export — JSON config download
router.get('/export', (req, res) => {
  const db = req.app.locals.db;
  const tables = req.query.tables ? req.query.tables.split(',') : undefined;
  try {
    const data = configPorter.exportConfig(db, tables);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="hyperion-config-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/settings/import — import config
router.post('/import', (req, res) => {
  const db = req.app.locals.db;
  const { data, mode } = req.body;
  if (!data) return res.status(400).json({ error: 'Data required' });
  try {
    const results = configPorter.importConfig(db, data, mode || 'merge');
    res.json({ ok: true, results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/settings/export/csv/:table — CSV download for a single table
router.get('/export/csv/:table', (req, res) => {
  const db = req.app.locals.db;
  try {
    const csv = configPorter.exportTableCsv(db, req.params.table);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.table}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ═══ THEME MANAGER ═══

// GET /api/settings/theme — get user's theme
router.get('/theme', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  try {
    const config = themeManager.getTheme(db, userId);
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings/theme — save user's theme
router.put('/theme', (req, res) => {
  const db = req.app.locals.db;
  const userId = req.session.userId;
  try {
    const config = themeManager.saveTheme(db, userId, req.body);
    res.json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/settings/theme/presets — list theme presets
router.get('/theme/presets', (req, res) => {
  res.json(themeManager.getPresets());
});

module.exports = router;
