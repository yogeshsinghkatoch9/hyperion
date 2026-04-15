const express = require('express');
const router = express.Router();
const net = require('../services/netTools');

// POST /api/net/dns — DNS lookup
router.post('/dns', async (req, res) => {
  try {
    const result = await net.dnsLookup(req.body.hostname || '');
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/net/reverse-dns — Reverse DNS
router.post('/reverse-dns', async (req, res) => {
  try {
    const result = await net.reverseDns(req.body.ip || '');
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/net/ping — Ping host
router.post('/ping', (req, res) => {
  try {
    const result = net.ping(req.body.host || '', req.body.count || 4);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/net/traceroute — Traceroute
router.post('/traceroute', (req, res) => {
  try {
    const result = net.traceroute(req.body.host || '', req.body.maxHops || 20);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/net/whois — Whois lookup
router.post('/whois', (req, res) => {
  try {
    const result = net.whois(req.body.domain || '');
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/net/ssl — SSL certificate check
router.post('/ssl', async (req, res) => {
  try {
    const result = await net.checkSslCert(req.body.host || '', req.body.port || 443);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/net/headers — HTTP headers
router.post('/headers', async (req, res) => {
  try {
    const result = await net.getHttpHeaders(req.body.url || '');
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/net/port-check — Check single port
router.post('/port-check', async (req, res) => {
  try {
    const result = await net.checkPort(req.body.host || '127.0.0.1', req.body.port || 80);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
