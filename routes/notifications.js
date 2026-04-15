/**
 * Notification CRUD — list, unread count, mark read, clear
 */
const express = require('express');
const router = express.Router();
const { notify } = require('../services/notify');

// List recent 50 notifications
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50').all();
  res.json(rows);
});

// Unread count
router.get('/unread-count', (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE read = 0').get();
  res.json({ count: row.count });
});

// Create notification (for testing / external use)
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { title, message, source, level } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const id = notify(db, { title, message, source, level });
  res.json({ id });
});

// Mark one as read
router.put('/:id/read', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Mark all as read
router.put('/read-all', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('UPDATE notifications SET read = 1 WHERE read = 0').run();
  res.json({ ok: true });
});

// Clear all notifications
router.delete('/clear', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM notifications').run();
  res.json({ ok: true });
});

module.exports = router;
