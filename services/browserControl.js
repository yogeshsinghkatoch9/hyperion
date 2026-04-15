/**
 * Browser Control — Chrome DevTools Protocol (CDP) over WebSocket
 * No Playwright/Puppeteer dependency — raw CDP.
 * Spawns headless Chrome, connects via WebSocket, provides actions.
 */

const { spawn: cpSpawn } = require('child_process');
const { WebSocket } = require('ws');
const os = require('os');
const path = require('path');

let _session = null;
let _ws = null;
let _process = null;
let _msgId = 1;
let _pendingCommands = new Map();
let _idleTimer = null;
const IDLE_TIMEOUT = 300000; // 5 minutes

// ── Chrome Path Detection ──
function findChromePath() {
  const paths = os.platform() === 'darwin'
    ? [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      ]
    : [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
      ];

  const fs = require('fs');
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function resetIdleTimer() {
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = setTimeout(() => {
    console.log('[Browser] Idle timeout, closing session');
    close();
  }, IDLE_TIMEOUT);
}

// ── CDP Communication ──
function sendCommand(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) {
      return reject(new Error('Browser not connected'));
    }

    const id = _msgId++;
    const timeout = setTimeout(() => {
      _pendingCommands.delete(id);
      reject(new Error(`CDP command timeout: ${method}`));
    }, 30000);

    _pendingCommands.set(id, { resolve, reject, timeout });
    _ws.send(JSON.stringify({ id, method, params }));
    resetIdleTimer();
  });
}

// ── Lifecycle ──
async function launch() {
  if (_session) return _session;

  const chromePath = findChromePath();
  if (!chromePath) throw new Error('Chrome/Chromium not found. Install Google Chrome.');

  // Create temp user data dir
  const fs = require('fs');
  const tmpDir = path.join(os.tmpdir(), `hyperion-chrome-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  return new Promise((resolve, reject) => {
    _process = cpSpawn(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--remote-debugging-port=0',
      `--user-data-dir=${tmpDir}`,
      '--window-size=1280,720',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    _process.stderr.on('data', (d) => {
      stderr += d.toString();
      // Parse the DevTools listening URL
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        const wsUrl = match[1];
        connectCDP(wsUrl).then(resolve).catch(reject);
      }
    });

    _process.on('error', (err) => reject(new Error(`Failed to launch Chrome: ${err.message}`)));
    _process.on('close', () => { _session = null; _process = null; });

    // Timeout
    setTimeout(() => {
      if (!_session) reject(new Error('Chrome launch timeout'));
    }, 15000);
  });
}

async function connectCDP(wsUrl) {
  // Get the page's WS endpoint
  const debugUrl = wsUrl.replace('ws://', 'http://').split('/devtools')[0];
  const res = await fetch(`${debugUrl}/json/list`);
  const pages = await res.json();
  const page = pages.find(p => p.type === 'page') || pages[0];

  if (!page) throw new Error('No browser page found');

  return new Promise((resolve, reject) => {
    _ws = new WebSocket(page.webSocketDebuggerUrl);

    _ws.on('open', async () => {
      _session = { wsUrl, pageUrl: page.url, id: page.id };

      // Handle messages
      _ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg.id && _pendingCommands.has(msg.id)) {
            const { resolve, reject, timeout } = _pendingCommands.get(msg.id);
            clearTimeout(timeout);
            _pendingCommands.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        } catch {}
      });

      // Enable Page domain
      await sendCommand('Page.enable');
      await sendCommand('Runtime.enable');

      resetIdleTimer();
      resolve(_session);
    });

    _ws.on('error', reject);
    _ws.on('close', () => { _session = null; _ws = null; });
  });
}

async function navigate(url) {
  if (!_session) throw new Error('Browser not launched');
  const result = await sendCommand('Page.navigate', { url });
  // Wait for load
  await sendCommand('Page.loadEventFired').catch(() => {});
  await new Promise(r => setTimeout(r, 1000)); // Extra settle time
  return result;
}

async function screenshot() {
  if (!_session) throw new Error('Browser not launched');
  const result = await sendCommand('Page.captureScreenshot', { format: 'png', quality: 80 });
  return result.data; // base64 PNG
}

async function click(selector) {
  if (!_session) throw new Error('Browser not launched');
  // Get element coordinates
  const result = await sendCommand('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2 };
    })()`,
    returnByValue: true,
  });

  const coords = result.result?.value;
  if (!coords) throw new Error(`Element not found: ${selector}`);

  await sendCommand('Input.dispatchMouseEvent', { type: 'mousePressed', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
  await sendCommand('Input.dispatchMouseEvent', { type: 'mouseReleased', x: coords.x, y: coords.y, button: 'left', clickCount: 1 });
  return { clicked: selector, ...coords };
}

async function type(selector, text) {
  if (!_session) throw new Error('Browser not launched');
  // Focus element
  await sendCommand('Runtime.evaluate', {
    expression: `document.querySelector('${selector.replace(/'/g, "\\'")}')?.focus()`,
  });

  for (const char of text) {
    await sendCommand('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
    await sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
  }
  return { typed: text.length };
}

async function evaluate(js) {
  if (!_session) throw new Error('Browser not launched');
  const result = await sendCommand('Runtime.evaluate', { expression: js, returnByValue: true });
  return result.result?.value;
}

async function getPageInfo() {
  if (!_session) throw new Error('Browser not launched');
  const result = await sendCommand('Runtime.evaluate', {
    expression: `({ url: location.href, title: document.title })`,
    returnByValue: true,
  });
  return result.result?.value || {};
}

async function close() {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
  if (_ws) { try { _ws.close(); } catch {} _ws = null; }
  if (_process) { try { _process.kill(); } catch {} _process = null; }
  _session = null;
  _pendingCommands.clear();
}

function isRunning() {
  return !!_session;
}

module.exports = { launch, navigate, screenshot, click, type, evaluate, getPageInfo, close, isRunning, findChromePath };
