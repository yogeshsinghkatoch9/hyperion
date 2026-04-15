'use strict';

// ── Encode / Decode ──

/** Encode text to Base64 */
function encode(text) {
  if (text == null) throw new Error('Text is required');
  return Buffer.from(String(text), 'utf-8').toString('base64');
}

/** Decode Base64 string to text */
function decode(b64) {
  if (b64 == null) throw new Error('Base64 string is required');
  return Buffer.from(String(b64), 'base64').toString('utf-8');
}

// ── URL-safe variants ──

/** Encode text to URL-safe Base64 (replaces +/ with -_, strips =) */
function encodeUrl(text) {
  if (text == null) throw new Error('Text is required');
  return Buffer.from(String(text), 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Decode URL-safe Base64 back to text */
function decodeUrl(b64) {
  if (b64 == null) throw new Error('Base64 string is required');
  let str = String(b64)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  // Re-pad to a multiple of 4
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  return Buffer.from(str, 'base64').toString('utf-8');
}

// ── Validation ──

/** Check if a string is valid Base64 (standard or URL-safe) */
function isValid(str) {
  if (str == null || typeof str !== 'string' || str.length === 0) return false;
  // Normalise URL-safe chars for validation
  let normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  if (pad) normalized += '='.repeat(4 - pad);
  // Must be valid Base64 characters
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return false;
  try {
    Buffer.from(normalized, 'base64');
    return true;
  } catch {
    return false;
  }
}

// ── Binary / Data URI ──

/**
 * Encode a buffer to a data URI string.
 * @param {Buffer} buffer - The file contents
 * @param {string} mime - MIME type (e.g. 'image/png')
 * @returns {string} data URI like "data:image/png;base64,..."
 */
function encodeFile(buffer, mime) {
  if (!Buffer.isBuffer(buffer)) throw new Error('First argument must be a Buffer');
  if (!mime || typeof mime !== 'string') throw new Error('MIME type is required');
  const b64 = buffer.toString('base64');
  return `data:${mime};base64,${b64}`;
}

/**
 * Decode a Base64 string (or data URI) to a Buffer.
 * Strips "data:...;base64," prefix if present.
 * @param {string} b64 - Base64 string or data URI
 * @returns {Buffer}
 */
function decodeToBuffer(b64) {
  if (b64 == null) throw new Error('Base64 string is required');
  let str = String(b64);
  // Strip data URI prefix
  const dataUriMatch = str.match(/^data:[^;]+;base64,(.+)$/);
  if (dataUriMatch) {
    str = dataUriMatch[1];
  }
  return Buffer.from(str, 'base64');
}

module.exports = {
  encode,
  decode,
  encodeUrl,
  decodeUrl,
  isValid,
  encodeFile,
  decodeToBuffer,
};
