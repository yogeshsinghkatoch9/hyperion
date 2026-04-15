/**
 * Hyperion HTTP Client — API Testing Engine
 * Send requests, manage collections, env variables, history, cURL import/export
 */
const { v4: uuidv4 } = require('uuid');

// ═══ ENVIRONMENT VARIABLES ═══

function interpolateEnv(str, envVars) {
  if (!str || !envVars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return envVars[key] !== undefined ? envVars[key] : match;
  });
}

function interpolateRequest(req, envVars) {
  if (!envVars || Object.keys(envVars).length === 0) return req;
  const result = { ...req };
  result.url = interpolateEnv(result.url, envVars);

  if (result.headers && typeof result.headers === 'object') {
    const newHeaders = {};
    for (const [k, v] of Object.entries(result.headers)) {
      newHeaders[interpolateEnv(k, envVars)] = interpolateEnv(v, envVars);
    }
    result.headers = newHeaders;
  }

  if (result.body && typeof result.body === 'string') {
    result.body = interpolateEnv(result.body, envVars);
  }

  return result;
}

// ═══ SEND REQUEST ═══

async function sendRequest(config) {
  const { method = 'GET', url, headers = {}, body, timeout = 30000 } = config;

  if (!url) throw new Error('URL is required');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const fetchOpts = {
    method: method.toUpperCase(),
    headers: { ...headers },
    signal: controller.signal,
    redirect: 'follow',
  };

  // Only add body for methods that support it
  if (body && !['GET', 'HEAD'].includes(fetchOpts.method)) {
    fetchOpts.body = body;
    // Auto-set Content-Type if not set
    if (!Object.keys(fetchOpts.headers).find(k => k.toLowerCase() === 'content-type')) {
      try {
        JSON.parse(body);
        fetchOpts.headers['Content-Type'] = 'application/json';
      } catch {
        fetchOpts.headers['Content-Type'] = 'text/plain';
      }
    }
  }

  const startTime = Date.now();

  try {
    const response = await fetch(url, fetchOpts);
    clearTimeout(timer);
    const elapsed = Date.now() - startTime;

    // Read response body
    const contentType = response.headers.get('content-type') || '';
    let responseBody;
    let bodySize = 0;

    if (contentType.includes('application/json')) {
      const text = await response.text();
      bodySize = Buffer.byteLength(text, 'utf8');
      try {
        responseBody = JSON.parse(text);
      } catch {
        responseBody = text;
      }
    } else {
      const text = await response.text();
      bodySize = Buffer.byteLength(text, 'utf8');
      responseBody = text;
    }

    // Extract response headers
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      time: elapsed,
      size: bodySize,
      redirected: response.redirected,
      url: response.url,
    };
  } catch (err) {
    clearTimeout(timer);
    const elapsed = Date.now() - startTime;

    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw new Error(`Request failed: ${err.message}`);
  }
}

// ═══ CURL PARSING ═══

function parseCurl(curlString) {
  if (!curlString) throw new Error('Empty cURL command');

  // Normalize: remove line continuations and excess whitespace
  let cmd = curlString.replace(/\\\n/g, ' ').replace(/\\\r\n/g, ' ').trim();

  // Remove leading 'curl' keyword
  if (cmd.startsWith('curl ')) cmd = cmd.slice(5).trim();
  else if (cmd.startsWith('curl')) cmd = cmd.slice(4).trim();

  const result = { method: 'GET', url: '', headers: {}, body: null };

  // Tokenize respecting quotes
  const tokens = tokenize(cmd);
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      result.method = (tokens[++i] || 'GET').toUpperCase();
    } else if (token === '-H' || token === '--header') {
      const headerStr = tokens[++i] || '';
      const colonIdx = headerStr.indexOf(':');
      if (colonIdx > 0) {
        const key = headerStr.slice(0, colonIdx).trim();
        const value = headerStr.slice(colonIdx + 1).trim();
        result.headers[key] = value;
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      result.body = tokens[++i] || '';
      if (result.method === 'GET') result.method = 'POST';
    } else if (token === '-u' || token === '--user') {
      const creds = tokens[++i] || '';
      result.headers['Authorization'] = 'Basic ' + Buffer.from(creds).toString('base64');
    } else if (token === '--compressed') {
      // Ignore
    } else if (token === '-L' || token === '--location') {
      // Follow redirects (default behavior)
    } else if (!token.startsWith('-') && !result.url) {
      result.url = token;
    }

    i++;
  }

  return result;
}

function tokenize(str) {
  const tokens = [];
  let i = 0;
  let current = '';

  while (i < str.length) {
    const ch = str[i];

    if (ch === ' ' || ch === '\t') {
      if (current) { tokens.push(current); current = ''; }
      i++;
    } else if (ch === "'" || ch === '"') {
      // Quoted string
      const quote = ch;
      i++;
      let quoted = '';
      while (i < str.length && str[i] !== quote) {
        if (str[i] === '\\' && i + 1 < str.length) {
          quoted += str[i + 1];
          i += 2;
        } else {
          quoted += str[i];
          i++;
        }
      }
      i++; // skip closing quote
      current += quoted;
    } else {
      current += ch;
      i++;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}

// ═══ CURL EXPORT ═══

function toCurl(config) {
  const { method = 'GET', url, headers = {}, body } = config;
  let cmd = 'curl';

  if (method !== 'GET') cmd += ` -X ${method}`;
  cmd += ` '${url}'`;

  for (const [key, value] of Object.entries(headers)) {
    cmd += ` \\\n  -H '${key}: ${value}'`;
  }

  if (body) {
    const escaped = body.replace(/'/g, "'\\''");
    cmd += ` \\\n  -d '${escaped}'`;
  }

  return cmd;
}

// ═══ COLLECTIONS (DB) ═══

function getCollections(db) {
  try {
    return db.prepare('SELECT * FROM http_collections ORDER BY created_at DESC').all()
      .map(c => ({ ...c, requests: JSON.parse(c.requests || '[]') }));
  } catch { return []; }
}

function getCollection(db, id) {
  try {
    const c = db.prepare('SELECT * FROM http_collections WHERE id = ?').get(id);
    if (c) c.requests = JSON.parse(c.requests || '[]');
    return c;
  } catch { return null; }
}

function createCollection(db, name, description) {
  const id = uuidv4();
  db.prepare('INSERT INTO http_collections (id, name, description, requests, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))')
    .run(id, name, description || '', '[]');
  return { id, name, description, requests: [] };
}

function deleteCollection(db, id) {
  db.prepare('DELETE FROM http_collections WHERE id = ?').run(id);
}

function addToCollection(db, collectionId, request) {
  const coll = getCollection(db, collectionId);
  if (!coll) throw new Error('Collection not found');

  const entry = { id: uuidv4(), ...request, addedAt: new Date().toISOString() };
  coll.requests.push(entry);
  db.prepare('UPDATE http_collections SET requests = ? WHERE id = ?')
    .run(JSON.stringify(coll.requests), collectionId);
  return entry;
}

function removeFromCollection(db, collectionId, requestId) {
  const coll = getCollection(db, collectionId);
  if (!coll) throw new Error('Collection not found');

  coll.requests = coll.requests.filter(r => r.id !== requestId);
  db.prepare('UPDATE http_collections SET requests = ? WHERE id = ?')
    .run(JSON.stringify(coll.requests), collectionId);
}

function updateInCollection(db, collectionId, requestId, updates) {
  const coll = getCollection(db, collectionId);
  if (!coll) throw new Error('Collection not found');

  const idx = coll.requests.findIndex(r => r.id === requestId);
  if (idx === -1) throw new Error('Request not found');

  coll.requests[idx] = { ...coll.requests[idx], ...updates };
  db.prepare('UPDATE http_collections SET requests = ? WHERE id = ?')
    .run(JSON.stringify(coll.requests), collectionId);
  return coll.requests[idx];
}

// ═══ HISTORY (DB) ═══

function addHistory(db, entry) {
  const id = uuidv4();
  db.prepare('INSERT INTO http_history (id, method, url, status, time_ms, size_bytes, request_data, response_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))')
    .run(id, entry.method, entry.url, entry.status, entry.time, entry.size,
      JSON.stringify(entry.request || {}),
      JSON.stringify({ status: entry.status, statusText: entry.statusText, headers: entry.responseHeaders, bodyPreview: typeof entry.body === 'string' ? entry.body.slice(0, 1000) : JSON.stringify(entry.body).slice(0, 1000) })
    );
  return id;
}

function getHistory(db, limit = 50) {
  try {
    return db.prepare('SELECT id, method, url, status, time_ms, size_bytes, created_at FROM http_history ORDER BY created_at DESC LIMIT ?').all(limit);
  } catch { return []; }
}

function getHistoryEntry(db, id) {
  try {
    const entry = db.prepare('SELECT * FROM http_history WHERE id = ?').get(id);
    if (entry) {
      entry.request_data = JSON.parse(entry.request_data || '{}');
      entry.response_data = JSON.parse(entry.response_data || '{}');
    }
    return entry;
  } catch { return null; }
}

function clearHistory(db) {
  try { db.prepare('DELETE FROM http_history').run(); } catch {}
}

// ═══ ENVIRONMENTS (DB) ═══

function getEnvironments(db) {
  try {
    return db.prepare('SELECT * FROM http_environments ORDER BY name').all()
      .map(e => ({ ...e, variables: JSON.parse(e.variables || '{}') }));
  } catch { return []; }
}

function createEnvironment(db, name, variables = {}) {
  const id = uuidv4();
  db.prepare('INSERT INTO http_environments (id, name, variables, created_at) VALUES (?, ?, ?, datetime(\'now\'))')
    .run(id, name, JSON.stringify(variables));
  return { id, name, variables };
}

function updateEnvironment(db, id, name, variables) {
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (variables !== undefined) { updates.push('variables = ?'); values.push(JSON.stringify(variables)); }
  if (updates.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE http_environments SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}

function deleteEnvironment(db, id) {
  db.prepare('DELETE FROM http_environments WHERE id = ?').run(id);
}

// ═══ HEADER HELPERS ═══

function parseHeaderString(headerStr) {
  const headers = {};
  if (!headerStr) return headers;

  for (const line of headerStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      headers[trimmed.slice(0, colonIdx).trim()] = trimmed.slice(colonIdx + 1).trim();
    }
  }
  return headers;
}

function headersToString(headers) {
  if (!headers) return '';
  return Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
}

// ═══ COMMON HEADERS ═══
const COMMON_HEADERS = {
  'Content-Type': ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain', 'text/html', 'application/xml'],
  'Accept': ['application/json', '*/*', 'text/html', 'application/xml'],
  'Authorization': ['Bearer <token>', 'Basic <base64>'],
  'Cache-Control': ['no-cache', 'no-store', 'max-age=0'],
  'User-Agent': ['Hyperion/1.0'],
};

// ═══ EXPORTS ═══
module.exports = {
  sendRequest,
  interpolateEnv,
  interpolateRequest,
  parseCurl,
  toCurl,
  tokenize,
  parseHeaderString,
  headersToString,
  COMMON_HEADERS,

  // Collections
  getCollections,
  getCollection,
  createCollection,
  deleteCollection,
  addToCollection,
  removeFromCollection,
  updateInCollection,

  // History
  addHistory,
  getHistory,
  getHistoryEntry,
  clearHistory,

  // Environments
  getEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
};
