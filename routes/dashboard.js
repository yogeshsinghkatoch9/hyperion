'use strict';
const express = require('express');
const router = express.Router();
const dashboardWidgets = require('../services/dashboardWidgets');

// GET /api/dashboard/activity — merged activity feed from multiple tables
router.get('/activity', (req, res) => {
  const db = req.app.locals.db;
  const limit = 10;
  const items = [];

  // Command history
  try {
    const rows = db.prepare('SELECT command, language, exit_code, created_at FROM command_history ORDER BY created_at DESC LIMIT ?').all(limit);
    rows.forEach(r => items.push({ type: 'command', title: r.command, detail: r.language || '', timestamp: r.created_at }));
  } catch {}

  // Agent logs
  try {
    const rows = db.prepare("SELECT agent_id, level, message, created_at FROM agent_logs ORDER BY created_at DESC LIMIT ?").all(limit);
    rows.forEach(r => items.push({ type: 'agent_log', title: `Agent ${r.agent_id}: ${r.message}`, detail: r.level, timestamp: r.created_at }));
  } catch {}

  // Notebooks
  try {
    const rows = db.prepare('SELECT id, name, updated_at FROM notebooks ORDER BY updated_at DESC LIMIT ?').all(limit);
    rows.forEach(r => items.push({ type: 'notebook', title: `Notebook: ${r.name}`, detail: '', timestamp: r.updated_at }));
  } catch {}

  // Clipboard items
  try {
    const rows = db.prepare('SELECT content, label, created_at FROM clipboard_items ORDER BY created_at DESC LIMIT ?').all(limit);
    rows.forEach(r => items.push({ type: 'clipboard', title: r.label || r.content?.slice(0, 60) || 'Clipboard', detail: '', timestamp: r.created_at }));
  } catch {}

  // Bookmarks
  try {
    const rows = db.prepare('SELECT url, title, created_at FROM bookmarks ORDER BY created_at DESC LIMIT ?').all(limit);
    rows.forEach(r => items.push({ type: 'bookmark', title: r.title || r.url, detail: r.url, timestamp: r.created_at }));
  } catch {}

  // Pomodoro sessions
  try {
    const rows = db.prepare('SELECT task, duration, completed_at FROM pomodoro_sessions ORDER BY completed_at DESC LIMIT ?').all(limit);
    rows.forEach(r => items.push({ type: 'pomodoro', title: `Pomodoro: ${r.task || 'Session'}`, detail: `${r.duration}min`, timestamp: r.completed_at }));
  } catch {}

  // Sort by timestamp descending, take top 10
  items.sort((a, b) => {
    const ta = new Date(a.timestamp || 0).getTime();
    const tb = new Date(b.timestamp || 0).getTime();
    return tb - ta;
  });

  res.json({ items: items.slice(0, limit) });
});

// GET /api/dashboard/stats — aggregate counts
router.get('/stats', (req, res) => {
  const db = req.app.locals.db;
  const stats = {};

  try { stats.snippets = db.prepare('SELECT COUNT(*) as c FROM snippets').get().c; } catch { stats.snippets = 0; }
  try { stats.notebooks = db.prepare('SELECT COUNT(*) as c FROM notebooks').get().c; } catch { stats.notebooks = 0; }
  try { stats.notes = db.prepare('SELECT COUNT(*) as c FROM quick_notes').get().c; } catch { stats.notes = 0; }
  try {
    const all = db.prepare('SELECT COUNT(*) as c FROM agents').get().c;
    const running = db.prepare("SELECT COUNT(*) as c FROM agents WHERE status = 'running'").get().c;
    stats.agents = { total: all, running };
  } catch { stats.agents = { total: 0, running: 0 }; }

  res.json(stats);
});

// ── Dashboard Widgets ──

// GET /api/dashboard/widgets — get user's widgets
router.get('/widgets', (req, res) => {
  try {
    const userId = req.session?.userId || 'default';
    res.json(dashboardWidgets.getWidgets(req.app.locals.db, userId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/dashboard/widget-types — available widget types
router.get('/widget-types', (req, res) => {
  res.json(dashboardWidgets.WIDGET_TYPES);
});

// POST /api/dashboard/widgets — add widget
router.post('/widgets', (req, res) => {
  try {
    const userId = req.session?.userId || 'default';
    res.json(dashboardWidgets.addWidget(req.app.locals.db, userId, req.body));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/dashboard/widgets/:id — update widget
router.put('/widgets/:id', (req, res) => {
  try {
    const userId = req.session?.userId || 'default';
    dashboardWidgets.updateWidget(req.app.locals.db, userId, req.params.id, req.body);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/dashboard/widgets/:id — remove widget
router.delete('/widgets/:id', (req, res) => {
  try {
    const userId = req.session?.userId || 'default';
    res.json(dashboardWidgets.removeWidget(req.app.locals.db, userId, req.params.id));
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// PUT /api/dashboard/widgets/reorder — reorder widgets
router.put('/widgets/reorder', (req, res) => {
  try {
    const userId = req.session?.userId || 'default';
    res.json(dashboardWidgets.reorderWidgets(req.app.locals.db, userId, req.body.widgetIds));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/dashboard/widgets/reset — reset to defaults
router.post('/widgets/reset', (req, res) => {
  try {
    const userId = req.session?.userId || 'default';
    res.json(dashboardWidgets.resetWidgets(req.app.locals.db, userId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
