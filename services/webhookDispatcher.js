/**
 * Webhook Dispatcher — send app events to external URLs
 */
'use strict';
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ── Subscription CRUD ──

function createSubscription(db, { name, url, events = ['*'], headers = {}, secret }) {
  if (!name || !url) throw new Error('Name and URL required');
  const id = uuidv4();
  db.prepare(
    'INSERT INTO webhook_subscriptions (id, name, url, events, headers, secret) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name, url, JSON.stringify(events), JSON.stringify(headers), secret || null);
  return { id, name, url, events, active: true };
}

function listSubscriptions(db) {
  return db.prepare('SELECT * FROM webhook_subscriptions ORDER BY created_at DESC').all().map(r => ({
    ...r,
    events: JSON.parse(r.events || '["*"]'),
    headers: JSON.parse(r.headers || '{}'),
  }));
}

function getSubscription(db, id) {
  const sub = db.prepare('SELECT * FROM webhook_subscriptions WHERE id = ?').get(id);
  if (!sub) throw new Error('Subscription not found');
  return { ...sub, events: JSON.parse(sub.events || '["*"]'), headers: JSON.parse(sub.headers || '{}') };
}

function updateSubscription(db, id, fields) {
  const existing = getSubscription(db, id);
  const updates = {};
  if (fields.name !== undefined) updates.name = fields.name;
  if (fields.url !== undefined) updates.url = fields.url;
  if (fields.events !== undefined) updates.events = JSON.stringify(fields.events);
  if (fields.headers !== undefined) updates.headers = JSON.stringify(fields.headers);
  if (fields.secret !== undefined) updates.secret = fields.secret;
  if (fields.active !== undefined) updates.active = fields.active ? 1 : 0;

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  if (!sets) return existing;
  db.prepare(`UPDATE webhook_subscriptions SET ${sets} WHERE id = ?`).run(...Object.values(updates), id);
  return { ...existing, ...updates };
}

function deleteSubscription(db, id) {
  const info = db.prepare('DELETE FROM webhook_subscriptions WHERE id = ?').run(id);
  if (info.changes === 0) throw new Error('Subscription not found');
  return { deleted: true };
}

// ── Dispatch ──

function signPayload(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function dispatch(db, event, data = {}) {
  const subs = db.prepare(
    "SELECT * FROM webhook_subscriptions WHERE active = 1"
  ).all();

  const results = [];

  for (const sub of subs) {
    const events = JSON.parse(sub.events || '["*"]');
    if (!events.includes('*') && !events.includes(event)) continue;

    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString(), source: 'hyperion' });
    const headers = {
      'Content-Type': 'application/json',
      'X-Hyperion-Event': event,
      ...JSON.parse(sub.headers || '{}'),
    };

    if (sub.secret) {
      headers['X-Hyperion-Signature'] = 'sha256=' + signPayload(payload, sub.secret);
    }

    const deliveryId = uuidv4();
    const startTime = Date.now();

    try {
      const response = await fetch(sub.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000),
      });

      const duration = Date.now() - startTime;
      const responseText = await response.text().catch(() => '');
      const success = response.status >= 200 && response.status < 300;

      db.prepare(
        'INSERT INTO webhook_deliveries (id, subscription_id, event, payload, status_code, response, duration_ms, success) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(deliveryId, sub.id, event, payload, response.status, responseText.slice(0, 2000), duration, success ? 1 : 0);

      results.push({ subscriptionId: sub.id, success, statusCode: response.status, duration });
    } catch (err) {
      const duration = Date.now() - startTime;
      db.prepare(
        'INSERT INTO webhook_deliveries (id, subscription_id, event, payload, status_code, response, duration_ms, success) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(deliveryId, sub.id, event, payload, 0, err.message, duration, 0);

      results.push({ subscriptionId: sub.id, success: false, error: err.message, duration });
    }
  }

  return results;
}

function getDeliveries(db, subscriptionId, limit = 50) {
  return db.prepare(
    'SELECT * FROM webhook_deliveries WHERE subscription_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(subscriptionId, limit);
}

function getRecentDeliveries(db, limit = 50) {
  return db.prepare(
    'SELECT d.*, s.name as subscription_name FROM webhook_deliveries d LEFT JOIN webhook_subscriptions s ON d.subscription_id = s.id ORDER BY d.created_at DESC LIMIT ?'
  ).all(limit);
}

module.exports = {
  createSubscription, listSubscriptions, getSubscription,
  updateSubscription, deleteSubscription,
  dispatch, signPayload, getDeliveries, getRecentDeliveries,
};
