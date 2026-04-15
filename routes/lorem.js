/* ═══ HYPERION — Lorem / Random Data Routes ═══ */
const express = require('express');
const router = express.Router();
const lorem = require('../services/loremGenerator');

// GET /words — Generate random words
router.get('/words', (req, res) => {
  try {
    const count = parseInt(req.query.count, 10) || 10;
    res.json({ result: lorem.words(count) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /sentences — Generate random sentences
router.get('/sentences', (req, res) => {
  try {
    const count = parseInt(req.query.count, 10) || 3;
    res.json({ result: lorem.sentences(count) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /paragraphs — Generate random paragraphs
router.get('/paragraphs', (req, res) => {
  try {
    const count = parseInt(req.query.count, 10) || 2;
    res.json({ result: lorem.paragraphs(count) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /name — Generate a random name
router.get('/name', (req, res) => {
  try {
    res.json({ result: lorem.name() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /email — Generate a random email
router.get('/email', (req, res) => {
  try {
    res.json({ result: lorem.email() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /phone — Generate a random phone number
router.get('/phone', (req, res) => {
  try {
    res.json({ result: lorem.phone() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /address — Generate a random address
router.get('/address', (req, res) => {
  try {
    res.json({ result: lorem.address() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /company — Generate a random company name
router.get('/company', (req, res) => {
  try {
    res.json({ result: lorem.company() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /date — Generate a random date (optional from/to query params)
router.get('/date', (req, res) => {
  try {
    const { from, to } = req.query;
    res.json({ result: lorem.date(from, to) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /number — Generate a random number (optional min/max query params)
router.get('/number', (req, res) => {
  try {
    const min = req.query.min != null ? parseFloat(req.query.min) : undefined;
    const max = req.query.max != null ? parseFloat(req.query.max) : undefined;
    res.json({ result: lorem.number(min, max) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
