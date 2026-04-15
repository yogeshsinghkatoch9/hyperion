const { v4: uuidv4 } = require('uuid');

const DEFAULTS = {
  focus: 25,
  break: 5,
  long_break: 15,
};

const VALID_TYPES = ['focus', 'break', 'long_break'];

// ── Validation ──
function validateDuration(minutes) {
  const m = Number(minutes);
  if (isNaN(m) || m < 1 || m > 120) return false;
  return true;
}

function formatTimer(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// ── Session CRUD ──
function startSession(db, { type, duration, label }) {
  const sessionType = VALID_TYPES.includes(type) ? type : 'focus';
  const dur = duration || DEFAULTS[sessionType];
  if (!validateDuration(dur)) throw new Error('Duration must be 1-120 minutes');
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO pomodoro_sessions (id, type, duration_min, label, status, started_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, sessionType, dur, label || '', 'active', now);
  return { id, type: sessionType, duration_min: dur, status: 'active', started_at: now };
}

function completeSession(db, id) {
  const session = db.prepare('SELECT * FROM pomodoro_sessions WHERE id = ?').get(id);
  if (!session) throw new Error('Session not found');
  if (session.status !== 'active') throw new Error('Session is not active');
  const now = new Date().toISOString();
  db.prepare('UPDATE pomodoro_sessions SET status = ?, completed_at = ? WHERE id = ?')
    .run('completed', now, id);
  return { id, status: 'completed', completed_at: now };
}

function cancelSession(db, id) {
  const session = db.prepare('SELECT * FROM pomodoro_sessions WHERE id = ?').get(id);
  if (!session) throw new Error('Session not found');
  if (session.status !== 'active') throw new Error('Session is not active');
  const now = new Date().toISOString();
  db.prepare('UPDATE pomodoro_sessions SET status = ?, completed_at = ? WHERE id = ?')
    .run('cancelled', now, id);
  return { id, status: 'cancelled' };
}

function getActiveSession(db) {
  return db.prepare("SELECT * FROM pomodoro_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1").get() || null;
}

function getSessions(db, limit) {
  const lim = limit || 50;
  return db.prepare('SELECT * FROM pomodoro_sessions ORDER BY started_at DESC LIMIT ?').all(lim);
}

function getDayStats(db, date) {
  const day = date || new Date().toISOString().split('T')[0];
  const start = `${day}T00:00:00.000Z`;
  const end = `${day}T23:59:59.999Z`;
  const sessions = db.prepare("SELECT * FROM pomodoro_sessions WHERE started_at >= ? AND started_at <= ? AND status = 'completed'")
    .all(start, end);
  const focusSessions = sessions.filter(s => s.type === 'focus');
  const breakSessions = sessions.filter(s => s.type === 'break' || s.type === 'long_break');
  return {
    date: day,
    completed: sessions.length,
    focusSessions: focusSessions.length,
    totalFocusMinutes: focusSessions.reduce((a, s) => a + s.duration_min, 0),
    breaksTaken: breakSessions.length,
  };
}

function getWeekStats(db) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    days.push(getDayStats(db, dateStr));
  }
  return {
    days,
    totalFocusMinutes: days.reduce((a, d) => a + d.totalFocusMinutes, 0),
    totalSessions: days.reduce((a, d) => a + d.completed, 0),
    avgFocusPerDay: Math.round(days.reduce((a, d) => a + d.totalFocusMinutes, 0) / 7),
  };
}

function getStreak(db) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    const start = `${dateStr}T00:00:00.000Z`;
    const end = `${dateStr}T23:59:59.999Z`;
    const count = db.prepare("SELECT COUNT(*) as cnt FROM pomodoro_sessions WHERE type = 'focus' AND status = 'completed' AND started_at >= ? AND started_at <= ?")
      .get(start, end).cnt;
    if (count > 0) streak++;
    else break;
  }
  return { streak, unit: 'days' };
}

function getDefaults() {
  return { ...DEFAULTS, types: VALID_TYPES };
}

module.exports = {
  DEFAULTS, VALID_TYPES, validateDuration, formatTimer,
  startSession, completeSession, cancelSession, getActiveSession,
  getSessions, getDayStats, getWeekStats, getStreak, getDefaults,
};
