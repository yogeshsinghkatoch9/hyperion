const express = require('express');
const router = express.Router();
const dbExplorer = require('../services/dbExplorer');

// GET /api/db/connections — List all connections
router.get('/connections', (req, res) => {
  res.json(dbExplorer.listConnections());
});

// POST /api/db/connect — Connect to a SQLite file
router.post('/connect', (req, res) => {
  try {
    const { path: dbPath, name } = req.body;
    if (!dbPath) return res.status(400).json({ error: 'Database path required' });
    const conn = dbExplorer.connect(dbPath, name);
    res.json(conn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/db/connect/hyperion — Connect Hyperion's own DB
router.post('/connect/hyperion', (req, res) => {
  try {
    const conn = dbExplorer.connectHyperion(req.app.locals.db);
    res.json(conn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/db/connections/:id — Disconnect
router.delete('/connections/:id', (req, res) => {
  dbExplorer.disconnect(req.params.id);
  res.json({ ok: true });
});

// GET /api/db/:connId/tables — List tables
router.get('/:connId/tables', (req, res) => {
  try {
    const tables = dbExplorer.getTables(req.params.connId);
    res.json(tables);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/db/:connId/schema/:table — Table schema
router.get('/:connId/schema/:table', (req, res) => {
  try {
    const schema = dbExplorer.getTableSchema(req.params.connId, req.params.table);
    res.json(schema);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/db/:connId/data/:table — Table data (paginated)
router.get('/:connId/data/:table', (req, res) => {
  try {
    const { limit, offset, orderBy, orderDir } = req.query;
    const data = dbExplorer.getTableData(req.params.connId, req.params.table, {
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
      orderBy,
      orderDir,
    });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/db/:connId/query — Execute SQL
router.post('/:connId/query', (req, res) => {
  const { sql, params } = req.body;
  const connId = req.params.connId;
  try {
    const result = dbExplorer.executeQuery(connId, sql, params);
    // Log to history
    dbExplorer.addQueryHistory(req.app.locals.db, {
      connId,
      sql,
      rowCount: result.rowCount || result.changes || 0,
      time: result.time,
    });
    res.json(result);
  } catch (err) {
    dbExplorer.addQueryHistory(req.app.locals.db, {
      connId,
      sql,
      error: err.message,
    });
    res.status(400).json({ error: err.message });
  }
});

// POST /api/db/export/csv — Export as CSV
router.post('/export/csv', (req, res) => {
  const { columns, rows } = req.body;
  const csv = dbExplorer.exportCsv(columns || [], rows || []);
  res.type('text/csv').send(csv);
});

// POST /api/db/export/json — Export as JSON
router.post('/export/json', (req, res) => {
  const { rows } = req.body;
  const json = dbExplorer.exportJson(rows || []);
  res.type('application/json').send(json);
});

// ── Database Export ──

// GET /api/db/:connId/export/sql — full SQL dump
router.get('/:connId/export/sql', (req, res) => {
  try {
    const conn = dbExplorer.getConnection(req.params.connId);
    const tables = conn.db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();

    let dump = '-- Hyperion SQL Dump\n-- Generated: ' + new Date().toISOString() + '\n\n';

    for (const table of tables) {
      dump += table.sql + ';\n\n';
      const rows = conn.db.prepare(`SELECT * FROM "${table.name.replace(/[^a-zA-Z0-9_]/g, '')}"`).all();
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = cols.map(c => {
          const v = row[c];
          if (v === null) return 'NULL';
          if (typeof v === 'number') return v;
          return "'" + String(v).replace(/'/g, "''") + "'";
        });
        dump += `INSERT INTO "${table.name}" (${cols.map(c => '"' + c + '"').join(', ')}) VALUES (${vals.join(', ')});\n`;
      }
      dump += '\n';
    }

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="export_${Date.now()}.sql"`);
    res.send(dump);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/db/:connId/export/csv/:table — single table CSV
router.get('/:connId/export/csv/:table', (req, res) => {
  try {
    const tableName = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
    const conn = dbExplorer.getConnection(req.params.connId);
    const rows = conn.db.prepare(`SELECT * FROM "${tableName}"`).all();
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const csv = dbExplorer.exportCsv(columns, rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${tableName}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/db/:connId/export/json/:table — single table JSON
router.get('/:connId/export/json/:table', (req, res) => {
  try {
    const tableName = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
    const conn = dbExplorer.getConnection(req.params.connId);
    const rows = conn.db.prepare(`SELECT * FROM "${tableName}"`).all();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${tableName}.json"`);
    res.send(JSON.stringify(rows, null, 2));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Saved Queries ──

// GET /api/db/saved — List saved queries
router.get('/saved', (req, res) => {
  res.json(dbExplorer.getSavedQueries(req.app.locals.db));
});

// POST /api/db/saved — Save a query
router.post('/saved', (req, res) => {
  try {
    const { name, sql, connId, description } = req.body;
    if (!name || !sql) return res.status(400).json({ error: 'Name and SQL required' });
    const result = dbExplorer.saveQuery(req.app.locals.db, { name, sql, connId, description });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/db/saved/:id — Delete saved query
router.delete('/saved/:id', (req, res) => {
  dbExplorer.deleteSavedQuery(req.app.locals.db, req.params.id);
  res.json({ ok: true });
});

// ── Query History ──

// GET /api/db/history — Get query history
router.get('/history', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 50;
  res.json(dbExplorer.getQueryHistory(req.app.locals.db, limit));
});

// DELETE /api/db/history — Clear history
router.delete('/history', (req, res) => {
  dbExplorer.clearQueryHistory(req.app.locals.db);
  res.json({ ok: true });
});

module.exports = router;
