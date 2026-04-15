/* ═══ HYPERION — JWT Debugger Service ═══ */
const crypto = require('crypto');

const ALGORITHMS = {
  HS256: 'sha256',
  HS384: 'sha384',
  HS512: 'sha512',
};

/** Base64url encode a buffer or string */
function base64UrlEncode(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
  return buf.toString('base64url');
}

/** Base64url decode to string */
function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/** Encode an object to base64url */
function encodeBase64Url(obj) {
  return base64UrlEncode(JSON.stringify(obj));
}

/** Decode base64url string to object */
function decodeBase64Url(str) {
  try {
    return JSON.parse(base64UrlDecode(str));
  } catch {
    throw new Error('Invalid base64url-encoded JSON');
  }
}

/** Decode JWT without verification */
function decode(token) {
  if (!token || typeof token !== 'string') throw new Error('Token is required');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format: expected 3 parts separated by dots');

  const header = decodeBase64Url(parts[0]);
  const payload = decodeBase64Url(parts[1]);
  const signature = parts[2];

  return { header, payload, signature, isValid: null };
}

/** Create a JWT with HMAC signing */
function encode(payload, secret, options = {}) {
  const alg = options.algorithm || 'HS256';
  if (!ALGORITHMS[alg]) throw new Error(`Unsupported algorithm: ${alg}. Supported: ${Object.keys(ALGORITHMS).join(', ')}`);
  if (!secret) throw new Error('Secret is required for encoding');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg, typ: 'JWT' };
  const claims = { ...payload };
  if (options.expiresIn) claims.exp = now + options.expiresIn;
  if (options.issuer) claims.iss = options.issuer;
  if (options.subject) claims.sub = options.subject;
  if (options.audience) claims.aud = options.audience;
  if (!claims.iat) claims.iat = now;

  const headerB64 = encodeBase64Url(header);
  const payloadB64 = encodeBase64Url(claims);
  const sigInput = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac(ALGORITHMS[alg], secret).update(sigInput).digest('base64url');

  return `${sigInput}.${signature}`;
}

/** Verify JWT signature */
function verify(token, secret) {
  try {
    const { header, payload, signature } = decode(token);
    const alg = header.alg || 'HS256';
    if (!ALGORITHMS[alg]) return { valid: false, header, payload, error: `Unsupported algorithm: ${alg}` };

    const parts = token.split('.');
    const sigInput = `${parts[0]}.${parts[1]}`;
    const expected = crypto.createHmac(ALGORITHMS[alg], secret).update(sigInput).digest('base64url');
    const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

    if (valid && payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: true, header, payload, expired: true, error: 'Token is expired' };
    }

    return { valid, header, payload, expired: false, error: valid ? null : 'Signature mismatch' };
  } catch (err) {
    return { valid: false, header: null, payload: null, error: err.message };
  }
}

/** Extract token metadata */
function getTokenInfo(token) {
  const { header, payload } = decode(token);
  const now = Math.floor(Date.now() / 1000);
  const info = {
    algorithm: header.alg || 'unknown',
    type: header.typ || 'unknown',
    issuedAt: payload.iat ? formatTimestamp(payload.iat) : null,
    expiresAt: payload.exp ? formatTimestamp(payload.exp) : null,
    issuer: payload.iss || null,
    subject: payload.sub || null,
    audience: payload.aud || null,
    timeToExpiry: payload.exp ? payload.exp - now : null,
    isExpired: payload.exp ? payload.exp < now : false,
  };
  return info;
}

/** Check if token is expired */
function isExpired(token) {
  const { payload } = decode(token);
  if (!payload.exp) return false;
  return payload.exp < Math.floor(Date.now() / 1000);
}

/** Return supported algorithms */
function getAlgorithms() {
  return Object.keys(ALGORITHMS).map(alg => ({
    name: alg,
    hash: ALGORITHMS[alg],
    description: `HMAC with ${ALGORITHMS[alg].toUpperCase()}`,
  }));
}

/** Format epoch to human-readable */
function formatTimestamp(epoch) {
  return new Date(epoch * 1000).toISOString();
}

module.exports = {
  decode, encode, verify,
  decodeBase64Url, encodeBase64Url,
  getTokenInfo, isExpired,
  getAlgorithms, formatTimestamp,
};
