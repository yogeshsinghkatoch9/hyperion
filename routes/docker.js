const express = require('express');
const router = express.Router();
const docker = require('../services/docker');

// GET /api/docker/status — Docker availability + info
router.get('/status', (req, res) => {
  const available = docker.isDockerAvailable();
  if (!available) return res.json({ available: false });
  const version = docker.getDockerVersion();
  const info = docker.getDockerInfo();
  res.json({ available: true, version, info });
});

// ── Containers ──

// GET /api/docker/containers — List containers
router.get('/containers', (req, res) => {
  try {
    const all = req.query.all !== 'false';
    res.json(docker.listContainers(all));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/docker/containers/:id — Inspect container
router.get('/containers/:id', (req, res) => {
  try {
    res.json(docker.inspectContainer(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/docker/containers/:id/start
router.post('/containers/:id/start', (req, res) => {
  try {
    docker.startContainer(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/docker/containers/:id/stop
router.post('/containers/:id/stop', (req, res) => {
  try {
    docker.stopContainer(req.params.id, req.body?.timeout);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/docker/containers/:id/restart
router.post('/containers/:id/restart', (req, res) => {
  try {
    docker.restartContainer(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/docker/containers/:id/pause
router.post('/containers/:id/pause', (req, res) => {
  try {
    docker.pauseContainer(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/docker/containers/:id/unpause
router.post('/containers/:id/unpause', (req, res) => {
  try {
    docker.unpauseContainer(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/docker/containers/:id
router.delete('/containers/:id', (req, res) => {
  try {
    docker.removeContainer(req.params.id, req.query.force === 'true');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/docker/containers/:id/logs
router.get('/containers/:id/logs', (req, res) => {
  try {
    const logs = docker.getContainerLogs(req.params.id, {
      tail: req.query.tail ? parseInt(req.query.tail) : 200,
      timestamps: req.query.timestamps === 'true',
    });
    res.json({ logs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/docker/containers/:id/stats
router.get('/containers/:id/stats', (req, res) => {
  try {
    const stats = docker.getContainerStats(req.params.id);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/docker/stats — All container stats
router.get('/stats', (req, res) => {
  try {
    res.json(docker.getAllStats());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Images ──

// GET /api/docker/images
router.get('/images', (req, res) => {
  try {
    res.json(docker.listImages());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/docker/images/pull
router.post('/images/pull', (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Image name required' });
    docker.pullImage(image);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/docker/images/:id
router.delete('/images/:id', (req, res) => {
  try {
    docker.removeImage(req.params.id, req.query.force === 'true');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/docker/images/prune
router.post('/images/prune', (req, res) => {
  try {
    const result = docker.pruneImages();
    res.json({ ok: true, output: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Volumes ──

// GET /api/docker/volumes
router.get('/volumes', (req, res) => {
  try {
    res.json(docker.listVolumes());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/docker/volumes/:name
router.get('/volumes/:name', (req, res) => {
  try {
    res.json(docker.inspectVolume(req.params.name));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/docker/volumes/:name
router.delete('/volumes/:name', (req, res) => {
  try {
    docker.removeVolume(req.params.name, req.query.force === 'true');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/docker/volumes/prune
router.post('/volumes/prune', (req, res) => {
  try {
    const result = docker.pruneVolumes();
    res.json({ ok: true, output: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Networks ──

// GET /api/docker/networks
router.get('/networks', (req, res) => {
  try {
    res.json(docker.listNetworks());
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Compose ──

// POST /api/docker/compose/up
router.post('/compose/up', (req, res) => {
  try {
    const { path: composePath } = req.body;
    if (!composePath) return res.status(400).json({ error: 'Compose file path required' });
    const output = docker.composeUp(composePath);
    res.json({ ok: true, output });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/docker/compose/down
router.post('/compose/down', (req, res) => {
  try {
    const { path: composePath } = req.body;
    if (!composePath) return res.status(400).json({ error: 'Compose file path required' });
    const output = docker.composeDown(composePath);
    res.json({ ok: true, output });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/docker/compose/ps
router.post('/compose/ps', (req, res) => {
  try {
    const { path: composePath } = req.body;
    if (!composePath) return res.status(400).json({ error: 'Compose file path required' });
    res.json(docker.composePs(composePath));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
