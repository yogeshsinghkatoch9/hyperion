'use strict';

const EXPORTABLE_TABLES = [
  'settings', 'workflow_profiles', 'snippets', 'bookmarks',
  'ssh_connections', 'webhook_subscriptions', 'dashboard_widgets',
  'cron_presets', 'color_palettes', 'regex_patterns', 'mock_endpoints',
];

const SENSITIVE_FIELDS = ['password', 'password_hash', 'secret', 'key_hash', 'encrypted_secret', 'encrypted_value', 'encrypted_notes'];

function sanitizeRow(row) {
  const cleaned = { ...row };
  for (const field of SENSITIVE_FIELDS) {
    if (field in cleaned) {
      cleaned[field] = '***REDACTED***';
    }
  }
  return cleaned;
}

function isValidTable(name) {
  return EXPORTABLE_TABLES.includes(name);
}

function exportConfig(db, tables) {
  const selectedTables = (tables || EXPORTABLE_TABLES).filter(isValidTable);
  const data = {
    _meta: {
      version: 1,
      exportedAt: new Date().toISOString(),
      tables: selectedTables,
    },
  };

  for (const table of selectedTables) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table}`).all();
      data[table] = rows.map(sanitizeRow);
    } catch {
      data[table] = [];
    }
  }

  return data;
}

function importConfig(db, data, mode = 'merge') {
  if (!data || typeof data !== 'object') throw new Error('Invalid import data');
  if (!data._meta) throw new Error('Missing _meta header — not a valid export file');

  const results = {};
  const tables = Object.keys(data).filter(k => k !== '_meta' && isValidTable(k));

  const tx = db.transaction(() => {
    for (const table of tables) {
      const rows = data[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        results[table] = { imported: 0, skipped: 0 };
        continue;
      }

      let imported = 0, skipped = 0;

      if (mode === 'overwrite') {
        db.prepare(`DELETE FROM ${table}`).run();
      }

      for (const row of rows) {
        // Remove redacted fields
        const cleaned = {};
        for (const [k, v] of Object.entries(row)) {
          if (v !== '***REDACTED***') cleaned[k] = v;
        }

        const cols = Object.keys(cleaned);
        if (cols.length === 0) { skipped++; continue; }

        const placeholders = cols.map(() => '?').join(', ');
        const values = cols.map(c => typeof cleaned[c] === 'object' ? JSON.stringify(cleaned[c]) : cleaned[c]);

        try {
          if (mode === 'merge') {
            db.prepare(`INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...values);
          } else {
            db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...values);
          }
          imported++;
        } catch {
          skipped++;
        }
      }

      results[table] = { imported, skipped };
    }
  });
  tx();

  return results;
}

function exportTableCsv(db, tableName) {
  if (!isValidTable(tableName)) throw new Error(`Table '${tableName}' is not exportable`);

  const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
  if (rows.length === 0) return '';

  const cols = Object.keys(rows[0]);
  const header = cols.join(',');
  const lines = rows.map(r =>
    cols.map(c => {
      const val = r[c];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (SENSITIVE_FIELDS.includes(c)) return '***REDACTED***';
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  return header + '\n' + lines.join('\n');
}

module.exports = {
  EXPORTABLE_TABLES,
  exportConfig,
  importConfig,
  exportTableCsv,
  isValidTable,
};
