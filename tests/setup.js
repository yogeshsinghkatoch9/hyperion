/**
 * Test bootstrap: spawn server on random port, create test user, get session
 */
const http = require('http');
const path = require('path');
const Database = require('better-sqlite3');

let server, baseUrl, sessionId, db;

async function setup() {
  // Create temp DB
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  require('../services/db')(db);

  // Build app
  const express = require('express');
  const auth = require('../services/auth');
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.locals.db = db;
  app.locals.systemHistory = [];
  app.locals.collectBattery = () => null;

  // Auth endpoints
  app.get('/api/auth/status', (req, res) => {
    const needsSetup = !auth.hasUsers(db);
    const sid = req.headers['x-session-id'];
    const session = auth.getSession(sid);
    res.json({ needsSetup, authenticated: !!session, user: session ? session.username : null });
  });
  app.post('/api/auth/setup', async (req, res) => {
    const { username, password } = req.body;
    const user = await auth.createUser(db, username, password);
    const sid = auth.createSession(user.id, user.username, user.role);
    res.json({ ok: true, sessionId: sid, user: user.username });
  });
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await auth.verifyUser(db, username, password);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const sid = auth.createSession(user.id, user.username, user.role);
    res.json({ ok: true, sessionId: sid, user: user.username });
  });
  // Health endpoint (no auth required)
  app.get('/api/health', (req, res) => {
    const os = require('os');
    res.json({ status: 'ok', uptime: process.uptime(), memPercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100), timestamp: Date.now() });
  });

  app.use('/api/', auth.requireAuth);

  // Mount routes
  app.use('/api/notifications', require('../routes/notifications'));
  app.use('/api/settings', require('../routes/settings'));
  app.use('/api/search', require('../routes/search'));
  app.use('/api/ssh', require('../routes/ssh'));

  // Wave 9 routes
  app.use('/api/regex', require('../routes/regexTester'));
  app.use('/api/jwt', require('../routes/jwtDebugger'));
  app.use('/api/diff', require('../routes/diffViewer'));
  app.use('/api/images', require('../routes/imageTools'));
  app.use('/api/cron-expr', require('../routes/cronBuilder'));
  app.use('/api/colors', require('../routes/colorTools'));

  // Wave 10 routes
  app.use('/api/base64', require('../routes/base64'));
  app.use('/api/hash', require('../routes/hash'));
  app.use('/api/uuid', require('../routes/uuid'));
  app.use('/api/json', require('../routes/json'));
  app.use('/api/yaml', require('../routes/yaml'));
  app.use('/api/lorem', require('../routes/lorem'));
  app.use('/api/dashboard', require('../routes/dashboard'));

  // Start on random port
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;

  // Create test user
  const res = await fetch(`${baseUrl}/api/auth/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser', password: 'testpass123' }),
  });
  const data = await res.json();
  sessionId = data.sessionId;

  return { baseUrl, sessionId, db, server };
}

async function teardown() {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) db.close();
}

function authedFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Session-Id': sessionId, ...(opts.headers || {}) };
  return fetch(`${baseUrl}${path}`, { ...opts, headers });
}

module.exports = { setup, teardown, authedFetch, getBaseUrl: () => baseUrl, getSessionId: () => sessionId };
