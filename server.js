const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const url = require('url');
const Database = require('better-sqlite3');
const auth = require('./services/auth');
const pluginLoader = require('./services/pluginLoader');
const skillLoader = require('./services/skillLoader');
const cronScheduler = require('./services/cronScheduler');
const vectorMemory = require('./services/vectorMemory');
const discovery = require('./services/discovery');
const mcpServer = require('./services/mcpServer');
const webhook = require('./services/channels/webhook');
const remoteDesktop = require('./services/remoteDesktop');
const monitor = require('./services/monitor');
const auditLog = require('./services/auditLog');

const metricsService = require('./services/metricsService');
const logger = require('./services/logger');
const sessionStore = require('./services/sessionStore');

const app = express();
const server = http.createServer(app);

// ── Database for agents, notebooks, sessions ──
const db = new Database(path.join(__dirname, 'hyperion.db'));
db.pragma('journal_mode = WAL');
require('./services/db')(db);

app.locals.db = db;

// ── Security Headers ──
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.CSP_DISABLED !== 'true') {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' ws: wss:;");
  }
  next();
});

// ── CORS ──
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
app.use((req, res, next) => {
  if (CORS_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id, X-API-Key');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

// ── Middleware ──
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0, setHeaders: (res) => res.set('Cache-Control', 'no-store') }));
app.use(logger.requestLogger);
app.use(metricsService.middleware());

// ── Metrics Endpoint (before auth, unauthenticated) ──
app.use('/api/metrics', require('./routes/metrics'));

// ── Health Endpoint (before auth, unauthenticated) ──
app.get('/api/health', (req, res) => {
  const os = require('os');
  const fs = require('fs');
  const checks = { database: 'ok', disk: 'ok', memory: 'ok' };
  let status = 'ok';

  // DB connectivity
  try { db.prepare('SELECT 1').get(); }
  catch { checks.database = 'error'; status = 'degraded'; }

  // Disk space (data dir writable)
  try { fs.accessSync(path.join(__dirname, 'data'), fs.constants.W_OK); }
  catch {
    try { fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true }); }
    catch { checks.disk = 'error'; status = 'degraded'; }
  }

  // Memory threshold (>95% = warning)
  const memPercent = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
  if (memPercent > 95) { checks.memory = 'warning'; if (status === 'ok') status = 'degraded'; }

  const code = status === 'ok' ? 200 : 503;
  res.status(code).json({
    status,
    checks,
    uptime: process.uptime(),
    memPercent,
    nodeVersion: process.version,
    timestamp: Date.now(),
  });
});

// ── Login Rate Limiter (in-memory, 5 attempts/min/IP) ──
const loginAttempts = new Map();
function checkLoginRate(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}
// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 300000);

// ── Auth Endpoints (before requireAuth middleware) ──
app.get('/api/auth/status', (req, res) => {
  const needsSetup = !auth.hasUsers(db);
  const sid = req.headers['x-session-id'];
  const session = auth.getSession(sid, db);
  res.json({ needsSetup, authenticated: !!session, user: session ? session.username : null });
});

app.post('/api/auth/setup', async (req, res) => {
  if (auth.hasUsers(db)) return res.status(400).json({ error: 'Setup already completed' });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const user = await auth.createUser(db, username, password);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const sid = auth.createSession(user.id, user.username, user.role, { db, ip, userAgent: req.headers['user-agent'] });
    sessionStore.logLogin(db, { userId: user.id, username: user.username, ip, userAgent: req.headers['user-agent'], success: true });
    res.json({ ok: true, sessionId: sid, user: user.username });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const user = await auth.createUser(db, username, password, 'user');
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const sid = auth.createSession(user.id, user.username, user.role, { db, ip, userAgent: req.headers['user-agent'] });
    sessionStore.logLogin(db, { userId: user.id, username: user.username, ip, userAgent: req.headers['user-agent'], success: true });
    res.json({ ok: true, sessionId: sid, user: user.username });
  } catch (err) {
    const msg = err.message.includes('UNIQUE') ? 'Username already taken' : err.message;
    res.status(400).json({ error: msg });
  }
});

// ── 2FA temp tokens ──
const totpTempTokens = new Map(); // tempToken -> { userId, username, role, expiresAt }
setInterval(() => { const now = Date.now(); for (const [k, v] of totpTempTokens) { if (now > v.expiresAt) totpTempTokens.delete(k); } }, 60000);

app.post('/api/auth/login', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkLoginRate(ip)) {
    return res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
  }
  const { username, password } = req.body;
  const user = await auth.verifyUser(db, username, password);
  if (!user) {
    sessionStore.logLogin(db, { userId: null, username, ip, userAgent: req.headers['user-agent'], success: false });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check if 2FA is enabled
  const totpRow = db.prepare('SELECT enabled FROM totp_secrets WHERE user_id = ?').get(user.id);
  if (totpRow && totpRow.enabled) {
    const crypto = require('crypto');
    const tempToken = crypto.randomBytes(32).toString('hex');
    totpTempTokens.set(tempToken, { userId: user.id, username: user.username, role: user.role, expiresAt: Date.now() + 300000 });
    return res.json({ requires2fa: true, tempToken });
  }

  const sid = auth.createSession(user.id, user.username, user.role, { db, ip, userAgent: req.headers['user-agent'] });
  sessionStore.logLogin(db, { userId: user.id, username: user.username, ip, userAgent: req.headers['user-agent'], success: true });
  res.json({ ok: true, sessionId: sid, user: user.username });
});

// ── 2FA Validate (during login) ──
app.post('/api/auth/totp/validate', (req, res) => {
  const { tempToken, token } = req.body;
  if (!tempToken || !token) return res.status(400).json({ error: 'Token required' });
  const pending = totpTempTokens.get(tempToken);
  if (!pending || Date.now() > pending.expiresAt) return res.status(401).json({ error: 'Invalid or expired temp token' });

  const totp = require('./services/totp');
  const row = db.prepare('SELECT encrypted_secret, backup_codes FROM totp_secrets WHERE user_id = ? AND enabled = 1').get(pending.userId);
  if (!row) return res.status(400).json({ error: '2FA not configured' });

  const secret = totp.decryptSecret(db, row.encrypted_secret);
  const loginIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (totp.verifyTOTP(secret, token)) {
    totpTempTokens.delete(tempToken);
    const sid = auth.createSession(pending.userId, pending.username, pending.role, { db, ip: loginIp, userAgent: req.headers['user-agent'] });
    sessionStore.logLogin(db, { userId: pending.userId, username: pending.username, ip: loginIp, userAgent: req.headers['user-agent'], success: true });
    return res.json({ ok: true, sessionId: sid, user: pending.username });
  }

  // Check backup codes
  if (row.backup_codes) {
    const codes = JSON.parse(row.backup_codes);
    const idx = codes.indexOf(token);
    if (idx >= 0) {
      codes.splice(idx, 1);
      db.prepare('UPDATE totp_secrets SET backup_codes = ? WHERE user_id = ?').run(JSON.stringify(codes), pending.userId);
      totpTempTokens.delete(tempToken);
      const sid = auth.createSession(pending.userId, pending.username, pending.role, { db, ip: loginIp, userAgent: req.headers['user-agent'] });
      sessionStore.logLogin(db, { userId: pending.userId, username: pending.username, ip: loginIp, userAgent: req.headers['user-agent'], success: true });
      return res.json({ ok: true, sessionId: sid, user: pending.username, backupCodeUsed: true });
    }
  }

  res.status(401).json({ error: 'Invalid TOTP code' });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = req.headers['x-session-id'];
  if (sid) auth.destroySession(sid, db);
  res.json({ ok: true });
});

// ── Global API Rate Limiter (100 req/min/IP) ──
const apiRateLimit = new Map(); // ip -> { count, resetAt }
const API_RATE_LIMIT = parseInt(process.env.API_RATE_LIMIT) || 100;
app.use('/api/', (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = apiRateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    apiRateLimit.set(ip, { count: 1, resetAt: now + 60000 });
    return next();
  }
  if (entry.count >= API_RATE_LIMIT) {
    return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
  }
  entry.count++;
  next();
});
// Cleanup stale API rate entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of apiRateLimit) {
    if (now > entry.resetAt) apiRateLimit.delete(ip);
  }
}, 300000);

// ── Apply auth middleware to all /api/ routes ──
app.use('/api/', auth.requireAuth);

// ── 2FA Setup/Verify/Disable (requires session) ──
app.post('/api/auth/totp/setup', (req, res) => {
  const totp = require('./services/totp');
  const { v4: uuidv4 } = require('uuid');
  const existing = db.prepare('SELECT * FROM totp_secrets WHERE user_id = ?').get(req.session.userId);
  if (existing && existing.enabled) return res.status(400).json({ error: '2FA already enabled' });

  const secret = totp.generateSecret();
  const qrUri = totp.generateQRUri(secret, req.session.username);
  const backupCodes = totp.generateBackupCodes();
  const encrypted = totp.encryptSecret(db, secret);

  if (existing) {
    db.prepare('UPDATE totp_secrets SET encrypted_secret = ?, enabled = 0, backup_codes = ? WHERE user_id = ?')
      .run(encrypted, JSON.stringify(backupCodes), req.session.userId);
  } else {
    db.prepare('INSERT INTO totp_secrets (id, user_id, encrypted_secret, enabled, backup_codes) VALUES (?, ?, ?, 0, ?)')
      .run(uuidv4(), req.session.userId, encrypted, JSON.stringify(backupCodes));
  }

  res.json({ secret, qrUri, backupCodes });
});

app.post('/api/auth/totp/verify', (req, res) => {
  const totp = require('./services/totp');
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });

  const row = db.prepare('SELECT encrypted_secret FROM totp_secrets WHERE user_id = ?').get(req.session.userId);
  if (!row) return res.status(400).json({ error: 'Run setup first' });

  const secret = totp.decryptSecret(db, row.encrypted_secret);
  if (!totp.verifyTOTP(secret, token)) return res.status(400).json({ error: 'Invalid code. Try again.' });

  db.prepare('UPDATE totp_secrets SET enabled = 1 WHERE user_id = ?').run(req.session.userId);
  res.json({ ok: true, message: '2FA enabled' });
});

app.post('/api/auth/totp/disable', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const bcrypt = require('bcryptjs');
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid password' });
  db.prepare('DELETE FROM totp_secrets WHERE user_id = ?').run(req.session.userId);
  res.json({ ok: true, message: '2FA disabled' });
});

app.get('/api/auth/totp/status', (req, res) => {
  const row = db.prepare('SELECT enabled FROM totp_secrets WHERE user_id = ?').get(req.session.userId);
  res.json({ enabled: !!(row && row.enabled) });
});

// ── Audit logging for mutating requests ──
app.use(auditLog.middleware());

// ── REST Routes (Original) ──
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/files', require('./routes/files'));
app.use('/api/code', require('./routes/code'));
app.use('/api/system', require('./routes/system'));
app.use('/api/agents', require('./routes/agents'));
app.use('/api/notebooks', require('./routes/notebooks'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/nova', require('./routes/nova'));
app.use('/api/workflows', require('./routes/workflows'));
app.use('/api/plugins', require('./routes/plugins'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/search', require('./routes/search'));
app.use('/api/ssh', require('./routes/ssh'));

// ── REST Routes (Wave 4) ──
app.use('/api/llm', require('./routes/llm'));
app.use('/api/memory', require('./routes/memory'));
app.use('/api/canvas', require('./routes/canvas'));
app.use('/api/browser', require('./routes/browser'));
app.use('/api/channels', require('./routes/channels'));
app.use('/api/mcp', require('./routes/mcp'));
app.use('/api/doctor', require('./routes/doctor'));
app.use('/api/discovery', require('./routes/discovery'));
app.use('/api/remote', require('./routes/remote'));
app.use('/api/monitor', require('./routes/monitor'));
app.use('/api/http', require('./routes/http'));
app.use('/api/vault', require('./routes/vault'));
app.use('/api/db', require('./routes/dbExplorer'));
app.use('/api/docker', require('./routes/docker'));
app.use('/api/git', require('./routes/git'));
app.use('/api/logs', require('./routes/logViewer'));
app.use('/api/toolkit', require('./routes/devToolkit'));
app.use('/api/cron', require('./routes/cron'));
app.use('/api/processes', require('./routes/processManager'));
app.use('/api/net', require('./routes/netTools'));
app.use('/api/snippets', require('./routes/snippets'));
app.use('/api/env', require('./routes/envManager'));

// ── REST Routes (Wave 7) ──
app.use('/api/ws', require('./routes/wsClient'));
app.use('/api/md', require('./routes/markdownEditor'));
app.use('/api/mock', require('./routes/mockServer'));
app.use('/api/deps', require('./routes/depAuditor'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/bookmarks', require('./routes/bookmarks'));

// ── REST Routes (Wave 8) ──
app.use('/api/load', require('./routes/loadTester'));
app.use('/api/data', require('./routes/dataViewer'));
app.use('/api/text', require('./routes/textTransform'));
app.use('/api/clipboard', require('./routes/clipboard'));
app.use('/api/pomodoro', require('./routes/pomodoro'));
app.use('/api/links', require('./routes/linkChecker'));

// ── REST Routes (Wave 9) ──
app.use('/api/regex', require('./routes/regexTester'));
app.use('/api/jwt', require('./routes/jwtDebugger'));
app.use('/api/diff', require('./routes/diffViewer'));
app.use('/api/images', require('./routes/imageTools'));
app.use('/api/cron-expr', require('./routes/cronBuilder'));
app.use('/api/colors', require('./routes/colorTools'));

// ── REST Routes (Wave 10) ──
app.use('/api/base64', require('./routes/base64'));
app.use('/api/hash', require('./routes/hash'));
app.use('/api/uuid', require('./routes/uuid'));
app.use('/api/json', require('./routes/json'));
app.use('/api/yaml', require('./routes/yaml'));
app.use('/api/lorem', require('./routes/lorem'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/backup', require('./routes/backup'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/docs', require('./routes/apiDocs'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/webhooks', require('./routes/webhooks'));

// ── AI Agent Chat ──
app.use('/api/chat', require('./routes/chat'));

// ── Restore LLM settings from DB (if user configured via UI) ──
try {
  const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (adminUser) {
    const llmSettings = {};
    const rows = db.prepare("SELECT key, value FROM settings WHERE user_id = ? AND key LIKE 'llm_%'").all(adminUser.id);
    rows.forEach(r => { try { llmSettings[r.key] = JSON.parse(r.value); } catch { llmSettings[r.key] = r.value; } });
    if (llmSettings.llm_provider) {
      const envMap = { ollama: null, openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', xai: 'XAI_API_KEY' };
      const modelMap = { ollama: 'OLLAMA_MODEL', openai: 'OPENAI_MODEL', gemini: 'GEMINI_MODEL', anthropic: 'ANTHROPIC_MODEL', xai: 'XAI_MODEL' };
      if (!process.env.LLM_PROVIDERS) process.env.LLM_PROVIDERS = llmSettings.llm_provider;
      if (llmSettings.llm_apikey && envMap[llmSettings.llm_provider]) {
        const envKey = envMap[llmSettings.llm_provider];
        if (!process.env[envKey]) process.env[envKey] = llmSettings.llm_apikey;
        if (!process.env.LLM_API_KEY) process.env.LLM_API_KEY = llmSettings.llm_apikey;
      }
      if (llmSettings.llm_model && modelMap[llmSettings.llm_provider]) {
        if (!process.env[modelMap[llmSettings.llm_provider]]) process.env[modelMap[llmSettings.llm_provider]] = llmSettings.llm_model;
      }
      if (llmSettings.llm_base_url && !process.env.LLM_BASE_URL) process.env.LLM_BASE_URL = llmSettings.llm_base_url;
      const llmService = require('./services/llmService');
      llmService.setProviderOrder([llmSettings.llm_provider]);
    }
  }
} catch {}

// ── Serve SPA ──
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Express error middleware ──
app.use((err, req, res, next) => {
  logger.error('Express error', { error: err.message, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
});

// ── WebSocket: Terminal + Live System ──
const wss = new WebSocketServer({ noServer: true });

// Notebook collaboration: track clients per notebook
const notebookClients = new Map(); // notebookId -> Set<ws>

server.on('upgrade', (request, socket, head) => {
  const parsed = url.parse(request.url);
  const pathname = parsed.pathname;

  const isAllowed = pathname === '/ws/terminal' || pathname === '/ws/system' || pathname.startsWith('/ws/notebook/') || pathname === '/ws/remote' || pathname === '/ws/monitor';
  if (!isAllowed) { socket.destroy(); return; }

  // WebSocket authentication
  const session = auth.authenticateWs(request, db);
  if (!session && auth.hasUsers(db)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, pathname);
  });
});

// Terminal sessions
const { spawn: cpSpawn } = require('child_process');
const terminalSessions = new Map();

// Clean env for terminals — remove vars that block nested tools
const terminalEnv = { ...process.env };
delete terminalEnv.CLAUDECODE;
delete terminalEnv.CLAUDE_CODE;

// Try to load node-pty, fall back to child_process
let ptyAvailable = false;
let pty;
try {
  pty = require('node-pty');
  // Quick test to see if it actually works
  const test = pty.spawn('/bin/sh', ['-c', 'exit 0'], { name: 'xterm-256color', cols: 10, rows: 10, cwd: '/tmp' });
  test.kill();
  ptyAvailable = true;
  logger.info('Using node-pty for terminal');
} catch {
  logger.info('Using child_process fallback for terminal');
}

wss.on('connection', (ws, request, pathname) => {
  if (pathname === '/ws/terminal') {
    const params = new URLSearchParams(url.parse(request.url).query);
    const ssh = params.get('ssh');
    if (ssh === 'true') {
      handleSSHTerminal(ws, request);
    } else if (ptyAvailable) {
      handleTerminalPty(ws, request);
    } else {
      handleTerminalFallback(ws, request);
    }
  } else if (pathname === '/ws/system') {
    handleSystemStream(ws);
  } else if (pathname === '/ws/remote') {
    handleRemoteDesktop(ws, request);
  } else if (pathname === '/ws/monitor') {
    handleMonitorStream(ws);
  } else if (pathname.startsWith('/ws/notebook/')) {
    const notebookId = pathname.split('/ws/notebook/')[1];
    handleNotebookCollab(ws, notebookId);
  }
});

// PTY-based terminal (if node-pty works)
function handleTerminalPty(ws, request) {
  const params = new URLSearchParams(url.parse(request.url).query);
  const cols = parseInt(params.get('cols')) || 120;
  const rows = parseInt(params.get('rows')) || 30;
  const cwd = params.get('cwd') || process.env.HOME || '/';
  const shell = process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash';
  const sessionId = require('uuid').v4();

  const term = pty.spawn(shell, [], {
    name: 'xterm-256color', cols, rows, cwd,
    env: { ...terminalEnv, TERM: 'xterm-256color' },
  });

  terminalSessions.set(sessionId, term);
  ws.send(JSON.stringify({ type: 'session', id: sessionId }));

  term.onData((data) => { try { ws.send(JSON.stringify({ type: 'output', data })); } catch {} });
  term.onExit(({ exitCode }) => { try { ws.send(JSON.stringify({ type: 'exit', code: exitCode })); } catch {} terminalSessions.delete(sessionId); });

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'input') term.write(parsed.data);
      else if (parsed.type === 'resize') term.resize(parsed.cols || 120, parsed.rows || 30);
    } catch { term.write(msg.toString()); }
  });

  ws.on('close', () => { try { term.kill(); } catch {} terminalSessions.delete(sessionId); });
}

// Python PTY bridge fallback — real pseudo-terminal via Python's pty module
function handleTerminalFallback(ws, request) {
  const params = new URLSearchParams(url.parse(request.url).query);
  const cols = parseInt(params.get('cols')) || 120;
  const rows = parseInt(params.get('rows')) || 30;
  const cwd = params.get('cwd') || process.env.HOME || '/';
  const sessionId = require('uuid').v4();
  const readline = require('readline');

  const bridgePath = path.join(__dirname, 'pty-bridge.py');
  const proc = cpSpawn('python3', [bridgePath, String(cols), String(rows), cwd], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  terminalSessions.set(sessionId, proc);
  ws.send(JSON.stringify({ type: 'session', id: sessionId }));

  // Read JSON lines from bridge stdout
  const rl = readline.createInterface({ input: proc.stdout });
  rl.on('line', (line) => {
    try {
      const msg = JSON.parse(line);
      ws.send(JSON.stringify(msg));
    } catch {}
  });

  proc.stderr.on('data', (d) => {
    try { ws.send(JSON.stringify({ type: 'output', data: d.toString() })); } catch {}
  });

  proc.on('close', (code) => {
    try { ws.send(JSON.stringify({ type: 'exit', code: code || 0 })); } catch {}
    terminalSessions.delete(sessionId);
  });

  proc.on('error', (err) => {
    try { ws.send(JSON.stringify({ type: 'output', data: `\r\nError: ${err.message}\r\n` })); } catch {}
  });

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      // Forward to bridge as JSON line
      proc.stdin.write(JSON.stringify(parsed) + '\n');
    } catch {}
  });

  ws.on('close', () => {
    try { proc.kill(); } catch {}
    terminalSessions.delete(sessionId);
  });
}

// ── SSH Terminal via PTY ──
function handleSSHTerminal(ws, request) {
  const params = new URLSearchParams(url.parse(request.url).query);
  const host = params.get('host');
  const sshUser = params.get('user');
  const port = params.get('port') || '22';
  const keyPath = params.get('keyPath');
  const cols = parseInt(params.get('cols')) || 120;
  const rows = parseInt(params.get('rows')) || 30;
  const sessionId = require('uuid').v4();

  if (!host || !sshUser) {
    ws.send(JSON.stringify({ type: 'output', data: '\r\nError: host and user required\r\n' }));
    ws.close();
    return;
  }

  const args = [];
  if (keyPath) args.push('-i', keyPath);
  args.push('-o', 'StrictHostKeyChecking=accept-new', '-p', port, `${sshUser}@${host}`);

  if (ptyAvailable) {
    const term = pty.spawn('ssh', args, {
      name: 'xterm-256color', cols, rows,
      env: { ...terminalEnv, TERM: 'xterm-256color' },
    });
    terminalSessions.set(sessionId, term);
    ws.send(JSON.stringify({ type: 'session', id: sessionId, ssh: true }));

    term.onData((data) => { try { ws.send(JSON.stringify({ type: 'output', data })); } catch {} });
    term.onExit(({ exitCode }) => { try { ws.send(JSON.stringify({ type: 'exit', code: exitCode })); } catch {} terminalSessions.delete(sessionId); });

    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'input') term.write(parsed.data);
        else if (parsed.type === 'resize') term.resize(parsed.cols || 120, parsed.rows || 30);
      } catch { term.write(msg.toString()); }
    });
    ws.on('close', () => { try { term.kill(); } catch {} terminalSessions.delete(sessionId); });
  } else {
    // Fallback: spawn ssh directly
    const proc = cpSpawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    terminalSessions.set(sessionId, proc);
    ws.send(JSON.stringify({ type: 'session', id: sessionId, ssh: true }));

    proc.stdout.on('data', (d) => { try { ws.send(JSON.stringify({ type: 'output', data: d.toString() })); } catch {} });
    proc.stderr.on('data', (d) => { try { ws.send(JSON.stringify({ type: 'output', data: d.toString() })); } catch {} });
    proc.on('close', (code) => { try { ws.send(JSON.stringify({ type: 'exit', code: code || 0 })); } catch {} terminalSessions.delete(sessionId); });

    ws.on('message', (msg) => {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'input') proc.stdin.write(parsed.data);
      } catch {}
    });
    ws.on('close', () => { try { proc.kill(); } catch {} terminalSessions.delete(sessionId); });
  }
}

// ── Remote Desktop via WebSocket ──
function handleRemoteDesktop(ws, request) {
  const clientId = remoteDesktop.addClient(ws);
  remoteDesktop.logSession(db, clientId, 'connected', {
    ip: request.socket.remoteAddress,
    userAgent: request.headers['user-agent'],
  });

  ws.on('message', (msg) => {
    // Binary messages are ignored (server sends binary frames, not receives)
    if (Buffer.isBuffer(msg) || msg instanceof ArrayBuffer) return;
    remoteDesktop.handleMessage(ws, msg.toString());
  });

  ws.on('close', () => {
    remoteDesktop.logSession(db, clientId, 'disconnected');
    remoteDesktop.removeClient(ws);
  });

  ws.on('error', () => {
    remoteDesktop.removeClient(ws);
  });
}

// ── Live Monitor via WebSocket ──
function handleMonitorStream(ws) {
  monitor.addMonitorClient(ws);
  monitor.startLiveMonitoring();

  ws.on('close', () => {
    monitor.removeMonitorClient(ws);
  });

  ws.on('error', () => {
    monitor.removeMonitorClient(ws);
  });
}

// ── Notebook Collaboration via WebSocket ──
function handleNotebookCollab(ws, notebookId) {
  if (!notebookClients.has(notebookId)) notebookClients.set(notebookId, new Set());
  const clients = notebookClients.get(notebookId);
  clients.add(ws);

  // Send current notebook state
  try {
    const nb = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(notebookId);
    if (nb) {
      const cells = typeof nb.cells === 'string' ? JSON.parse(nb.cells) : nb.cells;
      ws.send(JSON.stringify({ type: 'notebook_state', notebook: { ...nb, cells } }));
    }
  } catch {}

  // Broadcast presence
  broadcastToNotebook(notebookId, { type: 'presence', count: clients.size }, ws);

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.type === 'cell_edit') {
        // Save to DB (last-write-wins)
        try {
          const nb = db.prepare('SELECT cells FROM notebooks WHERE id = ?').get(notebookId);
          if (nb) {
            const cells = typeof nb.cells === 'string' ? JSON.parse(nb.cells) : nb.cells;
            const cell = cells.find(c => c.id === parsed.cellId);
            if (cell) {
              cell.source = parsed.content;
              db.prepare('UPDATE notebooks SET cells = ?, updated_at = datetime(\'now\') WHERE id = ?')
                .run(JSON.stringify(cells), notebookId);
            }
          }
        } catch {}
        // Broadcast to others
        broadcastToNotebook(notebookId, parsed, ws);
      } else if (parsed.type === 'cursor') {
        broadcastToNotebook(notebookId, parsed, ws);
      }
    } catch {}
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (clients.size === 0) notebookClients.delete(notebookId);
    else broadcastToNotebook(notebookId, { type: 'presence', count: clients.size });
  });
}

function broadcastToNotebook(notebookId, message, excludeWs) {
  const clients = notebookClients.get(notebookId);
  if (!clients) return;
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client !== excludeWs && client.readyState === 1) {
      try { client.send(data); } catch {}
    }
  }
}

// ── System History Ring Buffer (60 snapshots) ──
const systemHistory = [];
const MAX_HISTORY = 60;
let _prevCpuTimes = null;
let _prevNetBytes = null;

// Async network/battery cache — updated in background, read synchronously
let _cachedNetBytes = { in: 0, out: 0 };
let _cachedBattery = null;
const { exec: execAsync } = require('child_process');

function _updateNetBytesAsync() {
  execAsync("netstat -ib 2>/dev/null | awk 'NR>1 && $1!~/lo/{in+=$7;out+=$10}END{print in,out}'", { encoding: 'utf8', timeout: 3000 }, (err, stdout) => {
    if (err || !stdout) return;
    const [bi, bo] = stdout.trim().split(' ').map(Number);
    if (!isNaN(bi)) _cachedNetBytes.in = bi;
    if (!isNaN(bo)) _cachedNetBytes.out = bo;
  });
}

function _updateBatteryAsync() {
  if (require('os').platform() !== 'darwin') return;
  execAsync('pmset -g batt 2>/dev/null', { encoding: 'utf8', timeout: 3000 }, (err, stdout) => {
    if (err || !stdout) return;
    const pctMatch = stdout.match(/(\d+)%/);
    const charging = /charging|AC Power/i.test(stdout);
    const remMatch = stdout.match(/(\d+:\d+)\s+remaining/);
    _cachedBattery = { percent: pctMatch ? parseInt(pctMatch[1]) : null, charging, remaining: remMatch ? remMatch[1] : null };
  });
}

// Update every 2 seconds in background (non-blocking)
setInterval(_updateNetBytesAsync, 2000);
setInterval(_updateBatteryAsync, 5000);
_updateNetBytesAsync();
_updateBatteryAsync();

function collectSystemSnapshot() {
  const os = require('os');
  const cpus = os.cpus();

  // CPU percent from idle tick delta
  let cpuPercent = 0;
  const currentTimes = cpus.reduce((acc, c) => {
    acc.idle += c.times.idle;
    acc.total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
    return acc;
  }, { idle: 0, total: 0 });

  if (_prevCpuTimes) {
    const idleDelta = currentTimes.idle - _prevCpuTimes.idle;
    const totalDelta = currentTimes.total - _prevCpuTimes.total;
    cpuPercent = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
  }
  _prevCpuTimes = currentTimes;

  // Network bytes delta (from async cache)
  let netBytesIn = 0, netBytesOut = 0;
  const ifaces = os.networkInterfaces();
  const currentNet = { in: _cachedNetBytes.in, out: _cachedNetBytes.out };

  if (_prevNetBytes) {
    netBytesIn = Math.max(0, currentNet.in - _prevNetBytes.in);
    netBytesOut = Math.max(0, currentNet.out - _prevNetBytes.out);
  }
  _prevNetBytes = { ...currentNet };

  // Battery from async cache
  const battery = _cachedBattery;

  const snapshot = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: os.uptime(),
    loadavg: os.loadavg(),
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    memPercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
    cpuPercent,
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model,
    networkInterfaces: Object.entries(ifaces)
      .flatMap(([name, addrs]) => addrs.filter(a => !a.internal && a.family === 'IPv4')
        .map(a => ({ name, address: a.address }))),
    netBytesIn,
    netBytesOut,
    battery,
    timestamp: Date.now(),
  };

  systemHistory.push(snapshot);
  if (systemHistory.length > MAX_HISTORY) systemHistory.shift();

  return snapshot;
}

// Expose systemHistory for routes
app.locals.systemHistory = systemHistory;
app.locals.collectBattery = () => {
  const os = require('os');
  if (os.platform() !== 'darwin') return null;
  try {
    const { execSync } = require('child_process');
    const raw = execSync('pmset -g batt 2>/dev/null', { encoding: 'utf8', timeout: 2000 });
    const pctMatch = raw.match(/(\d+)%/);
    const charging = /charging|AC Power/i.test(raw);
    const remMatch = raw.match(/(\d+:\d+)\s+remaining/);
    return { percent: pctMatch ? parseInt(pctMatch[1]) : null, charging, remaining: remMatch ? remMatch[1] : null };
  } catch { return null; }
};

function handleSystemStream(ws) {
  // Send history on connect
  if (systemHistory.length > 0) {
    try { ws.send(JSON.stringify({ type: 'system_history', data: systemHistory })); } catch {}
  }

  const interval = setInterval(() => {
    try {
      const snapshot = collectSystemSnapshot();
      ws.send(JSON.stringify({ type: 'system', data: snapshot }));
    } catch {}
  }, 2000);

  ws.on('close', () => clearInterval(interval));
}

// ── Start ──
// ── Seed RBAC roles ──
try { require('./services/rbac').seedRoles(db); } catch {}

// ── Load plugins + skills at startup ──
pluginLoader.setDB(db);
try {
  const plugins = pluginLoader.loadPlugins();
  if (plugins.length) logger.info(`${plugins.length} plugin(s) loaded`);
} catch (err) {
  logger.error('Plugin load error', { error: err.message });
}

try {
  const skills = skillLoader.loadSkills();
  if (skills.length) logger.info(`${skills.length} skill(s) loaded`);
} catch (err) {
  logger.error('Skill load error', { error: err.message });
}

// ── Initialize Wave 4 services ──
vectorMemory.init(db);
cronScheduler.start(db);
const scheduledBackup = require('./services/scheduledBackup');
scheduledBackup.start(db);
const metricsHistory = require('./services/metricsHistory');
metricsHistory.start(db);
const sshTunnel = require('./services/sshTunnel');
webhook.init(db, null); // Handler set per-request in channels route

// Start MCP server if enabled
if (process.env.MCP_ENABLED === 'true') {
  mcpServer.start(db, parseInt(process.env.MCP_PORT) || 3334);
}

// Start discovery if enabled
if (process.env.DISCOVERY_ENABLED === 'true') {
  discovery.start(db);
}

// Auto-start channels marked as running
try {
  const runningChannels = db.prepare("SELECT * FROM channels WHERE status = 'running'").all();
  for (const ch of runningChannels) {
    try {
      if (ch.type === 'telegram') {
        const telegram = require('./services/channels/telegram');
        if (telegram.isConfigured()) telegram.startPolling(() => 'Hyperion channel starting...');
      } else if (ch.type === 'discord') {
        const discord = require('./services/channels/discord');
        if (discord.isConfigured()) discord.connect(() => 'Hyperion channel starting...');
      }
    } catch {}
  }
} catch {}

// ── Session cleanup every 15 minutes ──
const _sessionCleanup = setInterval(() => {
  try { sessionStore.cleanExpired(db); } catch {}
}, 15 * 60 * 1000);

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  const os = require('os');
  const memGB = (os.totalmem() / 1073741824).toFixed(1);
  const memUsed = (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(0);
  // Startup banner goes to stdout for visibility
  process.stdout.write(`
  ╦ ╦╦ ╦╔═╗╔═╗╦═╗╦╔═╗╔╗╦
  ╠═╣╚╦╝╠═╝║╣ ╠╦╝║║ ║║║║
  ╩ ╩ ╩ ╩  ╚═╝╩╚═╩╚═╝╝╚╝
  Your computer, unleashed.

  Host:     ${os.hostname()}
  Platform: ${os.platform()} ${os.arch()}
  CPU:      ${os.cpus().length} cores
  Memory:   ${memUsed}% of ${memGB} GB
  Server:   http://localhost:${PORT}
\n`);
  logger.info('Server started', { port: PORT, host: os.hostname() });
});

// ── Graceful Shutdown ──
function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down`);
  cronScheduler.stop();
  scheduledBackup.stop();
  metricsHistory.stop();
  sshTunnel.stopAll(db);
  discovery.stop();
  mcpServer.stop();
  remoteDesktop.stopCapture();
  monitor.stopLiveMonitoring();
  for (const [, proc] of terminalSessions) { try { proc.kill(); } catch {} }
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Force exit after 5s
  setTimeout(() => { process.exit(1); }, 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ── Global Error Handlers ──
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});
