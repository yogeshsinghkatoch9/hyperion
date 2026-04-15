/**
 * Remote Desktop Service
 * Screen capture, input injection, Wake-on-LAN, sleep prevention, client management
 */
const { execSync, exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dgram = require('dgram');
const { v4: uuidv4 } = require('uuid');

// ── State ──
let capturing = false;
let captureInterval = null;
let caffeinateProc = null;
let swiftHelperPath = null;
let swiftHelperReady = false;
const clients = new Map(); // ws -> { id, connectedAt, lastActivity }
let currentConfig = { fps: 10, quality: 60, scale: 0.5 };
let pinHash = null; // bcrypt hash of PIN
let screenSize = null;
const INPUT_RATE_LIMIT = 60; // max events/sec per client
const inputCounters = new Map(); // clientId -> { count, resetTime }
const FRAME_PATH = path.join(os.tmpdir(), 'hyperion_remote_frame.jpg');

// ── Screen Size Detection ──
function getScreenSize() {
  if (screenSize) return screenSize;
  try {
    if (os.platform() === 'darwin') {
      const raw = execSync("system_profiler SPDisplaysDataType 2>/dev/null | grep Resolution", { encoding: 'utf8', timeout: 5000 });
      const match = raw.match(/(\d+)\s*x\s*(\d+)/);
      if (match) {
        screenSize = { width: parseInt(match[1]), height: parseInt(match[2]) };
        return screenSize;
      }
    }
  } catch {}
  screenSize = { width: 1920, height: 1080 };
  return screenSize;
}

// ── Swift Helper Compilation ──
function ensureSwiftHelper() {
  if (swiftHelperReady) return true;
  const srcPath = path.join(__dirname, 'remoteInputHelper.swift');
  const binPath = path.join(__dirname, '..', '.cache', 'remoteInputHelper');

  if (!fs.existsSync(srcPath)) return false;

  // Check if already compiled and up to date
  if (fs.existsSync(binPath)) {
    try {
      const srcStat = fs.statSync(srcPath);
      const binStat = fs.statSync(binPath);
      if (binStat.mtimeMs > srcStat.mtimeMs) {
        swiftHelperPath = binPath;
        swiftHelperReady = true;
        return true;
      }
    } catch {}
  }

  // Compile
  try {
    const cacheDir = path.join(__dirname, '..', '.cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    execSync(`swiftc -O -o "${binPath}" "${srcPath}" -framework CoreGraphics -framework Foundation`, { timeout: 30000 });
    fs.chmodSync(binPath, 0o755);
    swiftHelperPath = binPath;
    swiftHelperReady = true;
    console.log('  Remote: Swift helper compiled');
    return true;
  } catch (err) {
    console.log('  Remote: Swift helper compilation failed, using osascript fallback');
    return false;
  }
}

// ── Screen Capture ──
function captureFrame(quality, scale) {
  try {
    // Try Swift helper first for speed
    if (swiftHelperReady && swiftHelperPath) {
      try {
        execSync(`"${swiftHelperPath}" capture "${FRAME_PATH}" ${quality} ${scale}`, { timeout: 2000 });
        return fs.readFileSync(FRAME_PATH);
      } catch {}
    }

    // Fallback: screencapture (macOS)
    if (os.platform() === 'darwin') {
      // -t jpg: JPEG format, -x: no sound, -C: include cursor
      const scaleFlag = scale < 1 ? `-R0,0,${Math.round(getScreenSize().width * scale)},${Math.round(getScreenSize().height * scale)}` : '';
      execSync(`screencapture -t jpg -x -C ${scaleFlag} "${FRAME_PATH}"`, { timeout: 3000 });

      // Compress with sips if quality < 80
      if (quality < 80) {
        try {
          execSync(`sips -s formatOptions ${quality} "${FRAME_PATH}" --out "${FRAME_PATH}" 2>/dev/null`, { timeout: 2000 });
        } catch {}
      }

      return fs.readFileSync(FRAME_PATH);
    }

    return null;
  } catch (err) {
    return null;
  }
}

// ── Capture Loop ──
function startCapture() {
  if (capturing) return;
  capturing = true;

  // Try to compile Swift helper in background
  try { ensureSwiftHelper(); } catch {}

  // Start caffeinate to prevent sleep
  startCaffeinate();

  // Reset screen size cache
  screenSize = null;
  getScreenSize();

  const tick = () => {
    if (!capturing || clients.size === 0) return;

    const frame = captureFrame(currentConfig.quality, currentConfig.scale);
    if (!frame) return;

    // Send binary frame to all connected clients
    for (const [ws] of clients) {
      try {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(frame, { binary: true });
        }
      } catch {}
    }
  };

  captureInterval = setInterval(tick, Math.max(33, Math.round(1000 / currentConfig.fps)));
  console.log(`  Remote: Capture started (${currentConfig.fps} FPS, ${currentConfig.quality}% quality)`);
}

function stopCapture() {
  capturing = false;
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  stopCaffeinate();

  // Cleanup temp frame
  try { if (fs.existsSync(FRAME_PATH)) fs.unlinkSync(FRAME_PATH); } catch {}
  console.log('  Remote: Capture stopped');
}

function updateConfig(config) {
  if (config.fps) currentConfig.fps = Math.min(30, Math.max(1, config.fps));
  if (config.quality) currentConfig.quality = Math.min(95, Math.max(20, config.quality));
  if (config.scale) currentConfig.scale = Math.min(1, Math.max(0.25, config.scale));

  // Restart interval with new FPS
  if (capturing && captureInterval) {
    clearInterval(captureInterval);
    const tick = () => {
      if (!capturing || clients.size === 0) return;
      const frame = captureFrame(currentConfig.quality, currentConfig.scale);
      if (!frame) return;
      for (const [ws] of clients) {
        try { if (ws.readyState === 1) ws.send(frame, { binary: true }); } catch {}
      }
    };
    captureInterval = setInterval(tick, Math.max(33, Math.round(1000 / currentConfig.fps)));
  }

  // Notify all clients
  broadcastJson({ type: 'config_updated', config: currentConfig });
}

// ── Input Injection ──
function checkRateLimit(clientId) {
  const now = Date.now();
  let counter = inputCounters.get(clientId);
  if (!counter || now > counter.resetTime) {
    counter = { count: 0, resetTime: now + 1000 };
    inputCounters.set(clientId, counter);
  }
  counter.count++;
  return counter.count <= INPUT_RATE_LIMIT;
}

function injectMouse(action, x, y, button) {
  const screen = getScreenSize();
  // Scale coordinates from client canvas to actual screen
  const sx = Math.round(x * screen.width);
  const sy = Math.round(y * screen.height);

  if (swiftHelperReady && swiftHelperPath) {
    try {
      execSync(`"${swiftHelperPath}" mouse ${action} ${sx} ${sy} ${button || 'left'}`, { timeout: 1000 });
      return;
    } catch {}
  }

  // osascript fallback
  try {
    switch (action) {
      case 'click':
        execSync(`osascript -e 'tell application "System Events" to click at {${sx}, ${sy}}'`, { timeout: 1000 });
        break;
      case 'doubleclick':
        execSync(`osascript -e 'tell application "System Events" to click at {${sx}, ${sy}}' -e 'tell application "System Events" to click at {${sx}, ${sy}}'`, { timeout: 1000 });
        break;
      case 'rightclick':
        execSync(`osascript -e 'do shell script "cliclick rc:${sx},${sy} 2>/dev/null || true"'`, { timeout: 1000 });
        break;
      case 'move':
        // osascript can't easily move mouse — skip for fallback
        break;
      case 'mousedown':
      case 'mouseup':
        // Basic click for fallback
        if (action === 'mouseup') {
          execSync(`osascript -e 'tell application "System Events" to click at {${sx}, ${sy}}'`, { timeout: 1000 });
        }
        break;
    }
  } catch {}
}

function injectScroll(x, y, deltaX, deltaY) {
  if (swiftHelperReady && swiftHelperPath) {
    try {
      execSync(`"${swiftHelperPath}" scroll ${Math.round(deltaY)} ${Math.round(deltaX)}`, { timeout: 1000 });
      return;
    } catch {}
  }

  try {
    const dir = deltaY > 0 ? 'down' : 'up';
    const amount = Math.min(10, Math.abs(Math.round(deltaY / 30)));
    for (let i = 0; i < amount; i++) {
      execSync(`osascript -e 'tell application "System Events" to scroll ${dir}'`, { timeout: 500 });
    }
  } catch {}
}

function injectKey(action, key, modifiers = {}) {
  if (action !== 'keydown') return; // Only fire on keydown to avoid doubles

  if (swiftHelperReady && swiftHelperPath) {
    try {
      const modStr = [
        modifiers.shift ? 'shift' : '',
        modifiers.control ? 'control' : '',
        modifiers.option ? 'option' : '',
        modifiers.command ? 'command' : '',
      ].filter(Boolean).join(',') || 'none';
      execSync(`"${swiftHelperPath}" key "${key}" ${modStr}`, { timeout: 1000 });
      return;
    } catch {}
  }

  // osascript fallback
  try {
    const modParts = [];
    if (modifiers.command) modParts.push('command down');
    if (modifiers.option) modParts.push('option down');
    if (modifiers.control) modParts.push('control down');
    if (modifiers.shift) modParts.push('shift down');
    const using = modParts.length ? ` using {${modParts.join(', ')}}` : '';

    // Map special keys to key codes
    const keyCodeMap = {
      'Enter': 36, 'Return': 36, 'Tab': 48, 'Escape': 53, 'Backspace': 51, 'Delete': 117,
      'ArrowUp': 126, 'ArrowDown': 125, 'ArrowLeft': 123, 'ArrowRight': 124,
      'Home': 115, 'End': 119, 'PageUp': 116, 'PageDown': 121,
      'F1': 122, 'F2': 120, 'F3': 99, 'F4': 118, 'F5': 96, 'F6': 97,
      'F7': 98, 'F8': 100, 'F9': 101, 'F10': 109, 'F11': 103, 'F12': 111,
      ' ': 49, 'Space': 49,
    };

    if (keyCodeMap[key] !== undefined) {
      execSync(`osascript -e 'tell application "System Events" to key code ${keyCodeMap[key]}${using}'`, { timeout: 1000 });
    } else if (key.length === 1) {
      // Escape single quotes for osascript
      const escaped = key.replace(/'/g, "'\"'\"'");
      execSync(`osascript -e 'tell application "System Events" to keystroke "${escaped}"${using}'`, { timeout: 1000 });
    }
  } catch {}
}

// ── Wake-on-LAN ──
function buildWolPacket(mac) {
  // Validate and normalize MAC
  const cleaned = mac.replace(/[:\-\.]/g, '');
  if (!/^[0-9a-fA-F]{12}$/.test(cleaned)) throw new Error('Invalid MAC address');

  const macBytes = Buffer.from(cleaned, 'hex');
  const packet = Buffer.alloc(102);

  // 6 bytes of 0xFF
  for (let i = 0; i < 6; i++) packet[i] = 0xff;
  // 16 repetitions of MAC address
  for (let i = 0; i < 16; i++) macBytes.copy(packet, 6 + i * 6);

  return packet;
}

function sendWolPacket(mac, broadcastAddr = '255.255.255.255', port = 9) {
  return new Promise((resolve, reject) => {
    const packet = buildWolPacket(mac);
    const client = dgram.createSocket('udp4');

    client.once('error', (err) => {
      client.close();
      reject(err);
    });

    client.bind(() => {
      client.setBroadcast(true);
      client.send(packet, 0, packet.length, port, broadcastAddr, (err) => {
        client.close();
        if (err) reject(err);
        else resolve({ mac, broadcastAddr, port, packetSize: packet.length });
      });
    });
  });
}

// ── Sleep Prevention ──
function startCaffeinate() {
  if (caffeinateProc) return;
  if (os.platform() !== 'darwin') return;
  try {
    caffeinateProc = spawn('caffeinate', ['-dis'], { stdio: 'ignore', detached: true });
    caffeinateProc.unref();
    caffeinateProc.on('error', () => { caffeinateProc = null; });
    caffeinateProc.on('exit', () => { caffeinateProc = null; });
  } catch {}
}

function stopCaffeinate() {
  if (caffeinateProc) {
    try { caffeinateProc.kill(); } catch {}
    caffeinateProc = null;
  }
}

// ── Client Management ──
function addClient(ws) {
  const id = uuidv4();
  clients.set(ws, { id, connectedAt: Date.now(), lastActivity: Date.now() });

  // Start capture if first client
  if (clients.size === 1) startCapture();

  // Send initial status
  try {
    ws.send(JSON.stringify({
      type: 'remote_status',
      status: 'connected',
      clientId: id,
      config: currentConfig,
      screenSize: getScreenSize(),
      clientCount: clients.size,
    }));
  } catch {}

  return id;
}

function removeClient(ws) {
  const client = clients.get(ws);
  if (client) {
    inputCounters.delete(client.id);
  }
  clients.delete(ws);

  // Stop capture if no clients
  if (clients.size === 0) stopCapture();
}

function broadcastJson(msg) {
  const data = JSON.stringify(msg);
  for (const [ws] of clients) {
    try { if (ws.readyState === 1) ws.send(data); } catch {}
  }
}

// ── WebSocket Message Handler ──
function handleMessage(ws, data) {
  const client = clients.get(ws);
  if (!client) return;
  client.lastActivity = Date.now();

  try {
    const msg = JSON.parse(data);

    switch (msg.type) {
      case 'mouse':
        if (!checkRateLimit(client.id)) return;
        injectMouse(msg.action, msg.x, msg.y, msg.button);
        break;

      case 'scroll':
        if (!checkRateLimit(client.id)) return;
        injectScroll(msg.x, msg.y, msg.deltaX, msg.deltaY);
        break;

      case 'key':
        if (!checkRateLimit(client.id)) return;
        injectKey(msg.action, msg.key, msg.modifiers);
        break;

      case 'configure':
        updateConfig({ fps: msg.fps, quality: msg.quality, scale: msg.scale });
        break;

      default:
        break;
    }
  } catch {}
}

// ── PIN Management ──
async function setPin(pin, bcrypt) {
  if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    throw new Error('PIN must be 4-6 digits');
  }
  pinHash = await bcrypt.hash(pin, 10);
  return true;
}

async function verifyPin(pin, bcrypt) {
  if (!pinHash) return true; // No PIN set, allow access
  if (!pin) return false;
  return bcrypt.compare(pin, pinHash);
}

function clearPin() {
  pinHash = null;
}

function hasPinSet() {
  return !!pinHash;
}

// ── Network Info ──
function getNetworkInfo() {
  const ifaces = os.networkInterfaces();
  const addresses = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs) {
      if (!addr.internal && addr.family === 'IPv4') {
        addresses.push({ name, address: addr.address, mac: addr.mac });
      }
    }
  }

  // Detect cloudflared
  let hasTunnel = false;
  try {
    execSync('which cloudflared', { timeout: 2000 });
    hasTunnel = true;
  } catch {}

  return { addresses, hasTunnel };
}

// ── Permissions Check ──
function checkPermissions() {
  const results = { screenRecording: false, accessibility: false };

  if (os.platform() !== 'darwin') {
    return { screenRecording: true, accessibility: true };
  }

  // Test screen recording by attempting a capture
  try {
    execSync(`screencapture -t jpg -x "${FRAME_PATH}" 2>&1`, { timeout: 5000 });
    if (fs.existsSync(FRAME_PATH)) {
      const stat = fs.statSync(FRAME_PATH);
      results.screenRecording = stat.size > 100; // Real screenshot is > 100 bytes
      try { fs.unlinkSync(FRAME_PATH); } catch {}
    }
  } catch {}

  // Test accessibility — try a benign osascript
  try {
    execSync('osascript -e \'tell application "System Events" to return name of first process\'', { timeout: 3000 });
    results.accessibility = true;
  } catch {}

  return results;
}

// ── WoL Device DB Operations ──
function getWolDevices(db) {
  try {
    return db.prepare('SELECT * FROM wol_devices ORDER BY created_at DESC').all();
  } catch { return []; }
}

function addWolDevice(db, name, mac, broadcastAddr, port) {
  const id = uuidv4();
  db.prepare('INSERT INTO wol_devices (id, name, mac, broadcast_addr, port, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))')
    .run(id, name, mac, broadcastAddr || '255.255.255.255', port || 9);
  return { id, name, mac, broadcastAddr, port };
}

function deleteWolDevice(db, id) {
  db.prepare('DELETE FROM wol_devices WHERE id = ?').run(id);
}

// ── Remote Session Logging ──
function logSession(db, clientId, action, metadata = {}) {
  try {
    const id = uuidv4();
    db.prepare('INSERT INTO remote_sessions (id, client_id, action, metadata, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))')
      .run(id, clientId, action, JSON.stringify(metadata));
  } catch {}
}

// ── Exports ──
module.exports = {
  // Capture
  startCapture,
  stopCapture,
  updateConfig,
  getConfig: () => ({ ...currentConfig }),
  isCapturing: () => capturing,

  // Clients
  addClient,
  removeClient,
  handleMessage,
  getClientCount: () => clients.size,

  // Input
  injectMouse,
  injectKey,
  injectScroll,

  // WoL
  buildWolPacket,
  sendWolPacket,

  // PIN
  setPin,
  verifyPin,
  clearPin,
  hasPinSet,

  // Info
  getScreenSize,
  getNetworkInfo,
  checkPermissions,

  // DB
  getWolDevices,
  addWolDevice,
  deleteWolDevice,
  logSession,
};
