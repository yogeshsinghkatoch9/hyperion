const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const telegram = require('../services/channels/telegram');
const discord = require('../services/channels/discord');
const webhook = require('../services/channels/webhook');

// ── Message handler: routes to assistant pipeline ──
function createMessageHandler(db) {
  const { translate } = require('../services/commandTranslator');
  const { generateCommand, isConfigured } = require('../services/llmService');

  return async (message, context) => {
    // Try pattern translation first
    const translated = translate(message);
    if (translated.command) {
      return `Command: \`${translated.command}\`\n${translated.description || ''}`;
    }

    // LLM fallback
    if (isConfigured()) {
      const aiResult = await generateCommand(message);
      if (aiResult?.command) {
        return `AI suggests: \`${aiResult.command}\`\n(via ${aiResult.provider})`;
      }
    }

    return `I'm not sure how to help with that. Try rephrasing your request.`;
  };
}

// List active channels
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const channels = db.prepare('SELECT * FROM channels ORDER BY created_at DESC').all();

  // Augment with live status
  const result = channels.map(ch => ({
    ...ch,
    config: JSON.parse(ch.config || '{}'),
    liveStatus: ch.type === 'telegram' ? telegram.getStatus() :
                ch.type === 'discord' ? discord.getStatus() :
                { running: ch.status === 'running' },
  }));

  res.json(result);
});

// Start a channel
router.post('/:type/start', (req, res) => {
  const db = req.app.locals.db;
  const { type } = req.params;
  const handler = createMessageHandler(db);

  try {
    switch (type) {
      case 'telegram':
        telegram.startPolling(handler);
        break;
      case 'discord':
        discord.connect(handler);
        break;
      default:
        return res.status(400).json({ error: `Unknown channel type: ${type}` });
    }

    // Upsert channel record
    const existing = db.prepare("SELECT id FROM channels WHERE type = ?").get(type);
    if (existing) {
      db.prepare("UPDATE channels SET status = 'running' WHERE type = ?").run(type);
    } else {
      db.prepare("INSERT INTO channels (id, type, config, status) VALUES (?, ?, '{}', 'running')")
        .run(uuidv4(), type);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop a channel
router.post('/:type/stop', (req, res) => {
  const db = req.app.locals.db;
  const { type } = req.params;

  switch (type) {
    case 'telegram': telegram.stopPolling(); break;
    case 'discord': discord.disconnect(); break;
    default: return res.status(400).json({ error: `Unknown channel type: ${type}` });
  }

  db.prepare("UPDATE channels SET status = 'stopped' WHERE type = ?").run(type);
  res.json({ ok: true });
});

// Channel status
router.get('/:type/status', (req, res) => {
  const { type } = req.params;
  switch (type) {
    case 'telegram': return res.json(telegram.getStatus());
    case 'discord': return res.json(discord.getStatus());
    default: return res.status(400).json({ error: `Unknown channel type: ${type}` });
  }
});

// Webhook receiver
router.post('/webhook/:id', async (req, res) => {
  try {
    const result = await webhook.handleWebhook(req.params.id, req.body, req.headers);
    res.json(result);
  } catch (err) {
    res.status(err.message === 'Unauthorized' ? 401 : 400).json({ error: err.message });
  }
});

// Create webhook channel
router.post('/webhook', (req, res) => {
  const db = req.app.locals.db;
  const { name, config } = req.body;
  const id = uuidv4();

  db.prepare("INSERT INTO channels (id, type, config, status) VALUES (?, 'webhook', ?, 'running')")
    .run(id, JSON.stringify({ name: name || 'Webhook', ...config }));

  res.json({ id, url: `/api/channels/webhook/${id}` });
});

module.exports = router;
