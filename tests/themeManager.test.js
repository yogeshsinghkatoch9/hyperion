import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const themeManager = require('../services/themeManager');

function createTestDB() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      key TEXT NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, key)
    );
  `);
  return db;
}

describe('themeManager', () => {
  let db;
  beforeEach(() => { db = createTestDB(); });

  describe('getTheme', () => {
    it('returns default theme when none saved', () => {
      const theme = themeManager.getTheme(db, 'u1');
      expect(theme).toEqual(themeManager.DEFAULT_THEME);
    });

    it('returns saved theme', () => {
      themeManager.saveTheme(db, 'u1', { mode: 'light', accent: '#ff0000' });
      const theme = themeManager.getTheme(db, 'u1');
      expect(theme.mode).toBe('light');
      expect(theme.accent).toBe('#ff0000');
    });

    it('merges with defaults for missing fields', () => {
      db.prepare("INSERT INTO settings (user_id, key, value) VALUES ('u1', 'theme_config', '{\"mode\":\"light\"}')").run();
      const theme = themeManager.getTheme(db, 'u1');
      expect(theme.mode).toBe('light');
      expect(theme.fontSize).toBe(themeManager.DEFAULT_THEME.fontSize);
    });
  });

  describe('saveTheme', () => {
    it('saves valid theme config', () => {
      const result = themeManager.saveTheme(db, 'u1', {
        mode: 'dark', accent: '#00ff88', fontSize: 15, borderRadius: 10,
      });
      expect(result.mode).toBe('dark');
      expect(result.accent).toBe('#00ff88');
      expect(result.fontSize).toBe(15);
    });

    it('clamps fontSize to valid range', () => {
      const result = themeManager.saveTheme(db, 'u1', { fontSize: 50 });
      expect(result.fontSize).toBe(22);
      const result2 = themeManager.saveTheme(db, 'u1', { fontSize: 5 });
      expect(result2.fontSize).toBe(10);
    });

    it('clamps borderRadius to valid range', () => {
      const result = themeManager.saveTheme(db, 'u1', { borderRadius: 100 });
      expect(result.borderRadius).toBe(20);
    });

    it('validates accent color format', () => {
      const result = themeManager.saveTheme(db, 'u1', { accent: 'not-a-color' });
      expect(result.accent).toBe(themeManager.DEFAULT_THEME.accent);
    });

    it('validates mode', () => {
      const result = themeManager.saveTheme(db, 'u1', { mode: 'invalid' });
      expect(result.mode).toBe('dark');
    });

    it('throws on invalid input', () => {
      expect(() => themeManager.saveTheme(db, 'u1', null)).toThrow();
      expect(() => themeManager.saveTheme(db, 'u1', 'string')).toThrow();
    });

    it('updates existing theme', () => {
      themeManager.saveTheme(db, 'u1', { mode: 'dark' });
      themeManager.saveTheme(db, 'u1', { mode: 'light' });
      const theme = themeManager.getTheme(db, 'u1');
      expect(theme.mode).toBe('light');
    });
  });

  describe('getPresets', () => {
    it('returns array of presets', () => {
      const presets = themeManager.getPresets();
      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBe(8);
    });

    it('each preset has name and config', () => {
      const presets = themeManager.getPresets();
      for (const p of presets) {
        expect(p).toHaveProperty('name');
        expect(p).toHaveProperty('config');
        expect(p.config).toHaveProperty('mode');
        expect(p.config).toHaveProperty('accent');
      }
    });

    it('includes Hyperion preset', () => {
      const presets = themeManager.getPresets();
      const hyperion = presets.find(p => p.name === 'Hyperion');
      expect(hyperion).toBeDefined();
      expect(hyperion.config.accent).toBe('#DA7756');
    });

    it('includes sci-fi themed presets', () => {
      const presets = themeManager.getPresets();
      const names = presets.map(p => p.name);
      expect(names).toContain('HAL 9000');
      expect(names).toContain('JARVIS');
      expect(names).toContain('LCARS');
      expect(names).toContain('Wintermute');
      expect(names).toContain('Cortana');
    });
  });

  describe('generateCssVars', () => {
    it('generates CSS variables', () => {
      const vars = themeManager.generateCssVars(themeManager.DEFAULT_THEME);
      expect(vars['--accent']).toBe('#DA7756');
      expect(vars['--font-size']).toBe('13px');
      expect(vars['--radius']).toBe('12px');
    });

    it('generates light mode variables', () => {
      const vars = themeManager.generateCssVars({ mode: 'light', accent: '#0066cc', fontSize: 14, borderRadius: 6 });
      expect(vars['--bg']).toBe('#FAF8F5');
      expect(vars['--text']).toBe('#2D2A26');
    });

    it('uses defaults for missing config', () => {
      const vars = themeManager.generateCssVars({});
      expect(vars['--accent']).toBe('#DA7756');
    });
  });

  describe('DEFAULT_THEME', () => {
    it('has expected defaults', () => {
      expect(themeManager.DEFAULT_THEME.mode).toBe('dark');
      expect(themeManager.DEFAULT_THEME.accent).toBe('#DA7756');
      expect(themeManager.DEFAULT_THEME.fontSize).toBe(13);
      expect(themeManager.DEFAULT_THEME.compactMode).toBe(false);
      expect(themeManager.DEFAULT_THEME.borderRadius).toBe(12);
    });
  });
});
