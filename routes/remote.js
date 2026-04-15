const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const remoteDesktop = require('../services/remoteDesktop');

// GET /api/remote/status — Current remote desktop status
router.get('/status', (req, res) => {
  const permissions = remoteDesktop.checkPermissions();
  res.json({
    capturing: remoteDesktop.isCapturing(),
    clients: remoteDesktop.getClientCount(),
    config: remoteDesktop.getConfig(),
    screenSize: remoteDesktop.getScreenSize(),
    pinSet: remoteDesktop.hasPinSet(),
    permissions,
    network: remoteDesktop.getNetworkInfo(),
  });
});

// POST /api/remote/start — Start capture manually
router.post('/start', (req, res) => {
  remoteDesktop.startCapture();
  res.json({ ok: true, message: 'Capture started' });
});

// POST /api/remote/stop — Stop capture
router.post('/stop', (req, res) => {
  remoteDesktop.stopCapture();
  res.json({ ok: true, message: 'Capture stopped' });
});

// POST /api/remote/configure — Update FPS/quality/scale
router.post('/configure', (req, res) => {
  const { fps, quality, scale } = req.body;
  remoteDesktop.updateConfig({ fps, quality, scale });
  res.json({ ok: true, config: remoteDesktop.getConfig() });
});

// POST /api/remote/pin — Set PIN
router.post('/pin', async (req, res) => {
  try {
    const { pin } = req.body;
    await remoteDesktop.setPin(pin, bcrypt);
    res.json({ ok: true, message: 'PIN set' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/remote/pin/verify — Verify PIN
router.post('/pin/verify', async (req, res) => {
  const { pin } = req.body;
  const valid = await remoteDesktop.verifyPin(pin, bcrypt);
  res.json({ ok: valid });
});

// DELETE /api/remote/pin — Clear PIN
router.delete('/pin', (req, res) => {
  remoteDesktop.clearPin();
  res.json({ ok: true, message: 'PIN cleared' });
});

// POST /api/remote/wol — Send Wake-on-LAN packet
router.post('/wol', async (req, res) => {
  try {
    const { mac, broadcastAddr, port } = req.body;
    const result = await remoteDesktop.sendWolPacket(mac, broadcastAddr, port);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/remote/wol/devices — List saved WoL devices
router.get('/wol/devices', (req, res) => {
  const devices = remoteDesktop.getWolDevices(req.app.locals.db);
  res.json(devices);
});

// POST /api/remote/wol/devices — Add WoL device
router.post('/wol/devices', (req, res) => {
  const { name, mac, broadcastAddr, port } = req.body;
  if (!name || !mac) return res.status(400).json({ error: 'Name and MAC required' });
  const device = remoteDesktop.addWolDevice(req.app.locals.db, name, mac, broadcastAddr, port);
  res.json({ ok: true, device });
});

// DELETE /api/remote/wol/devices/:id — Delete WoL device
router.delete('/wol/devices/:id', (req, res) => {
  remoteDesktop.deleteWolDevice(req.app.locals.db, req.params.id);
  res.json({ ok: true });
});

// GET /api/remote/network — Network info + tunnel detection
router.get('/network', (req, res) => {
  res.json(remoteDesktop.getNetworkInfo());
});

// GET /api/remote/permissions — Check macOS permissions
router.get('/permissions', (req, res) => {
  res.json(remoteDesktop.checkPermissions());
});

// GET /api/remote/sessions — Recent remote sessions
router.get('/sessions', (req, res) => {
  try {
    const sessions = req.app.locals.db.prepare('SELECT * FROM remote_sessions ORDER BY created_at DESC LIMIT 50').all();
    res.json(sessions);
  } catch {
    res.json([]);
  }
});

module.exports = router;
