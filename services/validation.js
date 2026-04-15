/* ═══ HYPERION — Request Validation Middleware ═══ */

/**
 * Validate request body fields against a schema.
 * Schema: { fieldName: { type, required, min, max, pattern, enum } }
 *
 * Usage:
 *   router.post('/foo', validate({ text: { type: 'string', required: true, min: 1 } }), handler)
 */
function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};

    for (const [field, rules] of Object.entries(schema)) {
      const val = body[field];

      // Required check
      if (rules.required && (val === undefined || val === null || val === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip optional missing fields
      if (val === undefined || val === null) continue;

      // Type check
      if (rules.type) {
        const actualType = Array.isArray(val) ? 'array' : typeof val;
        if (actualType !== rules.type) {
          errors.push(`${field} must be of type ${rules.type}`);
          continue;
        }
      }

      // String constraints
      if (typeof val === 'string') {
        if (rules.min !== undefined && val.length < rules.min) {
          errors.push(`${field} must be at least ${rules.min} characters`);
        }
        if (rules.max !== undefined && val.length > rules.max) {
          errors.push(`${field} must be at most ${rules.max} characters`);
        }
        if (rules.pattern && !rules.pattern.test(val)) {
          errors.push(`${field} format is invalid`);
        }
      }

      // Number constraints
      if (typeof val === 'number') {
        if (rules.min !== undefined && val < rules.min) {
          errors.push(`${field} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && val > rules.max) {
          errors.push(`${field} must be at most ${rules.max}`);
        }
      }

      // Enum check
      if (rules.enum && !rules.enum.includes(val)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }

      // Array constraints
      if (Array.isArray(val)) {
        if (rules.min !== undefined && val.length < rules.min) {
          errors.push(`${field} must have at least ${rules.min} items`);
        }
        if (rules.max !== undefined && val.length > rules.max) {
          errors.push(`${field} must have at most ${rules.max} items`);
        }
      }
    }

    if (errors.length) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    next();
  };
}

/**
 * Sanitize string fields — strip control chars, trim whitespace
 */
function sanitize(fields) {
  return (req, res, next) => {
    if (!req.body) return next();
    for (const field of fields) {
      if (typeof req.body[field] === 'string') {
        // eslint-disable-next-line no-control-regex
        req.body[field] = req.body[field].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
      }
    }
    next();
  };
}

module.exports = { validate, sanitize };
