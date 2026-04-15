/**
 * Cron Scheduler
 * Parses cron expressions, schedules agent execution.
 * Supports: standard 5-field cron + presets (@every5m, @hourly, @daily, @weekly)
 */

const { v4: uuidv4 } = require('uuid');

let _db = null;
let _tickInterval = null;
const MAX_CONCURRENT = 3;
const runningCronJobs = new Map();

// ── Cron Presets ──
const PRESETS = {
  '@every5m': '*/5 * * * *',
  '@every10m': '*/10 * * * *',
  '@every15m': '*/15 * * * *',
  '@every30m': '*/30 * * * *',
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
};

// ── Cron Parser ──
function parseCronField(field, min, max) {
  const values = new Set();

  for (const part of field.split(',')) {
    // */n
    const stepMatch = part.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1]);
      for (let i = min; i <= max; i += step) values.add(i);
      continue;
    }

    // n-m/s
    const rangeStepMatch = part.match(/^(\d+)-(\d+)\/(\d+)$/);
    if (rangeStepMatch) {
      const [, start, end, step] = rangeStepMatch.map(Number);
      for (let i = start; i <= end; i += step) values.add(i);
      continue;
    }

    // n-m
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const [, start, end] = rangeMatch.map(Number);
      for (let i = start; i <= end; i++) values.add(i);
      continue;
    }

    // *
    if (part === '*') {
      for (let i = min; i <= max; i++) values.add(i);
      continue;
    }

    // plain number
    const num = parseInt(part);
    if (!isNaN(num) && num >= min && num <= max) values.add(num);
  }

  return values;
}

function parseCron(expr) {
  // Resolve presets
  const resolved = PRESETS[expr] || expr;
  const parts = resolved.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  return {
    minutes: parseCronField(parts[0], 0, 59),
    hours: parseCronField(parts[1], 0, 23),
    daysOfMonth: parseCronField(parts[2], 1, 31),
    months: parseCronField(parts[3], 1, 12),
    daysOfWeek: parseCronField(parts[4], 0, 6),
  };
}

function matchesCron(cron, date) {
  return cron.minutes.has(date.getMinutes()) &&
    cron.hours.has(date.getHours()) &&
    cron.daysOfMonth.has(date.getDate()) &&
    cron.months.has(date.getMonth() + 1) &&
    cron.daysOfWeek.has(date.getDay());
}

function getNextRun(expr) {
  const cron = parseCron(expr);
  if (!cron) return null;

  const now = new Date();
  const check = new Date(now);
  check.setSeconds(0, 0);
  check.setMinutes(check.getMinutes() + 1);

  // Search up to 366 days
  for (let i = 0; i < 527040; i++) {
    if (matchesCron(cron, check)) return check;
    check.setMinutes(check.getMinutes() + 1);
  }
  return null;
}

function validateCron(expr) {
  const resolved = PRESETS[expr] || expr;
  const parts = resolved.trim().split(/\s+/);
  if (parts.length !== 5) return { valid: false, error: 'Must have 5 fields (min hour dom month dow)' };

  const cron = parseCron(expr);
  if (!cron) return { valid: false, error: 'Invalid cron expression' };

  const next = getNextRun(expr);
  return { valid: true, nextRun: next ? next.toISOString() : null, resolved };
}

// ── Tick: Check which agents are due ──
async function tick() {
  if (!_db) return;

  const now = new Date();
  const agents = _db.prepare("SELECT * FROM agents WHERE schedule IS NOT NULL AND schedule != '' AND status != 'running'").all();

  for (const agent of agents) {
    if (runningCronJobs.size >= MAX_CONCURRENT) break;
    if (runningCronJobs.has(agent.id)) continue;

    const cron = parseCron(agent.schedule);
    if (!cron) continue;

    if (!matchesCron(cron, now)) continue;

    // Check if already ran this minute
    const lastRun = _db.prepare(
      "SELECT * FROM cron_runs WHERE agent_id = ? AND started_at > datetime('now', '-1 minute')"
    ).get(agent.id);
    if (lastRun) continue;

    // Execute
    const runId = uuidv4();
    _db.prepare('INSERT INTO cron_runs (id, agent_id, status, started_at) VALUES (?, ?, ?, datetime(\'now\'))')
      .run(runId, agent.id, 'running');

    runningCronJobs.set(agent.id, runId);
    console.log(`[Cron] Starting agent: ${agent.name} (${agent.schedule})`);

    // Spawn agent execution
    try {
      const { spawn } = require('child_process');
      const path = require('path');
      const fs = require('fs');

      const agentDir = path.join(__dirname, '..', 'agents', agent.id);
      const ext = agent.type === 'python' ? '.py' : agent.type === 'bash' ? '.sh' : '.js';
      const scriptPath = path.join(agentDir, `agent${ext}`);

      if (!fs.existsSync(scriptPath)) {
        fs.mkdirSync(agentDir, { recursive: true });
        fs.writeFileSync(scriptPath, agent.script || 'echo "no script"');
      }

      const cmd = agent.type === 'python' ? 'python3' : agent.type === 'bash' ? 'bash' : 'node';
      const agentEnv = { ...process.env };
      try { Object.assign(agentEnv, JSON.parse(agent.env || '{}')); } catch {}

      const proc = spawn(cmd, [scriptPath], { cwd: agentDir, env: agentEnv, stdio: ['pipe', 'pipe', 'pipe'], timeout: 300000 });

      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', d => stdout += d.toString());
      proc.stderr.on('data', d => stderr += d.toString());

      proc.on('close', (code) => {
        const status = code === 0 ? 'completed' : 'failed';
        const output = (stdout ? '=== STDOUT ===\n' + stdout : '') + (stderr ? '\n=== STDERR ===\n' + stderr : '') || '(no output)';
        _db.prepare("UPDATE cron_runs SET status = ?, output = ?, finished_at = datetime('now') WHERE id = ?")
          .run(status, output.slice(0, 50000), runId);
        _db.prepare("UPDATE agents SET last_run = datetime('now') WHERE id = ?").run(agent.id);
        runningCronJobs.delete(agent.id);
        console.log(`[Cron] Agent ${agent.name} ${status} (exit ${code})`);
      });

      proc.on('error', (err) => {
        _db.prepare("UPDATE cron_runs SET status = ?, output = ?, finished_at = datetime('now') WHERE id = ?")
          .run('failed', err.message, runId);
        runningCronJobs.delete(agent.id);
      });
    } catch (err) {
      _db.prepare("UPDATE cron_runs SET status = ?, output = ?, finished_at = datetime('now') WHERE id = ?")
        .run('failed', err.message, runId);
      runningCronJobs.delete(agent.id);
    }
  }
}

function start(db) {
  _db = db;
  if (_tickInterval) clearInterval(_tickInterval);
  _tickInterval = setInterval(tick, 60000); // every 60s
  console.log('  Cron scheduler started');
}

function stop() {
  if (_tickInterval) { clearInterval(_tickInterval); _tickInterval = null; }
}

function getCronRuns(agentId, limit = 20) {
  if (!_db) return [];
  return _db.prepare('SELECT * FROM cron_runs WHERE agent_id = ? ORDER BY started_at DESC LIMIT ?')
    .all(agentId, limit);
}

module.exports = { start, stop, tick, parseCron, matchesCron, getNextRun, validateCron, getCronRuns, PRESETS };
