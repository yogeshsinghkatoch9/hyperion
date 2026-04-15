/**
 * Workflow Profiles — CRUD + Execution
 */

const express = require('express');
const router = express.Router();
const { v4: uuid } = require('uuid');
const { execSync } = require('child_process');
const os = require('os');
const { resolveAppName } = require('../services/appDiscovery');
const { notify } = require('../services/notify');

// Sanitize user input for shell and osascript safety
function shellSafe(s) { return (s || '').replace(/[`$(){}|;&<>\\]/g, ''); }
function osascriptSafe(s) { return (s || '').replace(/["\\]/g, '').replace(/[`$]/g, ''); }

// Seed built-in workflows on first run
function seedDefaults(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM workflow_profiles').get().c;
  if (count > 0) return;

  const defaults = [
    {
      name: 'Dev Mode',
      description: 'Open development tools: VSCode, Terminal, and Chrome',
      actions: [
        { type: 'open', app: 'Visual Studio Code' },
        { type: 'open', app: 'Terminal' },
        { type: 'open', app: 'Google Chrome' },
      ],
    },
    {
      name: 'Writing Mode',
      description: 'Minimal setup for focused writing',
      actions: [
        { type: 'open', app: 'Notes' },
        { type: 'open', app: 'Music' },
      ],
    },
    {
      name: 'Design Mode',
      description: 'Creative tools for design work',
      actions: [
        { type: 'open', app: 'Figma' },
        { type: 'open', app: 'Google Chrome' },
        { type: 'open', app: 'Preview' },
      ],
    },
    {
      name: 'Close All Browsers',
      description: 'Quit all browser applications',
      actions: [
        { type: 'close', app: 'Google Chrome' },
        { type: 'close', app: 'Firefox' },
        { type: 'close', app: 'Safari' },
        { type: 'close', app: 'Brave Browser' },
        { type: 'close', app: 'Microsoft Edge' },
        { type: 'close', app: 'Arc' },
      ],
    },
  ];

  const insert = db.prepare('INSERT INTO workflow_profiles (id, name, description, actions) VALUES (?, ?, ?, ?)');
  for (const wf of defaults) {
    insert.run(uuid(), wf.name, wf.description, JSON.stringify(wf.actions));
  }
}

// List all workflows
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  seedDefaults(db);
  const rows = db.prepare('SELECT * FROM workflow_profiles ORDER BY created_at').all();
  res.json(rows.map(r => ({ ...r, actions: JSON.parse(r.actions || '[]') })));
});

// Create workflow
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { name, description, actions } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuid();
  db.prepare('INSERT INTO workflow_profiles (id, name, description, actions) VALUES (?, ?, ?, ?)')
    .run(id, name, description || '', JSON.stringify(actions || []));
  res.json({ id, name, description, actions: actions || [] });
});

// Update workflow
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { name, description, actions } = req.body;
  const existing = db.prepare('SELECT * FROM workflow_profiles WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE workflow_profiles SET name = ?, description = ?, actions = ? WHERE id = ?')
    .run(name || existing.name, description ?? existing.description, JSON.stringify(actions || JSON.parse(existing.actions)), req.params.id);
  res.json({ ok: true });
});

// Delete workflow
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;
  db.prepare('DELETE FROM workflow_profiles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Execute workflow (uses workflow engine for conditionals/loops)
router.post('/:id/run', (req, res) => {
  const db = req.app.locals.db;
  const wf = db.prepare('SELECT * FROM workflow_profiles WHERE id = ?').get(req.params.id);
  if (!wf) return res.status(404).json({ error: 'Workflow not found' });

  const actions = JSON.parse(wf.actions || '[]');
  const workflowEngine = require('../services/workflowEngine');
  const { results } = workflowEngine.execute(actions, req.body.variables || {});

  const failCount = results.filter(r => r.status === 'error').length;
  notify(db, {
    title: 'Workflow Completed',
    message: `"${wf.name}" — ${results.length} actions${failCount ? `, ${failCount} failed` : ''}`,
    source: 'workflow',
    level: failCount ? 'warning' : 'success',
  });

  res.json({ success: true, workflow: wf.name, results });
});

module.exports = router;
