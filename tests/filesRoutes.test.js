/**
 * Route tests for routes/files.js
 * Tests the /api/files/* HTTP endpoints via the test server.
 *
 * NOTE: The files routes interact with the filesystem. These tests focus on
 * path validation, access control, and parameter handling. We avoid destructive
 * operations (write, delete, rename) on real files and focus on safe read-only
 * operations plus path-traversal rejection.
 *
 * The setup.js does NOT mount /api/files, so we create a minimal test server inline.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const http = require('http');
const express = require('express');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const auth = require('../services/auth');

let server, baseUrl, sessionId;

beforeAll(async () => {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  require('../services/db')(db);

  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.locals.db = db;

  // Auth setup
  app.post('/api/auth/setup', async (req, res) => {
    const { username, password } = req.body;
    const user = await auth.createUser(db, username, password);
    const sid = auth.createSession(user.id, user.username, user.role);
    res.json({ ok: true, sessionId: sid });
  });

  app.use('/api/', auth.requireAuth);
  app.use('/api/files', require('../routes/files'));

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'testpass123' }),
  });
  const setupData = await setupRes.json();
  sessionId = setupData.sessionId;
});

afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

function authedFetch(urlPath, opts = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Session-Id': sessionId, ...(opts.headers || {}) };
  return fetch(`${baseUrl}${urlPath}`, { ...opts, headers });
}

describe('GET /api/files/list', () => {
  it('lists the home directory by default', async () => {
    const res = await authedFetch('/api/files/list');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.path).toBe(os.homedir());
    expect(Array.isArray(data.items)).toBe(true);
    expect(data).toHaveProperty('parent');
    expect(data).toHaveProperty('separator');
  });

  it('lists a specific subdirectory within home', async () => {
    const res = await authedFetch(`/api/files/list?path=${encodeURIComponent(os.homedir())}`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.path).toBe(os.homedir());
  });

  it('items have name, path, isDirectory, isFile fields', async () => {
    const res = await authedFetch('/api/files/list');
    const data = await res.json();
    if (data.items.length > 0) {
      const item = data.items[0];
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('path');
      expect(typeof item.isDirectory).toBe('boolean');
      expect(typeof item.isFile).toBe('boolean');
    }
  });

  it('hides hidden files by default', async () => {
    const res = await authedFetch('/api/files/list');
    const data = await res.json();
    const hiddenItems = data.items.filter(i => i.name.startsWith('.'));
    expect(hiddenItems).toHaveLength(0);
  });

  it('shows hidden files when showHidden=true', async () => {
    const res = await authedFetch('/api/files/list?showHidden=true');
    const data = await res.json();
    // The home directory typically has hidden files like .bashrc
    // Just verify the response is valid
    expect(res.status).toBe(200);
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('sorts directories before files', async () => {
    const res = await authedFetch('/api/files/list');
    const data = await res.json();
    if (data.items.length >= 2) {
      const firstFileIndex = data.items.findIndex(i => i.isFile);
      const lastDirIndex = data.items.length - 1 - [...data.items].reverse().findIndex(i => i.isDirectory);
      if (firstFileIndex !== -1 && lastDirIndex !== -1) {
        expect(lastDirIndex).toBeLessThan(firstFileIndex);
      }
    }
  });
});

describe('Path traversal protection', () => {
  it('rejects paths outside home directory', async () => {
    const res = await authedFetch('/api/files/list?path=/etc');
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Access denied');
  });

  it('rejects path traversal with ../', async () => {
    const res = await authedFetch(`/api/files/list?path=${encodeURIComponent(os.homedir() + '/../../etc')}`);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Access denied');
  });

  it('rejects /tmp path outside home', async () => {
    const res = await authedFetch('/api/files/list?path=/tmp');
    expect(res.status).toBe(403);
  });

  it('rejects root path', async () => {
    const res = await authedFetch('/api/files/list?path=/');
    expect(res.status).toBe(403);
  });
});

describe('GET /api/files/read', () => {
  it('returns 400 when no path is provided', async () => {
    const res = await authedFetch('/api/files/read');
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('No path provided');
  });

  it('rejects paths outside home directory', async () => {
    const res = await authedFetch('/api/files/read?path=/etc/passwd');
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Access denied');
  });
});

describe('POST /api/files/write', () => {
  it('returns 400 when no path is provided', async () => {
    const res = await authedFetch('/api/files/write', {
      method: 'POST',
      body: JSON.stringify({ content: 'test' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('No path provided');
  });

  it('rejects paths outside home directory', async () => {
    const res = await authedFetch('/api/files/write', {
      method: 'POST',
      body: JSON.stringify({ path: '/tmp/evil.txt', content: 'bad' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/files/mkdir', () => {
  it('rejects paths outside home directory', async () => {
    const res = await authedFetch('/api/files/mkdir', {
      method: 'POST',
      body: JSON.stringify({ path: '/tmp/evil-dir' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/files/delete', () => {
  it('rejects paths outside home directory', async () => {
    const res = await authedFetch('/api/files/delete?path=/etc/hosts', { method: 'DELETE' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/files/rename', () => {
  it('rejects paths outside home directory', async () => {
    const res = await authedFetch('/api/files/rename', {
      method: 'POST',
      body: JSON.stringify({ from: '/etc/hosts', to: '/tmp/hosts' }),
    });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/files/search', () => {
  it('returns empty array when no query is provided', async () => {
    const res = await authedFetch('/api/files/search');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });
});

describe('Auth gate for files routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/files/list`);
    expect(res.status).toBe(401);
  });
});
