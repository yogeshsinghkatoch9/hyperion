/**
 * Hyperion Log Viewer — Real-time log file tailing, search, and filtering
 * Uses fs.watch + readline for streaming, WebSocket for live updates
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ── Active watchers ──
const watchers = new Map(); // filePath -> { watcher, clients: Set<ws>, position }

// ═══ FILE READING ═══

function readLogFile(filePath, { lines = 200, search, level } = {}) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error('File not found');

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) throw new Error('Path is a directory');

  const content = fs.readFileSync(resolved, 'utf8');
  let allLines = content.split('\n');

  // Take last N lines
  if (allLines.length > lines) {
    allLines = allLines.slice(-lines);
  }

  // Apply filters
  let filtered = allLines;
  if (search) {
    const regex = new RegExp(search, 'i');
    filtered = filtered.filter(l => regex.test(l));
  }
  if (level) {
    filtered = filtered.filter(l => detectLevel(l) === level);
  }

  return {
    path: resolved,
    totalLines: content.split('\n').length,
    returnedLines: filtered.length,
    size: stat.size,
    modified: stat.mtime,
    lines: filtered.map((text, i) => ({
      num: allLines.length - filtered.length + i + 1,
      text,
      level: detectLevel(text),
    })),
  };
}

function detectLevel(line) {
  if (!line) return 'default';
  const upper = line.toUpperCase();
  if (/\b(ERROR|FATAL|CRITICAL|PANIC)\b/.test(upper)) return 'error';
  if (/\b(WARN|WARNING)\b/.test(upper)) return 'warn';
  if (/\b(INFO)\b/.test(upper)) return 'info';
  if (/\b(DEBUG|TRACE|VERBOSE)\b/.test(upper)) return 'debug';
  return 'default';
}

function getLevelColor(level) {
  const colors = { error: 'red', warn: 'amber', info: 'green', debug: 'dim', default: 'text' };
  return colors[level] || 'text';
}

// ═══ LIVE TAILING ═══

function startTailing(filePath, ws) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error('File not found');

  if (!watchers.has(resolved)) {
    const stat = fs.statSync(resolved);
    let position = stat.size;

    const watcher = fs.watch(resolved, (eventType) => {
      if (eventType !== 'change') return;

      try {
        const newStat = fs.statSync(resolved);
        if (newStat.size <= position) {
          // File was truncated — reset
          position = 0;
        }

        const stream = fs.createReadStream(resolved, {
          start: position,
          encoding: 'utf8',
        });

        let buffer = '';
        stream.on('data', (chunk) => { buffer += chunk; });
        stream.on('end', () => {
          position = newStat.size;
          if (!buffer) return;

          const newLines = buffer.split('\n').filter(Boolean);
          const clients = watchers.get(resolved)?.clients;
          if (!clients) return;

          for (const client of clients) {
            try {
              client.send(JSON.stringify({
                type: 'log_lines',
                path: resolved,
                lines: newLines.map(text => ({
                  text,
                  level: detectLevel(text),
                  timestamp: Date.now(),
                })),
              }));
            } catch {}
          }
        });
      } catch {}
    });

    watchers.set(resolved, { watcher, clients: new Set(), position });
  }

  watchers.get(resolved).clients.add(ws);
  return resolved;
}

function stopTailing(filePath, ws) {
  const resolved = path.resolve(filePath);
  const entry = watchers.get(resolved);
  if (!entry) return;

  entry.clients.delete(ws);
  if (entry.clients.size === 0) {
    try { entry.watcher.close(); } catch {}
    watchers.delete(resolved);
  }
}

function stopAllTailing(ws) {
  for (const [filePath, entry] of watchers) {
    entry.clients.delete(ws);
    if (entry.clients.size === 0) {
      try { entry.watcher.close(); } catch {}
      watchers.delete(filePath);
    }
  }
}

// ═══ FILE DISCOVERY ═══

function findLogFiles(dir, { maxDepth = 3, extensions = ['.log', '.out', '.err'] } = {}) {
  const resolved = path.resolve(dir);
  const results = [];

  function scan(current, depth) {
    if (depth > maxDepth || results.length >= 50) return;
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(current, entry.name);

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const nameLC = entry.name.toLowerCase();
          if (extensions.includes(ext) || nameLC.includes('log') || nameLC === 'stdout' || nameLC === 'stderr') {
            try {
              const stat = fs.statSync(fullPath);
              results.push({
                path: fullPath,
                name: entry.name,
                size: stat.size,
                modified: stat.mtime,
              });
            } catch {}
          }
        } else if (entry.isDirectory()) {
          scan(fullPath, depth + 1);
        }
      }
    } catch {}
  }

  scan(resolved, 0);
  return results.sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

// ═══ COMMON LOG PATHS ═══

function getCommonLogPaths() {
  const home = process.env.HOME || '/';
  const candidates = [
    '/var/log',
    path.join(home, '.npm/_logs'),
    path.join(home, 'Library/Logs'),
    '/usr/local/var/log',
    '/tmp',
  ];
  return candidates.filter(p => {
    try { return fs.existsSync(p) && fs.statSync(p).isDirectory(); }
    catch { return false; }
  });
}

// ═══ SEARCH ACROSS FILE ═══

function searchInFile(filePath, pattern, { maxResults = 100 } = {}) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error('File not found');

  const content = fs.readFileSync(resolved, 'utf8');
  const lines = content.split('\n');
  const regex = new RegExp(pattern, 'gi');
  const results = [];

  for (let i = 0; i < lines.length && results.length < maxResults; i++) {
    if (regex.test(lines[i])) {
      results.push({ lineNum: i + 1, text: lines[i], level: detectLevel(lines[i]) });
      regex.lastIndex = 0; // Reset for global flag
    }
  }

  return results;
}

// ═══ EXPORTS ═══
module.exports = {
  readLogFile,
  detectLevel,
  getLevelColor,
  startTailing,
  stopTailing,
  stopAllTailing,
  findLogFiles,
  getCommonLogPaths,
  searchInFile,
};
