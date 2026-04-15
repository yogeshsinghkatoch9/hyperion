/**
 * Database Initialization Tests — validates services/db.js creates all required tables
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const Database = require('better-sqlite3');
const initDB = require('../services/db');

let db;

beforeAll(() => {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
});

afterAll(() => {
  if (db) db.close();
});

// All tables that services/db.js should create
const EXPECTED_TABLES = [
  'users', 'notebooks', 'agents', 'agent_logs', 'snippets',
  'command_history', 'workflow_profiles', 'notifications', 'settings',
  'ssh_connections', 'conversations', 'cron_runs', 'canvas_items',
  'channels', 'discovered_nodes', 'wol_devices', 'vault_config',
  'vault_secrets', 'http_collections', 'http_history', 'http_environments',
  'monitor_alerts', 'saved_queries', 'query_history', 'remote_sessions',
  'ws_connections', 'ws_messages', 'md_notes', 'mock_endpoints',
  'quick_notes', 'bookmarks', 'load_tests', 'load_results',
  'data_sets', 'clipboard_items', 'pomodoro_sessions', 'link_checks',
  'regex_patterns', 'diff_snapshots', 'cron_presets', 'color_palettes',
];

describe('Database Initialization', () => {
  test('initDB runs without error', () => {
    expect(() => initDB(db)).not.toThrow();
  });

  test('creates all expected tables', () => {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const tableNames = rows.map(r => r.name);
    for (const table of EXPECTED_TABLES) {
      expect(tableNames, `Missing table: ${table}`).toContain(table);
    }
  });

  test('idempotent — calling initDB twice does not throw', () => {
    expect(() => initDB(db)).not.toThrow();
  });

  test('users table has expected columns', () => {
    const cols = db.prepare("PRAGMA table_info('users')").all().map(c => c.name);
    expect(cols).toContain('id');
    expect(cols).toContain('username');
    expect(cols).toContain('password_hash');
    expect(cols).toContain('role');
    expect(cols).toContain('created_at');
  });

  test('agents table has expected columns', () => {
    const cols = db.prepare("PRAGMA table_info('agents')").all().map(c => c.name);
    expect(cols).toContain('id');
    expect(cols).toContain('name');
    expect(cols).toContain('type');
    expect(cols).toContain('script');
    expect(cols).toContain('schedule');
    expect(cols).toContain('status');
    expect(cols).toContain('pid');
  });

  test('foreign keys are enabled', () => {
    const fk = db.pragma('foreign_keys');
    expect(fk[0].foreign_keys).toBe(1);
  });

  test('can insert and query a row in the users table', () => {
    db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)").run('u1', 'alice', 'hash123');
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get('u1');
    expect(user.username).toBe('alice');
    expect(user.role).toBe('admin'); // default
  });

  test('users table enforces unique username constraint', () => {
    db.prepare("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)").run('u2', 'bob', 'hash456');
    expect(() => {
      db.prepare("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)").run('u3', 'bob', 'hash789');
    }).toThrow();
  });
});
