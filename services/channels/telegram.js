/**
 * Telegram Channel — Bot API long-polling
 * Routes incoming messages through the assistant pipeline.
 * Config: TELEGRAM_BOT_TOKEN env var
 */

let _polling = false;
let _offset = 0;
let _pollTimer = null;
let _onMessage = null;

function getToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

function isConfigured() {
  return !!getToken();
}

async function apiCall(method, body = {}) {
  const token = getToken();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });

  const json = await res.json();
  if (!json.ok) throw new Error(json.description || 'Telegram API error');
  return json.result;
}

async function sendMessage(chatId, text) {
  // Split long messages (Telegram 4096 char limit)
  const chunks = [];
  for (let i = 0; i < text.length; i += 4000) {
    chunks.push(text.slice(i, i + 4000));
  }
  for (const chunk of chunks) {
    await apiCall('sendMessage', { chat_id: chatId, text: chunk, parse_mode: 'Markdown' }).catch(() =>
      apiCall('sendMessage', { chat_id: chatId, text: chunk }) // Retry without Markdown
    );
  }
}

async function poll() {
  if (!_polling) return;

  try {
    const updates = await apiCall('getUpdates', { offset: _offset, timeout: 25, allowed_updates: ['message'] });

    for (const update of updates) {
      _offset = update.update_id + 1;

      if (update.message?.text && _onMessage) {
        const chatId = update.message.chat.id;
        const text = update.message.text;
        const username = update.message.from?.username || 'unknown';

        try {
          const response = await _onMessage(text, { source: 'telegram', chatId, username });
          await sendMessage(chatId, response || 'No response');
        } catch (err) {
          await sendMessage(chatId, `Error: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error('[Telegram] Poll error:', err.message);
  }

  if (_polling) {
    _pollTimer = setTimeout(poll, 1000);
  }
}

function startPolling(onMessage) {
  if (_polling) return;
  if (!isConfigured()) throw new Error('TELEGRAM_BOT_TOKEN not configured');

  _onMessage = onMessage;
  _polling = true;
  console.log('[Telegram] Started polling');
  poll();
}

function stopPolling() {
  _polling = false;
  if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
  console.log('[Telegram] Stopped polling');
}

function getStatus() {
  return { running: _polling, configured: isConfigured() };
}

module.exports = { startPolling, stopPolling, sendMessage, getStatus, isConfigured };
