const express = require('express');
const router = express.Router();
const vault = require('../services/vault');

// GET /api/vault/status — Lock status + has master password
router.get('/status', (req, res) => {
  res.json({
    initialized: vault.hasMasterPassword(req.app.locals.db),
    unlocked: vault.isUnlocked(),
  });
});

// POST /api/vault/setup — Set master password (first time)
router.post('/setup', (req, res) => {
  try {
    const { password } = req.body;
    if (vault.hasMasterPassword(req.app.locals.db)) {
      return res.status(400).json({ error: 'Master password already set' });
    }
    vault.setupMasterPassword(req.app.locals.db, password);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/vault/unlock — Unlock with master password
router.post('/unlock', (req, res) => {
  try {
    const { password } = req.body;
    vault.unlock(req.app.locals.db, password);
    res.json({ ok: true });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// POST /api/vault/lock — Lock vault
router.post('/lock', (req, res) => {
  vault.lock();
  res.json({ ok: true });
});

// POST /api/vault/auto-lock — Set auto-lock timeout
router.post('/auto-lock', (req, res) => {
  const { minutes } = req.body;
  vault.setAutoLock(minutes || 15);
  res.json({ ok: true, minutes: minutes || 15 });
});

// ── Secrets CRUD ──

// GET /api/vault/secrets — List all secrets (names only, no values)
router.get('/secrets', (req, res) => {
  try {
    const q = req.query.q;
    const secrets = q ? vault.searchSecrets(req.app.locals.db, q) : vault.getSecrets(req.app.locals.db);
    res.json(secrets);
  } catch (err) {
    res.status(err.message === 'Vault is locked' ? 403 : 400).json({ error: err.message });
  }
});

// GET /api/vault/secrets/:id — Get secret with decrypted value
router.get('/secrets/:id', (req, res) => {
  try {
    const secret = vault.getSecret(req.app.locals.db, req.params.id);
    res.json(secret);
  } catch (err) {
    const status = err.message === 'Vault is locked' ? 403 : err.message === 'Secret not found' ? 404 : 400;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/vault/secrets — Add secret
router.post('/secrets', (req, res) => {
  try {
    const { name, value, category, notes } = req.body;
    const result = vault.addSecret(req.app.locals.db, { name, value, category, notes });
    res.json(result);
  } catch (err) {
    res.status(err.message === 'Vault is locked' ? 403 : 400).json({ error: err.message });
  }
});

// PUT /api/vault/secrets/:id — Update secret
router.put('/secrets/:id', (req, res) => {
  try {
    vault.updateSecret(req.app.locals.db, req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.message === 'Vault is locked' ? 403 : 400).json({ error: err.message });
  }
});

// DELETE /api/vault/secrets/:id — Delete secret
router.delete('/secrets/:id', (req, res) => {
  try {
    vault.deleteSecret(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.message === 'Vault is locked' ? 403 : 400).json({ error: err.message });
  }
});

// GET /api/vault/categories — List categories
router.get('/categories', (req, res) => {
  try {
    res.json(vault.getCategories(req.app.locals.db));
  } catch (err) {
    res.status(403).json({ error: err.message });
  }
});

// ── Generator ──

// POST /api/vault/generate/password — Generate password
router.post('/generate/password', (req, res) => {
  const password = vault.generatePassword(req.body);
  res.json({ password });
});

// POST /api/vault/generate/token — Generate token
router.post('/generate/token', (req, res) => {
  const { length, encoding } = req.body;
  const token = vault.generateToken(length, encoding);
  res.json({ token });
});

// GET /api/vault/generate/uuid — Generate UUID
router.get('/generate/uuid', (req, res) => {
  res.json({ uuid: vault.generateUUID() });
});

// ── .env Import/Export ──

// POST /api/vault/import/env — Import .env string
router.post('/import/env', (req, res) => {
  try {
    const { content, category } = req.body;
    const imported = vault.importEnv(req.app.locals.db, content, category);
    res.json({ ok: true, count: imported.length, imported });
  } catch (err) {
    res.status(err.message === 'Vault is locked' ? 403 : 400).json({ error: err.message });
  }
});

// GET /api/vault/export/env — Export as .env string
router.get('/export/env', (req, res) => {
  try {
    const category = req.query.category;
    const env = vault.exportEnv(req.app.locals.db, category);
    res.json({ content: env });
  } catch (err) {
    res.status(err.message === 'Vault is locked' ? 403 : 400).json({ error: err.message });
  }
});

module.exports = router;
