/**
 * App Discovery Service
 * Dynamic scanning of /Applications + fuzzy matching with Levenshtein distance.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();

// ── Static Aliases (highest priority) ──
const APP_ALIASES = {
  'chrome': 'Google Chrome', 'chrome browser': 'Google Chrome', 'google chrome': 'Google Chrome',
  'firefox': 'Firefox', 'firefox browser': 'Firefox',
  'safari': 'Safari', 'safari browser': 'Safari',
  'vscode': 'Visual Studio Code', 'vs code': 'Visual Studio Code', 'code': 'Visual Studio Code',
  'terminal': 'Terminal',
  'finder': 'Finder',
  'slack': 'Slack',
  'discord': 'Discord',
  'spotify': 'Spotify',
  'zoom': 'zoom.us',
  'teams': 'Microsoft Teams', 'microsoft teams': 'Microsoft Teams',
  'word': 'Microsoft Word', 'microsoft word': 'Microsoft Word',
  'excel': 'Microsoft Excel', 'microsoft excel': 'Microsoft Excel',
  'powerpoint': 'Microsoft PowerPoint',
  'outlook': 'Microsoft Outlook',
  'notes': 'Notes',
  'messages': 'Messages', 'imessage': 'Messages',
  'mail': 'Mail',
  'photos': 'Photos',
  'music': 'Music', 'apple music': 'Music',
  'calendar': 'Calendar',
  'maps': 'Maps',
  'preview': 'Preview',
  'textedit': 'TextEdit', 'text edit': 'TextEdit',
  'activity monitor': 'Activity Monitor',
  'system preferences': 'System Preferences', 'settings': 'System Settings', 'system settings': 'System Settings',
  'app store': 'App Store',
  'facetime': 'FaceTime',
  'keynote': 'Keynote',
  'pages': 'Pages',
  'numbers': 'Numbers',
  'xcode': 'Xcode',
  'iterm': 'iTerm', 'iterm2': 'iTerm',
  'brave': 'Brave Browser', 'brave browser': 'Brave Browser',
  'edge': 'Microsoft Edge', 'microsoft edge': 'Microsoft Edge',
  'opera': 'Opera',
  'arc': 'Arc', 'arc browser': 'Arc',
  'notion': 'Notion',
  'figma': 'Figma',
  'postman': 'Postman',
  'docker': 'Docker', 'docker desktop': 'Docker',
  'vlc': 'VLC', 'vlc player': 'VLC',
  'obs': 'OBS',
  'telegram': 'Telegram',
  'whatsapp': 'WhatsApp',
};

// Known browser apps (for URL auto-detection)
const BROWSERS = new Set([
  'Google Chrome', 'Firefox', 'Safari', 'Brave Browser',
  'Microsoft Edge', 'Opera', 'Arc', 'Vivaldi',
]);

// ── Dynamic App Cache ──
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let appCache = null;
let cacheTimestamp = 0;

function scanApplications() {
  const now = Date.now();
  if (appCache && (now - cacheTimestamp) < CACHE_TTL) return appCache;

  const apps = new Map(); // normalized name → { name, path }

  const dirs = process.platform === 'darwin'
    ? ['/Applications', path.join(HOME, 'Applications'), '/System/Applications', '/System/Applications/Utilities']
    : ['/usr/share/applications'];

  for (const dir of dirs) {
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (process.platform === 'darwin') {
          if (!entry.endsWith('.app')) continue;
          const name = entry.replace(/\.app$/, '');
          apps.set(name.toLowerCase(), { name, path: path.join(dir, entry) });
        } else {
          // Linux: parse .desktop files
          if (!entry.endsWith('.desktop')) continue;
          try {
            const content = fs.readFileSync(path.join(dir, entry), 'utf8');
            const nameMatch = content.match(/^Name=(.+)$/m);
            if (nameMatch) {
              const name = nameMatch[1].trim();
              apps.set(name.toLowerCase(), { name, path: path.join(dir, entry) });
            }
          } catch {}
        }
      }
    } catch {}
  }

  appCache = apps;
  cacheTimestamp = now;
  return apps;
}

function invalidateCache() {
  appCache = null;
  cacheTimestamp = 0;
}

// ── Levenshtein Distance ──
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * 5-tier fuzzy matching:
 * 1. Exact alias match → confidence 1.0
 * 2. Exact dynamic scan match → confidence 1.0
 * 3. Substring match → confidence 0.85
 * 4. Levenshtein (similarity > 0.5) → confidence = 1 - dist/maxLen
 * 5. No match → return input + top 3 alternatives
 */
function fuzzyMatch(input) {
  const lower = (input || '').toLowerCase().trim();
  if (!lower) return { name: input, confidence: 0, alternatives: [] };

  // Tier 1: Static alias
  if (APP_ALIASES[lower]) {
    return { name: APP_ALIASES[lower], confidence: 1.0, source: 'alias' };
  }

  // Tier 2: Exact dynamic match
  const apps = scanApplications();
  if (apps.has(lower)) {
    return { name: apps.get(lower).name, confidence: 1.0, source: 'scan' };
  }

  // Tier 3: Substring match (either direction)
  for (const [key, val] of apps) {
    if (key.includes(lower) || lower.includes(key)) {
      return { name: val.name, confidence: 0.85, source: 'substring' };
    }
  }

  // Also check aliases for substring
  for (const [key, val] of Object.entries(APP_ALIASES)) {
    if (key.includes(lower) || lower.includes(key)) {
      return { name: val, confidence: 0.85, source: 'alias_substring' };
    }
  }

  // Tier 4: Levenshtein distance
  let bestMatch = null;
  let bestScore = 0;
  const candidates = [];

  // Check against dynamic apps
  for (const [key, val] of apps) {
    const dist = levenshtein(lower, key);
    const maxLen = Math.max(lower.length, key.length);
    const similarity = 1 - (dist / maxLen);
    candidates.push({ name: val.name, similarity });
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = val.name;
    }
  }

  // Also check aliases
  for (const [key, val] of Object.entries(APP_ALIASES)) {
    const dist = levenshtein(lower, key);
    const maxLen = Math.max(lower.length, key.length);
    const similarity = 1 - (dist / maxLen);
    candidates.push({ name: val, similarity });
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = val;
    }
  }

  if (bestScore > 0.5 && bestMatch) {
    return { name: bestMatch, confidence: bestScore, source: 'levenshtein' };
  }

  // Tier 5: No match — return input + top 3 alternatives
  candidates.sort((a, b) => b.similarity - a.similarity);
  const unique = [...new Set(candidates.slice(0, 5).map(c => c.name))].slice(0, 3);
  return { name: input, confidence: 0, alternatives: unique, source: 'none' };
}

/**
 * Drop-in replacement for the old resolveAppName.
 * Returns just the resolved name string for backward compatibility.
 */
function resolveAppName(input) {
  const result = fuzzyMatch(input);
  return result.name;
}

function isBrowser(appName) {
  return BROWSERS.has(appName);
}

function getInstalledApps() {
  const apps = scanApplications();
  return Array.from(apps.values()).map(a => a.name).sort();
}

module.exports = {
  APP_ALIASES,
  BROWSERS,
  resolveAppName,
  fuzzyMatch,
  isBrowser,
  scanApplications,
  invalidateCache,
  getInstalledApps,
  levenshtein,
};
