'use strict';

/**
 * YAML Tools — Simple YAML <-> JSON converter.
 * No external dependencies. Handles scalars, indented maps, lists, and nested blocks.
 */

// ---------------------------------------------------------------------------
// YAML Parser
// ---------------------------------------------------------------------------

/**
 * Parse a YAML string into a JavaScript value.
 * Supports: scalars, key: value maps, dash-lists, nested blocks, multi-line flow.
 * Does NOT support: anchors, aliases, tags, multi-doc, block scalars (|, >).
 * @param {string} yaml - YAML string
 * @returns {*} parsed value
 */
function parse(yaml) {
  if (typeof yaml !== 'string') {
    throw new TypeError('parse() expects a string');
  }

  const rawLines = yaml.split('\n');

  // Strip comments and blank lines, but preserve indent
  const lines = [];
  for (const raw of rawLines) {
    // Remove inline comments (not inside quotes)
    const stripped = _stripComment(raw);
    // Keep blank lines as separators only if we need them — actually skip them
    if (stripped.trim() === '') continue;
    lines.push(stripped);
  }

  if (lines.length === 0) return null;

  // Single scalar value?
  if (lines.length === 1 && !lines[0].includes(':') && !lines[0].trim().startsWith('-')) {
    return _parseScalar(lines[0].trim());
  }

  const ctx = { lines, pos: 0 };
  return _parseBlock(ctx, 0);
}

/**
 * Strip a trailing comment from a line, respecting quoted strings.
 */
function _stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === '#' && !inSingle && !inDouble) {
      // Make sure preceded by whitespace or at start
      if (i === 0 || line[i - 1] === ' ' || line[i - 1] === '\t') {
        return line.slice(0, i);
      }
    }
  }
  return line;
}

/**
 * Parse a block at a given indent level. A block is either a mapping or a sequence.
 */
function _parseBlock(ctx, indent) {
  if (ctx.pos >= ctx.lines.length) return null;

  const firstLine = ctx.lines[ctx.pos];
  const firstTrimmed = firstLine.trim();
  const firstIndent = _indent(firstLine);

  if (firstIndent < indent) return null;

  // Is this a sequence (starts with '-')?
  if (firstTrimmed.startsWith('- ') || firstTrimmed === '-') {
    return _parseSequence(ctx, firstIndent);
  }

  // Otherwise treat as mapping
  return _parseMapping(ctx, firstIndent);
}

/**
 * Parse a YAML mapping (key: value pairs) at the given indent level.
 */
function _parseMapping(ctx, indent) {
  const result = {};

  while (ctx.pos < ctx.lines.length) {
    const line = ctx.lines[ctx.pos];
    const lineIndent = _indent(line);

    // If dedented past our level, this mapping is done
    if (lineIndent < indent) break;
    // If indented further, something is wrong — skip
    if (lineIndent > indent) break;

    const trimmed = line.trim();

    // Sequence item at same level means we're done (parent handles it)
    if (trimmed.startsWith('- ')) break;

    const colonIdx = _findColon(trimmed);
    if (colonIdx === -1) {
      // Not a key:value line — skip it
      ctx.pos++;
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const afterColon = trimmed.slice(colonIdx + 1).trim();

    ctx.pos++;

    if (afterColon === '' || afterColon === '|' || afterColon === '>') {
      // Value is a nested block on subsequent indented lines
      if (ctx.pos < ctx.lines.length && _indent(ctx.lines[ctx.pos]) > indent) {
        const childIndent = _indent(ctx.lines[ctx.pos]);
        result[key] = _parseBlock(ctx, childIndent);
      } else {
        result[key] = null;
      }
    } else {
      result[key] = _parseScalar(afterColon);
    }
  }

  return result;
}

/**
 * Parse a YAML sequence (- item lines) at the given indent level.
 */
function _parseSequence(ctx, indent) {
  const result = [];

  while (ctx.pos < ctx.lines.length) {
    const line = ctx.lines[ctx.pos];
    const lineIndent = _indent(line);

    if (lineIndent < indent) break;
    if (lineIndent > indent) break;

    const trimmed = line.trim();
    if (!trimmed.startsWith('-')) break;

    // Content after the dash
    const afterDash = trimmed.slice(1).trim();

    ctx.pos++;

    if (afterDash === '') {
      // Nested block under this dash item
      if (ctx.pos < ctx.lines.length && _indent(ctx.lines[ctx.pos]) > indent) {
        const childIndent = _indent(ctx.lines[ctx.pos]);
        result.push(_parseBlock(ctx, childIndent));
      } else {
        result.push(null);
      }
    } else if (_findColon(afterDash) !== -1) {
      // Inline mapping on the same line as the dash: "- key: value"
      // There may be additional keys on subsequent indented lines
      const colonIdx = _findColon(afterDash);
      const key = afterDash.slice(0, colonIdx).trim();
      const val = afterDash.slice(colonIdx + 1).trim();

      const obj = {};
      obj[key] = val === '' ? null : _parseScalar(val);

      // Check for continuation keys at deeper indent
      if (ctx.pos < ctx.lines.length) {
        const nextIndent = _indent(ctx.lines[ctx.pos]);
        if (nextIndent > indent) {
          const continued = _parseMapping(ctx, nextIndent);
          if (continued && typeof continued === 'object') {
            Object.assign(obj, continued);
          }
        }
      }
      result.push(obj);
    } else {
      result.push(_parseScalar(afterDash));
    }
  }

  return result;
}

/**
 * Find the first unquoted colon followed by a space (or end-of-string).
 * Returns -1 if not found.
 */
function _findColon(str) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === ':' && !inSingle && !inDouble) {
      // Colon must be followed by space, end of string, or nothing
      if (i === str.length - 1 || str[i + 1] === ' ' || str[i + 1] === '\t') {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Count leading spaces of a line.
 */
function _indent(line) {
  let n = 0;
  while (n < line.length && line[n] === ' ') n++;
  return n;
}

/**
 * Parse a scalar value string into a JS primitive.
 */
function _parseScalar(str) {
  if (str === '' || str === '~' || str === 'null' || str === 'Null' || str === 'NULL') return null;
  if (str === 'true' || str === 'True' || str === 'TRUE') return true;
  if (str === 'false' || str === 'False' || str === 'FALSE') return false;

  // Quoted strings — strip quotes
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }

  // Inline flow sequence: [a, b, c]
  if (str.startsWith('[') && str.endsWith(']')) {
    const inner = str.slice(1, -1).trim();
    if (inner === '') return [];
    return _splitFlow(inner).map((s) => _parseScalar(s.trim()));
  }

  // Inline flow mapping: {a: 1, b: 2}
  if (str.startsWith('{') && str.endsWith('}')) {
    const inner = str.slice(1, -1).trim();
    if (inner === '') return {};
    const obj = {};
    const pairs = _splitFlow(inner);
    for (const pair of pairs) {
      const ci = pair.indexOf(':');
      if (ci !== -1) {
        const k = pair.slice(0, ci).trim();
        const v = pair.slice(ci + 1).trim();
        obj[k] = _parseScalar(v);
      }
    }
    return obj;
  }

  // Numbers
  if (/^-?\d+$/.test(str)) return parseInt(str, 10);
  if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str);
  if (/^-?\d+(\.\d+)?[eE][+-]?\d+$/.test(str)) return parseFloat(str);
  if (str === '.inf' || str === '.Inf') return Infinity;
  if (str === '-.inf' || str === '-.Inf') return -Infinity;
  if (str === '.nan' || str === '.NaN') return NaN;

  return str;
}

/**
 * Split a flow collection by commas, respecting nesting.
 */
function _splitFlow(str) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

// ---------------------------------------------------------------------------
// YAML Stringifier
// ---------------------------------------------------------------------------

/**
 * Convert a JavaScript value to a YAML string.
 * @param {*} obj - value to serialize
 * @returns {string} YAML string
 */
function stringify(obj) {
  return _stringify(obj, 0).trimEnd();
}

function _stringify(value, indent) {
  if (value === null || value === undefined) return 'null\n';
  if (typeof value === 'boolean') return (value ? 'true' : 'false') + '\n';
  if (typeof value === 'number') {
    if (value === Infinity) return '.inf\n';
    if (value === -Infinity) return '-.inf\n';
    if (Number.isNaN(value)) return '.nan\n';
    return String(value) + '\n';
  }
  if (typeof value === 'string') return _quoteString(value) + '\n';

  const pad = ' '.repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]\n';
    let out = '';
    for (const item of value) {
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        // Mapping inside a list: inline first key on same line as dash
        const keys = Object.keys(item);
        if (keys.length === 0) {
          out += pad + '- {}\n';
        } else {
          const firstKey = keys[0];
          const firstValStr = _stringifyInlineOrBlock(item[firstKey], indent + 2);
          out += pad + '- ' + firstKey + ': ' + firstValStr;
          for (let k = 1; k < keys.length; k++) {
            const valStr = _stringifyInlineOrBlock(item[keys[k]], indent + 2);
            out += pad + '  ' + keys[k] + ': ' + valStr;
          }
        }
      } else {
        const valStr = _stringifyInlineOrBlock(item, indent + 2);
        out += pad + '- ' + valStr;
      }
    }
    return out;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}\n';
    let out = '';
    for (const key of keys) {
      const child = value[key];
      if (child !== null && typeof child === 'object') {
        out += pad + key + ':\n';
        out += _stringify(child, indent + 2);
      } else {
        out += pad + key + ': ' + _stringify(child, 0);
      }
    }
    return out;
  }

  return String(value) + '\n';
}

/**
 * For a value that appears after "- " or "key: " on the same line.
 * Scalars go inline; objects/arrays get a newline then deeper indent.
 */
function _stringifyInlineOrBlock(value, indent) {
  if (value === null || value === undefined) return 'null\n';
  if (typeof value !== 'object') return _stringify(value, 0);
  // Complex value: newline + indented block
  return '\n' + _stringify(value, indent);
}

/**
 * Quote a YAML string if it contains special characters.
 */
function _quoteString(str) {
  // Needs quoting if it looks like a number, bool, null, or contains special chars
  if (
    str === '' ||
    str === 'true' || str === 'false' || str === 'True' || str === 'False' ||
    str === 'null' || str === 'Null' || str === '~' ||
    /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(str) ||
    /[:{}\[\],&*?|>!'"%@`#]/.test(str) ||
    str.includes('\n')
  ) {
    // Use double quotes, escape inner double quotes and backslashes
    const escaped = str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return '"' + escaped + '"';
  }
  return str;
}

// ---------------------------------------------------------------------------
// Convenience converters
// ---------------------------------------------------------------------------

/**
 * Convert a JSON string to a YAML string.
 * @param {string} jsonStr - valid JSON string
 * @returns {string} YAML string
 */
function jsonToYaml(jsonStr) {
  const obj = JSON.parse(jsonStr);
  return stringify(obj);
}

/**
 * Convert a YAML string to a JSON string (pretty-printed).
 * @param {string} yamlStr - YAML string
 * @returns {string} JSON string
 */
function yamlToJson(yamlStr) {
  const obj = parse(yamlStr);
  return JSON.stringify(obj, null, 2);
}

/**
 * Validate whether a string is valid YAML (parseable by this parser).
 * @param {string} yamlStr - candidate YAML string
 * @returns {{valid: boolean, error: string|null}}
 */
function validate(yamlStr) {
  try {
    parse(yamlStr);
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports = {
  parse,
  stringify,
  jsonToYaml,
  yamlToJson,
  validate,
};
