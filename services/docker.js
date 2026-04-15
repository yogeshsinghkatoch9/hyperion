/**
 * Hyperion Docker Manager — Container, Image, Volume & Network Management
 * Wraps Docker CLI with JSON parsing, status tracking, and compose support
 */
const { execSync, exec, spawn } = require('child_process');
const path = require('path');

// ── Helpers ──

function dockerExec(args, timeout = 15000) {
  try {
    const result = execSync(`docker ${args}`, {
      encoding: 'utf8',
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.trim();
  } catch (err) {
    const msg = err.stderr ? err.stderr.trim() : err.message;
    throw new Error(msg || 'Docker command failed');
  }
}

function dockerExecJson(args, timeout = 15000) {
  const raw = dockerExec(args, timeout);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    // Might be newline-separated JSON objects
    return raw.split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  }
}

function isDockerAvailable() {
  try {
    execSync('docker info --format "{{.ServerVersion}}"', { encoding: 'utf8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function getDockerVersion() {
  try {
    const client = execSync('docker version --format "{{.Client.Version}}"', { encoding: 'utf8', timeout: 5000 }).trim();
    const server = execSync('docker version --format "{{.Server.Version}}"', { encoding: 'utf8', timeout: 5000 }).trim();
    return { client, server };
  } catch {
    return { client: 'unknown', server: 'unknown' };
  }
}

function getDockerInfo() {
  try {
    const raw = dockerExec('info --format "{{json .}}"');
    const info = JSON.parse(raw);
    return {
      containers: info.Containers || 0,
      containersRunning: info.ContainersRunning || 0,
      containersPaused: info.ContainersPaused || 0,
      containersStopped: info.ContainersStopped || 0,
      images: info.Images || 0,
      serverVersion: info.ServerVersion || '',
      os: info.OperatingSystem || '',
      arch: info.Architecture || '',
      cpus: info.NCPU || 0,
      memory: info.MemTotal || 0,
      storageDriver: info.Driver || '',
    };
  } catch {
    return null;
  }
}

// ═══ CONTAINERS ═══

function listContainers(all = true) {
  const flag = all ? '-a' : '';
  const format = '{{json .}}';
  const raw = dockerExec(`ps ${flag} --format "${format}" --no-trunc`);
  if (!raw) return [];

  return raw.split('\n').filter(Boolean).map(line => {
    try {
      const c = JSON.parse(line);
      return {
        id: c.ID,
        name: c.Names,
        image: c.Image,
        command: c.Command,
        created: c.CreatedAt,
        status: c.Status,
        state: c.State,
        ports: parsePorts(c.Ports || ''),
        size: c.Size || '',
        networks: c.Networks || '',
      };
    } catch { return null; }
  }).filter(Boolean);
}

function inspectContainer(id) {
  const data = dockerExecJson(`inspect ${sanitizeId(id)}`);
  if (!data || !data[0]) throw new Error('Container not found');
  const c = data[0];
  return {
    id: c.Id,
    name: (c.Name || '').replace(/^\//, ''),
    image: c.Config?.Image || '',
    created: c.Created,
    state: {
      status: c.State?.Status,
      running: c.State?.Running,
      pid: c.State?.Pid,
      startedAt: c.State?.StartedAt,
      finishedAt: c.State?.FinishedAt,
      exitCode: c.State?.ExitCode,
    },
    ports: c.NetworkSettings?.Ports || {},
    env: c.Config?.Env || [],
    mounts: (c.Mounts || []).map(m => ({
      type: m.Type,
      source: m.Source,
      destination: m.Destination,
      mode: m.Mode,
    })),
    network: Object.keys(c.NetworkSettings?.Networks || {}),
    restartPolicy: c.HostConfig?.RestartPolicy?.Name || 'no',
    cmd: c.Config?.Cmd || [],
    labels: c.Config?.Labels || {},
  };
}

function startContainer(id) {
  dockerExec(`start ${sanitizeId(id)}`);
  return true;
}

function stopContainer(id, timeout = 10) {
  dockerExec(`stop -t ${Math.max(0, parseInt(timeout) || 10)} ${sanitizeId(id)}`, 30000);
  return true;
}

function restartContainer(id) {
  dockerExec(`restart ${sanitizeId(id)}`, 30000);
  return true;
}

function pauseContainer(id) {
  dockerExec(`pause ${sanitizeId(id)}`);
  return true;
}

function unpauseContainer(id) {
  dockerExec(`unpause ${sanitizeId(id)}`);
  return true;
}

function removeContainer(id, force = false) {
  const f = force ? '-f' : '';
  dockerExec(`rm ${f} ${sanitizeId(id)}`);
  return true;
}

function getContainerLogs(id, { tail = 200, timestamps = false } = {}) {
  const ts = timestamps ? '--timestamps' : '';
  const safeTail = Math.min(Math.max(1, parseInt(tail) || 200), 5000);
  return dockerExec(`logs --tail ${safeTail} ${ts} ${sanitizeId(id)}`, 10000);
}

function getContainerStats(id) {
  const raw = dockerExec(`stats --no-stream --format "{{json .}}" ${sanitizeId(id)}`, 10000);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    return {
      id: s.ID,
      name: s.Name,
      cpu: s.CPUPerc || '0%',
      memory: s.MemUsage || '',
      memPercent: s.MemPerc || '0%',
      netIO: s.NetIO || '',
      blockIO: s.BlockIO || '',
      pids: s.PIDs || '0',
    };
  } catch { return null; }
}

function getAllStats() {
  const raw = dockerExec('stats --no-stream --format "{{json .}}"', 15000);
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    try {
      const s = JSON.parse(line);
      return {
        id: s.ID,
        name: s.Name,
        cpu: s.CPUPerc || '0%',
        memory: s.MemUsage || '',
        memPercent: s.MemPerc || '0%',
        netIO: s.NetIO || '',
        blockIO: s.BlockIO || '',
        pids: s.PIDs || '0',
      };
    } catch { return null; }
  }).filter(Boolean);
}

// ═══ IMAGES ═══

function listImages() {
  const raw = dockerExec('images --format "{{json .}}" --no-trunc');
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    try {
      const i = JSON.parse(line);
      return {
        id: i.ID,
        repository: i.Repository,
        tag: i.Tag,
        created: i.CreatedAt || i.CreatedSince,
        size: i.Size,
      };
    } catch { return null; }
  }).filter(Boolean);
}

function pullImage(image) {
  // Synchronous pull — can be slow
  dockerExec(`pull ${sanitizeImage(image)}`, 120000);
  return true;
}

function removeImage(id, force = false) {
  const f = force ? '-f' : '';
  dockerExec(`rmi ${f} ${sanitizeId(id)}`);
  return true;
}

function pruneImages() {
  const result = dockerExec('image prune -f', 30000);
  return result;
}

// ═══ VOLUMES ═══

function listVolumes() {
  const raw = dockerExec('volume ls --format "{{json .}}"');
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    try {
      const v = JSON.parse(line);
      return {
        name: v.Name,
        driver: v.Driver,
        mountpoint: v.Mountpoint || '',
        labels: v.Labels || '',
      };
    } catch { return null; }
  }).filter(Boolean);
}

function inspectVolume(name) {
  const data = dockerExecJson(`volume inspect ${sanitizeId(name)}`);
  if (!data || !data[0]) throw new Error('Volume not found');
  return data[0];
}

function removeVolume(name, force = false) {
  const f = force ? '-f' : '';
  dockerExec(`volume rm ${f} ${sanitizeId(name)}`);
  return true;
}

function pruneVolumes() {
  return dockerExec('volume prune -f', 30000);
}

// ═══ NETWORKS ═══

function listNetworks() {
  const raw = dockerExec('network ls --format "{{json .}}"');
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    try {
      const n = JSON.parse(line);
      return {
        id: n.ID,
        name: n.Name,
        driver: n.Driver,
        scope: n.Scope,
      };
    } catch { return null; }
  }).filter(Boolean);
}

// ═══ COMPOSE ═══

function composeUp(composePath, detach = true) {
  const dir = path.dirname(composePath);
  const file = path.basename(composePath);
  const d = detach ? '-d' : '';
  try {
    return execSync(`docker compose -f "${file}" up ${d}`, {
      encoding: 'utf8',
      timeout: 120000,
      cwd: dir,
      maxBuffer: 5 * 1024 * 1024,
    }).trim();
  } catch (err) {
    throw new Error(err.stderr ? err.stderr.trim() : err.message);
  }
}

function composeDown(composePath) {
  const dir = path.dirname(composePath);
  const file = path.basename(composePath);
  try {
    return execSync(`docker compose -f "${file}" down`, {
      encoding: 'utf8',
      timeout: 60000,
      cwd: dir,
    }).trim();
  } catch (err) {
    throw new Error(err.stderr ? err.stderr.trim() : err.message);
  }
}

function composePs(composePath) {
  const dir = path.dirname(composePath);
  const file = path.basename(composePath);
  try {
    const raw = execSync(`docker compose -f "${file}" ps --format "{{json .}}"`, {
      encoding: 'utf8',
      timeout: 15000,
      cwd: dir,
    }).trim();
    if (!raw) return [];
    return raw.split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch (err) {
    throw new Error(err.stderr ? err.stderr.trim() : err.message);
  }
}

// ═══ LOG STREAMING ═══

function streamLogs(id, ws) {
  const safe = sanitizeId(id);
  const proc = spawn('docker', ['logs', '-f', '--tail', '100', safe]);

  proc.stdout.on('data', (data) => {
    try { ws.send(JSON.stringify({ type: 'log', stream: 'stdout', data: data.toString() })); } catch {}
  });
  proc.stderr.on('data', (data) => {
    try { ws.send(JSON.stringify({ type: 'log', stream: 'stderr', data: data.toString() })); } catch {}
  });
  proc.on('close', (code) => {
    try { ws.send(JSON.stringify({ type: 'log_end', code })); } catch {}
  });

  return proc;
}

// ═══ UTILITIES ═══

function sanitizeId(id) {
  // Allow alphanumeric, dashes, underscores, dots, colons, slashes (for image names)
  return id.replace(/[^a-zA-Z0-9_.\-:/]/g, '');
}

function sanitizeImage(image) {
  return image.replace(/[^a-zA-Z0-9_.\-:/@ ]/g, '');
}

function parsePorts(portStr) {
  if (!portStr) return [];
  // Format: "0.0.0.0:8080->80/tcp, 443/tcp"
  return portStr.split(',').map(p => p.trim()).filter(Boolean).map(p => {
    const match = p.match(/(?:(\d+\.\d+\.\d+\.\d+):)?(\d+)->(\d+)\/(tcp|udp)/);
    if (match) {
      return { host: match[1] || '0.0.0.0', hostPort: parseInt(match[2]), containerPort: parseInt(match[3]), protocol: match[4] };
    }
    const simple = p.match(/(\d+)\/(tcp|udp)/);
    if (simple) {
      return { containerPort: parseInt(simple[1]), protocol: simple[2] };
    }
    return { raw: p };
  });
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

function parseStateColor(state) {
  if (!state) return 'dim';
  const s = state.toLowerCase();
  if (s === 'running') return 'green';
  if (s === 'exited' || s === 'dead') return 'red';
  if (s === 'paused') return 'amber';
  if (s === 'restarting' || s === 'created') return 'cyan';
  return 'dim';
}

// ═══ EXPORTS ═══
module.exports = {
  isDockerAvailable,
  getDockerVersion,
  getDockerInfo,

  listContainers,
  inspectContainer,
  startContainer,
  stopContainer,
  restartContainer,
  pauseContainer,
  unpauseContainer,
  removeContainer,
  getContainerLogs,
  getContainerStats,
  getAllStats,

  listImages,
  pullImage,
  removeImage,
  pruneImages,

  listVolumes,
  inspectVolume,
  removeVolume,
  pruneVolumes,

  listNetworks,

  composeUp,
  composeDown,
  composePs,

  streamLogs,

  // Utilities (exported for testing)
  sanitizeId,
  sanitizeImage,
  parsePorts,
  formatBytes,
  parseStateColor,
};
