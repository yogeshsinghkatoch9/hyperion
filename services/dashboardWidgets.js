/**
 * Dashboard Widgets — configurable cards with drag-and-drop positioning
 */
'use strict';
const { v4: uuidv4 } = require('uuid');

// Built-in widget types and their data sources
const WIDGET_TYPES = {
  system_stats: { label: 'System Stats', description: 'CPU, memory, uptime' },
  recent_activity: { label: 'Recent Activity', description: 'Latest actions across the platform' },
  agent_status: { label: 'Agent Status', description: 'Running/stopped agents' },
  quick_commands: { label: 'Quick Commands', description: 'Frequently used terminal commands' },
  notifications: { label: 'Notifications', description: 'Recent notifications' },
  metrics_chart: { label: 'Metrics Chart', description: 'Request rate and latency' },
  disk_usage: { label: 'Disk Usage', description: 'Storage consumption' },
  cron_status: { label: 'Cron Jobs', description: 'Scheduled task status' },
  bookmarks: { label: 'Bookmarks', description: 'Quick-access bookmarks' },
  clock: { label: 'Clock', description: 'Current time with timezone' },
};

const DEFAULT_WIDGETS = [
  { type: 'system_stats', title: 'System', position: 0, width: 1, height: 1 },
  { type: 'recent_activity', title: 'Activity', position: 1, width: 2, height: 1 },
  { type: 'agent_status', title: 'Agents', position: 2, width: 1, height: 1 },
  { type: 'notifications', title: 'Notifications', position: 3, width: 1, height: 1 },
];

function getWidgets(db, userId) {
  const widgets = db.prepare('SELECT * FROM dashboard_widgets WHERE user_id = ? ORDER BY position').all(userId);
  if (widgets.length === 0) {
    // Seed defaults
    return seedDefaults(db, userId);
  }
  return widgets.map(w => ({ ...w, config: JSON.parse(w.config || '{}') }));
}

function seedDefaults(db, userId) {
  const insert = db.prepare(
    'INSERT INTO dashboard_widgets (id, user_id, type, title, config, position, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const result = [];
  for (const w of DEFAULT_WIDGETS) {
    const id = uuidv4();
    insert.run(id, userId, w.type, w.title, '{}', w.position, w.width, w.height);
    result.push({ id, user_id: userId, ...w, config: {} });
  }
  return result;
}

function addWidget(db, userId, { type, title, config = {}, position, width = 1, height = 1 }) {
  if (!WIDGET_TYPES[type]) throw new Error(`Unknown widget type: ${type}`);
  const id = uuidv4();
  const pos = position !== undefined ? position : getWidgets(db, userId).length;
  db.prepare(
    'INSERT INTO dashboard_widgets (id, user_id, type, title, config, position, width, height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, userId, type, title || WIDGET_TYPES[type].label, JSON.stringify(config), pos, width, height);
  return { id, type, title: title || WIDGET_TYPES[type].label, config, position: pos, width, height };
}

function updateWidget(db, userId, widgetId, fields) {
  const sets = [];
  const values = [];
  if (fields.title !== undefined) { sets.push('title = ?'); values.push(fields.title); }
  if (fields.config !== undefined) { sets.push('config = ?'); values.push(JSON.stringify(fields.config)); }
  if (fields.position !== undefined) { sets.push('position = ?'); values.push(fields.position); }
  if (fields.width !== undefined) { sets.push('width = ?'); values.push(fields.width); }
  if (fields.height !== undefined) { sets.push('height = ?'); values.push(fields.height); }

  if (sets.length === 0) return;
  values.push(widgetId, userId);
  db.prepare(`UPDATE dashboard_widgets SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);
}

function removeWidget(db, userId, widgetId) {
  const info = db.prepare('DELETE FROM dashboard_widgets WHERE id = ? AND user_id = ?').run(widgetId, userId);
  if (info.changes === 0) throw new Error('Widget not found');
  return { deleted: true };
}

function reorderWidgets(db, userId, widgetIds) {
  const tx = db.transaction(() => {
    for (let i = 0; i < widgetIds.length; i++) {
      db.prepare('UPDATE dashboard_widgets SET position = ? WHERE id = ? AND user_id = ?').run(i, widgetIds[i], userId);
    }
  });
  tx();
  return getWidgets(db, userId);
}

function resetWidgets(db, userId) {
  db.prepare('DELETE FROM dashboard_widgets WHERE user_id = ?').run(userId);
  return seedDefaults(db, userId);
}

module.exports = {
  WIDGET_TYPES, DEFAULT_WIDGETS,
  getWidgets, addWidget, updateWidget, removeWidget,
  reorderWidgets, resetWidgets, seedDefaults,
};
