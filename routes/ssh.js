const express = require('express');
const router = express.Router();
const ssh = require('../services/ssh');
const sshTunnel = require('../services/sshTunnel');

// Legacy routes (backward compat with api.test.js)
router.get('/', (req, res) => { res.json(ssh.listConnections(req.app.locals.db)); });
router.post('/', (req, res) => {
  try { const r = ssh.saveConnection(req.app.locals.db, req.body); res.json({ ok: true, id: r.id }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
router.put('/:id', (req, res) => {
  try { ssh.updateConnection(req.app.locals.db, req.params.id, req.body); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ error: e.message }); }
});
router.delete('/:id', (req, res) => {
  try { ssh.deleteConnection(req.app.locals.db, req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

// GET /api/ssh/connections — List saved connections
router.get('/connections', (req, res) => {
  res.json(ssh.listConnections(req.app.locals.db));
});

// GET /api/ssh/connections/:id — Get one
router.get('/connections/:id', (req, res) => {
  try { res.json(ssh.getConnection(req.app.locals.db, req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

// POST /api/ssh/connections — Save new connection
router.post('/connections', (req, res) => {
  try { res.json(ssh.saveConnection(req.app.locals.db, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/ssh/connections/:id — Update
router.put('/connections/:id', (req, res) => {
  try { res.json(ssh.updateConnection(req.app.locals.db, req.params.id, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/ssh/connections/:id — Delete
router.delete('/connections/:id', (req, res) => {
  try { res.json(ssh.deleteConnection(req.app.locals.db, req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

// POST /api/ssh/test — Test connection
router.post('/test', (req, res) => {
  try {
    const conn = req.body.id ? ssh.getConnection(req.app.locals.db, req.body.id) : req.body;
    res.json(ssh.testConnection(conn));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/ssh/execute — Execute command
router.post('/execute', (req, res) => {
  try {
    const conn = ssh.getConnection(req.app.locals.db, req.body.connectionId);
    const result = ssh.executeCommand(conn, req.body.command, req.body.timeout);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/ssh/ls — List remote files
router.post('/ls', (req, res) => {
  try {
    const conn = ssh.getConnection(req.app.locals.db, req.body.connectionId);
    res.json(ssh.listRemoteFiles(conn, req.body.path));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/ssh/info — Remote system info
router.post('/info', (req, res) => {
  try {
    const conn = ssh.getConnection(req.app.locals.db, req.body.connectionId);
    res.json(ssh.getRemoteInfo(conn));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/ssh/keys — List SSH keys
router.get('/keys', (req, res) => {
  res.json(ssh.listSshKeys());
});

// GET /api/ssh/known-hosts — List known hosts
router.get('/known-hosts', (req, res) => {
  res.json(ssh.getKnownHosts());
});

// ── SSH Tunnels ──

// GET /api/ssh/tunnels — list tunnels
router.get('/tunnels', (req, res) => {
  try { res.json(sshTunnel.listTunnels(req.app.locals.db)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ssh/tunnels — create tunnel
router.post('/tunnels', (req, res) => {
  try { res.json(sshTunnel.createTunnel(req.app.locals.db, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/ssh/tunnels/:id — get tunnel
router.get('/tunnels/:id', (req, res) => {
  try {
    const tunnel = sshTunnel.getTunnel(req.app.locals.db, req.params.id);
    const status = sshTunnel.getStatus(req.params.id);
    res.json({ ...tunnel, ...status });
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// POST /api/ssh/tunnels/:id/start — start tunnel
router.post('/tunnels/:id/start', (req, res) => {
  try { res.json(sshTunnel.startTunnel(req.app.locals.db, req.params.id)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/ssh/tunnels/:id/stop — stop tunnel
router.post('/tunnels/:id/stop', (req, res) => {
  try { res.json(sshTunnel.stopTunnel(req.app.locals.db, req.params.id)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/ssh/tunnels/:id — delete tunnel
router.delete('/tunnels/:id', (req, res) => {
  try { res.json(sshTunnel.deleteTunnel(req.app.locals.db, req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

module.exports = router;
