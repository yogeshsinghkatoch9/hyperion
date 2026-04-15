const express = require('express');
const router = express.Router();
const llm = require('../services/llmService');

// List all providers with health status
router.get('/providers', (req, res) => {
  res.json(llm.getProvidersInfo());
});

// Test a specific provider
router.post('/test', async (req, res) => {
  const { provider } = req.body;
  if (!provider) return res.status(400).json({ error: 'Provider name required' });
  const result = await llm.testProvider(provider);
  res.json(result);
});

// Set provider priority order
router.put('/order', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });
  llm.setProviderOrder(order);
  res.json({ ok: true, order: llm.getProviderOrder() });
});

// Get/update prompt injection files
router.get('/prompts', (req, res) => {
  res.json(llm.getPromptFiles());
});

router.put('/prompts', (req, res) => {
  const { name, content } = req.body;
  if (!name || !['boot', 'soul', 'agents'].includes(name)) {
    return res.status(400).json({ error: 'name must be boot, soul, or agents' });
  }
  try {
    llm.savePromptFile(name, content || '');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
