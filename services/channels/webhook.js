/**
 * Webhook Channel — Generic incoming webhook receiver
 * POST /api/channels/webhook/:id → process payload → optional reply
 */

let _db = null;
let _onMessage = null;

function init(db, onMessage) {
  _db = db;
  _onMessage = onMessage;
}

async function handleWebhook(webhookId, payload, headers) {
  if (!_db) throw new Error('Webhook service not initialized');

  // Look up webhook config
  const channel = _db.prepare("SELECT * FROM channels WHERE id = ? AND type = 'webhook'").get(webhookId);
  if (!channel) throw new Error('Webhook not found');

  const config = JSON.parse(channel.config || '{}');

  // Verify auth if configured
  if (config.authHeader && config.authValue) {
    if (headers[config.authHeader.toLowerCase()] !== config.authValue) {
      throw new Error('Unauthorized');
    }
  }

  // Extract message from payload
  const message = typeof payload === 'string' ? payload :
    payload.text || payload.message || payload.content || JSON.stringify(payload);

  if (!_onMessage) return { processed: false, reason: 'No message handler' };

  const response = await _onMessage(message, {
    source: 'webhook',
    webhookId,
    payload,
  });

  // Send reply to configured URL if present
  if (config.replyUrl && response) {
    try {
      const replyHeaders = { 'Content-Type': 'application/json' };
      if (config.replyHeaders) Object.assign(replyHeaders, config.replyHeaders);

      await fetch(config.replyUrl, {
        method: 'POST',
        headers: replyHeaders,
        body: JSON.stringify({ text: response, source: 'hyperion' }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (err) {
      console.error('[Webhook] Reply error:', err.message);
    }
  }

  return { processed: true, response };
}

module.exports = { init, handleWebhook };
