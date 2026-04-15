const { v4: uuidv4 } = require('uuid');

// ── Format Detection ──
function detectFormat(text) {
  if (!text || typeof text !== 'string') return 'unknown';
  const trimmed = text.trim();
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
    try { JSON.parse(trimmed); return 'json'; } catch { /* fall through */ }
  }
  const firstLine = trimmed.split('\n')[0] || '';
  if (firstLine.includes('\t')) return 'tsv';
  if (firstLine.includes(',')) return 'csv';
  return 'unknown';
}

// ── CSV/TSV Parsing ──
function parseCSV(text, delimiter) {
  if (!text || typeof text !== 'string') return { headers: [], rows: [] };
  const delim = delimiter || (text.includes('\t') ? '\t' : ',');
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === delim && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] !== undefined ? vals[i] : ''; });
    return row;
  });

  return { headers, rows };
}

// ── JSON Parsing ──
function parseJSON(text) {
  if (!text || typeof text !== 'string') return { headers: [], rows: [] };
  const data = JSON.parse(text.trim());
  if (Array.isArray(data)) {
    if (data.length === 0) return { headers: [], rows: [] };
    const headers = [...new Set(data.flatMap(item => typeof item === 'object' && item !== null ? Object.keys(item) : []))];
    const rows = data.map(item => {
      if (typeof item !== 'object' || item === null) return { value: String(item) };
      const row = {};
      headers.forEach(h => { row[h] = item[h] !== undefined ? String(item[h]) : ''; });
      return row;
    });
    if (headers.length === 0 && rows.length > 0) return { headers: ['value'], rows };
    return { headers, rows };
  }
  if (typeof data === 'object' && data !== null) {
    const headers = ['key', 'value'];
    const rows = Object.entries(data).map(([k, v]) => ({ key: k, value: String(v) }));
    return { headers, rows };
  }
  return { headers: ['value'], rows: [{ value: String(data) }] };
}

// ── Filter ──
function filterRows(rows, column, operator, value) {
  if (!rows || !column || !operator) return rows || [];
  return rows.filter(row => {
    const cell = String(row[column] || '');
    const val = String(value || '');
    switch (operator) {
      case 'equals': return cell === val;
      case 'contains': return cell.toLowerCase().includes(val.toLowerCase());
      case 'gt': return parseFloat(cell) > parseFloat(val);
      case 'lt': return parseFloat(cell) < parseFloat(val);
      case 'startsWith': return cell.toLowerCase().startsWith(val.toLowerCase());
      case 'endsWith': return cell.toLowerCase().endsWith(val.toLowerCase());
      default: return true;
    }
  });
}

// ── Sort ──
function sortRows(rows, column, direction) {
  if (!rows || !column) return rows || [];
  const dir = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const aVal = a[column] || '';
    const bVal = b[column] || '';
    const aNum = parseFloat(aVal);
    const bNum = parseFloat(bVal);
    if (!isNaN(aNum) && !isNaN(bNum)) return (aNum - bNum) * dir;
    return String(aVal).localeCompare(String(bVal)) * dir;
  });
}

// ── Aggregate ──
function aggregate(rows, column, fn) {
  if (!rows || !column) return null;
  const values = rows.map(r => r[column]).filter(v => v !== undefined && v !== '');
  const nums = values.map(Number).filter(n => !isNaN(n));

  switch (fn) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'avg': return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
    case 'min': return nums.length > 0 ? Math.min(...nums) : null;
    case 'max': return nums.length > 0 ? Math.max(...nums) : null;
    case 'count': return values.length;
    case 'distinct': return [...new Set(values)].length;
    default: return null;
  }
}

// ── Paginate ──
function paginate(rows, page, pageSize) {
  const p = Math.max(1, page || 1);
  const size = Math.max(1, pageSize || 25);
  const totalPages = Math.ceil((rows || []).length / size);
  const start = (p - 1) * size;
  return {
    rows: (rows || []).slice(start, start + size),
    page: p,
    pageSize: size,
    totalRows: (rows || []).length,
    totalPages,
  };
}

// ── Export CSV ──
function exportCSV(headers, rows) {
  if (!headers || !rows) return '';
  const escapeField = (val) => {
    const s = String(val || '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escapeField).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escapeField(row[h] || '')).join(','));
  }
  return lines.join('\n');
}

// ── DB CRUD ──
function saveDataSet(db, name, content, format) {
  if (!name) throw new Error('Name is required');
  if (!content) throw new Error('Content is required');
  const id = uuidv4();
  const now = new Date().toISOString();
  let rowCount = 0;
  try {
    const fmt = format || detectFormat(content);
    if (fmt === 'json') rowCount = parseJSON(content).rows.length;
    else rowCount = parseCSV(content).rows.length;
  } catch { /* ignore */ }
  db.prepare('INSERT INTO data_sets (id, name, content, format, row_count, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, name, content, format || detectFormat(content), rowCount, now);
  return { id, name, format: format || detectFormat(content), row_count: rowCount };
}

function getDataSets(db) {
  return db.prepare('SELECT id, name, format, row_count, created_at FROM data_sets ORDER BY created_at DESC').all();
}

function getDataSet(db, id) {
  const row = db.prepare('SELECT * FROM data_sets WHERE id = ?').get(id);
  if (!row) throw new Error('Data set not found');
  return row;
}

function deleteDataSet(db, id) {
  const r = db.prepare('DELETE FROM data_sets WHERE id = ?').run(id);
  if (r.changes === 0) throw new Error('Data set not found');
}

module.exports = {
  detectFormat, parseCSV, parseJSON, filterRows, sortRows,
  aggregate, paginate, exportCSV,
  saveDataSet, getDataSets, getDataSet, deleteDataSet,
};
