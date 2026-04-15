/**
 * Hyperion Dev Toolkit — Swiss Army Knife for Developers
 * Regex tester, JSON/YAML formatter, Base64/URL encoder, hash generator,
 * text diff, UUID/timestamp tools
 */
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ═══ HASH GENERATION ═══

function generateHash(input, algorithm = 'sha256') {
  const validAlgos = ['md5', 'sha1', 'sha256', 'sha512'];
  const algo = validAlgos.includes(algorithm) ? algorithm : 'sha256';
  return crypto.createHash(algo).update(input).digest('hex');
}

function generateAllHashes(input) {
  return {
    md5: generateHash(input, 'md5'),
    sha1: generateHash(input, 'sha1'),
    sha256: generateHash(input, 'sha256'),
    sha512: generateHash(input, 'sha512'),
  };
}

// ═══ BASE64 ═══

function base64Encode(input) {
  return Buffer.from(input, 'utf8').toString('base64');
}

function base64Decode(input) {
  return Buffer.from(input, 'base64').toString('utf8');
}

// ═══ URL ENCODING ═══

function urlEncode(input) {
  return encodeURIComponent(input);
}

function urlDecode(input) {
  return decodeURIComponent(input);
}

// ═══ JSON FORMATTER ═══

function formatJson(input, indent = 2) {
  const parsed = JSON.parse(input);
  return JSON.stringify(parsed, null, indent);
}

function minifyJson(input) {
  const parsed = JSON.parse(input);
  return JSON.stringify(parsed);
}

function validateJson(input) {
  try {
    JSON.parse(input);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// ═══ REGEX TESTER ═══

function testRegex(pattern, flags, testString) {
  try {
    const regex = new RegExp(pattern, flags || '');
    const matches = [];

    if (flags && flags.includes('g')) {
      let match;
      while ((match = regex.exec(testString)) !== null) {
        matches.push({
          match: match[0],
          index: match.index,
          groups: match.slice(1),
          namedGroups: match.groups || {},
        });
        if (matches.length > 100) break; // Safety limit
      }
    } else {
      const match = regex.exec(testString);
      if (match) {
        matches.push({
          match: match[0],
          index: match.index,
          groups: match.slice(1),
          namedGroups: match.groups || {},
        });
      }
    }

    return { valid: true, matches, matchCount: matches.length };
  } catch (err) {
    return { valid: false, error: err.message, matches: [], matchCount: 0 };
  }
}

// ═══ TEXT DIFF ═══

function textDiff(text1, text2) {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const diff = [];

  // Simple line-by-line diff (Myers-like output)
  const maxLen = Math.max(lines1.length, lines2.length);
  let i = 0, j = 0;

  while (i < lines1.length || j < lines2.length) {
    if (i >= lines1.length) {
      diff.push({ type: 'add', line: lines2[j], lineNum: j + 1 });
      j++;
    } else if (j >= lines2.length) {
      diff.push({ type: 'remove', line: lines1[i], lineNum: i + 1 });
      i++;
    } else if (lines1[i] === lines2[j]) {
      diff.push({ type: 'same', line: lines1[i], lineNum: i + 1 });
      i++; j++;
    } else {
      // Look ahead for matching lines
      let found = false;
      for (let k = 1; k <= 3 && j + k < lines2.length; k++) {
        if (lines1[i] === lines2[j + k]) {
          // Lines were added
          for (let m = 0; m < k; m++) {
            diff.push({ type: 'add', line: lines2[j + m], lineNum: j + m + 1 });
          }
          j += k;
          found = true;
          break;
        }
      }
      if (!found) {
        for (let k = 1; k <= 3 && i + k < lines1.length; k++) {
          if (lines1[i + k] === lines2[j]) {
            for (let m = 0; m < k; m++) {
              diff.push({ type: 'remove', line: lines1[i + m], lineNum: i + m + 1 });
            }
            i += k;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        diff.push({ type: 'remove', line: lines1[i], lineNum: i + 1 });
        diff.push({ type: 'add', line: lines2[j], lineNum: j + 1 });
        i++; j++;
      }
    }
  }

  const added = diff.filter(d => d.type === 'add').length;
  const removed = diff.filter(d => d.type === 'remove').length;
  return { diff, stats: { added, removed, unchanged: diff.filter(d => d.type === 'same').length } };
}

// ═══ TIMESTAMP CONVERTER ═══

function timestampToDate(timestamp) {
  // Auto-detect seconds vs milliseconds
  const ts = timestamp > 9999999999 ? timestamp : timestamp * 1000;
  const d = new Date(ts);
  return {
    iso: d.toISOString(),
    utc: d.toUTCString(),
    local: d.toString(),
    unix: Math.floor(ts / 1000),
    unixMs: ts,
  };
}

function dateToTimestamp(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error('Invalid date');
  return {
    unix: Math.floor(d.getTime() / 1000),
    unixMs: d.getTime(),
    iso: d.toISOString(),
  };
}

function nowTimestamp() {
  const d = new Date();
  return {
    unix: Math.floor(d.getTime() / 1000),
    unixMs: d.getTime(),
    iso: d.toISOString(),
    utc: d.toUTCString(),
    local: d.toString(),
  };
}

// ═══ UUID ═══

function generateUUID() {
  return uuidv4();
}

// ═══ JWT DECODE ═══

function decodeJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return { header, payload, signature: parts[2] };
  } catch {
    throw new Error('Failed to decode JWT');
  }
}

// ═══ COLOR CONVERTER ═══

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6 && clean.length !== 3) throw new Error('Invalid hex color');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return { r, g, b, css: `rgb(${r}, ${g}, ${b})` };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}

// ═══ EXPORTS ═══
module.exports = {
  generateHash,
  generateAllHashes,
  base64Encode,
  base64Decode,
  urlEncode,
  urlDecode,
  formatJson,
  minifyJson,
  validateJson,
  testRegex,
  textDiff,
  timestampToDate,
  dateToTimestamp,
  nowTimestamp,
  generateUUID,
  decodeJwt,
  hexToRgb,
  rgbToHex,
};
