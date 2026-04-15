const { v4: uuidv4 } = require('uuid');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const dns = require('dns');

// ── SSRF Protection: Block private/internal IPs ──
function isPrivateIP(hostname) {
  // Block obvious private hostnames
  const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]', 'metadata.google.internal', '169.254.169.254'];
  if (blocked.includes(hostname.toLowerCase())) return true;
  // Check IP ranges: 10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x
  const parts = hostname.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
  }
  return false;
}

// ── Validation ──
function validateConfig(config) {
  const errors = [];
  if (!config.url) errors.push('URL is required');
  else {
    try {
      const parsed = new URL(config.url);
      if (isPrivateIP(parsed.hostname)) errors.push('Cannot target private/internal IP addresses');
      if (!['http:', 'https:'].includes(parsed.protocol)) errors.push('Only HTTP/HTTPS protocols allowed');
    } catch { errors.push('Invalid URL'); }
  }
  const conc = config.concurrency !== undefined ? config.concurrency : 10;
  if (conc < 1 || conc > 500) errors.push('Concurrency must be 1-500');
  const total = config.totalRequests || 100;
  if (total < 1 || total > 10000) errors.push('Total requests must be 1-10000');
  if (config.timeout && (config.timeout < 100 || config.timeout > 60000)) errors.push('Timeout must be 100-60000ms');
  return { valid: errors.length === 0, errors };
}

// ── Percentile ──
function calculatePercentile(sortedArr, p) {
  if (!sortedArr || sortedArr.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(idx, sortedArr.length - 1))];
}

// ── Duration format ──
function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ── Single request ──
function sendRequest(urlStr, method, headers, body, timeout) {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === 'https:' ? https : http;
      const opts = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: method || 'GET',
        headers: { ...headers },
        timeout: timeout || 10000,
      };

      const req = mod.request(opts, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, latency: Date.now() - start, error: null, size: Buffer.byteLength(data) });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 0, latency: Date.now() - start, error: 'timeout' });
      });

      req.on('error', (err) => {
        resolve({ status: 0, latency: Date.now() - start, error: err.message });
      });

      if (body && method !== 'GET') req.write(typeof body === 'string' ? body : JSON.stringify(body));
      req.end();
    } catch (err) {
      resolve({ status: 0, latency: Date.now() - start, error: err.message });
    }
  });
}

// ── Run load test ──
async function runLoadTest(config) {
  const validation = validateConfig(config);
  if (!validation.valid) throw new Error(validation.errors.join(', '));

  // Resolve DNS and verify target is not private (prevents DNS rebinding)
  const parsed = new URL(config.url);
  try {
    const { address } = await new Promise((resolve, reject) => {
      dns.lookup(parsed.hostname, (err, address) => {
        if (err) reject(err); else resolve({ address });
      });
    });
    if (isPrivateIP(address)) throw new Error('Resolved IP is private/internal — request blocked');
  } catch (err) {
    if (err.message.includes('private/internal')) throw err;
    // DNS lookup failure — allow the request to fail naturally
  }

  const { url, method = 'GET', headers = {}, body, concurrency = 10, totalRequests = 100, timeout = 10000 } = config;
  const results = [];
  const startTime = Date.now();
  let completed = 0;

  // Fire requests in batches of concurrency
  while (completed < totalRequests) {
    const batch = Math.min(concurrency, totalRequests - completed);
    const promises = [];
    for (let i = 0; i < batch; i++) {
      promises.push(sendRequest(url, method, headers, body, timeout));
    }
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    completed += batch;
  }

  const totalTime = Date.now() - startTime;
  const latencies = results.filter(r => !r.error).map(r => r.latency).sort((a, b) => a - b);
  const successCount = results.filter(r => r.status >= 200 && r.status < 400).length;
  const errorCount = results.filter(r => r.error || r.status >= 400).length;

  const summary = {
    totalRequests: results.length,
    successCount,
    errorCount,
    successRate: results.length > 0 ? ((successCount / results.length) * 100).toFixed(1) : '0',
    errorRate: results.length > 0 ? ((errorCount / results.length) * 100).toFixed(1) : '0',
    totalTime,
    rps: totalTime > 0 ? ((results.length / totalTime) * 1000).toFixed(1) : '0',
    latency: {
      min: latencies.length > 0 ? Math.min(...latencies) : 0,
      max: latencies.length > 0 ? Math.max(...latencies) : 0,
      avg: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      p50: calculatePercentile(latencies, 50),
      p95: calculatePercentile(latencies, 95),
      p99: calculatePercentile(latencies, 99),
    },
    statusCodes: {},
  };

  // Count status codes
  for (const r of results) {
    const key = r.error ? 'error' : String(r.status);
    summary.statusCodes[key] = (summary.statusCodes[key] || 0) + 1;
  }

  return { results, summary };
}

// ── DB CRUD ──
function saveTest(db, config, summary) {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO load_tests (id, url, method, concurrency, total_requests, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, config.url, config.method || 'GET', config.concurrency || 10, config.totalRequests || 100, JSON.stringify(summary), now);
  return { id, url: config.url, created_at: now };
}

function getTests(db) {
  return db.prepare('SELECT * FROM load_tests ORDER BY created_at DESC').all().map(r => ({
    ...r, summary: JSON.parse(r.summary || '{}'),
  }));
}

function getTest(db, id) {
  const row = db.prepare('SELECT * FROM load_tests WHERE id = ?').get(id);
  if (!row) throw new Error('Test not found');
  return { ...row, summary: JSON.parse(row.summary || '{}') };
}

function deleteTest(db, id) {
  const r = db.prepare('DELETE FROM load_tests WHERE id = ?').run(id);
  if (r.changes === 0) throw new Error('Test not found');
  db.prepare('DELETE FROM load_results WHERE test_id = ?').run(id);
}

module.exports = {
  validateConfig, calculatePercentile, formatDuration, sendRequest,
  runLoadTest, saveTest, getTests, getTest, deleteTest,
};
