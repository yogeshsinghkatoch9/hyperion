import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const { WIDGET_TYPES, DEFAULT_WIDGETS, getWidgets, addWidget, updateWidget, removeWidget, reorderWidgets, resetWidgets, seedDefaults } = await import('../services/dashboardWidgets.js');

describe('Dashboard Widgets', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS dashboard_widgets (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL,
        title TEXT, config TEXT DEFAULT '{}', position INTEGER DEFAULT 0,
        width INTEGER DEFAULT 1, height INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  describe('WIDGET_TYPES', () => {
    it('has 10 widget types', () => {
      expect(Object.keys(WIDGET_TYPES).length).toBe(10);
    });

    it('includes system_stats', () => {
      expect(WIDGET_TYPES.system_stats).toBeDefined();
      expect(WIDGET_TYPES.system_stats.label).toBe('System Stats');
    });
  });

  describe('DEFAULT_WIDGETS', () => {
    it('has default widgets', () => {
      expect(DEFAULT_WIDGETS.length).toBe(4);
    });
  });

  describe('getWidgets', () => {
    it('seeds defaults for new user', () => {
      const widgets = getWidgets(db, 'user1');
      expect(widgets.length).toBe(DEFAULT_WIDGETS.length);
      expect(widgets[0].type).toBe('system_stats');
    });

    it('returns existing widgets', () => {
      getWidgets(db, 'user1'); // seed
      const widgets = getWidgets(db, 'user1');
      expect(widgets.length).toBe(DEFAULT_WIDGETS.length);
    });

    it('parses config JSON', () => {
      getWidgets(db, 'user1');
      const widgets = getWidgets(db, 'user1');
      expect(widgets[0].config).toEqual({});
    });
  });

  describe('addWidget', () => {
    it('adds a widget', () => {
      const w = addWidget(db, 'user1', { type: 'clock', title: 'My Clock' });
      expect(w.id).toBeDefined();
      expect(w.type).toBe('clock');
      expect(w.title).toBe('My Clock');
    });

    it('uses default title from type', () => {
      const w = addWidget(db, 'user1', { type: 'clock' });
      expect(w.title).toBe('Clock');
    });

    it('throws for unknown type', () => {
      expect(() => addWidget(db, 'user1', { type: 'nonexistent' })).toThrow('Unknown widget type');
    });

    it('auto-assigns position', () => {
      getWidgets(db, 'user1'); // seeds 4
      const w = addWidget(db, 'user1', { type: 'clock' });
      expect(w.position).toBe(4);
    });

    it('respects explicit position', () => {
      const w = addWidget(db, 'user1', { type: 'clock', position: 0 });
      expect(w.position).toBe(0);
    });
  });

  describe('updateWidget', () => {
    it('updates title', () => {
      const w = addWidget(db, 'user1', { type: 'clock', title: 'Old' });
      updateWidget(db, 'user1', w.id, { title: 'New' });
      const widgets = db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(w.id);
      expect(widgets.title).toBe('New');
    });

    it('updates config', () => {
      const w = addWidget(db, 'user1', { type: 'clock' });
      updateWidget(db, 'user1', w.id, { config: { timezone: 'UTC' } });
      const widgets = db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(w.id);
      expect(JSON.parse(widgets.config)).toEqual({ timezone: 'UTC' });
    });

    it('updates position', () => {
      const w = addWidget(db, 'user1', { type: 'clock', position: 0 });
      updateWidget(db, 'user1', w.id, { position: 5 });
      const widgets = db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(w.id);
      expect(widgets.position).toBe(5);
    });

    it('updates size', () => {
      const w = addWidget(db, 'user1', { type: 'clock' });
      updateWidget(db, 'user1', w.id, { width: 2, height: 2 });
      const widgets = db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(w.id);
      expect(widgets.width).toBe(2);
      expect(widgets.height).toBe(2);
    });

    it('does nothing with empty fields', () => {
      const w = addWidget(db, 'user1', { type: 'clock', title: 'Unchanged' });
      updateWidget(db, 'user1', w.id, {});
      const widgets = db.prepare('SELECT * FROM dashboard_widgets WHERE id = ?').get(w.id);
      expect(widgets.title).toBe('Unchanged');
    });
  });

  describe('removeWidget', () => {
    it('removes a widget', () => {
      const w = addWidget(db, 'user1', { type: 'clock' });
      const result = removeWidget(db, 'user1', w.id);
      expect(result.deleted).toBe(true);
    });

    it('throws if not found', () => {
      expect(() => removeWidget(db, 'user1', 'nope')).toThrow('Widget not found');
    });

    it('does not remove other user widgets', () => {
      const w = addWidget(db, 'user1', { type: 'clock' });
      expect(() => removeWidget(db, 'user2', w.id)).toThrow('Widget not found');
    });
  });

  describe('reorderWidgets', () => {
    it('reorders widgets', () => {
      const widgets = getWidgets(db, 'user1');
      const ids = widgets.map(w => w.id).reverse();
      const reordered = reorderWidgets(db, 'user1', ids);
      expect(reordered[0].id).toBe(ids[0]);
    });
  });

  describe('resetWidgets', () => {
    it('resets to defaults', () => {
      getWidgets(db, 'user1');
      addWidget(db, 'user1', { type: 'clock' });
      const reset = resetWidgets(db, 'user1');
      expect(reset.length).toBe(DEFAULT_WIDGETS.length);
    });
  });
});
