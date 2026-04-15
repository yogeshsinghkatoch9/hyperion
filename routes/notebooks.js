const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// List notebooks
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const notebooks = db.prepare('SELECT id, name, description, language, created_at, updated_at FROM notebooks ORDER BY updated_at DESC').all();
  res.json(notebooks);
});

// Get notebook
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const nb = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(req.params.id);
  if (!nb) return res.status(404).json({ error: 'Not found' });
  nb.cells = JSON.parse(nb.cells || '[]');
  res.json(nb);
});

// Create notebook
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { name, description, language = 'python' } = req.body;
  const id = uuidv4();
  const cells = JSON.stringify([
    { id: uuidv4(), type: 'code', source: '', output: '', language }
  ]);

  db.prepare('INSERT INTO notebooks (id, name, description, language, cells) VALUES (?,?,?,?,?)')
    .run(id, name || 'Untitled Notebook', description || '', language, cells);

  res.json({ id });
});

// Update notebook
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { name, description, cells } = req.body;

  db.prepare(`UPDATE notebooks SET name=COALESCE(?,name), description=COALESCE(?,description),
    cells=COALESCE(?,cells), updated_at=datetime('now') WHERE id=?`)
    .run(name, description, cells ? JSON.stringify(cells) : null, req.params.id);

  res.json({ ok: true });
});

// Delete notebook
router.delete('/:id', (req, res) => {
  req.app.locals.db.prepare('DELETE FROM notebooks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Execute a single cell
router.post('/:id/run-cell', async (req, res) => {
  const db = req.app.locals.db;
  const { cellId, source, language = 'python' } = req.body;

  const nb = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(req.params.id);
  if (!nb) return res.status(404).json({ error: 'Notebook not found' });

  const cells = JSON.parse(nb.cells || '[]');

  try {
    const result = await executeCell(source, language);

    // Update cell output
    const cellIdx = cells.findIndex(c => c.id === cellId);
    if (cellIdx >= 0) {
      cells[cellIdx].output = result.stdout + result.stderr;
      cells[cellIdx].exitCode = result.exitCode;
      cells[cellIdx].duration = result.duration;
      cells[cellIdx].executedAt = new Date().toISOString();
    }

    db.prepare('UPDATE notebooks SET cells = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(cells), req.params.id);

    res.json(result);
  } catch (err) {
    res.json({ stdout: '', stderr: err.message, exitCode: 1, duration: 0 });
  }
});

// Run ALL cells in order
router.post('/:id/run-all', async (req, res) => {
  const db = req.app.locals.db;
  const nb = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(req.params.id);
  if (!nb) return res.status(404).json({ error: 'Notebook not found' });

  const cells = JSON.parse(nb.cells || '[]');
  const results = [];

  for (const cell of cells) {
    if (cell.type !== 'code' || !cell.source?.trim()) continue;

    const result = await executeCell(cell.source, cell.language || nb.language);
    cell.output = result.stdout + result.stderr;
    cell.exitCode = result.exitCode;
    cell.duration = result.duration;
    cell.executedAt = new Date().toISOString();
    results.push({ cellId: cell.id, ...result });
  }

  db.prepare('UPDATE notebooks SET cells = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(JSON.stringify(cells), req.params.id);

  res.json({ results });
});

// Export notebook as script
router.get('/:id/export', (req, res) => {
  const db = req.app.locals.db;
  const nb = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(req.params.id);
  if (!nb) return res.status(404).json({ error: 'Not found' });

  const cells = JSON.parse(nb.cells || '[]');
  const ext = { python: '.py', javascript: '.js', bash: '.sh', ruby: '.rb' }[nb.language] || '.txt';
  const comment = { python: '#', javascript: '//', bash: '#', ruby: '#' }[nb.language] || '#';

  let script = `${comment} ${nb.name}\n${comment} Exported from Hyperion\n\n`;

  cells.forEach((cell, i) => {
    if (cell.type === 'markdown') {
      script += cell.source.split('\n').map(l => `${comment} ${l}`).join('\n') + '\n\n';
    } else if (cell.type === 'code') {
      script += `${comment} Cell ${i + 1}\n${cell.source}\n\n`;
    }
  });

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${nb.name}${ext}"`);
  res.send(script);
});

async function executeCell(source, language) {
  const langs = {
    python: { cmd: 'python3', ext: '.py' },
    javascript: { cmd: 'node', ext: '.js' },
    bash: { cmd: 'bash', ext: '.sh' },
    ruby: { cmd: 'ruby', ext: '.rb' },
    r: { cmd: 'Rscript', ext: '.R' },
    go: { cmd: 'go', args: ['run'], ext: '.go' },
    shell: { cmd: 'sh', ext: '.sh' },
  };

  const lang = langs[language] || langs.python;
  const tmpFile = path.join(os.tmpdir(), `hyperion_nb_${uuidv4()}${lang.ext}`);

  fs.writeFileSync(tmpFile, source);
  const startTime = Date.now();

  try {
    const args = [...(lang.args || []), tmpFile];
    const result = await new Promise((resolve) => {
      const proc = spawn(lang.cmd, args, {
        timeout: 60000,
        cwd: os.homedir(),
        env: process.env,
      });

      let stdout = '', stderr = '';
      proc.stdout.on('data', d => stdout += d.toString());
      proc.stderr.on('data', d => stderr += d.toString());

      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        stderr += '\n[TIMEOUT: 60s]';
      }, 60000);

      proc.on('close', code => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code || 0 });
      });
      proc.on('error', err => {
        clearTimeout(timer);
        resolve({ stdout, stderr: err.message, exitCode: 1 });
      });
    });

    return { ...result, duration: Date.now() - startTime };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

module.exports = router;
