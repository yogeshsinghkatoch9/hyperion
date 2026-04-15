const { v4: uuidv4 } = require('uuid');

const ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ACCESS: 'ACCESS',
  EXPORT: 'EXPORT',
};

const METHOD_ACTION = { POST: ACTIONS.CREATE, PUT: ACTIONS.UPDATE, DELETE: ACTIONS.DELETE, PATCH: ACTIONS.UPDATE };

function log(db, { userId, username, action, resource, details, ip, userAgent, statusCode }) {
  const id = uuidv4();
  db.prepare(
    `INSERT INTO audit_logs (id, user_id, username, action, resource, details, ip, user_agent, status_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId || null, username || null, action, resource || null,
    typeof details === 'object' ? JSON.stringify(details) : details || null,
    ip || null, userAgent || null, statusCode || null);
  return id;
}

function query(db, { userId, action, resource, from, to, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  if (userId)   { conditions.push('user_id = ?');  params.push(userId); }
  if (action)   { conditions.push('action = ?');    params.push(action); }
  if (resource) { conditions.push('resource LIKE ?'); params.push(`%${resource}%`); }
  if (from)     { conditions.push('created_at >= ?'); params.push(from); }
  if (to)       { conditions.push('created_at <= ?'); params.push(to); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM audit_logs ${where}`).get(...params);
  return { rows, total };
}

function getTimeline(db, { from, to, bucketMinutes = 60 } = {}) {
  const conditions = [];
  const params = [];
  if (from) { conditions.push('created_at >= ?'); params.push(from); }
  if (to)   { conditions.push('created_at <= ?'); params.push(to); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT strftime('%Y-%m-%dT%H:', created_at) ||
           CAST((CAST(strftime('%M', created_at) AS INTEGER) / ${Math.max(1, Math.floor(bucketMinutes))} * ${Math.max(1, Math.floor(bucketMinutes))}) AS TEXT) ||
           ':00' AS bucket,
           COUNT(*) as count
    FROM audit_logs ${where}
    GROUP BY bucket ORDER BY bucket
  `).all(...params);
  return rows;
}

function getTopUsers(db, { from, to, limit = 10 } = {}) {
  const conditions = [];
  const params = [];
  if (from) { conditions.push('created_at >= ?'); params.push(from); }
  if (to)   { conditions.push('created_at <= ?'); params.push(to); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  return db.prepare(`
    SELECT username, user_id, COUNT(*) as action_count
    FROM audit_logs ${where}
    GROUP BY user_id, username ORDER BY action_count DESC LIMIT ?
  `).all(...params, limit);
}

function getSuspiciousActivity(db) {
  const alerts = [];

  // Failed logins (>3 from same IP in 5 minutes) — check login_history table
  try {
    const failedLogins = db.prepare(`
      SELECT ip, COUNT(*) as cnt, MAX(created_at) as last_attempt
      FROM login_history
      WHERE success = 0 AND created_at >= datetime('now', '-5 minutes')
      GROUP BY ip HAVING cnt >= 3
    `).all();
    for (const fl of failedLogins) {
      alerts.push({ type: 'brute_force', severity: 'high', message: `${fl.cnt} failed logins from IP ${fl.ip}`, ip: fl.ip, lastAttempt: fl.last_attempt });
    }
  } catch {}

  // Mass deletes (>10 in 1 minute)
  try {
    const massDeletes = db.prepare(`
      SELECT username, COUNT(*) as cnt
      FROM audit_logs
      WHERE action = 'DELETE' AND created_at >= datetime('now', '-1 minute')
      GROUP BY username HAVING cnt >= 10
    `).all();
    for (const md of massDeletes) {
      alerts.push({ type: 'mass_delete', severity: 'medium', message: `${md.cnt} deletions by ${md.username} in last minute`, username: md.username });
    }
  } catch {}

  // 401 bursts (>5 in 1 minute)
  try {
    const authBursts = db.prepare(`
      SELECT ip, COUNT(*) as cnt
      FROM audit_logs
      WHERE status_code = 401 AND created_at >= datetime('now', '-1 minute')
      GROUP BY ip HAVING cnt >= 5
    `).all();
    for (const ab of authBursts) {
      alerts.push({ type: 'auth_burst', severity: 'high', message: `${ab.cnt} unauthorized requests from IP ${ab.ip}`, ip: ab.ip });
    }
  } catch {}

  return alerts;
}

function exportCsv(db, filters = {}) {
  const { rows } = query(db, { ...filters, limit: 10000, offset: 0 });
  const header = 'id,user_id,username,action,resource,details,ip,user_agent,status_code,created_at';
  const lines = rows.map(r =>
    [r.id, r.user_id, r.username, r.action, r.resource,
     `"${(r.details || '').replace(/"/g, '""')}"`,
     r.ip, r.user_agent, r.status_code, r.created_at].join(',')
  );
  return header + '\n' + lines.join('\n');
}

function middleware() {
  return (req, res, next) => {
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();

    res.on('finish', () => {
      try {
        const db = req.app.locals.db;
        if (!db) return;
        const action = METHOD_ACTION[req.method] || req.method;
        const user = req.user || {};
        log(db, {
          userId: user.id || user.userId,
          username: user.username,
          action,
          resource: req.baseUrl + req.path,
          details: { method: req.method, body: req.body },
          ip: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          statusCode: res.statusCode,
        });
      } catch (e) { /* silent — audit should never break the app */ }
    });
    next();
  };
}

module.exports = { log, query, getTimeline, getTopUsers, getSuspiciousActivity, exportCsv, middleware, ACTIONS };
