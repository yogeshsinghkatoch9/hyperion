'use strict';

/**
 * JSON Formatter & Utilities
 * Pure function exports — no external dependencies.
 */

/**
 * Pretty-print a JSON string with the given indent.
 * @param {string} str - JSON string
 * @param {number} [indent=2] - spaces per indent level
 * @returns {string} formatted JSON
 */
function format(str, indent = 2) {
  return JSON.stringify(JSON.parse(str), null, indent);
}

/**
 * Minify a JSON string (remove all whitespace).
 * @param {string} str - JSON string
 * @returns {string} minified JSON
 */
function minify(str) {
  return JSON.stringify(JSON.parse(str));
}

/**
 * Validate whether a string is valid JSON.
 * @param {string} str - candidate JSON string
 * @returns {{valid: boolean, error: string|null}}
 */
function validate(str) {
  try {
    JSON.parse(str);
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Recursively sort all object keys alphabetically.
 * Arrays are preserved in order; their object elements are sorted recursively.
 * @param {string} str - JSON string
 * @returns {string} JSON string with sorted keys (pretty-printed, 2-space indent)
 */
function sortKeys(str) {
  const parsed = JSON.parse(str);

  function _sort(value) {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(_sort);
    }
    const sorted = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      sorted[key] = _sort(value[key]);
    }
    return sorted;
  }

  return JSON.stringify(_sort(parsed), null, 2);
}

/**
 * Deep comparison of two JSON values. Returns an array of differences.
 * Each entry: { path: string, type: 'added'|'removed'|'changed', oldValue, newValue }
 * @param {string} jsonA - first JSON string
 * @param {string} jsonB - second JSON string
 * @returns {Array<{path:string, type:string, oldValue:*, newValue:*}>}
 */
function diff(jsonA, jsonB) {
  const a = JSON.parse(jsonA);
  const b = JSON.parse(jsonB);
  const results = [];

  function _diff(valA, valB, path) {
    // Both null / identical primitives
    if (valA === valB) return;

    const typeA = _typeOf(valA);
    const typeB = _typeOf(valB);

    // Type mismatch or both are primitives that differ
    if (typeA !== typeB) {
      results.push({ path: path || '$', type: 'changed', oldValue: valA, newValue: valB });
      return;
    }

    if (typeA === 'array') {
      const maxLen = Math.max(valA.length, valB.length);
      for (let i = 0; i < maxLen; i++) {
        const itemPath = path ? `${path}[${i}]` : `$[${i}]`;
        if (i >= valA.length) {
          results.push({ path: itemPath, type: 'added', oldValue: undefined, newValue: valB[i] });
        } else if (i >= valB.length) {
          results.push({ path: itemPath, type: 'removed', oldValue: valA[i], newValue: undefined });
        } else {
          _diff(valA[i], valB[i], itemPath);
        }
      }
      return;
    }

    if (typeA === 'object') {
      const allKeys = new Set([...Object.keys(valA), ...Object.keys(valB)]);
      for (const key of allKeys) {
        const childPath = path ? `${path}.${key}` : key;
        if (!(key in valA)) {
          results.push({ path: childPath, type: 'added', oldValue: undefined, newValue: valB[key] });
        } else if (!(key in valB)) {
          results.push({ path: childPath, type: 'removed', oldValue: valA[key], newValue: undefined });
        } else {
          _diff(valA[key], valB[key], childPath);
        }
      }
      return;
    }

    // Primitives that differ (same type)
    if (valA !== valB) {
      results.push({ path: path || '$', type: 'changed', oldValue: valA, newValue: valB });
    }
  }

  function _typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  _diff(a, b, '');
  return results;
}

/**
 * Traverse an object using a dot-notation path.
 * Supports bracket notation for arrays, e.g. "a.b[0].c".
 * @param {*} obj - the object to query
 * @param {string} path - dot-notation path
 * @returns {*} value at path, or undefined if not found
 */
function query(obj, path) {
  if (!path) return obj;

  // Tokenize: split on dots, then further split bracket indices
  const tokens = [];
  const parts = path.split('.');
  for (const part of parts) {
    // e.g. "items[0]" → "items", "0"
    const bracketMatch = part.match(/^([^[]*)((?:\[\d+\])*)$/);
    if (bracketMatch) {
      if (bracketMatch[1]) {
        tokens.push(bracketMatch[1]);
      }
      if (bracketMatch[2]) {
        const indices = bracketMatch[2].match(/\[(\d+)\]/g);
        if (indices) {
          for (const idx of indices) {
            tokens.push(parseInt(idx.slice(1, -1), 10));
          }
        }
      }
    } else {
      tokens.push(part);
    }
  }

  let current = obj;
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;
    current = current[token];
  }
  return current;
}

/**
 * Flatten a nested object into dot-notation keys.
 * Arrays use bracket notation: "a.items[0].name".
 * @param {object} obj - the object to flatten
 * @returns {object} flat object with string keys
 */
function flatten(obj) {
  const result = {};

  function _flatten(current, prefix) {
    if (current === null || typeof current !== 'object') {
      result[prefix] = current;
      return;
    }

    if (Array.isArray(current)) {
      if (current.length === 0) {
        result[prefix] = [];
        return;
      }
      for (let i = 0; i < current.length; i++) {
        _flatten(current[i], `${prefix}[${i}]`);
      }
      return;
    }

    const keys = Object.keys(current);
    if (keys.length === 0) {
      result[prefix] = {};
      return;
    }
    for (const key of keys) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      _flatten(current[key], newPrefix);
    }
  }

  _flatten(obj, '');
  return result;
}

/**
 * Unflatten a dot-notation object back to nested structure.
 * Recognizes bracket notation for arrays.
 * @param {object} flat - flat object with dot-notation keys
 * @returns {object} nested object
 */
function unflatten(flat) {
  const result = {};

  for (const compoundKey of Object.keys(flat)) {
    const tokens = _tokenize(compoundKey);
    let current = result;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const isLast = i === tokens.length - 1;

      if (isLast) {
        current[token] = flat[compoundKey];
      } else {
        const nextToken = tokens[i + 1];
        const needArray = typeof nextToken === 'number';
        if (current[token] === undefined) {
          current[token] = needArray ? [] : {};
        }
        current = current[token];
      }
    }
  }

  return result;
}

/**
 * Tokenize a flat key like "a.b[0].c" into ["a","b",0,"c"].
 */
function _tokenize(key) {
  const tokens = [];
  const parts = key.split('.');
  for (const part of parts) {
    const bracketMatch = part.match(/^([^[]*)((?:\[\d+\])*)$/);
    if (bracketMatch) {
      if (bracketMatch[1]) tokens.push(bracketMatch[1]);
      if (bracketMatch[2]) {
        const indices = bracketMatch[2].match(/\[(\d+)\]/g);
        if (indices) {
          for (const idx of indices) {
            tokens.push(parseInt(idx.slice(1, -1), 10));
          }
        }
      }
    } else {
      tokens.push(part);
    }
  }
  return tokens;
}

/**
 * Compute statistics about a JSON string.
 * @param {string} str - JSON string
 * @returns {{keys:number, depth:number, arrays:number, objects:number, nulls:number, size:number}}
 */
function getStats(str) {
  const parsed = JSON.parse(str);
  const stats = { keys: 0, depth: 0, arrays: 0, objects: 0, nulls: 0, size: Buffer.byteLength(str, 'utf8') };

  function _walk(value, depth) {
    if (depth > stats.depth) stats.depth = depth;

    if (value === null) {
      stats.nulls++;
      return;
    }

    if (Array.isArray(value)) {
      stats.arrays++;
      for (const item of value) {
        _walk(item, depth + 1);
      }
      return;
    }

    if (typeof value === 'object') {
      stats.objects++;
      const keys = Object.keys(value);
      stats.keys += keys.length;
      for (const key of keys) {
        _walk(value[key], depth + 1);
      }
      return;
    }
    // primitives (string, number, boolean) — no counter needed
  }

  _walk(parsed, 0);
  return stats;
}

module.exports = {
  format,
  minify,
  validate,
  sortKeys,
  diff,
  query,
  flatten,
  unflatten,
  getStats,
};
