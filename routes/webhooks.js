/**
 * Webhook Routes — subscription CRUD + delivery log
 */
'use strict';
const express = require('express');
const router = express.Router();
const webhookDispatcher = require('../services/webhookDispatcher');

// GET /api/webhooks — list subscriptions
router.get('/', (req, res) => {
  try { res.json(webhookDispatcher.listSubscriptions(req.app.locals.db)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/webhooks — create subscription
router.post('/', (req, res) => {
  try { res.json(webhookDispatcher.createSubscription(req.app.locals.db, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/webhooks/:id — get subscription
router.get('/:id', (req, res) => {
  try { res.json(webhookDispatcher.getSubscription(req.app.locals.db, req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

// PUT /api/webhooks/:id — update subscription
router.put('/:id', (req, res) => {
  try { res.json(webhookDispatcher.updateSubscription(req.app.locals.db, req.params.id, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/webhooks/:id — delete subscription
router.delete('/:id', (req, res) => {
  try { res.json(webhookDispatcher.deleteSubscription(req.app.locals.db, req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

// POST /api/webhooks/test — dispatch a test event
router.post('/test', async (req, res) => {
  try {
    const results = await webhookDispatcher.dispatch(req.app.locals.db, 'test', { message: 'Test webhook from Hyperion' });
    res.json({ results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/webhooks/:id/deliveries — delivery log for subscription
router.get('/:id/deliveries', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    res.json(webhookDispatcher.getDeliveries(req.app.locals.db, req.params.id, limit));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/webhooks/deliveries/recent — recent deliveries across all
router.get('/deliveries/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    res.json(webhookDispatcher.getRecentDeliveries(req.app.locals.db, limit));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
