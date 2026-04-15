/**
 * Vector Memory Tests — store, search, delete conversations
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
const Database = require('better-sqlite3');

describe('Vector Memory', () => {
  let db, vectorMemory;

  beforeAll(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    require('../services/db')(db);
    vectorMemory = require('../services/vectorMemory');
    vectorMemory.init(db);
  });

  afterAll(() => {
    db.close();
  });

  test('store saves a conversation entry', async () => {
    const id = await vectorMemory.store('Hello, how do I list files?', { role: 'user' });
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  test('store saves multiple entries', async () => {
    await vectorMemory.store('Use ls -la to list files with details', { role: 'assistant' });
    await vectorMemory.store('How do I find large files?', { role: 'user' });
    await vectorMemory.store('Use find / -size +100M to find files larger than 100MB', { role: 'assistant' });

    const stats = vectorMemory.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(4);
  });

  test('getRecent returns most recent entries', () => {
    const recent = vectorMemory.getRecent(10);
    expect(recent.length).toBeGreaterThanOrEqual(4);
    expect(recent[0]).toHaveProperty('content');
    expect(recent[0]).toHaveProperty('created_at');
  });

  test('search finds relevant conversations (TF-IDF fallback)', async () => {
    const results = await vectorMemory.search('list files', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('similarity');
    expect(results[0].similarity).toBeGreaterThan(0);
    // The "list files" query should match the ls-related conversation
    expect(results[0].content).toContain('list');
  });

  test('search returns empty for unrelated query', async () => {
    const results = await vectorMemory.search('quantum physics theory');
    // May return low-similarity results or empty
    if (results.length > 0) {
      expect(results[0].similarity).toBeLessThan(0.5);
    }
  });

  test('forget deletes a specific entry', async () => {
    const id = await vectorMemory.store('Delete me', { role: 'test' });
    const deleted = vectorMemory.forget(id);
    expect(deleted).toBe(true);

    // Should not appear in recent
    const recent = vectorMemory.getRecent(100);
    expect(recent.find(r => r.id === id)).toBeUndefined();
  });

  test('forget returns false for nonexistent id', () => {
    expect(vectorMemory.forget('nonexistent-id')).toBe(false);
  });

  test('getStats returns correct counts', () => {
    const stats = vectorMemory.getStats();
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('withEmbeddings');
    expect(stats).toHaveProperty('oldestDate');
    expect(stats).toHaveProperty('newestDate');
    expect(stats.total).toBeGreaterThan(0);
  });

  test('clearAll removes all entries', () => {
    vectorMemory.clearAll();
    const stats = vectorMemory.getStats();
    expect(stats.total).toBe(0);
  });
});
