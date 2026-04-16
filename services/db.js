module.exports = function initDB(db) {
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      cells TEXT DEFAULT '[]',
      language TEXT DEFAULT 'python',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'script',
      script TEXT,
      schedule TEXT,
      env TEXT DEFAULT '{}',
      status TEXT DEFAULT 'stopped',
      last_run DATETIME,
      last_output TEXT,
      last_error TEXT,
      pid INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
      type TEXT DEFAULT 'stdout',
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      language TEXT DEFAULT 'python',
      code TEXT,
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS command_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT,
      language TEXT,
      output TEXT,
      exit_code INTEGER,
      duration_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workflow_profiles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      actions TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT,
      source TEXT DEFAULT 'system',
      level TEXT DEFAULT 'info',
      read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      key TEXT NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, key)
    );

    CREATE TABLE IF NOT EXISTS ssh_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER DEFAULT 22,
      username TEXT NOT NULL,
      auth_type TEXT DEFAULT 'password',
      key_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 4: Vector Memory
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding BLOB,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 4: Cron Runs
    CREATE TABLE IF NOT EXISTS cron_runs (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      output TEXT,
      started_at DATETIME,
      finished_at DATETIME
    );

    -- Wave 4: Canvas Items
    CREATE TABLE IF NOT EXISTS canvas_items (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT NOT NULL,
      title TEXT,
      content TEXT,
      x REAL DEFAULT 0,
      y REAL DEFAULT 0,
      width REAL DEFAULT 300,
      height REAL DEFAULT 200,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 4: Messaging Channels
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      config TEXT,
      status TEXT DEFAULT 'stopped',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 4: Discovered Nodes
    CREATE TABLE IF NOT EXISTS discovered_nodes (
      id TEXT PRIMARY KEY,
      name TEXT,
      host TEXT NOT NULL,
      port INTEGER,
      os TEXT,
      capabilities TEXT,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Remote Desktop: WoL Devices
    CREATE TABLE IF NOT EXISTS wol_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mac TEXT NOT NULL,
      broadcast_addr TEXT DEFAULT '255.255.255.255',
      port INTEGER DEFAULT 9,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Vault: Config (master password salt, test cipher)
    CREATE TABLE IF NOT EXISTS vault_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Vault: Encrypted Secrets
    CREATE TABLE IF NOT EXISTS vault_secrets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      encrypted_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- HTTP Client: Collections
    CREATE TABLE IF NOT EXISTS http_collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      requests TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- HTTP Client: History
    CREATE TABLE IF NOT EXISTS http_history (
      id TEXT PRIMARY KEY,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      status INTEGER,
      time_ms INTEGER,
      size_bytes INTEGER,
      request_data TEXT DEFAULT '{}',
      response_data TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- HTTP Client: Environments
    CREATE TABLE IF NOT EXISTS http_environments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      variables TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Monitor: Alert History
    CREATE TABLE IF NOT EXISTS monitor_alerts (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- DB Explorer: Saved Queries
    CREATE TABLE IF NOT EXISTS saved_queries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sql TEXT NOT NULL,
      conn_id TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- DB Explorer: Query History
    CREATE TABLE IF NOT EXISTS query_history (
      id TEXT PRIMARY KEY,
      conn_id TEXT,
      sql TEXT NOT NULL,
      row_count INTEGER DEFAULT 0,
      time_ms INTEGER DEFAULT 0,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Remote Desktop: Session Logs
    CREATE TABLE IF NOT EXISTS remote_sessions (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      action TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 7: WebSocket Tester
    CREATE TABLE IF NOT EXISTS ws_connections (
      id TEXT PRIMARY KEY,
      name TEXT,
      url TEXT,
      headers TEXT DEFAULT '{}',
      protocols TEXT DEFAULT '[]',
      last_used DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ws_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conn_id TEXT,
      direction TEXT,
      payload TEXT,
      msg_type TEXT DEFAULT 'text',
      size_bytes INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 7: Markdown Editor
    CREATE TABLE IF NOT EXISTS md_notes (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 7: API Mock Server
    CREATE TABLE IF NOT EXISTS mock_endpoints (
      id TEXT PRIMARY KEY,
      path TEXT,
      method TEXT DEFAULT 'GET',
      status INTEGER DEFAULT 200,
      body TEXT DEFAULT '',
      headers TEXT DEFAULT '{}',
      delay_ms INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 7: Quick Notes
    CREATE TABLE IF NOT EXISTS quick_notes (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      color TEXT DEFAULT 'default',
      pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 7: Bookmarks
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      url TEXT,
      title TEXT,
      description TEXT,
      tags TEXT DEFAULT '[]',
      favicon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 8: Load Tester
    CREATE TABLE IF NOT EXISTS load_tests (
      id TEXT PRIMARY KEY,
      url TEXT,
      method TEXT DEFAULT 'GET',
      concurrency INTEGER,
      total_requests INTEGER,
      summary TEXT DEFAULT '{}',
      created_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS load_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id TEXT,
      status INTEGER,
      latency_ms REAL,
      error TEXT,
      created_at DATETIME
    );

    -- Wave 8: Data Viewer
    CREATE TABLE IF NOT EXISTS data_sets (
      id TEXT PRIMARY KEY,
      name TEXT,
      content TEXT,
      format TEXT DEFAULT 'csv',
      row_count INTEGER DEFAULT 0,
      created_at DATETIME
    );

    -- Wave 8: Clipboard Manager
    CREATE TABLE IF NOT EXISTS clipboard_items (
      id TEXT PRIMARY KEY,
      content TEXT,
      label TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      pinned INTEGER DEFAULT 0,
      created_at DATETIME
    );

    -- Wave 8: Pomodoro Timer
    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id TEXT PRIMARY KEY,
      type TEXT DEFAULT 'focus',
      duration_min INTEGER DEFAULT 25,
      label TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      started_at DATETIME,
      completed_at DATETIME
    );

    -- Wave 8: Link Checker
    CREATE TABLE IF NOT EXISTS link_checks (
      id TEXT PRIMARY KEY,
      url TEXT,
      total_links INTEGER DEFAULT 0,
      summary TEXT DEFAULT '{}',
      results TEXT DEFAULT '[]',
      created_at DATETIME
    );

    -- Wave 9: Regex Tester
    CREATE TABLE IF NOT EXISTS regex_patterns (
      id TEXT PRIMARY KEY,
      name TEXT,
      pattern TEXT,
      flags TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 9: Diff Viewer
    CREATE TABLE IF NOT EXISTS diff_snapshots (
      id TEXT PRIMARY KEY,
      name TEXT,
      text_a TEXT,
      text_b TEXT,
      stats TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 9: Cron Builder
    CREATE TABLE IF NOT EXISTS cron_presets (
      id TEXT PRIMARY KEY,
      name TEXT,
      expression TEXT,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Wave 9: Color Tools
    CREATE TABLE IF NOT EXISTS color_palettes (
      id TEXT PRIMARY KEY,
      name TEXT,
      colors TEXT DEFAULT '[]',
      type TEXT DEFAULT 'custom',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Backup Log
    CREATE TABLE IF NOT EXISTS backup_log (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      size_bytes INTEGER,
      action TEXT DEFAULT 'create',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit Logging
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      action TEXT NOT NULL,
      resource TEXT,
      details TEXT,
      ip TEXT,
      user_agent TEXT,
      status_code INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

    -- Analytics Events
    CREATE TABLE IF NOT EXISTS analytics_events (
      id TEXT PRIMARY KEY,
      event TEXT NOT NULL,
      page TEXT,
      user_id TEXT,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics_events(event);
    CREATE INDEX IF NOT EXISTS idx_analytics_page ON analytics_events(page);
    CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);

    -- 2FA/TOTP Secrets
    CREATE TABLE IF NOT EXISTS totp_secrets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      encrypted_secret TEXT NOT NULL,
      enabled INTEGER DEFAULT 0,
      backup_codes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- API Keys
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      prefix TEXT NOT NULL,
      permissions TEXT DEFAULT '["*"]',
      last_used DATETIME,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(prefix);

    -- Notification Preferences
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      UNIQUE(user_id, category)
    );

    -- SSH Tunnels
    CREATE TABLE IF NOT EXISTS ssh_tunnels (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      name TEXT NOT NULL,
      local_port INTEGER NOT NULL,
      remote_host TEXT NOT NULL,
      remote_port INTEGER NOT NULL,
      type TEXT DEFAULT 'local',
      status TEXT DEFAULT 'stopped',
      pid INTEGER,
      auto_reconnect INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- File Versions
    CREATE TABLE IF NOT EXISTS file_versions (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      content TEXT,
      size INTEGER DEFAULT 0,
      hash TEXT,
      reason TEXT DEFAULT 'edit',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_file_versions_path ON file_versions(file_path);
    CREATE INDEX IF NOT EXISTS idx_file_versions_created ON file_versions(created_at);

    -- Webhook Subscriptions
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT DEFAULT '["*"]',
      headers TEXT DEFAULT '{}',
      secret TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Webhook Delivery Log
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL,
      event TEXT NOT NULL,
      payload TEXT,
      status_code INTEGER,
      response TEXT,
      duration_ms INTEGER,
      success INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub ON webhook_deliveries(subscription_id);

    -- Dashboard Widgets
    CREATE TABLE IF NOT EXISTS dashboard_widgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT,
      config TEXT DEFAULT '{}',
      position INTEGER DEFAULT 0,
      width INTEGER DEFAULT 1,
      height INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Persistent Sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    -- Login History
    CREATE TABLE IF NOT EXISTS login_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      username TEXT,
      ip TEXT,
      user_agent TEXT,
      success INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);

    -- RBAC Roles
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT DEFAULT '[]',
      is_system INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- User-Role assignments
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY(user_id, role_id)
    );

    -- AI Chat Sessions
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT DEFAULT 'New Chat',
      messages TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at);

    -- Metrics Snapshots (persistent)
    CREATE TABLE IF NOT EXISTS metrics_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_requests INTEGER,
      avg_duration REAL,
      p95_duration REAL,
      p99_duration REAL,
      mem_usage INTEGER,
      cpu_usage REAL,
      by_method TEXT DEFAULT '{}',
      by_status TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_metrics_created ON metrics_snapshots(created_at);

    -- ═══ Performance Indexes ═══
    CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_command_history_created ON command_history(created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);
    CREATE INDEX IF NOT EXISTS idx_cron_runs_agent ON cron_runs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_canvas_items_user ON canvas_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_ssh_connections_user ON ssh_connections(user_id);
    CREATE INDEX IF NOT EXISTS idx_http_history_created ON http_history(created_at);
    CREATE INDEX IF NOT EXISTS idx_ws_messages_conn ON ws_messages(conn_id);
    CREATE INDEX IF NOT EXISTS idx_load_results_test ON load_results(test_id);
    CREATE INDEX IF NOT EXISTS idx_monitor_alerts_created ON monitor_alerts(created_at);
    CREATE INDEX IF NOT EXISTS idx_query_history_created ON query_history(created_at);
    CREATE INDEX IF NOT EXISTS idx_remote_sessions_created ON remote_sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user ON dashboard_widgets(user_id);
    CREATE INDEX IF NOT EXISTS idx_ssh_tunnels_conn ON ssh_tunnels(connection_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_created ON bookmarks(created_at);
    CREATE INDEX IF NOT EXISTS idx_clipboard_items_pinned ON clipboard_items(pinned);
    CREATE INDEX IF NOT EXISTS idx_quick_notes_pinned ON quick_notes(pinned);
    CREATE INDEX IF NOT EXISTS idx_pomodoro_started ON pomodoro_sessions(started_at);
  `);

  // Initialize FTS5 if available
  try {
    const fts = require('./fts');
    if (fts.isFts5Available(db)) {
      fts.initFtsTables(db);
      // Rebuild FTS indexes on first init
      const ftsInit = db.prepare("SELECT value FROM settings WHERE user_id = 'system' AND key = 'fts_initialized'").get();
      if (!ftsInit) {
        fts.rebuildAll(db);
        db.prepare("INSERT INTO settings (user_id, key, value, updated_at) VALUES ('system', 'fts_initialized', '1', datetime('now'))").run();
      }
    }
  } catch {}
};
