import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { setup, teardown, authedFetch } = require('./setup');

let ctx;

beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await teardown(); });

describe('Auth', () => {
  it('returns authenticated status', async () => {
    const res = await authedFetch('/api/auth/status');
    const data = await res.json();
    expect(data.authenticated).toBe(true);
    expect(data.user).toBe('testuser');
  });

  it('rejects invalid login', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated API calls', async () => {
    const res = await fetch(`${ctx.baseUrl}/api/settings`);
    expect(res.status).toBe(401);
  });
});

describe('Settings', () => {
  it('saves and retrieves settings', async () => {
    const putRes = await authedFetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ theme: 'dark', llm_provider: 'ollama' }),
    });
    expect((await putRes.json()).ok).toBe(true);

    const getRes = await authedFetch('/api/settings');
    const settings = await getRes.json();
    expect(settings.theme).toBe('dark');
    expect(settings.llm_provider).toBe('ollama');
  });

  it('retrieves single setting', async () => {
    const res = await authedFetch('/api/settings/theme');
    const data = await res.json();
    expect(data.value).toBe('dark');
  });

  it('deletes a setting', async () => {
    await authedFetch('/api/settings/theme', { method: 'DELETE' });
    const res = await authedFetch('/api/settings/theme');
    expect(res.status).toBe(404);
  });

  it('changes password', async () => {
    const res = await authedFetch('/api/settings/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'testpass123', newPassword: 'newpass456' }),
    });
    const data = await res.json();
    expect(data.ok).toBe(true);

    // Login with new password
    const loginRes = await fetch(`${ctx.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'newpass456' }),
    });
    expect(loginRes.status).toBe(200);
  });
});

describe('Notifications', () => {
  it('creates and lists notifications', async () => {
    await authedFetch('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', message: 'Hello', level: 'info' }),
    });
    const res = await authedFetch('/api/notifications');
    const notifs = await res.json();
    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs[0].title).toBe('Test');
  });

  it('returns unread count', async () => {
    const res = await authedFetch('/api/notifications/unread-count');
    const data = await res.json();
    expect(typeof data.count).toBe('number');
    expect(data.count).toBeGreaterThan(0);
  });
});

describe('Search', () => {
  it('searches across tables', async () => {
    const res = await authedFetch('/api/search?q=test');
    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(typeof data.results).toBe('object');
  });

  it('requires minimum query length', async () => {
    const res = await authedFetch('/api/search?q=a');
    const data = await res.json();
    expect(data.results).toEqual({});
  });
});

describe('SSH Connections', () => {
  let connId;

  it('creates an SSH connection', async () => {
    const res = await authedFetch('/api/ssh', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Server', host: '192.168.1.1', username: 'root' }),
    });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.id).toBeDefined();
    connId = data.id;
  });

  it('lists SSH connections', async () => {
    const res = await authedFetch('/api/ssh');
    const conns = await res.json();
    expect(conns.length).toBeGreaterThan(0);
    expect(conns[0].name).toBe('Test Server');
  });

  it('deletes an SSH connection', async () => {
    const res = await authedFetch(`/api/ssh/${connId}`, { method: 'DELETE' });
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
