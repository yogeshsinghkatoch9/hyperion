/**
 * Device Discovery — mDNS-based Hyperion instance discovery
 * Uses dgram UDP multicast (224.0.0.251:5353) — no external deps.
 * Advertises _hyperion._tcp service, discovers other instances.
 */

const dgram = require('dgram');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

let _db = null;
let _socket = null;
let _scanInterval = null;
let _advertising = false;
const MDNS_ADDR = '224.0.0.251';
const MDNS_PORT = 5353;
const NODE_TTL = 300000; // 5 minutes
const SCAN_INTERVAL = 30000; // 30 seconds

const _instanceId = uuidv4();
const _capabilities = ['terminal', 'agents', 'code', 'files', 'notebooks'];

function getLocalIPs() {
  const ips = [];
  const ifaces = os.networkInterfaces();
  for (const [, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs) {
      if (!addr.internal && addr.family === 'IPv4') ips.push(addr.address);
    }
  }
  return ips;
}

function buildAdvertisement(port) {
  return JSON.stringify({
    type: 'hyperion-announce',
    id: _instanceId,
    name: os.hostname(),
    host: getLocalIPs()[0] || '127.0.0.1',
    port: port || parseInt(process.env.PORT) || 3333,
    os: `${os.platform()} ${os.arch()}`,
    version: '1.0.0',
    capabilities: _capabilities,
    timestamp: Date.now(),
  });
}

function parseAnnouncement(data) {
  try {
    const msg = JSON.parse(data.toString());
    if (msg.type !== 'hyperion-announce' || msg.id === _instanceId) return null;
    return msg;
  } catch {
    return null;
  }
}

function start(db) {
  _db = db;

  try {
    _socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    _socket.on('message', (data, rinfo) => {
      const announcement = parseAnnouncement(data);
      if (!announcement) return;

      // Store/update discovered node
      if (_db) {
        const existing = _db.prepare('SELECT id FROM discovered_nodes WHERE id = ?').get(announcement.id);
        if (existing) {
          _db.prepare("UPDATE discovered_nodes SET name = ?, host = ?, port = ?, os = ?, capabilities = ?, last_seen = datetime('now') WHERE id = ?")
            .run(announcement.name, announcement.host, announcement.port, announcement.os, JSON.stringify(announcement.capabilities), announcement.id);
        } else {
          _db.prepare("INSERT INTO discovered_nodes (id, name, host, port, os, capabilities) VALUES (?, ?, ?, ?, ?, ?)")
            .run(announcement.id, announcement.name, announcement.host, announcement.port, announcement.os, JSON.stringify(announcement.capabilities));
        }
      }
    });

    _socket.on('error', (err) => {
      console.error('[Discovery] Socket error:', err.message);
    });

    _socket.bind(MDNS_PORT, () => {
      try {
        _socket.addMembership(MDNS_ADDR);
        _socket.setMulticastTTL(255);
        _socket.setBroadcast(true);
      } catch {}
    });

    // Periodic scan + advertise
    _scanInterval = setInterval(() => {
      if (_advertising) advertise();
      cleanStaleNodes();
    }, SCAN_INTERVAL);

    console.log('  Discovery service started');
  } catch (err) {
    console.error('[Discovery] Failed to start:', err.message);
  }
}

function advertise(port) {
  if (!_socket) return;
  _advertising = true;
  const msg = Buffer.from(buildAdvertisement(port));
  try {
    _socket.send(msg, 0, msg.length, MDNS_PORT, MDNS_ADDR);
  } catch {}
}

function scan() {
  // Send a query to trigger responses
  advertise();
  return getNodes();
}

function stop() {
  _advertising = false;
  if (_scanInterval) { clearInterval(_scanInterval); _scanInterval = null; }
  if (_socket) {
    try { _socket.dropMembership(MDNS_ADDR); } catch {}
    try { _socket.close(); } catch {}
    _socket = null;
  }
}

function cleanStaleNodes() {
  if (!_db) return;
  _db.prepare("DELETE FROM discovered_nodes WHERE last_seen < datetime('now', '-5 minutes')").run();
}

function getNodes() {
  if (!_db) return [];
  return _db.prepare('SELECT * FROM discovered_nodes ORDER BY last_seen DESC').all()
    .map(n => ({ ...n, capabilities: JSON.parse(n.capabilities || '[]') }));
}

function setAdvertising(enabled) {
  _advertising = enabled;
  if (enabled) advertise();
}

function isRunning() {
  return !!_socket;
}

module.exports = { start, stop, scan, getNodes, advertise, setAdvertising, isRunning };
