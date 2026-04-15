/**
 * Hyperion DB Explorer — SQLite Database Browser & Query Runner
 * Connection management, schema inspection, query execution, export
 */
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ── Connection Pool ──
const connections = new Map(); // id -> { db, name, path, connectedAt }
const MAX_CONNECTIONS = 10;

// ═══ CONNECTIONS ═══

function connect(dbPath, name) {
  if (connections.size >= MAX_CONNECTIONS) {
    throw new Error(`Maximum ${MAX_CONNECTIONS} connections reached`);
  }

  // Resolve path
  const resolvedPath = path.resolve(dbPath);

  // Check if already connected
  for (const [id, conn] of connections) {
    if (conn.path === resolvedPath) return { id, ...getConnectionInfo(id) };
  }

  try {
    const db = new Database(resolvedPath, { readonly: false, fileMustExist: true });
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const id = uuidv4();
    connections.set(id, {
      db,
      name: name || path.basename(resolvedPath),
      path: resolvedPath,
      connectedAt: Date.now(),
    });

    return { id, name: name || path.basename(resolvedPath), path: resolvedPath };
  } catch (err) {
    throw new Error(`Failed to connect: ${err.message}`);
  }
}

function connectHyperion(hyperionDb) {
  // Special: wrap the existing Hyperion DB instance
  const id = 'hyperion';
  if (connections.has(id)) return { id, ...getConnectionInfo(id) };

  connections.set(id, {
    db: hyperionDb,
    name: 'Hyperion (internal)',
    path: 'hyperion.db',
    connectedAt: Date.now(),
    isInternal: true,
  });

  return { id, name: 'Hyperion (internal)', path: 'hyperion.db' };
}

function disconnect(id) {
  const conn = connections.get(id);
  if (!conn) return;

  // Don't close internal Hyperion DB
  if (!conn.isInternal) {
    try { conn.db.close(); } catch {}
  }
  connections.delete(id);
}

function getConnection(id) {
  const conn = connections.get(id);
  if (!conn) throw new Error('Connection not found');
  return conn;
}

function getConnectionInfo(id) {
  const conn = connections.get(id);
  if (!conn) return null;
  return {
    id,
    name: conn.name,
    path: conn.path,
    connectedAt: conn.connectedAt,
    isInternal: !!conn.isInternal,
  };
}

function listConnections() {
  const result = [];
  for (const [id, conn] of connections) {
    result.push({
      id,
      name: conn.name,
      path: conn.path,
      connectedAt: conn.connectedAt,
      isInternal: !!conn.isInternal,
    });
  }
  return result;
}

// ═══ SCHEMA ═══

function getTables(connId) {
  const { db } = getConnection(connId);
  const rows = db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name").all();
  return rows;
}

function getTableSchema(connId, tableName) {
  const { db } = getConnection(connId);
  // Validate table name to prevent injection
  const safeName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

  const columns = db.prepare(`PRAGMA table_info("${safeName}")`).all();
  const indexes = db.prepare(`PRAGMA index_list("${safeName}")`).all();
  const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${safeName}")`).all();

  // Get row count
  let rowCount = 0;
  try {
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM "${safeName}"`).get();
    rowCount = countRow?.count || 0;
  } catch {}

  // Get CREATE statement
  let createSql = '';
  try {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(safeName);
    createSql = row?.sql || '';
  } catch {}

  return {
    name: safeName,
    columns: columns.map(c => ({
      name: c.name,
      type: c.type,
      notNull: !!c.notnull,
      defaultValue: c.dflt_value,
      primaryKey: !!c.pk,
    })),
    indexes: indexes.map(i => ({
      name: i.name,
      unique: !!i.unique,
      columns: db.prepare(`PRAGMA index_info("${i.name}")`).all().map(ic => ic.name),
    })),
    foreignKeys: foreignKeys.map(fk => ({
      from: fk.from,
      table: fk.table,
      to: fk.to,
      onUpdate: fk.on_update,
      onDelete: fk.on_delete,
    })),
    rowCount,
    createSql,
  };
}

function getTableData(connId, tableName, { limit = 100, offset = 0, orderBy, orderDir = 'ASC' } = {}) {
  const { db } = getConnection(connId);
  const safeName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

  let sql = `SELECT * FROM "${safeName}"`;

  if (orderBy) {
    const safeOrder = orderBy.replace(/[^a-zA-Z0-9_]/g, '');
    const dir = orderDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    sql += ` ORDER BY "${safeOrder}" ${dir}`;
  }

  sql += ` LIMIT ? OFFSET ?`;

  const rows = db.prepare(sql).all(Math.min(limit, 1000), offset);

  // Get total count
  let total = 0;
  try {
    total = db.prepare(`SELECT COUNT(*) as c FROM "${safeName}"`).get()?.c || 0;
  } catch {}

  // Get column names from first row or pragma
  let columns = [];
  if (rows.length > 0) {
    columns = Object.keys(rows[0]);
  } else {
    columns = db.prepare(`PRAGMA table_info("${safeName}")`).all().map(c => c.name);
  }

  return { columns, rows, total, limit, offset };
}

// ═══ QUERY EXECUTION ═══

function executeQuery(connId, sql, params = []) {
  const { db } = getConnection(connId);

  if (!sql || !sql.trim()) throw new Error('Empty query');

  const trimmed = sql.trim();
  const startTime = Date.now();

  // Detect if it's a read or write query
  const isRead = /^\s*(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(trimmed);

  try {
    if (isRead) {
      const stmt = db.prepare(trimmed);
      const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
      const elapsed = Date.now() - startTime;

      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return {
        type: 'select',
        columns,
        rows,
        rowCount: rows.length,
        time: elapsed,
      };
    } else {
      const stmt = db.prepare(trimmed);
      const result = params.length > 0 ? stmt.run(...params) : stmt.run();
      const elapsed = Date.now() - startTime;

      return {
        type: 'modify',
        changes: result.changes,
        lastInsertRowid: Number(result.lastInsertRowid),
        time: elapsed,
      };
    }
  } catch (err) {
    throw new Error(`SQL Error: ${err.message}`);
  }
}

// ═══ EXPORT ═══

function exportCsv(columns, rows) {
  const header = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
  const lines = [header];

  for (const row of rows) {
    const values = columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

function exportJson(rows) {
  return JSON.stringify(rows, null, 2);
}

// ═══ SAVED QUERIES ═══

function saveQuery(appDb, { name, sql, connId, description }) {
  const id = uuidv4();
  appDb.prepare('INSERT INTO saved_queries (id, name, sql, conn_id, description, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))')
    .run(id, name, sql, connId || '', description || '');
  return { id, name, sql };
}

function getSavedQueries(appDb) {
  try {
    return appDb.prepare('SELECT * FROM saved_queries ORDER BY created_at DESC').all();
  } catch { return []; }
}

function deleteSavedQuery(appDb, id) {
  appDb.prepare('DELETE FROM saved_queries WHERE id = ?').run(id);
}

// ═══ QUERY HISTORY ═══

function addQueryHistory(appDb, { connId, sql, rowCount, time, error }) {
  try {
    const id = uuidv4();
    appDb.prepare('INSERT INTO query_history (id, conn_id, sql, row_count, time_ms, error, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))')
      .run(id, connId || '', sql, rowCount || 0, time || 0, error || null);
  } catch {}
}

function getQueryHistory(appDb, limit = 50) {
  try {
    return appDb.prepare('SELECT * FROM query_history ORDER BY created_at DESC LIMIT ?').all(limit);
  } catch { return []; }
}

function clearQueryHistory(appDb) {
  try { appDb.prepare('DELETE FROM query_history').run(); } catch {}
}

// ═══ CLEANUP ═══

function closeAll() {
  for (const [id, conn] of connections) {
    if (!conn.isInternal) {
      try { conn.db.close(); } catch {}
    }
  }
  connections.clear();
}

// ═══ EXPORTS ═══
module.exports = {
  connect,
  connectHyperion,
  disconnect,
  getConnection,
  getConnectionInfo,
  listConnections,

  getTables,
  getTableSchema,
  getTableData,

  executeQuery,

  exportCsv,
  exportJson,

  saveQuery,
  getSavedQueries,
  deleteSavedQuery,

  addQueryHistory,
  getQueryHistory,
  clearQueryHistory,

  closeAll,
};
