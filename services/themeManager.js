'use strict';

const DEFAULT_THEME = {
  mode: 'dark',
  accent: '#DA7756',
  fontSize: 13,
  sidebarPosition: 'left',
  compactMode: false,
  borderRadius: 12,
};

const PRESETS = {
  'Hyperion': {
    mode: 'dark', accent: '#DA7756', fontSize: 13,
    sidebarPosition: 'left', compactMode: false, borderRadius: 12,
  },
  'Hyperion Light': {
    mode: 'light', accent: '#DA7756', fontSize: 13,
    sidebarPosition: 'left', compactMode: false, borderRadius: 12,
  },
  'HAL 9000': {
    mode: 'dark', accent: '#EF4444', fontSize: 13,
    sidebarPosition: 'left', compactMode: false, borderRadius: 6,
  },
  'JARVIS': {
    mode: 'dark', accent: '#38BDF8', fontSize: 13,
    sidebarPosition: 'left', compactMode: false, borderRadius: 10,
  },
  'LCARS': {
    mode: 'dark', accent: '#F59E0B', fontSize: 14,
    sidebarPosition: 'left', compactMode: false, borderRadius: 20,
  },
  'Wintermute': {
    mode: 'dark', accent: '#22C55E', fontSize: 13,
    sidebarPosition: 'left', compactMode: true, borderRadius: 4,
  },
  'Cortana': {
    mode: 'dark', accent: '#A78BFA', fontSize: 13,
    sidebarPosition: 'left', compactMode: false, borderRadius: 12,
  },
  'Solarized': {
    mode: 'dark', accent: '#B58900', fontSize: 14,
    sidebarPosition: 'left', compactMode: false, borderRadius: 8,
  },
};

function getTheme(db, userId) {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE user_id = ? AND key = 'theme_config'").get(userId);
    if (row) {
      const parsed = JSON.parse(row.value);
      return { ...DEFAULT_THEME, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_THEME };
}

function saveTheme(db, userId, config) {
  if (!config || typeof config !== 'object') throw new Error('Invalid theme config');

  // Validate and sanitize
  const safe = {
    mode: ['dark', 'light'].includes(config.mode) ? config.mode : DEFAULT_THEME.mode,
    accent: typeof config.accent === 'string' && /^#[0-9a-fA-F]{6}$/.test(config.accent) ? config.accent : DEFAULT_THEME.accent,
    fontSize: Math.min(22, Math.max(10, parseInt(config.fontSize) || DEFAULT_THEME.fontSize)),
    sidebarPosition: ['left', 'right'].includes(config.sidebarPosition) ? config.sidebarPosition : DEFAULT_THEME.sidebarPosition,
    compactMode: !!config.compactMode,
    borderRadius: Math.min(20, Math.max(0, parseInt(config.borderRadius) || DEFAULT_THEME.borderRadius)),
  };

  db.prepare(
    "INSERT INTO settings (user_id, key, value, updated_at) VALUES (?, 'theme_config', ?, datetime('now')) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  ).run(userId, JSON.stringify(safe));

  return safe;
}

function getPresets() {
  return Object.entries(PRESETS).map(([name, config]) => ({ name, config }));
}

function generateCssVars(config) {
  const c = { ...DEFAULT_THEME, ...config };
  const vars = {
    '--accent': c.accent,
    '--font-size': `${c.fontSize}px`,
    '--radius': `${c.borderRadius}px`,
  };

  if (c.mode === 'light') {
    vars['--bg'] = '#FAF8F5';
    vars['--bg2'] = '#ffffff';
    vars['--bg3'] = '#F5F0EA';
    vars['--text'] = '#2D2A26';
    vars['--text2'] = '#6B6560';
    vars['--text3'] = '#9B9590';
    vars['--border'] = '#DDD5CB';
  }

  return vars;
}

module.exports = {
  DEFAULT_THEME,
  PRESETS,
  getTheme,
  saveTheme,
  getPresets,
  generateCssVars,
};
