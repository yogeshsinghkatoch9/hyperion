const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// List all canvas items
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const items = db.prepare('SELECT * FROM canvas_items ORDER BY created_at DESC').all();
  res.json(items.map(i => ({ ...i, metadata: JSON.parse(i.metadata || '{}') })));
});

// Create canvas item
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { type, title, content, x, y, width, height, metadata } = req.body;

  if (!type) return res.status(400).json({ error: 'type required' });

  const id = uuidv4();
  db.prepare(
    `INSERT INTO canvas_items (id, user_id, type, title, content, x, y, width, height, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, 'default', type, title || '', content || '', x || 0, y || 0, width || 300, height || 200, JSON.stringify(metadata || {}));

  res.json({ id });
});

// Update canvas item
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { title, content, x, y, width, height, metadata } = req.body;

  const sets = [];
  const vals = [];

  if (title !== undefined) { sets.push('title = ?'); vals.push(title); }
  if (content !== undefined) { sets.push('content = ?'); vals.push(content); }
  if (x !== undefined) { sets.push('x = ?'); vals.push(x); }
  if (y !== undefined) { sets.push('y = ?'); vals.push(y); }
  if (width !== undefined) { sets.push('width = ?'); vals.push(width); }
  if (height !== undefined) { sets.push('height = ?'); vals.push(height); }
  if (metadata !== undefined) { sets.push('metadata = ?'); vals.push(JSON.stringify(metadata)); }

  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  sets.push("updated_at = datetime('now')");
  vals.push(req.params.id);

  db.prepare(`UPDATE canvas_items SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

// Delete canvas item
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM canvas_items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
