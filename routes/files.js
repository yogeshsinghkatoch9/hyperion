const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const os = require('os');
const fileVersioning = require('../services/fileVersioning');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// Path traversal protection
function validatePath(p) {
  if (!p) return null;
  let resolved = p;
  if (resolved === '~' || resolved.startsWith('~/')) resolved = resolved.replace('~', os.homedir());
  resolved = path.resolve(resolved);
  const home = os.homedir();
  if (!resolved.startsWith(home)) return null;
  return resolved;
}

// List directory
router.get('/list', (req, res) => {
  const resolved = validatePath(req.query.path || os.homedir());
  if (!resolved) return res.status(403).json({ error: 'Access denied: path outside home directory' });

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });

    const items = entries.map(entry => {
      let stats = null;
      try {
        stats = fs.statSync(path.join(resolved, entry.name));
      } catch {}

      return {
        name: entry.name,
        path: path.join(resolved, entry.name),
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        isSymlink: entry.isSymbolicLink(),
        size: stats?.size || 0,
        modified: stats?.mtime,
        created: stats?.birthtime,
        permissions: stats ? (stats.mode & 0o777).toString(8) : null,
      };
    }).filter(item => !item.name.startsWith('.') || req.query.showHidden === 'true')
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

    res.json({
      path: resolved,
      parent: path.dirname(resolved),
      items,
      separator: path.sep,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Read file
router.get('/read', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'No path provided' });
  const resolved = validatePath(filePath);
  if (!resolved) return res.status(403).json({ error: 'Access denied: path outside home directory' });

  try {
    const stats = fs.statSync(resolved);

    if (stats.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large (>10MB). Use terminal to view.' });
    }

    // Detect binary
    const buffer = Buffer.alloc(512);
    const fd = fs.openSync(resolved, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
    fs.closeSync(fd);

    let isBinary = false;
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) { isBinary = true; break; }
    }

    if (isBinary) {
      return res.json({
        path: resolved,
        isBinary: true,
        size: stats.size,
        extension: path.extname(resolved),
      });
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    const ext = path.extname(resolved).slice(1);
    const langMap = {
      js: 'javascript', ts: 'typescript', py: 'python', rb: 'ruby',
      rs: 'rust', go: 'go', c: 'c', cpp: 'cpp', h: 'c',
      java: 'java', swift: 'swift', kt: 'kotlin', sh: 'bash',
      css: 'css', html: 'html', json: 'json', yml: 'yaml', yaml: 'yaml',
      md: 'markdown', sql: 'sql', r: 'r', lua: 'lua', php: 'php',
      xml: 'xml', toml: 'toml', ini: 'ini', env: 'shell',
    };

    res.json({
      path: resolved,
      content,
      language: langMap[ext] || 'text',
      size: stats.size,
      modified: stats.mtime,
      lines: content.split('\n').length,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Write file
router.post('/write', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'No path provided' });
  const resolved = validatePath(filePath);
  if (!resolved) return res.status(403).json({ error: 'Access denied: path outside home directory' });

  try {
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(resolved, content || '');
    // Auto-save file version
    try { fileVersioning.saveVersion(req.app.locals.db, resolved, content || '', 'edit'); } catch {}
    res.json({ ok: true, path: resolved, size: Buffer.byteLength(content || '') });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Create directory
router.post('/mkdir', (req, res) => {
  const { path: dirPath } = req.body;
  const resolved = validatePath(dirPath);
  if (!resolved) return res.status(403).json({ error: 'Access denied: path outside home directory' });
  try {
    fs.mkdirSync(resolved, { recursive: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete file/directory
router.delete('/delete', (req, res) => {
  const filePath = req.query.path;
  const resolved = validatePath(filePath);
  if (!resolved) return res.status(403).json({ error: 'Access denied: path outside home directory' });
  try {
    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      fs.rmSync(resolved, { recursive: true });
    } else {
      fs.unlinkSync(resolved);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rename / Move
router.post('/rename', (req, res) => {
  const { from, to } = req.body;
  const resolvedFrom = validatePath(from);
  const resolvedTo = validatePath(to);
  if (!resolvedFrom || !resolvedTo) return res.status(403).json({ error: 'Access denied: path outside home directory' });
  try {
    fs.renameSync(resolvedFrom, resolvedTo);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Upload
router.post('/upload', upload.array('files', 20), (req, res) => {
  const destDir = req.body.path || os.homedir();
  const resolvedDir = validatePath(destDir);
  if (!resolvedDir) return res.status(403).json({ error: 'Access denied: path outside home directory' });
  const uploaded = [];

  for (const file of req.files) {
    const destPath = path.join(resolvedDir, file.originalname);
    fs.writeFileSync(destPath, file.buffer);
    uploaded.push({ name: file.originalname, path: destPath, size: file.size });
  }

  res.json({ uploaded });
});

// Download
router.get('/download', (req, res) => {
  const filePath = req.query.path;
  const resolved = validatePath(filePath);
  if (!resolved) return res.status(403).json({ error: 'Access denied: path outside home directory' });
  try {
    res.download(resolved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Search files
router.get('/search', (req, res) => {
  const { query, path: searchPath, type = 'name' } = req.query;
  if (!query) return res.json([]);

  const root = validatePath(searchPath || os.homedir()) || os.homedir();
  const results = [];
  const maxResults = 50;

  function walk(dir, depth = 0) {
    if (depth > 5 || results.length >= maxResults) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxResults) break;
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

        const fullPath = path.join(dir, entry.name);

        if (type === 'name' && entry.name.toLowerCase().includes(query.toLowerCase())) {
          results.push({ name: entry.name, path: fullPath, isDirectory: entry.isDirectory() });
        }

        if (type === 'content' && entry.isFile()) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            if (content.includes(query)) {
              const lines = content.split('\n');
              const matches = lines.reduce((acc, line, i) => {
                if (line.includes(query)) acc.push({ line: i + 1, text: line.trim().slice(0, 200) });
                return acc;
              }, []).slice(0, 5);
              results.push({ name: entry.name, path: fullPath, isDirectory: false, matches });
            }
          } catch {}
        }

        if (entry.isDirectory()) walk(fullPath, depth + 1);
      }
    } catch {}
  }

  walk(root);
  res.json(results);
});

// Disk usage
router.get('/disk', (req, res) => {
  const dirPath = validatePath(req.query.path || os.homedir()) || os.homedir();
  try {
    const { execSync } = require('child_process');
    const df = execSync(`df -h "${dirPath}"`, { encoding: 'utf-8' });
    const du = execSync(`du -sh "${dirPath}" 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
    res.json({ df: df.trim(), du: du.trim() });
  } catch (err) {
    res.json({ df: '', du: '', error: err.message });
  }
});

// ── File Versioning ──

// GET /api/files/versions — list versioned files
router.get('/versions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    res.json(fileVersioning.getVersionedFiles(req.app.locals.db, limit));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/files/versions/file — list versions for a file
router.get('/versions/file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'Path required' });
  try {
    const limit = parseInt(req.query.limit) || 20;
    res.json(fileVersioning.listVersions(req.app.locals.db, filePath, limit));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/files/versions/:id — get specific version
router.get('/versions/:id', (req, res) => {
  try { res.json(fileVersioning.getVersion(req.app.locals.db, req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

// POST /api/files/versions/diff — diff two versions
router.post('/versions/diff', (req, res) => {
  const { idA, idB } = req.body;
  if (!idA || !idB) return res.status(400).json({ error: 'idA and idB required' });
  try { res.json(fileVersioning.diffVersions(req.app.locals.db, idA, idB)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/files/versions/:id/restore — restore a version
router.post('/versions/:id/restore', (req, res) => {
  try {
    const { filePath, content } = fileVersioning.restoreVersion(req.app.locals.db, req.params.id);
    const resolved = validatePath(filePath);
    if (!resolved) return res.status(403).json({ error: 'Access denied' });
    fs.writeFileSync(resolved, content || '');
    fileVersioning.saveVersion(req.app.locals.db, resolved, content || '', 'restore');
    res.json({ ok: true, path: resolved });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/files/versions/:id — delete a version
router.delete('/versions/:id', (req, res) => {
  try { res.json(fileVersioning.deleteVersion(req.app.locals.db, req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

module.exports = router;
