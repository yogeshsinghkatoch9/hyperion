/**
 * Hyperion Monitor — Advanced System Intelligence
 * Process manager, network connections, disk analysis, port scanning, alert engine
 */
const { execSync } = require('child_process');
const os = require('os');
const net = require('net');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ── Process cache ──
let _processCache = null;
let _processCacheTime = 0;
const PROCESS_CACHE_TTL = 1500; // 1.5s

// ── Alert thresholds ──
let alertConfig = {
  cpuWarn: 80,     // % per process
  cpuCrit: 95,
  memWarn: 500,    // MB per process
  memCrit: 1000,
  diskWarn: 85,    // % used
  diskCrit: 95,
  enabled: true,
};

// ═══ PROCESSES ═══

function getProcesses() {
  const now = Date.now();
  if (_processCache && now - _processCacheTime < PROCESS_CACHE_TTL) return _processCache;

  try {
    // macOS/Linux: ps with consistent output
    const raw = execSync(
      'ps -eo pid,ppid,user,%cpu,%mem,rss,vsz,stat,time,command',
      { encoding: 'utf8', timeout: 5000, maxBuffer: 10 * 1024 * 1024 }
    );

    const lines = raw.trim().split('\n');
    const processes = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse fixed-width columns (command can contain spaces)
      const parts = line.split(/\s+/);
      if (parts.length < 10) continue;

      const pid = parseInt(parts[0]);
      const ppid = parseInt(parts[1]);
      const user = parts[2];
      const cpu = parseFloat(parts[3]) || 0;
      const mem = parseFloat(parts[4]) || 0;
      const rss = parseInt(parts[5]) || 0;  // KB
      const vsz = parseInt(parts[6]) || 0;  // KB
      const stat = parts[7];
      const time = parts[8];
      const command = parts.slice(9).join(' ');

      // Extract process name from command
      const name = path.basename(command.split(' ')[0]);

      processes.push({
        pid, ppid, user, cpu, mem, rss, vsz, stat, time,
        command, name,
        rssMB: Math.round(rss / 1024 * 10) / 10,
      });
    }

    // Sort by CPU descending
    processes.sort((a, b) => b.cpu - a.cpu);

    _processCache = processes;
    _processCacheTime = now;
    return processes;
  } catch (err) {
    return _processCache || [];
  }
}

function getProcessTree() {
  const procs = getProcesses();
  const map = new Map();
  const roots = [];

  // Index by PID
  for (const p of procs) {
    map.set(p.pid, { ...p, children: [] });
  }

  // Build tree
  for (const p of procs) {
    const node = map.get(p.pid);
    const parent = map.get(p.ppid);
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function getProcessSummary() {
  const procs = getProcesses();
  const totalCpu = procs.reduce((s, p) => s + p.cpu, 0);
  const totalMemMB = procs.reduce((s, p) => s + p.rssMB, 0);

  // Group by user
  const byUser = {};
  for (const p of procs) {
    if (!byUser[p.user]) byUser[p.user] = { count: 0, cpu: 0, mem: 0 };
    byUser[p.user].count++;
    byUser[p.user].cpu += p.cpu;
    byUser[p.user].mem += p.rssMB;
  }

  // Top 5 CPU
  const topCpu = procs.slice(0, 5).map(p => ({ pid: p.pid, name: p.name, cpu: p.cpu, rssMB: p.rssMB }));

  // Top 5 Memory
  const topMem = [...procs].sort((a, b) => b.rssMB - a.rssMB).slice(0, 5)
    .map(p => ({ pid: p.pid, name: p.name, cpu: p.cpu, rssMB: p.rssMB }));

  return {
    total: procs.length,
    totalCpu: Math.round(totalCpu * 10) / 10,
    totalMemMB: Math.round(totalMemMB),
    cpuCount: os.cpus().length,
    byUser,
    topCpu,
    topMem,
  };
}

function killProcess(pid, signal = 'SIGTERM') {
  if (!pid || pid <= 1) throw new Error('Cannot kill PID ' + pid);

  // Safety: don't kill init, kernel, or Hyperion itself
  if (pid === process.pid) throw new Error('Cannot kill Hyperion process');

  try {
    process.kill(pid, signal);
    // Invalidate cache
    _processCache = null;
    return { ok: true, pid, signal };
  } catch (err) {
    throw new Error(`Failed to kill PID ${pid}: ${err.message}`);
  }
}

function searchProcesses(query) {
  const procs = getProcesses();
  const q = query.toLowerCase();
  return procs.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.command.toLowerCase().includes(q) ||
    p.user.toLowerCase().includes(q) ||
    String(p.pid).includes(q)
  );
}

// ═══ NETWORK ═══

function getNetworkConnections() {
  try {
    // lsof -i -n -P: network connections, no DNS, numeric ports
    const raw = execSync('lsof -i -n -P 2>/dev/null | head -500', {
      encoding: 'utf8', timeout: 8000, maxBuffer: 5 * 1024 * 1024,
    });

    const lines = raw.trim().split('\n');
    const connections = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/\s+/);
      if (parts.length < 9) continue;

      const command = parts[0];
      const pid = parseInt(parts[1]);
      const user = parts[2];
      const type = parts[4]; // IPv4/IPv6
      const name = parts[8] || '';

      // Parse "local->remote (STATE)" format
      let local = '', remote = '', state = '';
      const arrow = name.indexOf('->');
      if (arrow > -1) {
        local = name.substring(0, arrow);
        const rest = name.substring(arrow + 2);
        const parenIdx = rest.indexOf(' (');
        if (parenIdx > -1) {
          remote = rest.substring(0, parenIdx);
          state = rest.substring(parenIdx + 2, rest.length - 1);
        } else {
          remote = rest;
        }
      } else {
        // Listening: just has local address
        local = name.replace(/\s*\(.*\)/, '');
        const stateMatch = name.match(/\((\w+)\)/);
        state = stateMatch ? stateMatch[1] : 'LISTEN';
      }

      connections.push({ command, pid, user, type, local, remote, state });
    }

    return connections;
  } catch {
    return [];
  }
}

function getListeningPorts() {
  try {
    const raw = execSync("lsof -i -n -P 2>/dev/null | grep LISTEN", {
      encoding: 'utf8', timeout: 5000,
    });

    const ports = [];
    const seen = new Set();

    for (const line of raw.trim().split('\n')) {
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;

      const command = parts[0];
      const pid = parseInt(parts[1]);
      const name = parts[8] || '';

      // Extract port from "host:port"
      const portMatch = name.match(/:(\d+)(?:\s|$)/);
      const port = portMatch ? parseInt(portMatch[1]) : null;

      if (port && !seen.has(`${pid}:${port}`)) {
        seen.add(`${pid}:${port}`);
        const host = name.split(':')[0] || '*';
        ports.push({ port, pid, command, host, protocol: 'tcp' });
      }
    }

    ports.sort((a, b) => a.port - b.port);
    return ports;
  } catch {
    return [];
  }
}

function getNetworkSummary() {
  const conns = getNetworkConnections();
  const listening = conns.filter(c => c.state === 'LISTEN');
  const established = conns.filter(c => c.state === 'ESTABLISHED');

  // Group established by remote host
  const byRemote = {};
  for (const c of established) {
    const host = c.remote.split(':')[0] || 'unknown';
    if (!byRemote[host]) byRemote[host] = { count: 0, processes: new Set() };
    byRemote[host].count++;
    byRemote[host].processes.add(c.command);
  }

  // Convert Sets to arrays
  for (const key of Object.keys(byRemote)) {
    byRemote[key].processes = [...byRemote[key].processes];
  }

  return {
    total: conns.length,
    listening: listening.length,
    established: established.length,
    byRemote,
    topConnections: established.slice(0, 20),
  };
}

async function scanPorts(host, portRange = '1-1024', timeout = 1000) {
  const results = [];
  let start = 1, end = 1024;

  // Parse port range
  if (typeof portRange === 'string') {
    const parts = portRange.split('-');
    start = parseInt(parts[0]) || 1;
    end = parts[1] ? parseInt(parts[1]) : start;
  }

  // Limit range to prevent abuse
  end = Math.min(end, start + 1023);

  const scanPort = (port) => new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on('connect', () => {
      results.push({ port, state: 'open' });
      socket.destroy();
      resolve();
    });

    socket.on('timeout', () => { socket.destroy(); resolve(); });
    socket.on('error', () => { socket.destroy(); resolve(); });

    socket.connect(port, host);
  });

  // Scan in batches of 50 for performance
  const ports = [];
  for (let p = start; p <= end; p++) ports.push(p);

  const batchSize = 50;
  for (let i = 0; i < ports.length; i += batchSize) {
    const batch = ports.slice(i, i + batchSize);
    await Promise.all(batch.map(scanPort));
  }

  results.sort((a, b) => a.port - b.port);

  // Try to label common ports
  const commonPorts = {
    21: 'FTP', 22: 'SSH', 23: 'Telnet', 25: 'SMTP', 53: 'DNS',
    80: 'HTTP', 110: 'POP3', 143: 'IMAP', 443: 'HTTPS', 993: 'IMAPS',
    995: 'POP3S', 3306: 'MySQL', 5432: 'PostgreSQL', 6379: 'Redis',
    8080: 'HTTP-Alt', 8443: 'HTTPS-Alt', 27017: 'MongoDB',
    3000: 'Dev', 3333: 'Hyperion', 5000: 'Dev', 8000: 'Dev',
  };

  for (const r of results) {
    r.service = commonPorts[r.port] || '';
  }

  return { host, range: `${start}-${end}`, openPorts: results, scanned: end - start + 1 };
}

// ═══ DISK ═══

function getDiskInfo() {
  try {
    const raw = execSync("df -h 2>/dev/null | grep -v '^Filesystem' | grep -v '^map '", {
      encoding: 'utf8', timeout: 5000,
    });

    const disks = [];
    for (const line of raw.trim().split('\n')) {
      const parts = line.split(/\s+/);
      if (parts.length < 6) continue;

      const filesystem = parts[0];
      const size = parts[1];
      const used = parts[2];
      const available = parts[3];
      const usePercent = parseInt(parts[4]) || 0;
      const mountpoint = parts.slice(5).join(' ');

      // Skip virtual/tiny filesystems
      if (filesystem.startsWith('/dev/') || filesystem === 'tmpfs') {
        disks.push({ filesystem, size, used, available, usePercent, mountpoint });
      }
    }

    return disks;
  } catch {
    return [];
  }
}

function getDiskUsage(dirPath, depth = 1) {
  const target = dirPath || os.homedir();
  try {
    const raw = execSync(`du -h -d ${depth} "${target}" 2>/dev/null | sort -hr | head -30`, {
      encoding: 'utf8', timeout: 15000,
    });

    const entries = [];
    for (const line of raw.trim().split('\n')) {
      const match = line.match(/^\s*([\d.]+\w?)\s+(.+)$/);
      if (match) {
        entries.push({ size: match[1], path: match[2] });
      }
    }

    return { basePath: target, entries };
  } catch (err) {
    return { basePath: target, entries: [], error: err.message };
  }
}

function getLargestFiles(dirPath, count = 20) {
  const target = dirPath || os.homedir();
  try {
    const raw = execSync(
      `find "${target}" -maxdepth 3 -type f -exec ls -lhS {} + 2>/dev/null | head -${count}`,
      { encoding: 'utf8', timeout: 15000 }
    );

    const files = [];
    for (const line of raw.trim().split('\n')) {
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;
      const size = parts[4];
      const filePath = parts.slice(8).join(' ');
      files.push({ size, path: filePath, name: path.basename(filePath) });
    }

    return files;
  } catch {
    return [];
  }
}

// ═══ ALERTS ═══

function checkAlerts(db) {
  if (!alertConfig.enabled) return [];

  const alerts = [];
  const procs = getProcesses();

  // CPU alerts
  for (const p of procs) {
    if (p.cpu >= alertConfig.cpuCrit) {
      alerts.push({ level: 'critical', category: 'cpu', message: `${p.name} (PID ${p.pid}) at ${p.cpu}% CPU`, pid: p.pid });
    } else if (p.cpu >= alertConfig.cpuWarn) {
      alerts.push({ level: 'warning', category: 'cpu', message: `${p.name} (PID ${p.pid}) at ${p.cpu}% CPU`, pid: p.pid });
    }
  }

  // Memory alerts
  for (const p of procs) {
    if (p.rssMB >= alertConfig.memCrit) {
      alerts.push({ level: 'critical', category: 'memory', message: `${p.name} (PID ${p.pid}) using ${p.rssMB} MB`, pid: p.pid });
    } else if (p.rssMB >= alertConfig.memWarn) {
      alerts.push({ level: 'warning', category: 'memory', message: `${p.name} (PID ${p.pid}) using ${p.rssMB} MB`, pid: p.pid });
    }
  }

  // Disk alerts
  const disks = getDiskInfo();
  for (const d of disks) {
    if (d.usePercent >= alertConfig.diskCrit) {
      alerts.push({ level: 'critical', category: 'disk', message: `${d.mountpoint} at ${d.usePercent}% (${d.available} free)` });
    } else if (d.usePercent >= alertConfig.diskWarn) {
      alerts.push({ level: 'warning', category: 'disk', message: `${d.mountpoint} at ${d.usePercent}% (${d.available} free)` });
    }
  }

  // Store alerts in DB
  if (db && alerts.length > 0) {
    try {
      const insert = db.prepare('INSERT INTO monitor_alerts (id, level, category, message, metadata, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))');
      for (const a of alerts) {
        insert.run(uuidv4(), a.level, a.category, a.message, JSON.stringify({ pid: a.pid || null }));
      }
    } catch {}
  }

  return alerts;
}

function getAlertHistory(db, limit = 50) {
  try {
    return db.prepare('SELECT * FROM monitor_alerts ORDER BY created_at DESC LIMIT ?').all(limit);
  } catch { return []; }
}

function clearAlertHistory(db) {
  try { db.prepare('DELETE FROM monitor_alerts').run(); } catch {}
}

function getAlertConfig() { return { ...alertConfig }; }

function setAlertConfig(config) {
  if (config.cpuWarn !== undefined) alertConfig.cpuWarn = config.cpuWarn;
  if (config.cpuCrit !== undefined) alertConfig.cpuCrit = config.cpuCrit;
  if (config.memWarn !== undefined) alertConfig.memWarn = config.memWarn;
  if (config.memCrit !== undefined) alertConfig.memCrit = config.memCrit;
  if (config.diskWarn !== undefined) alertConfig.diskWarn = config.diskWarn;
  if (config.diskCrit !== undefined) alertConfig.diskCrit = config.diskCrit;
  if (config.enabled !== undefined) alertConfig.enabled = config.enabled;
  return alertConfig;
}

// ═══ SYSTEM OVERVIEW ═══

function getFullSnapshot() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const processSummary = getProcessSummary();
  const disks = getDiskInfo();

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: os.uptime(),
    uptimeFormatted: formatUptime(os.uptime()),
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model,
    loadAvg: os.loadavg(),
    totalMemMB: Math.round(totalMem / 1024 / 1024),
    freeMemMB: Math.round(freeMem / 1024 / 1024),
    usedMemMB: Math.round((totalMem - freeMem) / 1024 / 1024),
    memPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    processes: processSummary,
    disks,
    timestamp: Date.now(),
  };
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ═══ LIVE MONITORING (WebSocket) ═══

const monitorClients = new Set();

function addMonitorClient(ws) {
  monitorClients.add(ws);

  // Send initial snapshot
  try {
    ws.send(JSON.stringify({ type: 'monitor_snapshot', data: getFullSnapshot() }));
  } catch {}

  return monitorClients.size;
}

function removeMonitorClient(ws) {
  monitorClients.delete(ws);
  return monitorClients.size;
}

let _monitorInterval = null;

function startLiveMonitoring() {
  if (_monitorInterval) return;

  _monitorInterval = setInterval(() => {
    if (monitorClients.size === 0) return;

    const snapshot = getFullSnapshot();
    const data = JSON.stringify({ type: 'monitor_snapshot', data: snapshot });

    for (const ws of monitorClients) {
      try {
        if (ws.readyState === 1) ws.send(data);
      } catch {}
    }
  }, 2000);
}

function stopLiveMonitoring() {
  if (_monitorInterval) {
    clearInterval(_monitorInterval);
    _monitorInterval = null;
  }
}

// ═══ EXPORTS ═══
module.exports = {
  // Processes
  getProcesses,
  getProcessTree,
  getProcessSummary,
  killProcess,
  searchProcesses,

  // Network
  getNetworkConnections,
  getListeningPorts,
  getNetworkSummary,
  scanPorts,

  // Disk
  getDiskInfo,
  getDiskUsage,
  getLargestFiles,

  // Alerts
  checkAlerts,
  getAlertHistory,
  clearAlertHistory,
  getAlertConfig,
  setAlertConfig,

  // Overview
  getFullSnapshot,
  formatUptime,

  // Live
  addMonitorClient,
  removeMonitorClient,
  startLiveMonitoring,
  stopLiveMonitoring,
};
