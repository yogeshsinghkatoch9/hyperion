/**
 * Plugin Loader
 * Scans ~/.hyperion/plugins/ for community plugins.
 * Each plugin: plugin.json (manifest) + index.js (exports patterns, novaKeywords, quickActions)
 * Wraps each plugin in SDK boundary for sandboxed access.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createSDK } = require('./pluginSDK');

const PLUGINS_DIR = path.join(os.homedir(), '.hyperion', 'plugins');
let loadedPlugins = [];
let _db = null;

function ensurePluginsDir() {
  try {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
  } catch {}
}

function setDB(db) {
  _db = db;
}

function loadPlugins() {
  ensurePluginsDir();
  loadedPlugins = [];

  let entries;
  try {
    entries = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true });
  } catch {
    return loadedPlugins;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pluginDir = path.join(PLUGINS_DIR, entry.name);
    const manifestPath = path.join(pluginDir, 'plugin.json');
    const indexPath = path.join(pluginDir, 'index.js');

    try {
      if (!fs.existsSync(manifestPath)) continue;

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      let exports = {};

      if (fs.existsSync(indexPath)) {
        // Clear require cache for hot reload
        delete require.cache[require.resolve(indexPath)];

        // If DB available, provide SDK to plugin
        if (_db) {
          const sdk = createSDK(entry.name, _db);
          const pluginModule = require(indexPath);
          // If plugin exports a function, call it with SDK
          if (typeof pluginModule === 'function') {
            exports = pluginModule(sdk);
          } else {
            exports = pluginModule;
            // Backward compat: old plugins still work but get deprecation notice
            if (!exports._sdkPlugin) {
              console.log(`  Plugin ${manifest.name || entry.name}: using legacy mode (no SDK). Consider updating to SDK format.`);
            }
          }
        } else {
          exports = require(indexPath);
        }
      }

      loadedPlugins.push({
        id: entry.name,
        name: manifest.name || entry.name,
        version: manifest.version || '0.0.0',
        description: manifest.description || '',
        author: manifest.author || 'Unknown',
        patterns: exports.patterns || [],
        novaKeywords: exports.novaKeywords || [],
        novaHandlers: exports.novaHandlers || {},
        quickActions: exports.quickActions || [],
        hooks: exports.hooks || {},
      });

      console.log(`  Plugin loaded: ${manifest.name || entry.name} v${manifest.version || '?'}`);
    } catch (err) {
      console.error(`  Plugin error (${entry.name}): ${err.message}`);
    }
  }

  return loadedPlugins;
}

function reloadPlugins() {
  // Clear require cache for all plugin index.js files
  for (const plugin of loadedPlugins) {
    const indexPath = path.join(PLUGINS_DIR, plugin.id, 'index.js');
    try { delete require.cache[require.resolve(indexPath)]; } catch {}
  }
  return loadPlugins();
}

function getPlugins() {
  return loadedPlugins;
}

function getPluginPatterns() {
  const patterns = [];
  for (const plugin of loadedPlugins) {
    for (const p of plugin.patterns) {
      patterns.push({ ...p, _plugin: plugin.id });
    }
  }
  return patterns;
}

function getPluginQuickActions() {
  const actions = [];
  for (const plugin of loadedPlugins) {
    if (plugin.quickActions.length) {
      actions.push({
        category: `Plugin: ${plugin.name}`,
        actions: plugin.quickActions,
        _plugin: plugin.id,
      });
    }
  }
  return actions;
}

function getPluginNovaKeywords() {
  const keywords = new Set();
  for (const plugin of loadedPlugins) {
    for (const kw of plugin.novaKeywords) {
      keywords.add(kw);
    }
  }
  return keywords;
}

module.exports = {
  loadPlugins,
  reloadPlugins,
  getPlugins,
  getPluginPatterns,
  getPluginQuickActions,
  getPluginNovaKeywords,
  setDB,
  PLUGINS_DIR,
};
