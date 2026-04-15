const express = require('express');
const router = express.Router();
const browser = require('../services/browserControl');

// Launch browser
router.post('/launch', async (req, res) => {
  try {
    const session = await browser.launch();
    res.json({ ok: true, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Navigate to URL
router.post('/navigate', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    await browser.navigate(url);
    const info = await browser.getPageInfo();
    res.json({ ok: true, ...info });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Take screenshot
router.post('/screenshot', async (req, res) => {
  try {
    const data = await browser.screenshot();
    res.json({ ok: true, image: data }); // base64 PNG
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Perform action (click, type, evaluate)
router.post('/action', async (req, res) => {
  const { action, selector, text, js } = req.body;
  try {
    let result;
    switch (action) {
      case 'click': result = await browser.click(selector); break;
      case 'type': result = await browser.type(selector, text); break;
      case 'evaluate': result = await browser.evaluate(js); break;
      case 'info': result = await browser.getPageInfo(); break;
      default: return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close browser
router.post('/close', async (req, res) => {
  await browser.close();
  res.json({ ok: true });
});

// Status
router.get('/status', (req, res) => {
  res.json({ running: browser.isRunning(), chromeFound: !!browser.findChromePath() });
});

module.exports = router;
