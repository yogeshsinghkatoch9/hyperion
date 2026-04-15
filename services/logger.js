'use strict';

const fs = require('fs');
const path = require('path');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let currentLevel = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? 1;

function formatError(err) {
  if (!(err instanceof Error)) return err;
  return { name: err.name, message: err.message, stack: err.stack?.split('\n').map(l => l.trim()) };
}

function emit(level, message, meta, context) {
  if (LEVELS[level] < currentLevel) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
    ...meta,
  };
  // Serialize Error objects found in meta
  for (const key of Object.keys(entry)) {
    if (entry[key] instanceof Error) entry[key] = formatError(entry[key]);
  }
  const line = JSON.stringify(entry) + '\n';
  process.stderr.write(line);
  if (process.env.LOG_FILE === 'true') {
    const logDir = path.resolve(__dirname, '..', 'data');
    try { fs.mkdirSync(logDir, { recursive: true }); } catch (_) { /* ignore */ }
    fs.appendFileSync(path.join(logDir, 'hyperion.log'), line);
  }
}

function createLogger(context = {}) {
  const logger = {
    debug: (msg, meta) => emit('debug', msg, meta, context),
    info:  (msg, meta) => emit('info',  msg, meta, context),
    warn:  (msg, meta) => emit('warn',  msg, meta, context),
    error: (msg, meta) => emit('error', msg, meta, context),
    child: (extra) => createLogger({ ...context, ...extra }),
    setLevel: (lvl) => { currentLevel = LEVELS[lvl.toLowerCase()] ?? 1; },
    getLevel: () => Object.keys(LEVELS).find(k => LEVELS[k] === currentLevel),
  };
  return logger;
}

const logger = createLogger();

// Express request logging middleware
logger.requestLogger = (req, res, next) => {
  const start = Date.now();
  const onFinish = () => {
    res.removeListener('finish', onFinish);
    const duration = Date.now() - start;
    logger.info('request', { method: req.method, path: req.originalUrl || req.url, status: res.statusCode, duration });
  };
  res.on('finish', onFinish);
  next();
};

module.exports = logger;
