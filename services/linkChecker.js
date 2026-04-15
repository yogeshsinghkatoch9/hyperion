const { v4: uuidv4 } = require('uuid');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// ── URL Validation ──
function isValidUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const u = new URL(urlStr);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return urlStr || '';
  let u = urlStr.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  u = u.replace(/\/+$/, '');
  return u;
}

// ── Result Categorization ──
function categorizeResult(result) {
  if (!result) return 'error';
  if (result.error === 'timeout') return 'timeout';
  if (result.error) return 'error';
  const s = result.status;
  if (s >= 200 && s < 300) return 'ok';
  if (s >= 300 && s < 400) return 'redirect';
  if (s >= 400 && s < 500) return 'client-error';
  if (s >= 500) return 'server-error';
  return 'error';
}

// ── Check Single URL ──
function checkUrl(urlStr, timeout) {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === 'https:' ? https : http;
      const opts = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'HEAD',
        timeout: timeout || 10000,
        headers: { 'User-Agent': 'Hyperion-LinkChecker/1.0' },
      };

      const req = mod.request(opts, (res) => {
        const redirect = res.headers.location || null;
        resolve({
          url: urlStr,
          status: res.statusCode,
          latency: Date.now() - start,
          redirect,
          error: null,
          category: categorizeResult({ status: res.statusCode }),
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ url: urlStr, status: 0, latency: Date.now() - start, redirect: null, error: 'timeout', category: 'timeout' });
      });

      req.on('error', (err) => {
        resolve({ url: urlStr, status: 0, latency: Date.now() - start, redirect: null, error: err.message, category: 'error' });
      });

      req.end();
    } catch (err) {
      resolve({ url: urlStr, status: 0, latency: Date.now() - start, redirect: null, error: err.message, category: 'error' });
    }
  });
}

// ── Batch Check with Concurrency ──
async function checkUrls(urls, concurrency) {
  const conc = Math.max(1, Math.min(concurrency || 5, 50));
  const results = [];
  const queue = [...urls];

  while (queue.length > 0) {
    const batch = queue.splice(0, conc);
    const batchResults = await Promise.all(batch.map(u => checkUrl(u)));
    results.push(...batchResults);
  }

  return results;
}

// ── Extract Links from HTML ──
function extractLinks(html, baseUrl) {
  if (!html || typeof html !== 'string') return [];
  const links = new Set();
  const regex = /href\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:') || href.startsWith('tel:')) continue;
    try {
      if (baseUrl && !href.startsWith('http')) {
        href = new URL(href, baseUrl).href;
      }
      if (href.startsWith('http')) links.add(href);
    } catch { /* skip invalid */ }
  }
  return [...links];
}

// ── Build Summary ──
function buildSummary(results) {
  if (!results || results.length === 0) return { total: 0, ok: 0, redirect: 0, clientError: 0, serverError: 0, timeout: 0, error: 0, fastest: null, slowest: null, totalTime: 0 };
  const categories = { ok: 0, redirect: 0, 'client-error': 0, 'server-error': 0, timeout: 0, error: 0 };
  let totalTime = 0;
  let fastest = results[0];
  let slowest = results[0];

  for (const r of results) {
    const cat = r.category || categorizeResult(r);
    categories[cat] = (categories[cat] || 0) + 1;
    totalTime += r.latency || 0;
    if (r.latency < fastest.latency) fastest = r;
    if (r.latency > slowest.latency) slowest = r;
  }

  return {
    total: results.length,
    ok: categories.ok,
    redirect: categories.redirect,
    clientError: categories['client-error'],
    serverError: categories['server-error'],
    timeout: categories.timeout,
    error: categories.error,
    fastest: fastest ? { url: fastest.url, latency: fastest.latency } : null,
    slowest: slowest ? { url: slowest.url, latency: slowest.latency } : null,
    totalTime,
  };
}

// ── DB CRUD ──
function saveCheck(db, { url, results, summary }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO link_checks (id, url, total_links, summary, results, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, url, (results || []).length, JSON.stringify(summary || {}), JSON.stringify(results || []), now);
  return { id, url, created_at: now };
}

function getChecks(db) {
  return db.prepare('SELECT id, url, total_links, summary, created_at FROM link_checks ORDER BY created_at DESC').all().map(r => ({
    ...r, summary: JSON.parse(r.summary || '{}'),
  }));
}

function getCheck(db, id) {
  const row = db.prepare('SELECT * FROM link_checks WHERE id = ?').get(id);
  if (!row) throw new Error('Check not found');
  return { ...row, summary: JSON.parse(row.summary || '{}'), results: JSON.parse(row.results || '[]') };
}

function deleteCheck(db, id) {
  const r = db.prepare('DELETE FROM link_checks WHERE id = ?').run(id);
  if (r.changes === 0) throw new Error('Check not found');
}

module.exports = {
  isValidUrl, normalizeUrl, categorizeResult,
  checkUrl, checkUrls, extractLinks, buildSummary,
  saveCheck, getChecks, getCheck, deleteCheck,
};
