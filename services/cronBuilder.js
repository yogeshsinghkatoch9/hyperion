/* ═══ HYPERION — Cron Builder Service ═══ */
const { v4: uuid } = require('uuid');

const FIELD_RANGES = {
  minute:     { min: 0, max: 59, name: 'Minute' },
  hour:       { min: 0, max: 23, name: 'Hour' },
  dayOfMonth: { min: 1, max: 31, name: 'Day of Month' },
  month:      { min: 1, max: 12, name: 'Month' },
  dayOfWeek:  { min: 0, max: 6,  name: 'Day of Week' },
};

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Validate a single cron field */
function isValidField(field, min, max) {
  if (field === '*') return true;

  // Handle lists: 1,3,5
  const parts = field.split(',');
  for (const part of parts) {
    // Handle step: */5 or 1-10/2
    const stepParts = part.split('/');
    if (stepParts.length > 2) return false;

    const base = stepParts[0];
    const step = stepParts[1];

    if (step !== undefined) {
      const s = parseInt(step);
      if (isNaN(s) || s < 1) return false;
    }

    if (base === '*') continue;

    // Handle range: 1-5
    const rangeParts = base.split('-');
    if (rangeParts.length > 2) return false;

    for (const rp of rangeParts) {
      const num = parseInt(rp);
      if (isNaN(num) || num < min || num > max) return false;
    }

    if (rangeParts.length === 2) {
      if (parseInt(rangeParts[0]) > parseInt(rangeParts[1])) return false;
    }
  }
  return true;
}

/** Parse "* * * * *" into { minute, hour, dayOfMonth, month, dayOfWeek } */
function parseCron(expression) {
  if (!expression || typeof expression !== 'string') throw new Error('Cron expression is required');
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Expected 5 fields, got ${parts.length}`);

  const fields = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];
  const result = {};
  const errors = [];

  for (let i = 0; i < 5; i++) {
    const name = fields[i];
    const { min, max } = FIELD_RANGES[name];
    result[name] = parts[i];
    if (!isValidField(parts[i], min, max)) {
      errors.push(`Invalid ${FIELD_RANGES[name].name} field: "${parts[i]}" (allowed ${min}-${max})`);
    }
  }

  if (errors.length) throw new Error(errors.join('; '));
  return result;
}

/** Human-readable explanation */
function explainCron(expression) {
  const parsed = parseCron(expression);
  const parts = [];

  // Minute
  if (parsed.minute === '*') parts.push('Every minute');
  else if (parsed.minute.startsWith('*/')) parts.push(`Every ${parsed.minute.slice(2)} minutes`);
  else parts.push(`At minute ${parsed.minute}`);

  // Hour
  if (parsed.hour === '*') {
    if (parsed.minute !== '*' && !parsed.minute.startsWith('*/')) parts.push('of every hour');
  } else if (parsed.hour.startsWith('*/')) {
    parts.push(`every ${parsed.hour.slice(2)} hours`);
  } else {
    const h = parseInt(parsed.hour);
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const minStr = parsed.minute === '0' || parsed.minute === '00' ? '00' : parsed.minute;
      parts.length = 0;
      parts.push(`At ${h12}:${String(minStr).padStart(2, '0')} ${ampm}`);
    } else {
      parts.push(`at hour ${parsed.hour}`);
    }
  }

  // Day of Month
  if (parsed.dayOfMonth !== '*') {
    parts.push(`on day ${parsed.dayOfMonth} of the month`);
  }

  // Month
  if (parsed.month !== '*') {
    const m = parseInt(parsed.month);
    if (!isNaN(m) && MONTH_NAMES[m]) parts.push(`in ${MONTH_NAMES[m]}`);
    else parts.push(`in month ${parsed.month}`);
  }

  // Day of Week
  if (parsed.dayOfWeek !== '*') {
    if (parsed.dayOfWeek === '1-5') parts.push('on weekdays');
    else if (parsed.dayOfWeek === '0,6') parts.push('on weekends');
    else {
      const d = parseInt(parsed.dayOfWeek);
      if (!isNaN(d) && DAY_NAMES[d]) parts.push(`on ${DAY_NAMES[d]}`);
      else parts.push(`on day-of-week ${parsed.dayOfWeek}`);
    }
  }

  return parts.join(' ');
}

/** Build cron expression from parts */
function buildCron({ minute, hour, dayOfMonth, month, dayOfWeek }) {
  const m = minute ?? '*';
  const h = hour ?? '*';
  const dom = dayOfMonth ?? '*';
  const mon = month ?? '*';
  const dow = dayOfWeek ?? '*';
  const expr = `${m} ${h} ${dom} ${mon} ${dow}`;
  // Validate
  parseCron(expr);
  return expr;
}

/** Compute next N run times */
function getNextRuns(expression, count = 5, fromDate = null) {
  parseCron(expression); // validate
  const runs = [];
  const start = fromDate ? new Date(fromDate) : new Date();
  const current = new Date(start);
  current.setSeconds(0, 0);
  current.setMinutes(current.getMinutes() + 1);

  const maxIterations = 525600; // 1 year of minutes
  let iterations = 0;

  while (runs.length < count && iterations < maxIterations) {
    if (matchesCron(current, expression)) {
      runs.push(new Date(current).toISOString());
    }
    current.setMinutes(current.getMinutes() + 1);
    iterations++;
  }

  return runs;
}

function matchesCron(date, expression) {
  const parts = expression.trim().split(/\s+/);
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  return fieldMatches(parts[0], minute, 0, 59) &&
    fieldMatches(parts[1], hour, 0, 23) &&
    fieldMatches(parts[2], dayOfMonth, 1, 31) &&
    fieldMatches(parts[3], month, 1, 12) &&
    fieldMatches(parts[4], dayOfWeek, 0, 6);
}

function fieldMatches(field, value, min, max) {
  if (field === '*') return true;
  const parts = field.split(',');
  for (const part of parts) {
    const [base, step] = part.split('/');
    const stepVal = step ? parseInt(step) : 1;

    if (base === '*') {
      if ((value - min) % stepVal === 0) return true;
    } else if (base.includes('-')) {
      const [lo, hi] = base.split('-').map(Number);
      if (value >= lo && value <= hi && (value - lo) % stepVal === 0) return true;
    } else {
      if (parseInt(base) === value) return true;
    }
  }
  return false;
}

/** Validate cron expression */
function validateCron(expression) {
  try {
    parseCron(expression);
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/** Common presets */
function getPresets() {
  return [
    { name: 'Every Minute',  expression: '* * * * *',     description: 'Runs every minute' },
    { name: 'Every 5 Minutes', expression: '*/5 * * * *', description: 'Runs every 5 minutes' },
    { name: 'Every 15 Minutes', expression: '*/15 * * * *', description: 'Runs every 15 minutes' },
    { name: 'Hourly',        expression: '0 * * * *',     description: 'Runs at the top of every hour' },
    { name: 'Daily (Midnight)', expression: '0 0 * * *',  description: 'Runs at midnight every day' },
    { name: 'Daily (Noon)',  expression: '0 12 * * *',    description: 'Runs at noon every day' },
    { name: 'Weekly (Monday)', expression: '0 0 * * 1',   description: 'Runs at midnight every Monday' },
    { name: 'Monthly',       expression: '0 0 1 * *',     description: 'Runs at midnight on the 1st of each month' },
    { name: 'Yearly',        expression: '0 0 1 1 *',     description: 'Runs at midnight on January 1st' },
    { name: 'Weekdays',      expression: '0 9 * * 1-5',   description: 'Runs at 9:00 AM on weekdays' },
    { name: 'Weekends',      expression: '0 10 * * 0,6',  description: 'Runs at 10:00 AM on weekends' },
  ];
}

/** Save custom preset */
function savePreset(db, { name, expression, description }) {
  parseCron(expression); // validate first
  const id = uuid();
  db.prepare('INSERT INTO cron_presets (id, name, expression, description) VALUES (?, ?, ?, ?)')
    .run(id, name || 'Untitled', expression, description || '');
  return { id, name, expression, description };
}

/** List custom presets */
function getCustomPresets(db) {
  return db.prepare('SELECT * FROM cron_presets ORDER BY created_at DESC').all();
}

/** Delete custom preset */
function deletePreset(db, id) {
  const info = db.prepare('DELETE FROM cron_presets WHERE id = ?').run(id);
  if (info.changes === 0) throw new Error('Preset not found');
}

module.exports = {
  parseCron, explainCron, buildCron, getNextRuns,
  validateCron, getPresets, isValidField,
  savePreset, getCustomPresets, deletePreset,
};
