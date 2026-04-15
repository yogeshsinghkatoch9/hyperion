/**
 * Hyperion Process & Port Manager — ps, kill, lsof, port scan
 */
const { execSync } = require('child_process');
const net = require('net');
const os = require('os');

// ═══ PROCESS LISTING ═══

function listProcesses(sortBy = 'cpu') {
  const sortFlag = sortBy === 'mem' ? '-m' : '-r'; // -r = CPU, -m = memory
  try {
    const output = execSync(`ps aux ${sortFlag} | head -50`, { encoding: 'utf8', timeout: 10000 });
    const lines = output.trim().split('\n');
    const header = lines[0];
    return lines.slice(1).map(line => {
      const parts = line.split(/\s+/);
      if (parts.length < 11) return null;
      return {
        user: parts[0],
        pid: parseInt(parts[1]),
        cpu: parseFloat(parts[2]),
        mem: parseFloat(parts[3]),
        vsz: parseInt(parts[4]),
        rss: parseInt(parts[5]),
        tty: parts[6],
        stat: parts[7],
        start: parts[8],
        time: parts[9],
        command: parts.slice(10).join(' '),
      };
    }).filter(Boolean);
  } catch (err) {
    throw new Error('Failed to list processes: ' + err.message);
  }
}

function searchProcesses(query) {
  if (!query) return [];
  // Get all processes and filter in JS — avoids shell injection entirely
  try {
    const all = listProcesses('cpu');
    const q = query.toLowerCase();
    return all.filter(p => p.command && p.command.toLowerCase().includes(q)).map(p => ({
      user: p.user,
      pid: p.pid,
      cpu: p.cpu,
      mem: p.mem,
      command: p.command,
    }));
  } catch {
    return [];
  }
}

// ═══ KILL PROCESS ═══

function killProcess(pid, signal = 'TERM') {
  const p = parseInt(pid);
  if (!p || p <= 0) throw new Error('Invalid PID');
  if (p === 1 || p === process.pid) throw new Error('Cannot kill this process');

  const validSignals = ['TERM', 'KILL', 'HUP', 'INT', 'QUIT', 'USR1', 'USR2'];
  const sig = validSignals.includes(signal.toUpperCase()) ? signal.toUpperCase() : 'TERM';

  try {
    execSync(`kill -${sig} ${p}`, { encoding: 'utf8', timeout: 5000 });
    return { killed: true, pid: p, signal: sig };
  } catch (err) {
    throw new Error(`Failed to kill PID ${p}: ${err.message}`);
  }
}

function killByPort(port) {
  const p = parseInt(port);
  if (!p || p <= 0 || p > 65535) throw new Error('Invalid port');

  const procs = getProcessOnPort(p);
  if (procs.length === 0) throw new Error(`No process found on port ${p}`);

  const killed = [];
  for (const proc of procs) {
    try {
      killProcess(proc.pid, 'TERM');
      killed.push(proc.pid);
    } catch { /* skip */ }
  }
  return { port: p, killed };
}

// ═══ PORT OPERATIONS ═══

function getProcessOnPort(port) {
  const p = parseInt(port);
  if (!p || p <= 0 || p > 65535) throw new Error('Invalid port');

  try {
    const output = execSync(`lsof -i :${p} -P -n 2>/dev/null | grep LISTEN`, { encoding: 'utf8', timeout: 5000 });
    return output.trim().split('\n').filter(l => l.trim()).map(line => {
      const parts = line.split(/\s+/);
      return {
        command: parts[0],
        pid: parseInt(parts[1]),
        user: parts[2],
        fd: parts[3],
        type: parts[4],
        name: parts[parts.length - 1],
      };
    });
  } catch {
    return [];
  }
}

function getListeningPorts() {
  try {
    const output = execSync('lsof -i -P -n 2>/dev/null | grep LISTEN', { encoding: 'utf8', timeout: 10000 });
    const ports = new Map();
    output.trim().split('\n').filter(l => l.trim()).forEach(line => {
      const parts = line.split(/\s+/);
      const name = parts[parts.length - 1];
      const portMatch = name.match(/:(\d+)\s*$/);
      if (portMatch) {
        const port = parseInt(portMatch[1]);
        if (!ports.has(port)) {
          ports.set(port, {
            port,
            command: parts[0],
            pid: parseInt(parts[1]),
            user: parts[2],
            protocol: parts[4]?.includes('6') ? 'TCP6' : 'TCP',
          });
        }
      }
    });
    return Array.from(ports.values()).sort((a, b) => a.port - b.port);
  } catch {
    return [];
  }
}

async function scanPort(host, port, timeoutMs = 2000) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => { socket.destroy(); resolve({ port, status: 'open' }); });
    socket.on('timeout', () => { socket.destroy(); resolve({ port, status: 'closed' }); });
    socket.on('error', () => { resolve({ port, status: 'closed' }); });
    socket.connect(port, host);
  });
}

async function scanPortRange(host, startPort, endPort, timeoutMs = 1000) {
  // Only allow scanning localhost — prevent SSRF
  const allowedHosts = ['127.0.0.1', 'localhost', '::1', '0.0.0.0'];
  if (!allowedHosts.includes(host)) throw new Error('Port scanning is only allowed on localhost');
  const start = Math.max(1, parseInt(startPort));
  const end = Math.min(65535, parseInt(endPort));
  if (end - start > 1000) throw new Error('Port range too large (max 1000)');

  const results = [];
  // Scan in batches of 50
  for (let i = start; i <= end; i += 50) {
    const batch = [];
    for (let p = i; p <= Math.min(i + 49, end); p++) {
      batch.push(scanPort(host, p, timeoutMs));
    }
    const batchResults = await Promise.all(batch);
    results.push(...batchResults.filter(r => r.status === 'open'));
  }
  return results;
}

// ═══ SYSTEM RESOURCES ═══

function getSystemResources() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  return {
    cpu: {
      model: cpus[0]?.model || 'Unknown',
      cores: cpus.length,
      usage: _getCpuUsage(),
    },
    memory: {
      total: totalMem,
      free: freeMem,
      used: totalMem - freeMem,
      usedPercent: ((totalMem - freeMem) / totalMem * 100).toFixed(1),
    },
    uptime: os.uptime(),
    loadAvg: os.loadavg(),
    platform: os.platform(),
    hostname: os.hostname(),
  };
}

function _getCpuUsage() {
  try {
    const output = execSync("top -l 1 -n 0 2>/dev/null | grep 'CPU usage'", { encoding: 'utf8', timeout: 5000 });
    const match = output.match(/([\d.]+)% user.*?([\d.]+)% sys/);
    if (match) return { user: parseFloat(match[1]), sys: parseFloat(match[2]) };
  } catch { /* fallback */ }
  return { user: 0, sys: 0 };
}

// ═══ TOP RESOURCE HOGS ═══

function getTopProcesses(count = 10, sortBy = 'cpu') {
  return listProcesses(sortBy).slice(0, count);
}

// ═══ PROCESS TREE ═══

function getProcessTree(pid) {
  const p = parseInt(pid);
  if (!p) throw new Error('Invalid PID');
  try {
    const output = execSync(`pstree -p ${p} 2>/dev/null || ps -o pid,ppid,comm -p ${p}`, { encoding: 'utf8', timeout: 5000 });
    return output.trim();
  } catch {
    return 'Process tree unavailable';
  }
}

// ═══ FORMAT HELPERS ═══

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

module.exports = {
  listProcesses, searchProcesses,
  killProcess, killByPort,
  getProcessOnPort, getListeningPorts, scanPort, scanPortRange,
  getSystemResources, getTopProcesses, getProcessTree,
  formatBytes, formatUptime,
};
