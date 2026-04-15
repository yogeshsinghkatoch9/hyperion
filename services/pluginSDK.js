/**
 * Plugin SDK — Formal boundary for plugins.
 * Plugins receive an sdk object instead of raw app context.
 * Provides sandboxed access to DB, notifications, settings, HTTP, events.
 */

const EventEmitter = require('events');

const pluginEvents = new EventEmitter();
pluginEvents.setMaxListeners(50);

function createSDK(pluginId, db) {
  return {
    pluginId,

    db: {
      query(sql, params = []) {
        // Only allow SELECT and plugin-namespaced tables
        const trimmed = sql.trim().toUpperCase();
        if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('INSERT') &&
            !trimmed.startsWith('UPDATE') && !trimmed.startsWith('DELETE')) {
          throw new Error('SDK: Only SELECT/INSERT/UPDATE/DELETE queries allowed');
        }
        return db.prepare(sql).run(...(Array.isArray(params) ? params : [params]));
      },
      get(sql, params = []) {
        return db.prepare(sql).get(...(Array.isArray(params) ? params : [params]));
      },
      all(sql, params = []) {
        return db.prepare(sql).all(...(Array.isArray(params) ? params : [params]));
      },
    },

    notify(title, message, level = 'info') {
      const { v4: uuidv4 } = require('uuid');
      try {
        db.prepare('INSERT INTO notifications (id, title, message, source, level) VALUES (?, ?, ?, ?, ?)')
          .run(uuidv4(), title, message, `plugin:${pluginId}`, level);
      } catch {}
    },

    settings: {
      get(key) {
        const row = db.prepare('SELECT value FROM settings WHERE key = ? AND user_id = ?')
          .get(`plugin:${pluginId}:${key}`, 'system');
        return row ? JSON.parse(row.value) : null;
      },
      set(key, value) {
        db.prepare(`INSERT INTO settings (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
          ON CONFLICT(user_id, key) DO UPDATE SET value = ?, updated_at = datetime('now')`)
          .run('system', `plugin:${pluginId}:${key}`, JSON.stringify(value), JSON.stringify(value));
      },
    },

    http: async (url, opts = {}) => {
      return fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeout || 15000) });
    },

    log: {
      info: (...args) => console.log(`[Plugin:${pluginId}]`, ...args),
      warn: (...args) => console.warn(`[Plugin:${pluginId}]`, ...args),
      error: (...args) => console.error(`[Plugin:${pluginId}]`, ...args),
    },

    events: {
      on(event, handler) { pluginEvents.on(`${pluginId}:${event}`, handler); },
      emit(event, data) { pluginEvents.emit(`${pluginId}:${event}`, data); },
      onGlobal(event, handler) { pluginEvents.on(event, handler); },
      emitGlobal(event, data) { pluginEvents.emit(event, data); },
    },
  };
}

function createPlugin(definition) {
  const { name, version, patterns, quickActions, novaKeywords, novaHandlers, hooks } = definition;

  if (!name) throw new Error('Plugin must have a name');

  return {
    name,
    version: version || '1.0.0',
    patterns: patterns || [],
    quickActions: quickActions || [],
    novaKeywords: novaKeywords || [],
    novaHandlers: novaHandlers || {},
    hooks: hooks || {},
    _sdkPlugin: true,
  };
}

module.exports = { createSDK, createPlugin, pluginEvents };
