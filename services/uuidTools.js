'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// ── Constants ──

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Generators ──

/** Generate a v4 (random) UUID */
function v4() {
  return uuidv4();
}

/**
 * Generate a v1-style (timestamp-based) UUID using crypto.randomBytes.
 * Format: timestamp-hex (8-4) + random (4-4-12)
 */
function v1() {
  const now = Date.now();
  const timeHex = now.toString(16).padStart(12, '0');
  const rand = crypto.randomBytes(8);

  // Build UUID: tttttttt-tttt-1xxx-yxxx-xxxxxxxxxxxx
  const timeLow = timeHex.slice(-8);                   // 8 hex chars
  const timeMid = timeHex.slice(-12, -8);               // 4 hex chars
  const timeHiAndVersion = '1' + timeHex.slice(0, 3);   // version 1 + 3 hex chars

  // Variant bits: 10xx for RFC 4122
  const clockSeqHi = (rand[0] & 0x3f | 0x80).toString(16).padStart(2, '0');
  const clockSeqLow = rand[1].toString(16).padStart(2, '0');

  const node = rand.slice(2, 8).toString('hex');        // 12 hex chars (6 bytes)

  return `${timeLow}-${timeMid}-${timeHiAndVersion}-${clockSeqHi}${clockSeqLow}-${node}`;
}

/** Return the nil UUID (all zeros) */
function nil() {
  return NIL_UUID;
}

// ── Validation ──

/** Check if a string is a valid UUID format */
function validate(str) {
  if (str == null || typeof str !== 'string') return false;
  return UUID_REGEX.test(str);
}

/** Check if a UUID is the nil UUID */
function isNil(str) {
  if (str == null || typeof str !== 'string') return false;
  return str.toLowerCase() === NIL_UUID;
}

// ── Inspection ──

/**
 * Extract the version digit from a UUID (position 14, the char after the third hyphen group).
 * @param {string} str - UUID string
 * @returns {number|null} Version number (1-5) or null if invalid
 */
function version(str) {
  if (!validate(str)) return null;
  const v = parseInt(str.charAt(14), 10);
  return isNaN(v) ? null : v;
}

/**
 * Parse a UUID into its components.
 * @param {string} str - UUID string
 * @returns {{ version: number|null, variant: string, timestamp: number|null }}
 */
function parse(str) {
  if (!validate(str)) {
    throw new Error(`Invalid UUID: ${str}`);
  }

  const lower = str.toLowerCase();
  const v = version(lower);

  // Determine variant from the first hex digit of the 4th group (position 19)
  const variantNibble = parseInt(lower.charAt(19), 16);
  let variant;
  if ((variantNibble & 0x8) === 0) {
    variant = 'NCS';
  } else if ((variantNibble & 0xc) === 0x8) {
    variant = 'RFC 4122';
  } else if ((variantNibble & 0xe) === 0xc) {
    variant = 'Microsoft';
  } else {
    variant = 'Future';
  }

  // Extract timestamp for v1 UUIDs
  let timestamp = null;
  if (v === 1) {
    // v1 UUID time fields: time_low (8) - time_mid (4) - time_hi_and_version (4)
    const parts = lower.split('-');
    const timeLow = parts[0];
    const timeMid = parts[1];
    const timeHi = parts[2].slice(1); // strip version digit
    const timeHex = timeHi + timeMid + timeLow;
    timestamp = parseInt(timeHex, 16);
  }

  return {
    version: v,
    variant,
    timestamp,
  };
}

// ── Batch ──

/**
 * Generate an array of v4 UUIDs.
 * @param {number} count - Number of UUIDs to generate
 * @returns {string[]}
 */
function generateBatch(count) {
  const n = Math.max(1, Math.min(Number(count) || 1, 10000));
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(uuidv4());
  }
  return result;
}

module.exports = {
  v4,
  v1,
  nil,
  validate,
  version,
  parse,
  generateBatch,
  isNil,
};
