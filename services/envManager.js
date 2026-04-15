/**
 * Hyperion Env Manager — Parse, edit, compare .env files
 */
const fs = require('fs');
const path = require('path');

// ═══ PARSE .ENV ═══

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error('File not found');
  const content = fs.readFileSync(filePath, 'utf8');
  return parseEnvString(content);
}

function parseEnvString(content) {
  const entries = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      entries.push({ type: trimmed.startsWith('#') ? 'comment' : 'blank', raw: line, lineNum: i + 1 });
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      entries.push({ type: 'invalid', raw: line, lineNum: i + 1 });
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    entries.push({
      type: 'variable',
      key,
      value,
      isSensitive: isSensitiveKey(key),
      lineNum: i + 1,
      raw: line,
    });
  }

  return entries;
}

// ═══ SENSITIVE KEY DETECTION ═══

const SENSITIVE_PATTERNS = [
  /password/i, /secret/i, /token/i, /key/i, /api_key/i, /apikey/i,
  /auth/i, /credential/i, /private/i, /access/i, /jwt/i, /session/i,
  /encryption/i, /salt/i, /hash/i, /cert/i, /ssl/i,
];

function isSensitiveKey(key) {
  return SENSITIVE_PATTERNS.some(p => p.test(key));
}

function maskValue(value) {
  if (!value || value.length <= 4) return '****';
  return value.slice(0, 2) + '*'.repeat(Math.min(value.length - 4, 20)) + value.slice(-2);
}

// ═══ READ ENV FILE ═══

function readEnvFile(filePath, maskSensitive = true) {
  const entries = parseEnvFile(filePath);
  if (maskSensitive) {
    return entries.map(e => {
      if (e.type === 'variable' && e.isSensitive) {
        return { ...e, displayValue: maskValue(e.value) };
      }
      return { ...e, displayValue: e.value };
    });
  }
  return entries.map(e => ({ ...e, displayValue: e.value }));
}

// ═══ WRITE ENV FILE ═══

function writeEnvFile(filePath, entries) {
  const lines = entries.map(e => {
    if (e.type === 'comment') return e.raw || `# ${e.text || ''}`;
    if (e.type === 'blank') return '';
    if (e.type === 'variable') {
      const needsQuotes = e.value && (e.value.includes(' ') || e.value.includes('#') || e.value.includes('"'));
      return needsQuotes ? `${e.key}="${e.value}"` : `${e.key}=${e.value || ''}`;
    }
    return e.raw || '';
  });

  // Backup existing file
  if (fs.existsSync(filePath)) {
    const backupPath = filePath + '.bak';
    fs.copyFileSync(filePath, backupPath);
  }

  fs.writeFileSync(filePath, lines.join('\n') + '\n');
  return { success: true, path: filePath, lineCount: lines.length };
}

// ═══ UPDATE SINGLE VARIABLE ═══

function setVariable(filePath, key, value) {
  if (!key || !key.trim()) throw new Error('Key required');
  const entries = fs.existsSync(filePath) ? parseEnvFile(filePath) : [];

  const existing = entries.findIndex(e => e.type === 'variable' && e.key === key);
  if (existing >= 0) {
    entries[existing].value = value;
  } else {
    entries.push({ type: 'variable', key: key.trim(), value: value || '' });
  }

  return writeEnvFile(filePath, entries);
}

function removeVariable(filePath, key) {
  if (!fs.existsSync(filePath)) throw new Error('File not found');
  const entries = parseEnvFile(filePath);
  const filtered = entries.filter(e => !(e.type === 'variable' && e.key === key));
  if (filtered.length === entries.length) throw new Error('Variable not found');
  return writeEnvFile(filePath, filtered);
}

// ═══ COMPARE TWO ENV FILES ═══

function compareEnvFiles(filePath1, filePath2) {
  const env1 = parseEnvFile(filePath1);
  const env2 = parseEnvFile(filePath2);

  const vars1 = new Map(env1.filter(e => e.type === 'variable').map(e => [e.key, e.value]));
  const vars2 = new Map(env2.filter(e => e.type === 'variable').map(e => [e.key, e.value]));

  const allKeys = new Set([...vars1.keys(), ...vars2.keys()]);
  const results = [];

  for (const key of allKeys) {
    const in1 = vars1.has(key);
    const in2 = vars2.has(key);
    const sensitive = isSensitiveKey(key);

    if (in1 && in2) {
      const same = vars1.get(key) === vars2.get(key);
      results.push({
        key,
        status: same ? 'same' : 'different',
        value1: sensitive ? maskValue(vars1.get(key)) : vars1.get(key),
        value2: sensitive ? maskValue(vars2.get(key)) : vars2.get(key),
        sensitive,
      });
    } else if (in1) {
      results.push({
        key,
        status: 'only_in_first',
        value1: sensitive ? maskValue(vars1.get(key)) : vars1.get(key),
        value2: null,
        sensitive,
      });
    } else {
      results.push({
        key,
        status: 'only_in_second',
        value1: null,
        value2: sensitive ? maskValue(vars2.get(key)) : vars2.get(key),
        sensitive,
      });
    }
  }

  results.sort((a, b) => {
    const order = { different: 0, only_in_first: 1, only_in_second: 2, same: 3 };
    return (order[a.status] || 4) - (order[b.status] || 4);
  });

  return {
    file1: filePath1,
    file2: filePath2,
    results,
    stats: {
      same: results.filter(r => r.status === 'same').length,
      different: results.filter(r => r.status === 'different').length,
      onlyFirst: results.filter(r => r.status === 'only_in_first').length,
      onlySecond: results.filter(r => r.status === 'only_in_second').length,
    },
  };
}

// ═══ MERGE ENV FILES ═══

function mergeEnvFiles(basePath, overridePath) {
  const base = parseEnvFile(basePath);
  const overrides = parseEnvFile(overridePath);

  const baseVars = new Map(base.filter(e => e.type === 'variable').map(e => [e.key, e]));
  const merged = [...base];

  for (const override of overrides.filter(e => e.type === 'variable')) {
    if (baseVars.has(override.key)) {
      const idx = merged.findIndex(e => e.type === 'variable' && e.key === override.key);
      if (idx >= 0) merged[idx] = override;
    } else {
      merged.push(override);
    }
  }

  return merged;
}

// ═══ VALIDATE ENV FORMAT ═══

function validateEnvFile(filePath) {
  const entries = parseEnvFile(filePath);
  const issues = [];

  const seenKeys = new Map();
  for (const entry of entries) {
    if (entry.type === 'invalid') {
      issues.push({ line: entry.lineNum, type: 'error', message: `Invalid syntax: ${entry.raw}` });
    }
    if (entry.type === 'variable') {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry.key)) {
        issues.push({ line: entry.lineNum, type: 'warning', message: `Unusual key format: ${entry.key}` });
      }
      if (seenKeys.has(entry.key)) {
        issues.push({ line: entry.lineNum, type: 'warning', message: `Duplicate key: ${entry.key} (first at line ${seenKeys.get(entry.key)})` });
      }
      seenKeys.set(entry.key, entry.lineNum);
      if (!entry.value && entry.value !== '') {
        issues.push({ line: entry.lineNum, type: 'info', message: `Empty value: ${entry.key}` });
      }
    }
  }

  return { valid: issues.filter(i => i.type === 'error').length === 0, issues, entryCount: entries.filter(e => e.type === 'variable').length };
}

// ═══ DISCOVER ENV FILES ═══

function discoverEnvFiles(dir, maxDepth = 3) {
  const files = [];
  function scan(current, depth) {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isFile() && (entry.name.startsWith('.env') || entry.name.endsWith('.env'))) {
          const stat = fs.statSync(fullPath);
          files.push({ path: fullPath, name: entry.name, size: stat.size, modified: stat.mtime });
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          scan(fullPath, depth + 1);
        }
      }
    } catch { /* permission denied etc */ }
  }
  scan(dir, 0);
  return files;
}

// ═══ GENERATE TEMPLATE ═══

function generateTemplate(entries) {
  return entries
    .filter(e => e.type === 'variable')
    .map(e => `${e.key}=${e.isSensitive ? '' : e.value}`)
    .join('\n') + '\n';
}

module.exports = {
  parseEnvFile, parseEnvString,
  isSensitiveKey, maskValue,
  readEnvFile, writeEnvFile,
  setVariable, removeVariable,
  compareEnvFiles, mergeEnvFiles,
  validateEnvFile, discoverEnvFiles, generateTemplate,
};
