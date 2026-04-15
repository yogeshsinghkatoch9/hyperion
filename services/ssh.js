/**
 * Hyperion SSH Manager — Saved connections, command execution, file transfer
 */
const { execSync, spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// ═══ SANITIZATION ═══

function sanitizeHost(host) {
  return host.replace(/[^a-zA-Z0-9.\-:_]/g, '');
}

function sanitizeUser(user) {
  return user.replace(/[^a-zA-Z0-9.\-_@]/g, '');
}

function sanitizePath(p) {
  return p.replace(/[`$();|&><]/g, '');
}

function sanitizePort(port) {
  const p = parseInt(port);
  return (p > 0 && p <= 65535) ? p : 22;
}

// ═══ CONNECTION MANAGEMENT (DB-backed) ═══

function listConnections(db) {
  return db.prepare('SELECT id, name, host, port, username, auth_type, key_path, created_at FROM ssh_connections ORDER BY name').all();
}

function getConnection(db, id) {
  const conn = db.prepare('SELECT * FROM ssh_connections WHERE id = ?').get(id);
  if (!conn) throw new Error('Connection not found');
  return conn;
}

function saveConnection(db, { name, host, port, username, auth_type, key_path }) {
  if (!name || !host || !username) throw new Error('Name, host, and username required');
  const id = uuidv4();
  db.prepare('INSERT INTO ssh_connections (id, name, host, port, username, auth_type, key_path) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, sanitizeHost(host), sanitizePort(port || 22), sanitizeUser(username), auth_type || 'key', sanitizePath(key_path || ''));
  return { id, name, host, port: sanitizePort(port || 22), username };
}

function updateConnection(db, id, fields) {
  const existing = getConnection(db, id);
  const updates = {};
  if (fields.name) updates.name = fields.name;
  if (fields.host) updates.host = sanitizeHost(fields.host);
  if (fields.port) updates.port = sanitizePort(fields.port);
  if (fields.username) updates.username = sanitizeUser(fields.username);
  if (fields.auth_type) updates.auth_type = fields.auth_type;
  if (fields.key_path !== undefined) updates.key_path = sanitizePath(fields.key_path);

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  if (!sets) return existing;
  db.prepare(`UPDATE ssh_connections SET ${sets} WHERE id = ?`).run(...Object.values(updates), id);
  return { ...existing, ...updates };
}

function deleteConnection(db, id) {
  const result = db.prepare('DELETE FROM ssh_connections WHERE id = ?').run(id);
  if (result.changes === 0) throw new Error('Connection not found');
  return { deleted: true };
}

// ═══ SSH COMMAND BUILDING ═══

function buildSshArgs(conn, extraArgs = []) {
  const args = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=10',
    '-o', 'BatchMode=yes',
    '-p', String(conn.port || 22),
  ];
  if (conn.auth_type === 'key' && conn.key_path) {
    args.push('-i', conn.key_path);
  }
  args.push(...extraArgs);
  args.push(`${conn.username}@${conn.host}`);
  return args;
}

// ═══ COMMAND EXECUTION ═══

function executeCommand(conn, command, timeoutMs = 30000) {
  if (!command || !command.trim()) throw new Error('Empty command');
  const args = buildSshArgs(conn);
  args.push(command);

  try {
    const output = execSync(`ssh ${args.map(a => `"${a}"`).join(' ')}`, {
      timeout: timeoutMs,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: output.trim(), exitCode: 0 };
  } catch (err) {
    return {
      success: false,
      output: (err.stdout || '').trim(),
      error: (err.stderr || err.message || '').trim(),
      exitCode: err.status || 1,
    };
  }
}

// ═══ CONNECTION TEST ═══

function testConnection(conn) {
  const result = executeCommand(conn, 'echo "connected"', 15000);
  return {
    connected: result.success && result.output.includes('connected'),
    latencyMs: 0, // Would need timing wrapper
    error: result.error || null,
  };
}

// ═══ FILE TRANSFER (SCP) ═══

function buildScpArgs(conn) {
  const args = [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ConnectTimeout=10',
    '-P', String(conn.port || 22),
  ];
  if (conn.auth_type === 'key' && conn.key_path) {
    args.push('-i', conn.key_path);
  }
  return args;
}

function uploadFile(conn, localPath, remotePath) {
  if (!fs.existsSync(localPath)) throw new Error('Local file not found');
  const args = buildScpArgs(conn);
  const remote = `${conn.username}@${conn.host}:${sanitizePath(remotePath)}`;
  try {
    execSync(`scp ${args.map(a => `"${a}"`).join(' ')} "${sanitizePath(localPath)}" "${remote}"`, {
      timeout: 120000, encoding: 'utf8',
    });
    return { success: true };
  } catch (err) {
    throw new Error(`Upload failed: ${err.stderr || err.message}`);
  }
}

function downloadFile(conn, remotePath, localPath) {
  const args = buildScpArgs(conn);
  const remote = `${conn.username}@${conn.host}:${sanitizePath(remotePath)}`;
  try {
    execSync(`scp ${args.map(a => `"${a}"`).join(' ')} "${remote}" "${sanitizePath(localPath)}"`, {
      timeout: 120000, encoding: 'utf8',
    });
    return { success: true, localPath };
  } catch (err) {
    throw new Error(`Download failed: ${err.stderr || err.message}`);
  }
}

// ═══ REMOTE FILE LISTING ═══

function listRemoteFiles(conn, remotePath = '~') {
  const result = executeCommand(conn, `ls -la ${sanitizePath(remotePath)} 2>/dev/null || echo "DIR_ERROR"`, 15000);
  if (!result.success || result.output.includes('DIR_ERROR')) {
    throw new Error('Could not list directory');
  }
  const lines = result.output.split('\n').filter(l => l.trim() && !l.startsWith('total'));
  return lines.map(line => {
    const parts = line.split(/\s+/);
    if (parts.length < 9) return null;
    return {
      permissions: parts[0],
      owner: parts[2],
      group: parts[3],
      size: parseInt(parts[4]) || 0,
      modified: `${parts[5]} ${parts[6]} ${parts[7]}`,
      name: parts.slice(8).join(' '),
      isDir: parts[0].startsWith('d'),
    };
  }).filter(Boolean);
}

// ═══ SYSTEM INFO ═══

function getRemoteInfo(conn) {
  const commands = {
    hostname: 'hostname',
    os: 'uname -a',
    uptime: 'uptime',
    disk: 'df -h / | tail -1',
    memory: 'free -h 2>/dev/null || vm_stat 2>/dev/null | head -5',
  };
  const info = {};
  for (const [key, cmd] of Object.entries(commands)) {
    const r = executeCommand(conn, cmd, 10000);
    info[key] = r.success ? r.output : null;
  }
  return info;
}

// ═══ KNOWN HOSTS ═══

function getKnownHosts() {
  const khPath = path.join(process.env.HOME || '~', '.ssh', 'known_hosts');
  if (!fs.existsSync(khPath)) return [];
  const content = fs.readFileSync(khPath, 'utf8');
  return content.split('\n').filter(l => l.trim() && !l.startsWith('#')).map(line => {
    const parts = line.split(' ');
    return { host: parts[0], type: parts[1] || 'unknown' };
  });
}

function listSshKeys() {
  const sshDir = path.join(process.env.HOME || '~', '.ssh');
  if (!fs.existsSync(sshDir)) return [];
  return fs.readdirSync(sshDir)
    .filter(f => f.endsWith('.pub') || (!f.includes('.') && f.startsWith('id_')))
    .map(f => ({ name: f, path: path.join(sshDir, f), isPublic: f.endsWith('.pub') }));
}

module.exports = {
  sanitizeHost, sanitizeUser, sanitizePath, sanitizePort,
  listConnections, getConnection, saveConnection, updateConnection, deleteConnection,
  buildSshArgs, executeCommand, testConnection,
  uploadFile, downloadFile, listRemoteFiles, getRemoteInfo,
  getKnownHosts, listSshKeys,
};
