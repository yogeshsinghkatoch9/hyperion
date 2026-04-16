/**
 * Chat Route — AI agent chat with SSE streaming + tool execution
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const agentLoop = require('../services/agentLoop');

// ── Session CRUD ──

// Create session
router.post('/sessions', (req, res) => {
  const db = req.app.locals.db;
  const { title } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO chat_sessions (id, user_id, title, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, req.session.userId, title || 'New Chat', '[]', now, now);
  res.json({ id, title: title || 'New Chat', created_at: now });
});

// List sessions
router.get('/sessions', (req, res) => {
  const db = req.app.locals.db;
  const sessions = db.prepare('SELECT id, title, created_at, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC')
    .all(req.session.userId);
  res.json(sessions);
});

// Get session messages
router.get('/sessions/:id/messages', (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare('SELECT messages FROM chat_sessions WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.userId);
  if (!row) return res.status(404).json({ error: 'Session not found' });
  const messages = typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages;
  res.json(messages);
});

// Delete session
router.delete('/sessions/:id', (req, res) => {
  const db = req.app.locals.db;
  const result = db.prepare('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.session.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Session not found' });
  res.json({ ok: true });
});

// Update session title
router.patch('/sessions/:id', (req, res) => {
  const db = req.app.locals.db;
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  db.prepare('UPDATE chat_sessions SET title = ?, updated_at = datetime("now") WHERE id = ? AND user_id = ?')
    .run(title, req.params.id, req.session.userId);
  res.json({ ok: true });
});

// ── SSE Streaming Chat ──
router.post('/stream', async (req, res) => {
  const db = req.app.locals.db;
  const { message, sessionId } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  // Get or create session
  let chatSessionId = sessionId;
  if (!chatSessionId) {
    chatSessionId = uuidv4();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO chat_sessions (id, user_id, title, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(chatSessionId, req.session.userId, message.slice(0, 60), '[]', now, now);
  }

  // Load conversation history
  const row = db.prepare('SELECT messages FROM chat_sessions WHERE id = ? AND user_id = ?')
    .get(chatSessionId, req.session.userId);
  if (!row) return res.status(404).json({ error: 'Session not found' });

  let history = typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages;

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send session ID
  res.write(`event: session\ndata: ${JSON.stringify({ sessionId: chatSessionId })}\n\n`);

  // Build conversation messages for LLM (strip tool results from UI format)
  const conversationMessages = history.map(m => ({
    role: m.role,
    content: m.content,
  })).filter(m => m.role === 'user' || m.role === 'assistant');

  let assistantText = '';
  let toolEvents = [];

  try {
    const loop = agentLoop.runAgentLoop(message, conversationMessages, chatSessionId);

    for await (const event of loop) {
      if (res.destroyed) break;

      switch (event.type) {
        case 'provider':
          res.write(`event: provider\ndata: ${JSON.stringify(event.data)}\n\n`);
          break;
        case 'text':
          assistantText += event.data;
          res.write(`event: text\ndata: ${JSON.stringify({ text: event.data })}\n\n`);
          break;
        case 'tool_start':
          toolEvents.push({ type: 'start', ...event.data });
          res.write(`event: tool_start\ndata: ${JSON.stringify(event.data)}\n\n`);
          break;
        case 'tool_result':
          toolEvents.push({ type: 'result', ...event.data });
          res.write(`event: tool_result\ndata: ${JSON.stringify(event.data)}\n\n`);
          break;
        case 'approval_needed':
          res.write(`event: approval_needed\ndata: ${JSON.stringify(event.data)}\n\n`);
          break;
        case 'error':
          res.write(`event: error\ndata: ${JSON.stringify({ error: event.data })}\n\n`);
          break;
        case 'done':
          res.write(`event: done\ndata: ${JSON.stringify(event.data)}\n\n`);
          break;
      }
    }
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  // Save messages to DB
  history.push({ role: 'user', content: message, timestamp: Date.now() });
  if (assistantText || toolEvents.length) {
    history.push({
      role: 'assistant',
      content: assistantText,
      tools: toolEvents.length ? toolEvents : undefined,
      timestamp: Date.now(),
    });
  }

  // Keep last 100 messages to prevent bloat
  if (history.length > 100) history = history.slice(-100);

  try {
    db.prepare('UPDATE chat_sessions SET messages = ?, updated_at = datetime("now") WHERE id = ?')
      .run(JSON.stringify(history), chatSessionId);
  } catch {}

  res.write('event: close\ndata: {}\n\n');
  res.end();
});

// ── Approve/Deny Tool Call ──
router.post('/approve', (req, res) => {
  const { sessionId, approved } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const pending = agentLoop.getPendingApproval(sessionId);
  if (!pending) return res.status(404).json({ error: 'No pending approval' });

  pending.resolve(!!approved);
  res.json({ ok: true, approved: !!approved });
});

module.exports = router;
