'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// ── Supported algorithms ──

const SUPPORTED_ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512'];

/** Return the list of supported hash algorithms */
function getAlgorithms() {
  return [...SUPPORTED_ALGORITHMS];
}

// ── Hashing ──

/**
 * Hash a text string with the given algorithm.
 * @param {string} text - The text to hash
 * @param {string} [algo='sha256'] - Hash algorithm (md5, sha1, sha256, sha512)
 * @returns {string} Hex-encoded hash
 */
function hash(text, algo) {
  if (text == null) throw new Error('Text is required');
  const algorithm = (algo || 'sha256').toLowerCase();
  if (!SUPPORTED_ALGORITHMS.includes(algorithm)) {
    throw new Error(`Unsupported algorithm: ${algorithm}. Use one of: ${SUPPORTED_ALGORITHMS.join(', ')}`);
  }
  return crypto.createHash(algorithm).update(String(text), 'utf-8').digest('hex');
}

/**
 * Hash a Buffer (file contents) with the given algorithm.
 * @param {Buffer} buffer - The buffer to hash
 * @param {string} [algo='sha256'] - Hash algorithm
 * @returns {string} Hex-encoded hash
 */
function hashFile(buffer, algo) {
  if (!Buffer.isBuffer(buffer)) throw new Error('First argument must be a Buffer');
  const algorithm = (algo || 'sha256').toLowerCase();
  if (!SUPPORTED_ALGORITHMS.includes(algorithm)) {
    throw new Error(`Unsupported algorithm: ${algorithm}. Use one of: ${SUPPORTED_ALGORITHMS.join(', ')}`);
  }
  return crypto.createHash(algorithm).update(buffer).digest('hex');
}

// ── HMAC ──

/**
 * Generate an HMAC for the given text.
 * @param {string} text - The text to sign
 * @param {string} key - The secret key
 * @param {string} [algo='sha256'] - Hash algorithm
 * @returns {string} Hex-encoded HMAC
 */
function hmac(text, key, algo) {
  if (text == null) throw new Error('Text is required');
  if (key == null) throw new Error('Key is required');
  const algorithm = (algo || 'sha256').toLowerCase();
  if (!SUPPORTED_ALGORITHMS.includes(algorithm)) {
    throw new Error(`Unsupported algorithm: ${algorithm}. Use one of: ${SUPPORTED_ALGORITHMS.join(', ')}`);
  }
  return crypto.createHmac(algorithm, String(key)).update(String(text), 'utf-8').digest('hex');
}

// ── Compare ──

/**
 * Check if a plaintext string matches a given hash.
 * Tries all supported algorithms and returns true if any match.
 * @param {string} text - The plaintext to check
 * @param {string} hashValue - The hash to compare against
 * @returns {{ match: boolean, algorithm: string|null }}
 */
function compare(text, hashValue) {
  if (text == null) throw new Error('Text is required');
  if (hashValue == null) throw new Error('Hash is required');
  const target = String(hashValue).toLowerCase();
  for (const algo of SUPPORTED_ALGORITHMS) {
    const computed = hash(text, algo);
    if (computed === target) {
      return { match: true, algorithm: algo };
    }
  }
  return { match: false, algorithm: null };
}

// ── Bcrypt ──

/**
 * Hash a text string using bcrypt.
 * @param {string} text - The plaintext to hash
 * @param {number} [rounds=10] - Salt rounds
 * @returns {Promise<string>} Bcrypt hash
 */
async function bcryptHash(text, rounds) {
  if (text == null) throw new Error('Text is required');
  const saltRounds = rounds != null ? Number(rounds) : 10;
  if (isNaN(saltRounds) || saltRounds < 1 || saltRounds > 31) {
    throw new Error('Rounds must be between 1 and 31');
  }
  const salt = await bcrypt.genSalt(saltRounds);
  return bcrypt.hash(String(text), salt);
}

/**
 * Compare a plaintext string against a bcrypt hash.
 * @param {string} text - The plaintext to check
 * @param {string} hashValue - The bcrypt hash to compare against
 * @returns {Promise<boolean>}
 */
async function bcryptCompare(text, hashValue) {
  if (text == null) throw new Error('Text is required');
  if (hashValue == null) throw new Error('Hash is required');
  return bcrypt.compare(String(text), String(hashValue));
}

module.exports = {
  hash,
  hashFile,
  hmac,
  getAlgorithms,
  compare,
  bcryptHash,
  bcryptCompare,
};
