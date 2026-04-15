/**
 * API Docs Route Tests — validates /api/docs returns structured route documentation
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const http = require('http');
const express = require('express');

let server, baseUrl;

beforeAll(async () => {
  const app = express();
  app.use(express.json());

  // Mount a few sample routes so apiDocs has something to discover
  const sampleRouter = express.Router();
  sampleRouter.get('/status', (_req, res) => res.json({ ok: true }));
  sampleRouter.post('/run', (_req, res) => res.json({ ok: true }));
  app.use('/api/test', sampleRouter);

  const otherRouter = express.Router();
  otherRouter.get('/', (_req, res) => res.json([]));
  otherRouter.delete('/:id', (_req, res) => res.json({ ok: true }));
  app.use('/api/items', otherRouter);

  // Direct route on the app
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Mount the apiDocs route
  app.use('/api/docs', require('../routes/apiDocs'));

  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

function fetchDocs() {
  return fetch(`${baseUrl}/api/docs`);
}

describe('API Docs Route', () => {
  test('GET /api/docs returns 200', async () => {
    const res = await fetchDocs();
    expect(res.status).toBe(200);
  });

  test('response has name, version, totalRoutes, groups', async () => {
    const data = await (await fetchDocs()).json();
    expect(data).toHaveProperty('name');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('totalRoutes');
    expect(data).toHaveProperty('groups');
  });

  test('name is "Hyperion API" and version is "1.0.0"', async () => {
    const data = await (await fetchDocs()).json();
    expect(data.name).toBe('Hyperion API');
    expect(data.version).toBe('1.0.0');
  });

  test('totalRoutes is a positive number matching actual routes', async () => {
    const data = await (await fetchDocs()).json();
    expect(typeof data.totalRoutes).toBe('number');
    expect(data.totalRoutes).toBeGreaterThan(0);
    const allRoutes = Object.values(data.groups).flat();
    expect(data.totalRoutes).toBe(allRoutes.length);
  });

  test('groups is a non-empty object with string keys', async () => {
    const data = await (await fetchDocs()).json();
    expect(typeof data.groups).toBe('object');
    const keys = Object.keys(data.groups);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(typeof key).toBe('string');
      expect(key.startsWith('/')).toBe(true);
    }
  });

  test('each route entry has path (string) and methods (array)', async () => {
    const data = await (await fetchDocs()).json();
    const allRoutes = Object.values(data.groups).flat();
    for (const route of allRoutes) {
      expect(typeof route.path).toBe('string');
      expect(Array.isArray(route.methods)).toBe(true);
      expect(route.methods.length).toBeGreaterThan(0);
    }
  });

  test('methods are uppercase HTTP verbs', async () => {
    const data = await (await fetchDocs()).json();
    const valid = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    const allRoutes = Object.values(data.groups).flat();
    for (const route of allRoutes) {
      for (const m of route.methods) {
        expect(m).toBe(m.toUpperCase());
        expect(valid).toContain(m);
      }
    }
  });

  test('routes are sorted alphabetically by path', async () => {
    const data = await (await fetchDocs()).json();
    const allRoutes = Object.values(data.groups).flat();
    for (let i = 1; i < allRoutes.length; i++) {
      expect(allRoutes[i].path.localeCompare(allRoutes[i - 1].path)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('OpenAPI Spec (/api/docs/openapi.json)', () => {
  function fetchOpenAPI() {
    return fetch(`${baseUrl}/api/docs/openapi.json`);
  }

  test('GET /openapi.json returns valid OpenAPI structure', async () => {
    const res = await fetchOpenAPI();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('openapi', '3.0.0');
    expect(data).toHaveProperty('info');
    expect(data).toHaveProperty('paths');
    expect(data).toHaveProperty('servers');
  });

  test('OpenAPI has info.title and info.version', async () => {
    const data = await (await fetchOpenAPI()).json();
    expect(data.info.title).toBe('Hyperion API');
    expect(data.info.version).toBe('1.0.0');
    expect(typeof data.info.description).toBe('string');
  });

  test('OpenAPI paths is non-empty and contains discovered routes', async () => {
    const data = await (await fetchOpenAPI()).json();
    const pathKeys = Object.keys(data.paths);
    expect(pathKeys.length).toBeGreaterThan(0);
    // Each path entry should have at least one HTTP method
    for (const p of pathKeys) {
      const methods = Object.keys(data.paths[p]);
      expect(methods.length).toBeGreaterThan(0);
    }
  });

  test('OpenAPI has security scheme defined for X-Session-Id', async () => {
    const data = await (await fetchOpenAPI()).json();
    expect(data.components).toHaveProperty('securitySchemes');
    const scheme = data.components.securitySchemes.SessionAuth;
    expect(scheme).toBeDefined();
    expect(scheme.type).toBe('apiKey');
    expect(scheme.in).toBe('header');
    expect(scheme.name).toBe('X-Session-Id');
  });

  test('each path operation has summary, tags, and responses', async () => {
    const data = await (await fetchOpenAPI()).json();
    for (const [, methods] of Object.entries(data.paths)) {
      for (const [, op] of Object.entries(methods)) {
        expect(typeof op.summary).toBe('string');
        expect(Array.isArray(op.tags)).toBe(true);
        expect(op.tags.length).toBeGreaterThan(0);
        expect(op.responses).toHaveProperty('200');
        expect(op.responses).toHaveProperty('401');
      }
    }
  });
});

describe('Swagger UI (/api/docs/swagger)', () => {
  test('GET /swagger returns 200 with swagger-ui HTML', async () => {
    const res = await fetch(`${baseUrl}/api/docs/swagger`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('swagger-ui');
    expect(html).toContain('SwaggerUIBundle');
    expect(html).toContain('Hyperion API Docs');
  });
});
