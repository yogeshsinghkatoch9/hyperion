/**
 * SSH Tunnel Manager — persistent tunnels with auto-reconnect
 */
'use strict';
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const ssh = require('./ssh');

// Active tunnel processes: tunnelId -> { proc, restartTimer, attempts }
const activeTunnels = new Map();
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 5000;

function createTunnel(db, { connectionId, name, localPort, remoteHost, remotePort, type = 'local', autoReconnect = true }) {
  if (!connectionId || !name || !localPort || !remoteHost || !remotePort) {
    throw new Error('connectionId, name, localPort, remoteHost, remotePort required');
  }
  // Verify connection exists
  ssh.getConnection(db, connectionId);

  const id = uuidv4();
  db.prepare(
    'INSERT INTO ssh_tunnels (id, connection_id, name, local_port, remote_host, remote_port, type, auto_reconnect) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, connectionId, name, parseInt(localPort), ssh.sanitizeHost(remoteHost), parseInt(remotePort), type, autoReconnect ? 1 : 0);

  return { id, connectionId, name, localPort: parseInt(localPort), remoteHost, remotePort: parseInt(remotePort), type, status: 'stopped' };
}

function listTunnels(db) {
  const tunnels = db.prepare('SELECT * FROM ssh_tunnels ORDER BY created_at DESC').all();
  return tunnels.map(t => ({
    ...t,
    running: activeTunnels.has(t.id),
    pid: activeTunnels.get(t.id)?.proc?.pid || t.pid || null,
  }));
}

function getTunnel(db, id) {
  const tunnel = db.prepare('SELECT * FROM ssh_tunnels WHERE id = ?').get(id);
  if (!tunnel) throw new Error('Tunnel not found');
  return tunnel;
}

function deleteTunnel(db, id) {
  stopTunnel(db, id);
  const info = db.prepare('DELETE FROM ssh_tunnels WHERE id = ?').run(id);
  if (info.changes === 0) throw new Error('Tunnel not found');
  return { deleted: true };
}

function startTunnel(db, id) {
  const tunnel = getTunnel(db, id);
  if (activeTunnels.has(id)) throw new Error('Tunnel already running');

  const conn = ssh.getConnection(db, tunnel.connection_id);
  const args = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=10',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ExitOnForwardFailure=yes',
    '-N', // No remote command
    '-p', String(conn.port || 22),
  ];

  if (conn.auth_type === 'key' && conn.key_path) {
    args.push('-i', conn.key_path);
  }

  // Tunnel direction
  if (tunnel.type === 'remote' || tunnel.type === 'reverse') {
    args.push('-R', `${tunnel.local_port}:${tunnel.remote_host}:${tunnel.remote_port}`);
  } else {
    args.push('-L', `${tunnel.local_port}:${tunnel.remote_host}:${tunnel.remote_port}`);
  }

  args.push(`${conn.username}@${conn.host}`);

  const proc = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });

  const state = { proc, restartTimer: null, attempts: 0 };
  activeTunnels.set(id, state);

  db.prepare("UPDATE ssh_tunnels SET status = 'running', pid = ? WHERE id = ?").run(proc.pid, id);

  proc.on('close', (code) => {
    db.prepare("UPDATE ssh_tunnels SET status = 'stopped', pid = NULL WHERE id = ?").run(id);

    // Auto-reconnect
    if (tunnel.auto_reconnect && state.attempts < MAX_RECONNECT_ATTEMPTS && activeTunnels.has(id)) {
      state.attempts++;
      state.restartTimer = setTimeout(() => {
        if (activeTunnels.has(id)) {
          activeTunnels.delete(id);
          try { startTunnel(db, id); } catch {}
        }
      }, RECONNECT_DELAY_MS * state.attempts);
    } else {
      activeTunnels.delete(id);
    }
  });

  proc.on('error', () => {
    activeTunnels.delete(id);
    db.prepare("UPDATE ssh_tunnels SET status = 'error', pid = NULL WHERE id = ?").run(id);
  });

  return { started: true, pid: proc.pid };
}

function stopTunnel(db, id) {
  const state = activeTunnels.get(id);
  if (state) {
    if (state.restartTimer) clearTimeout(state.restartTimer);
    try { state.proc.kill(); } catch {}
    activeTunnels.delete(id);
  }
  db.prepare("UPDATE ssh_tunnels SET status = 'stopped', pid = NULL WHERE id = ?").run(id);
  return { stopped: true };
}

function stopAll(db) {
  for (const [id] of activeTunnels) {
    stopTunnel(db, id);
  }
}

function getStatus(id) {
  const state = activeTunnels.get(id);
  if (!state) return { running: false };
  return { running: true, pid: state.proc.pid, attempts: state.attempts };
}

module.exports = {
  createTunnel, listTunnels, getTunnel, deleteTunnel,
  startTunnel, stopTunnel, stopAll, getStatus,
  MAX_RECONNECT_ATTEMPTS, RECONNECT_DELAY_MS,
};
