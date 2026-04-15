/* ═══ HYPERION — Regex Tester Service ═══ */
const { v4: uuid } = require('uuid');

/** Test regex against text, return all matches with indices and groups */
function testRegex(pattern, flags, text) {
  const re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.push({
      match: m[0],
      index: m.index,
      length: m[0].length,
      groups: m.slice(1),
      namedGroups: m.groups || {},
    });
    if (m[0].length === 0) re.lastIndex++; // prevent infinite loop on zero-length matches
    if (!re.global) break;
    if (matches.length >= 10000) break; // safety limit
  }
  return { pattern, flags, matchCount: matches.length, matches };
}

/** Find & replace using regex */
function replaceRegex(pattern, flags, text, replacement) {
  const re = new RegExp(pattern, flags);
  const result = text.replace(re, replacement);
  return { original: text, result, pattern, flags, replacement };
}

/** Split text by regex */
function splitRegex(pattern, flags, text) {
  const re = new RegExp(pattern, flags);
  const parts = text.split(re);
  return { pattern, flags, parts, count: parts.length };
}

/** Basic explanation of regex tokens */
function explainRegex(pattern) {
  const tokens = [];
  const explanations = {
    '.': 'Any character except newline',
    '\\d': 'Digit (0-9)',
    '\\D': 'Non-digit',
    '\\w': 'Word character (a-z, A-Z, 0-9, _)',
    '\\W': 'Non-word character',
    '\\s': 'Whitespace',
    '\\S': 'Non-whitespace',
    '\\b': 'Word boundary',
    '\\B': 'Non-word boundary',
    '^': 'Start of string',
    '$': 'End of string',
    '*': 'Zero or more of previous',
    '+': 'One or more of previous',
    '?': 'Zero or one of previous (optional)',
    '|': 'OR — alternation',
    '\\t': 'Tab character',
    '\\n': 'Newline character',
  };

  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) {
      const seq = ch + pattern[i + 1];
      if (explanations[seq]) tokens.push({ token: seq, description: explanations[seq] });
      else tokens.push({ token: seq, description: `Escaped character "${pattern[i + 1]}"` });
      i += 2;
    } else if (ch === '[') {
      const end = pattern.indexOf(']', i);
      if (end !== -1) {
        const cls = pattern.slice(i, end + 1);
        const negated = cls[1] === '^' ? ' (negated)' : '';
        tokens.push({ token: cls, description: `Character class${negated}` });
        i = end + 1;
      } else {
        tokens.push({ token: ch, description: 'Unclosed character class' });
        i++;
      }
    } else if (ch === '(') {
      if (pattern[i + 1] === '?' && pattern[i + 2] === ':') {
        tokens.push({ token: '(?:', description: 'Non-capturing group start' });
        i += 3;
      } else if (pattern[i + 1] === '?' && pattern[i + 2] === '<') {
        const nameEnd = pattern.indexOf('>', i + 3);
        if (nameEnd !== -1) {
          const name = pattern.slice(i + 3, nameEnd);
          tokens.push({ token: pattern.slice(i, nameEnd + 1), description: `Named capturing group "${name}"` });
          i = nameEnd + 1;
        } else {
          tokens.push({ token: ch, description: 'Group start' });
          i++;
        }
      } else if (pattern[i + 1] === '?' && pattern[i + 2] === '=') {
        tokens.push({ token: '(?=', description: 'Positive lookahead' });
        i += 3;
      } else if (pattern[i + 1] === '?' && pattern[i + 2] === '!') {
        tokens.push({ token: '(?!', description: 'Negative lookahead' });
        i += 3;
      } else {
        tokens.push({ token: '(', description: 'Capturing group start' });
        i++;
      }
    } else if (ch === ')') {
      tokens.push({ token: ')', description: 'Group end' });
      i++;
    } else if (ch === '{') {
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        const quant = pattern.slice(i, end + 1);
        tokens.push({ token: quant, description: `Quantifier: repeat ${quant}` });
        i = end + 1;
      } else {
        tokens.push({ token: ch, description: 'Literal "{"' });
        i++;
      }
    } else if (explanations[ch]) {
      tokens.push({ token: ch, description: explanations[ch] });
      i++;
    } else {
      tokens.push({ token: ch, description: `Literal "${ch}"` });
      i++;
    }
  }
  return { pattern, tokens };
}

/** Check if regex compiles without error */
function validateRegex(pattern, flags) {
  try {
    new RegExp(pattern, flags);
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/** Return common preset patterns */
function getCommonPatterns() {
  return [
    { name: 'Email', pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', flags: 'gi', description: 'Match email addresses' },
    { name: 'URL', pattern: 'https?://[^\\s/$.?#].[^\\s]*', flags: 'gi', description: 'Match HTTP/HTTPS URLs' },
    { name: 'IPv4', pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', flags: 'g', description: 'Match IPv4 addresses' },
    { name: 'Phone (US)', pattern: '\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}', flags: 'g', description: 'Match US phone numbers' },
    { name: 'Date (YYYY-MM-DD)', pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])', flags: 'g', description: 'Match ISO dates' },
    { name: 'Hex Color', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b', flags: 'g', description: 'Match hex color codes' },
    { name: 'HTML Tag', pattern: '<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*>.*?</\\1>', flags: 'gs', description: 'Match HTML tags with content' },
    { name: 'Integer', pattern: '-?\\d+', flags: 'g', description: 'Match integers' },
    { name: 'Float', pattern: '-?\\d+\\.\\d+', flags: 'g', description: 'Match floating point numbers' },
    { name: 'Whitespace', pattern: '\\s+', flags: 'g', description: 'Match whitespace sequences' },
  ];
}

/** Escape special regex characters in a string */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Save pattern to DB */
function savePattern(db, { name, pattern, flags, description }) {
  const id = uuid();
  db.prepare('INSERT INTO regex_patterns (id, name, pattern, flags, description) VALUES (?, ?, ?, ?, ?)')
    .run(id, name || 'Untitled', pattern, flags || '', description || '');
  return { id, name, pattern, flags, description };
}

/** List saved patterns */
function getPatterns(db) {
  return db.prepare('SELECT * FROM regex_patterns ORDER BY created_at DESC').all();
}

/** Get pattern by id */
function getPattern(db, id) {
  const row = db.prepare('SELECT * FROM regex_patterns WHERE id = ?').get(id);
  if (!row) throw new Error('Pattern not found');
  return row;
}

/** Delete pattern */
function deletePattern(db, id) {
  const info = db.prepare('DELETE FROM regex_patterns WHERE id = ?').run(id);
  if (info.changes === 0) throw new Error('Pattern not found');
}

module.exports = {
  testRegex, replaceRegex, splitRegex, explainRegex,
  validateRegex, getCommonPatterns, escapeRegex,
  savePattern, getPatterns, getPattern, deletePattern,
};
