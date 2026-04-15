const express = require('express');
const router = express.Router();
const os = require('os');
const { execSync, spawn } = require('child_process');

// System overview
router.get('/info', (req, res) => {
  const cpus = os.cpus();
  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    uptime: os.uptime(),
    loadavg: os.loadavg(),
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    memPercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
    cpuCount: cpus.length,
    cpuModel: cpus[0]?.model,
    tmpdir: os.tmpdir(),
    homedir: os.homedir(),
    user: os.userInfo().username,
    nodeVersion: process.version,
    pid: process.pid,
  });
});

// Running processes
router.get('/processes', (req, res) => {
  try {
    const raw = execSync('ps aux --sort=-%mem 2>/dev/null || ps aux', {
      encoding: 'utf-8',
      timeout: 5000,
    });

    const lines = raw.trim().split('\n');
    const header = lines[0];
    const processes = lines.slice(1, 51).map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        user: parts[0],
        pid: parseInt(parts[1]),
        cpu: parseFloat(parts[2]),
        mem: parseFloat(parts[3]),
        vsz: parts[4],
        rss: parts[5],
        tty: parts[6],
        stat: parts[7],
        start: parts[8],
        time: parts[9],
        command: parts.slice(10).join(' '),
      };
    });

    res.json({ processes, header });
  } catch (err) {
    res.json({ processes: [], error: err.message });
  }
});

// Kill process
router.post('/kill', (req, res) => {
  const { pid, signal = 'SIGTERM' } = req.body;

  // Validate PID is a positive integer
  const numPid = parseInt(pid);
  if (!Number.isInteger(numPid) || numPid <= 0) {
    return res.status(400).json({ error: 'Invalid PID' });
  }

  // Restrict signal to allowlist
  const ALLOWED_SIGNALS = ['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGHUP'];
  if (!ALLOWED_SIGNALS.includes(signal)) {
    return res.status(400).json({ error: `Signal not allowed. Use: ${ALLOWED_SIGNALS.join(', ')}` });
  }

  // Check process ownership
  try {
    const ownerCheck = execSync(`ps -o uid= -p ${numPid} 2>/dev/null`, { encoding: 'utf-8' }).trim();
    const currentUid = String(process.getuid());
    if (ownerCheck && ownerCheck !== currentUid && currentUid !== '0') {
      return res.status(403).json({ error: 'Cannot kill process owned by another user' });
    }
  } catch {
    // Process may not exist
  }

  try {
    process.kill(numPid, signal);
    res.json({ ok: true, pid: numPid, signal });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Network info
router.get('/network', (req, res) => {
  const interfaces = os.networkInterfaces();
  const result = {};
  for (const [name, addrs] of Object.entries(interfaces)) {
    result[name] = addrs.map(a => ({
      address: a.address,
      family: a.family,
      internal: a.internal,
      mac: a.mac,
      netmask: a.netmask,
    }));
  }

  // Active connections
  let connections = [];
  try {
    const raw = execSync("netstat -an 2>/dev/null | head -50 || ss -tuln 2>/dev/null | head -50", {
      encoding: 'utf-8',
      timeout: 5000,
    });
    connections = raw.trim().split('\n').slice(1);
  } catch {}

  res.json({ interfaces: result, connections });
});

// Disk usage
router.get('/disk', (req, res) => {
  try {
    const raw = execSync('df -h', { encoding: 'utf-8', timeout: 5000 });
    const lines = raw.trim().split('\n');
    const disks = lines.slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usePercent: parts[4],
        mountpoint: parts.slice(5).join(' '),
      };
    }).filter(d => !d.filesystem.startsWith('map') && d.size !== '0Bi');

    res.json(disks);
  } catch (err) {
    res.json([]);
  }
});

// Environment variables
router.get('/env', (req, res) => {
  // Filter sensitive vars
  const safe = {};
  const sensitive = ['password', 'secret', 'key', 'token', 'credential', 'auth',
    'database_url', 'redis_url', 'dsn', 'connection_string', 'api_key',
    'private', 'cert', 'session'];
  const connectionPatterns = /^(postgres|mysql|redis|mongodb|amqp|https?):\/\/[^\s]+@/i;
  for (const [k, v] of Object.entries(process.env)) {
    const isSecret = sensitive.some(s => k.toLowerCase().includes(s));
    const isConnStr = connectionPatterns.test(v || '');
    safe[k] = (isSecret || isConnStr) ? '***' : v;
  }
  res.json(safe);
});

// Battery info (macOS)
router.get('/battery', (req, res) => {
  const battery = req.app.locals.collectBattery?.();
  if (!battery) return res.json({ available: false });
  res.json({ available: true, ...battery });
});

// Disk I/O stats
router.get('/diskio', (req, res) => {
  try {
    const raw = execSync("iostat -d -c 1 2>/dev/null | tail -1", { encoding: 'utf-8', timeout: 3000 }).trim();
    const parts = raw.split(/\s+/).filter(Boolean);
    res.json({ kbPerTransfer: parseFloat(parts[0]) || 0, transfersPerSec: parseFloat(parts[1]) || 0, mbPerSec: parseFloat(parts[2]) || 0 });
  } catch {
    res.json({ kbPerTransfer: 0, transfersPerSec: 0, mbPerSec: 0 });
  }
});

// Installed runtimes
router.get('/runtimes', (req, res) => {
  const checks = [
    { name: 'Node.js', cmd: 'node --version' },
    { name: 'Python', cmd: 'python3 --version' },
    { name: 'Ruby', cmd: 'ruby --version' },
    { name: 'Go', cmd: 'go version' },
    { name: 'Rust', cmd: 'rustc --version' },
    { name: 'Swift', cmd: 'swift --version 2>&1 | head -1' },
    { name: 'Java', cmd: 'java --version 2>&1 | head -1' },
    { name: 'GCC', cmd: 'gcc --version 2>&1 | head -1' },
    { name: 'Docker', cmd: 'docker --version' },
    { name: 'Git', cmd: 'git --version' },
    { name: 'Pip', cmd: 'pip3 --version' },
    { name: 'npm', cmd: 'npm --version' },
    { name: 'Brew', cmd: 'brew --version 2>&1 | head -1' },
  ];

  const runtimes = checks.map(({ name, cmd }) => {
    try {
      const version = execSync(cmd, { encoding: 'utf-8', timeout: 3000 }).trim();
      return { name, version, installed: true };
    } catch {
      return { name, version: null, installed: false };
    }
  });

  res.json(runtimes);
});

module.exports = router;
