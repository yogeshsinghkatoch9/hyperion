/**
 * Discord Channel — Gateway WebSocket connection (no discord.js dep)
 * Routes incoming messages through the assistant pipeline.
 * Config: DISCORD_BOT_TOKEN, DISCORD_CHANNEL_IDS env vars
 */

const { WebSocket } = require('ws');

let _ws = null;
let _heartbeatTimer = null;
let _sequence = null;
let _sessionId = null;
let _onMessage = null;
let _running = false;

function getToken() {
  return process.env.DISCORD_BOT_TOKEN || '';
}

function getAllowedChannels() {
  return (process.env.DISCORD_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
}

function isConfigured() {
  return !!getToken();
}

async function apiCall(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { Authorization: `Bot ${getToken()}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`https://discord.com/api/v10${endpoint}`, opts);
  if (!res.ok) throw new Error(`Discord API ${res.status}`);
  return res.json();
}

async function sendMessage(channelId, content) {
  // Discord 2000 char limit
  const chunks = [];
  for (let i = 0; i < content.length; i += 1900) {
    chunks.push(content.slice(i, i + 1900));
  }
  for (const chunk of chunks) {
    await apiCall(`/channels/${channelId}/messages`, 'POST', { content: chunk });
  }
}

function heartbeat(interval) {
  _heartbeatTimer = setInterval(() => {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify({ op: 1, d: _sequence }));
    }
  }, interval);
}

function connect(onMessage) {
  if (_running) return;
  if (!isConfigured()) throw new Error('DISCORD_BOT_TOKEN not configured');

  _onMessage = onMessage;
  _running = true;

  _ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

  _ws.on('message', async (data) => {
    const payload = JSON.parse(data);
    const { op, d, s, t } = payload;

    if (s) _sequence = s;

    switch (op) {
      case 10: // Hello
        heartbeat(d.heartbeat_interval);
        // Identify
        _ws.send(JSON.stringify({
          op: 2,
          d: {
            token: getToken(),
            intents: 1 << 9 | 1 << 15, // GUILD_MESSAGES | MESSAGE_CONTENT
            properties: { os: 'linux', browser: 'hyperion', device: 'hyperion' },
          },
        }));
        break;

      case 0: // Dispatch
        if (t === 'READY') {
          _sessionId = d.session_id;
          console.log('[Discord] Connected as', d.user?.username);
        }
        if (t === 'MESSAGE_CREATE') {
          if (d.author.bot) break; // Ignore bots
          const allowed = getAllowedChannels();
          if (allowed.length && !allowed.includes(d.channel_id)) break;

          if (_onMessage) {
            try {
              const response = await _onMessage(d.content, {
                source: 'discord',
                channelId: d.channel_id,
                username: d.author.username,
                guildId: d.guild_id,
              });
              await sendMessage(d.channel_id, response || 'No response');
            } catch (err) {
              await sendMessage(d.channel_id, `Error: ${err.message}`).catch(() => {});
            }
          }
        }
        break;

      case 7: // Reconnect
        disconnect();
        setTimeout(() => connect(onMessage), 5000);
        break;

      case 9: // Invalid session
        disconnect();
        setTimeout(() => connect(onMessage), 5000);
        break;
    }
  });

  _ws.on('close', () => {
    if (_running) {
      console.log('[Discord] Disconnected, reconnecting...');
      setTimeout(() => connect(onMessage), 5000);
    }
  });

  _ws.on('error', (err) => {
    console.error('[Discord] WS error:', err.message);
  });

  console.log('[Discord] Connecting...');
}

function disconnect() {
  _running = false;
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_ws) { try { _ws.close(); } catch {} _ws = null; }
  _sessionId = null;
}

function getStatus() {
  return { running: _running, configured: isConfigured(), connected: _ws?.readyState === WebSocket.OPEN };
}

module.exports = { connect, disconnect, sendMessage, getStatus, isConfigured };
