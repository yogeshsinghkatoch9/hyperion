const { v4: uuidv4 } = require('uuid');
const http = require('http');

let _server = null;
let _port = 0;
let _requestLog = [];
const MAX_LOG = 200;

const VALID_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

// ── Path Sanitization ──
function sanitizePath(p) {
  if (!p || typeof p !== 'string') return '/';
  let clean = p.trim();
  if (!clean.startsWith('/')) clean = '/' + clean;
  // Remove double slashes
  clean = clean.replace(/\/+/g, '/');
  // Remove trailing slash (except root)
  if (clean.length > 1 && clean.endsWith('/')) clean = clean.slice(0, -1);
  // Remove dangerous chars
  clean = clean.replace(/[^a-zA-Z0-9/_\-.:]/g, '');
  return clean || '/';
}

// ── Route Matching (with path params) ──
function matchRoute(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// ── Response Builder ──
function buildResponse(endpoint, params) {
  let body = endpoint.body || '';
  // Replace :param placeholders in body
  if (params && typeof body === 'string') {
    for (const [k, v] of Object.entries(params)) {
      body = body.replace(new RegExp(`:${k}`, 'g'), v);
    }
  }
  const headers = typeof endpoint.headers === 'string' ? JSON.parse(endpoint.headers) : (endpoint.headers || {});
  if (!headers['content-type'] && !headers['Content-Type']) {
    // Auto-detect content type
    const trimmed = body.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      headers['Content-Type'] = 'application/json';
    } else if (trimmed.startsWith('<')) {
      headers['Content-Type'] = 'text/html';
    } else {
      headers['Content-Type'] = 'text/plain';
    }
  }
  return { status: endpoint.status || 200, body, headers, delay: endpoint.delay_ms || 0 };
}

// ── Validate Status Code ──
function isValidStatus(code) {
  const n = parseInt(code);
  return !isNaN(n) && n >= 100 && n <= 599;
}

// ── Validate Delay ──
function isValidDelay(ms) {
  const n = parseInt(ms);
  return !isNaN(n) && n >= 0 && n <= 30000;
}

// ── Endpoint CRUD ──
function createEndpoint(db, { path, method, status, body, headers, delay_ms }) {
  const id = uuidv4();
  const cleanPath = sanitizePath(path);
  const cleanMethod = (method || 'GET').toUpperCase();
  if (!VALID_METHODS.includes(cleanMethod)) throw new Error('Invalid HTTP method');
  if (status !== undefined && !isValidStatus(status)) throw new Error('Invalid status code');
  if (delay_ms !== undefined && !isValidDelay(delay_ms)) throw new Error('Delay must be 0-30000ms');
  const now = new Date().toISOString();
  db.prepare('INSERT INTO mock_endpoints (id, path, method, status, body, headers, delay_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, cleanPath, cleanMethod, status || 200, body || '', JSON.stringify(headers || {}), delay_ms || 0, now);
  return { id, path: cleanPath, method: cleanMethod };
}

function getEndpoints(db) {
  return db.prepare('SELECT * FROM mock_endpoints ORDER BY created_at DESC').all().map(e => ({
    ...e,
    headers: JSON.parse(e.headers || '{}'),
  }));
}

function getEndpoint(db, id) {
  const row = db.prepare('SELECT * FROM mock_endpoints WHERE id = ?').get(id);
  if (!row) throw new Error('Endpoint not found');
  return { ...row, headers: JSON.parse(row.headers || '{}') };
}

function updateEndpoint(db, id, updates) {
  const ep = getEndpoint(db, id);
  const path = updates.path !== undefined ? sanitizePath(updates.path) : ep.path;
  const method = updates.method !== undefined ? updates.method.toUpperCase() : ep.method;
  if (!VALID_METHODS.includes(method)) throw new Error('Invalid HTTP method');
  const status = updates.status !== undefined ? updates.status : ep.status;
  const body = updates.body !== undefined ? updates.body : ep.body;
  const headers = updates.headers !== undefined ? JSON.stringify(updates.headers) : JSON.stringify(ep.headers);
  const delay_ms = updates.delay_ms !== undefined ? updates.delay_ms : ep.delay_ms;
  db.prepare('UPDATE mock_endpoints SET path=?, method=?, status=?, body=?, headers=?, delay_ms=? WHERE id=?')
    .run(path, method, status, body, headers, delay_ms, id);
  return { id, path, method };
}

function deleteEndpoint(db, id) {
  const r = db.prepare('DELETE FROM mock_endpoints WHERE id = ?').run(id);
  if (r.changes === 0) throw new Error('Endpoint not found');
}

// ── Mock Server Control ──
function startServer(db, port) {
  if (_server) throw new Error('Mock server already running');
  const p = parseInt(port) || 9999;
  if (p < 1024 || p > 65535) throw new Error('Port must be 1024-65535');

  _server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url, `http://localhost:${p}`);
    const reqPath = reqUrl.pathname;
    const reqMethod = req.method.toUpperCase();

    // Find matching endpoint
    const endpoints = db.prepare("SELECT * FROM mock_endpoints WHERE method = ? AND active = 1").all(reqMethod);
    let matched = null;
    let params = {};
    for (const ep of endpoints) {
      const m = matchRoute(ep.path, reqPath);
      if (m !== null) { matched = ep; params = m; break; }
    }

    // Collect request body
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      // Log request
      _requestLog.push({
        method: reqMethod,
        path: reqPath,
        body: body || null,
        matched: !!matched,
        timestamp: new Date().toISOString(),
      });
      if (_requestLog.length > MAX_LOG) _requestLog.shift();

      if (!matched) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No matching mock endpoint' }));
        return;
      }

      const parsed = { ...matched, headers: JSON.parse(matched.headers || '{}') };
      const response = buildResponse(parsed, params);

      const sendResponse = () => {
        res.writeHead(response.status, response.headers);
        res.end(response.body);
      };

      if (response.delay > 0) {
        setTimeout(sendResponse, response.delay);
      } else {
        sendResponse();
      }
    });
  });

  return new Promise((resolve, reject) => {
    _server.on('error', (err) => {
      _server = null;
      reject(err);
    });
    _server.listen(p, () => {
      _port = p;
      resolve({ port: p });
    });
  });
}

function stopServer() {
  if (!_server) throw new Error('Mock server not running');
  return new Promise((resolve) => {
    _server.close(() => {
      _server = null;
      _port = 0;
      resolve({ ok: true });
    });
  });
}

function getServerStatus() {
  return { running: !!_server, port: _port };
}

function getRequestLog() {
  return _requestLog.slice().reverse();
}

function clearRequestLog() {
  _requestLog = [];
}

module.exports = {
  sanitizePath,
  matchRoute,
  buildResponse,
  isValidStatus,
  isValidDelay,
  createEndpoint,
  getEndpoints,
  getEndpoint,
  updateEndpoint,
  deleteEndpoint,
  startServer,
  stopServer,
  getServerStatus,
  getRequestLog,
  clearRequestLog,
  VALID_METHODS,
};
