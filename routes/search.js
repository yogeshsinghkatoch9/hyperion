const express = require('express');
const router = express.Router();

// GET /api/search?q=... — unified search across tables
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const q = req.query.q;
  if (!q || q.length < 2) return res.json({ results: {} });

  const pattern = `%${q}%`;
  const limit = 5;

  const results = {};

  // Commands
  try {
    const commands = db.prepare(
      'SELECT command, language, created_at FROM command_history WHERE command LIKE ? ORDER BY created_at DESC LIMIT ?'
    ).all(pattern, limit);
    if (commands.length) results.commands = commands;
  } catch {}

  // Snippets
  try {
    const snippets = db.prepare(
      'SELECT id, name, language, created_at FROM snippets WHERE name LIKE ? OR code LIKE ? ORDER BY created_at DESC LIMIT ?'
    ).all(pattern, pattern, limit);
    if (snippets.length) results.snippets = snippets;
  } catch {}

  // Notebooks
  try {
    const notebooks = db.prepare(
      'SELECT id, name, language, description FROM notebooks WHERE name LIKE ? OR description LIKE ? LIMIT ?'
    ).all(pattern, pattern, limit);
    if (notebooks.length) results.notebooks = notebooks;
  } catch {}

  // Agents
  try {
    const agents = db.prepare(
      'SELECT id, name, description, status FROM agents WHERE name LIKE ? OR description LIKE ? LIMIT ?'
    ).all(pattern, pattern, limit);
    if (agents.length) results.agents = agents;
  } catch {}

  // Workflows
  try {
    const workflows = db.prepare(
      'SELECT id, name, description FROM workflow_profiles WHERE name LIKE ? OR description LIKE ? LIMIT ?'
    ).all(pattern, pattern, limit);
    if (workflows.length) results.workflows = workflows;
  } catch {}

  // Notifications
  try {
    const notifs = db.prepare(
      'SELECT id, title, message, level FROM notifications WHERE title LIKE ? OR message LIKE ? ORDER BY created_at DESC LIMIT ?'
    ).all(pattern, pattern, limit);
    if (notifs.length) results.notifications = notifs;
  } catch {}

  // Bookmarks
  try {
    const bookmarks = db.prepare(
      'SELECT id, url, title, description FROM bookmarks WHERE url LIKE ? OR title LIKE ? OR description LIKE ? ORDER BY created_at DESC LIMIT ?'
    ).all(pattern, pattern, pattern, limit);
    if (bookmarks.length) results.bookmarks = bookmarks;
  } catch {}

  // Quick Notes
  try {
    const notes = db.prepare(
      'SELECT id, title, content FROM quick_notes WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT ?'
    ).all(pattern, pattern, limit);
    if (notes.length) results.notes = notes;
  } catch {}

  // Regex Patterns
  try {
    const regex = db.prepare(
      'SELECT id, name, pattern, description FROM regex_patterns WHERE name LIKE ? OR pattern LIKE ? OR description LIKE ? LIMIT ?'
    ).all(pattern, pattern, pattern, limit);
    if (regex.length) results.regex = regex;
  } catch {}

  // Diff Snapshots
  try {
    const diffs = db.prepare(
      'SELECT id, name FROM diff_snapshots WHERE name LIKE ? ORDER BY created_at DESC LIMIT ?'
    ).all(pattern, limit);
    if (diffs.length) results.diffs = diffs;
  } catch {}

  // Cron Presets
  try {
    const crons = db.prepare(
      'SELECT id, name, expression FROM cron_presets WHERE name LIKE ? OR expression LIKE ? LIMIT ?'
    ).all(pattern, pattern, limit);
    if (crons.length) results.crons = crons;
  } catch {}

  // Color Palettes
  try {
    const palettes = db.prepare(
      'SELECT id, name, type FROM color_palettes WHERE name LIKE ? OR type LIKE ? LIMIT ?'
    ).all(pattern, pattern, limit);
    if (palettes.length) results.palettes = palettes;
  } catch {}

  // Clipboard Items
  try {
    const clips = db.prepare(
      'SELECT id, content, label FROM clipboard_items WHERE content LIKE ? OR label LIKE ? ORDER BY created_at DESC LIMIT ?'
    ).all(pattern, pattern, limit);
    if (clips.length) results.clipboard = clips;
  } catch {}

  // Mock Endpoints
  try {
    const mocks = db.prepare(
      'SELECT id, path, method FROM mock_endpoints WHERE path LIKE ? OR method LIKE ? LIMIT ?'
    ).all(pattern, pattern, limit);
    if (mocks.length) results.mocks = mocks;
  } catch {}

  res.json({ results });
});

// GET /api/search/fts?q=... — Full-text search (FTS5)
router.get('/fts', (req, res) => {
  const db = req.app.locals.db;
  const q = req.query.q;
  if (!q || q.length < 2) return res.json({ results: [] });

  try {
    const fts = require('../services/fts');
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const results = fts.search(db, q, { limit });
    res.json({ results });
  } catch (err) {
    res.json({ results: [], error: 'FTS not available' });
  }
});

module.exports = router;
