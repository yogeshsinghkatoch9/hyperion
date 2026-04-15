const express = require('express');
const router = express.Router();
const lc = require('../services/linkChecker');

// POST /api/links/check — Check single URL
router.post('/check', async (req, res) => {
  try {
    const { url, timeout } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const normalized = lc.normalizeUrl(url);
    if (!lc.isValidUrl(normalized)) return res.status(400).json({ error: 'Invalid URL' });
    const result = await lc.checkUrl(normalized, timeout);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/links/check-batch — Check multiple URLs
router.post('/check-batch', async (req, res) => {
  try {
    const { urls, concurrency } = req.body;
    if (!urls || !Array.isArray(urls) || urls.length === 0) return res.status(400).json({ error: 'URLs array is required' });
    const normalized = urls.map(u => lc.normalizeUrl(u)).filter(u => lc.isValidUrl(u));
    const results = await lc.checkUrls(normalized, concurrency);
    const summary = lc.buildSummary(results);
    const saved = lc.saveCheck(req.app.locals.db, { url: `batch (${normalized.length} URLs)`, results, summary });
    res.json({ ...saved, results, summary });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/links/crawl — Extract links from page and check them
router.post('/crawl', async (req, res) => {
  try {
    const { url, concurrency } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    const normalized = lc.normalizeUrl(url);
    if (!lc.isValidUrl(normalized)) return res.status(400).json({ error: 'Invalid URL' });

    // Fetch the page HTML
    const mod = normalized.startsWith('https') ? require('https') : require('http');
    const html = await new Promise((resolve, reject) => {
      mod.get(normalized, { timeout: 15000, headers: { 'User-Agent': 'Hyperion-LinkChecker/1.0' } }, (r) => {
        let data = '';
        r.on('data', chunk => { data += chunk; });
        r.on('end', () => resolve(data));
      }).on('error', reject);
    });

    const links = lc.extractLinks(html, normalized);
    const results = await lc.checkUrls(links, concurrency);
    const summary = lc.buildSummary(results);
    const saved = lc.saveCheck(req.app.locals.db, { url: normalized, results, summary });
    res.json({ ...saved, linksFound: links.length, results, summary });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/links — List past checks
router.get('/', (req, res) => {
  res.json(lc.getChecks(req.app.locals.db));
});

// GET /api/links/:id — Single check
router.get('/:id', (req, res) => {
  try {
    res.json(lc.getCheck(req.app.locals.db, req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// DELETE /api/links/:id — Delete check
router.delete('/:id', (req, res) => {
  try {
    lc.deleteCheck(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
