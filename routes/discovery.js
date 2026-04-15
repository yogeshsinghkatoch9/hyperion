const express = require('express');
const router = express.Router();
const discovery = require('../services/discovery');

// List discovered nodes
router.get('/nodes', (req, res) => {
  res.json(discovery.getNodes());
});

// Trigger manual scan
router.post('/scan', (req, res) => {
  const nodes = discovery.scan();
  res.json({ ok: true, nodes });
});

// Toggle mDNS advertising
router.put('/advertise', (req, res) => {
  const { enabled } = req.body;
  discovery.setAdvertising(!!enabled);
  res.json({ ok: true, advertising: !!enabled });
});

// Discovery status
router.get('/status', (req, res) => {
  res.json({ running: discovery.isRunning(), nodes: discovery.getNodes().length });
});

module.exports = router;
