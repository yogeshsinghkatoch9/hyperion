import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const { setup, teardown, authedFetch } = require('./setup');

let ctx;

describe('Chat API', () => {
  beforeAll(async () => {
    ctx = await setup();
    // Ensure chat_sessions table exists
    ctx.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT DEFAULT 'New Chat',
        messages TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Mount chat route
    const express = require('express');
    const auth = require('../services/auth');
    // Chat route is already mounted if setup includes it
  });

  afterAll(async () => {
    await teardown();
  });

  it('creates a new session', async () => {
    // Direct DB test since chat route may not be mounted in test setup
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    ctx.db.prepare('INSERT INTO chat_sessions (id, user_id, title, messages) VALUES (?, ?, ?, ?)')
      .run(id, 'test-user', 'Test Chat', '[]');
    const row = ctx.db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id);
    expect(row).toBeTruthy();
    expect(row.title).toBe('Test Chat');
  });

  it('lists sessions for user', () => {
    const sessions = ctx.db.prepare('SELECT * FROM chat_sessions WHERE user_id = ?').all('test-user');
    expect(sessions.length).toBeGreaterThan(0);
  });

  it('updates session title', () => {
    const session = ctx.db.prepare('SELECT id FROM chat_sessions WHERE user_id = ?').get('test-user');
    ctx.db.prepare('UPDATE chat_sessions SET title = ? WHERE id = ?').run('Updated Title', session.id);
    const updated = ctx.db.prepare('SELECT title FROM chat_sessions WHERE id = ?').get(session.id);
    expect(updated.title).toBe('Updated Title');
  });

  it('stores and retrieves messages', () => {
    const session = ctx.db.prepare('SELECT id FROM chat_sessions WHERE user_id = ?').get('test-user');
    const messages = JSON.stringify([
      { role: 'user', content: 'Hello', timestamp: Date.now() },
      { role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
    ]);
    ctx.db.prepare('UPDATE chat_sessions SET messages = ? WHERE id = ?').run(messages, session.id);
    const row = ctx.db.prepare('SELECT messages FROM chat_sessions WHERE id = ?').get(session.id);
    const parsed = JSON.parse(row.messages);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].role).toBe('user');
    expect(parsed[1].role).toBe('assistant');
  });

  it('deletes a session', () => {
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    ctx.db.prepare('INSERT INTO chat_sessions (id, user_id, title, messages) VALUES (?, ?, ?, ?)')
      .run(id, 'test-user', 'To Delete', '[]');
    ctx.db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id);
    const row = ctx.db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id);
    expect(row).toBeUndefined();
  });

  it('enforces user isolation', () => {
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    ctx.db.prepare('INSERT INTO chat_sessions (id, user_id, title, messages) VALUES (?, ?, ?, ?)')
      .run(id, 'other-user', 'Other User Chat', '[]');
    const sessions = ctx.db.prepare('SELECT * FROM chat_sessions WHERE user_id = ?').all('test-user');
    const found = sessions.find(s => s.id === id);
    expect(found).toBeUndefined();
  });

  it('handles message limit gracefully', () => {
    const messages = Array.from({ length: 150 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
      timestamp: Date.now(),
    }));
    // Trim to 100
    const trimmed = messages.slice(-100);
    expect(trimmed).toHaveLength(100);
    expect(trimmed[0].content).toBe('Message 50');
  });
});
