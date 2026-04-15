/**
 * Hyperion Cron Manager — Visual cron builder, list/create/edit/delete cron jobs
 */
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// ═══ CRON EXPRESSION PARSER ═══

const CRON_FIELDS = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];
const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseCronExpression(expr) {
  if (!expr || typeof expr !== 'string') throw new Error('Empty cron expression');
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) throw new Error('Cron expression needs 5 fields');

  const fields = {};
  CRON_FIELDS.forEach((name, i) => {
    fields[name] = parts[i];
  });
  fields.command = parts.slice(5).join(' ');
  return fields;
}

function describeCronExpression(expr) {
  try {
    const fields = parseCronExpression(expr);
    const parts = [];

    if (fields.minute === '*' && fields.hour === '*') parts.push('Every minute');
    else if (fields.minute === '0' && fields.hour === '*') parts.push('Every hour');
    else if (fields.minute !== '*' && fields.hour !== '*') parts.push(`At ${fields.hour}:${fields.minute.padStart(2, '0')}`);
    else if (fields.minute === '*/5') parts.push('Every 5 minutes');
    else if (fields.minute === '*/10') parts.push('Every 10 minutes');
    else if (fields.minute === '*/15') parts.push('Every 15 minutes');
    else if (fields.minute === '*/30') parts.push('Every 30 minutes');
    else parts.push(`Minute ${fields.minute}, hour ${fields.hour}`);

    if (fields.dayOfMonth !== '*') parts.push(`on day ${fields.dayOfMonth}`);
    if (fields.month !== '*') {
      const m = parseInt(fields.month);
      parts.push(`in ${(m >= 1 && m <= 12) ? MONTH_NAMES[m] : fields.month}`);
    }
    if (fields.dayOfWeek !== '*') {
      const d = parseInt(fields.dayOfWeek);
      parts.push(`on ${(d >= 0 && d <= 6) ? DAY_NAMES[d] : fields.dayOfWeek}`);
    }

    return parts.join(' ');
  } catch {
    return 'Invalid expression';
  }
}

function validateCronExpression(expr) {
  try {
    const fields = parseCronExpression(expr);
    const validators = {
      minute: { min: 0, max: 59 },
      hour: { min: 0, max: 23 },
      dayOfMonth: { min: 1, max: 31 },
      month: { min: 1, max: 12 },
      dayOfWeek: { min: 0, max: 7 },
    };

    for (const [field, range] of Object.entries(validators)) {
      const val = fields[field];
      if (val === '*') continue;
      if (/^\*\/\d+$/.test(val)) {
        const step = parseInt(val.split('/')[1]);
        if (step < 1 || step > range.max) return { valid: false, error: `Invalid step in ${field}` };
        continue;
      }
      // Comma-separated or range
      const subParts = val.split(',');
      for (const sub of subParts) {
        if (sub.includes('-')) {
          const [a, b] = sub.split('-').map(Number);
          if (isNaN(a) || isNaN(b) || a < range.min || b > range.max) return { valid: false, error: `Invalid range in ${field}` };
        } else {
          const n = parseInt(sub);
          if (isNaN(n) || n < range.min || n > range.max) return { valid: false, error: `Invalid value in ${field}: ${sub}` };
        }
      }
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// ═══ NEXT RUN CALCULATOR ═══

function getNextRuns(expr, count = 5) {
  const fields = parseCronExpression(expr);
  const runs = [];
  const now = new Date();
  let candidate = new Date(now);
  candidate.setSeconds(0);
  candidate.setMilliseconds(0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const maxIterations = 525600; // 1 year of minutes
  let iter = 0;

  while (runs.length < count && iter < maxIterations) {
    if (matchesField(fields.minute, candidate.getMinutes()) &&
        matchesField(fields.hour, candidate.getHours()) &&
        matchesField(fields.dayOfMonth, candidate.getDate()) &&
        matchesField(fields.month, candidate.getMonth() + 1) &&
        matchesField(fields.dayOfWeek, candidate.getDay())) {
      runs.push(new Date(candidate));
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
    iter++;
  }
  return runs.map(d => d.toISOString());
}

function matchesField(field, value) {
  if (field === '*') return true;
  if (field.startsWith('*/')) {
    const step = parseInt(field.split('/')[1]);
    return value % step === 0;
  }
  return field.split(',').some(part => {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      return value >= a && value <= b;
    }
    return parseInt(part) === value;
  });
}

// ═══ CRONTAB MANAGEMENT ═══

function listCrontab() {
  try {
    const output = execSync('crontab -l 2>/dev/null', { encoding: 'utf8' });
    const lines = output.split('\n').filter(l => l.trim());
    return lines.map((line, i) => {
      if (line.startsWith('#')) return { index: i, type: 'comment', raw: line };
      const fields = parseCronExpression(line);
      return {
        index: i,
        type: 'job',
        raw: line,
        schedule: `${fields.minute} ${fields.hour} ${fields.dayOfMonth} ${fields.month} ${fields.dayOfWeek}`,
        command: fields.command,
        description: describeCronExpression(line),
      };
    });
  } catch {
    return [];
  }
}

function addCrontabEntry(schedule, command) {
  if (!schedule || !command) throw new Error('Schedule and command required');
  const validation = validateCronExpression(`${schedule} ${command}`);
  if (!validation.valid) throw new Error(validation.error);

  const existing = _getRawCrontab();
  const newEntry = `${schedule} ${command}`;
  const updated = existing ? `${existing}\n${newEntry}` : newEntry;
  _writeCrontab(updated);
  return { added: newEntry };
}

function removeCrontabEntry(index) {
  const lines = _getRawCrontab().split('\n');
  if (index < 0 || index >= lines.length) throw new Error('Invalid entry index');
  const removed = lines.splice(index, 1)[0];
  _writeCrontab(lines.join('\n'));
  return { removed };
}

function updateCrontabEntry(index, schedule, command) {
  const lines = _getRawCrontab().split('\n');
  if (index < 0 || index >= lines.length) throw new Error('Invalid entry index');
  lines[index] = `${schedule} ${command}`;
  _writeCrontab(lines.join('\n'));
  return { updated: lines[index] };
}

function _getRawCrontab() {
  try {
    return execSync('crontab -l 2>/dev/null', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function _writeCrontab(content) {
  const tmpFile = `/tmp/hyperion_cron_${Date.now()}`;
  const fs = require('fs');
  fs.writeFileSync(tmpFile, content + '\n');
  try {
    execSync(`crontab "${tmpFile}"`, { encoding: 'utf8' });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// ═══ COMMON PRESETS ═══

function getPresets() {
  return [
    { name: 'Every minute', schedule: '* * * * *' },
    { name: 'Every 5 minutes', schedule: '*/5 * * * *' },
    { name: 'Every 15 minutes', schedule: '*/15 * * * *' },
    { name: 'Every hour', schedule: '0 * * * *' },
    { name: 'Every day at midnight', schedule: '0 0 * * *' },
    { name: 'Every day at 6 AM', schedule: '0 6 * * *' },
    { name: 'Every Monday at 9 AM', schedule: '0 9 * * 1' },
    { name: 'Every 1st of month', schedule: '0 0 1 * *' },
    { name: 'Weekdays at 8 AM', schedule: '0 8 * * 1-5' },
    { name: 'Every Sunday at 2 AM', schedule: '0 2 * * 0' },
  ];
}

// ═══ CRON RUN HISTORY (DB-backed) ═══

function logCronRun(db, agentId, status, output) {
  const id = uuidv4();
  db.prepare('INSERT INTO cron_runs (id, agent_id, status, output, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, agentId, status, output, new Date().toISOString(), new Date().toISOString());
  return id;
}

function getCronHistory(db, limit = 50) {
  return db.prepare('SELECT * FROM cron_runs ORDER BY started_at DESC LIMIT ?').all(limit);
}

module.exports = {
  parseCronExpression, describeCronExpression, validateCronExpression,
  getNextRuns, matchesField,
  listCrontab, addCrontabEntry, removeCrontabEntry, updateCrontabEntry,
  getPresets, logCronRun, getCronHistory,
};
