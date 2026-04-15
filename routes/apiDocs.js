const { Router } = require('express');
const router = Router();

// Discover all registered routes from the Express app
function discoverRoutes(app) {
  const routes = [];

  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods).map(m => m.toUpperCase());
      routes.push({ path: middleware.route.path, methods });
    } else if (middleware.name === 'router' && middleware.handle.stack) {
      const prefix = middleware.regexp.source
        .replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace(/\^/g, '')
        .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param');

      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).map(m => m.toUpperCase());
          routes.push({ path: prefix + handler.route.path, methods });
        }
      });
    }
  });

  routes.sort((a, b) => a.path.localeCompare(b.path));
  return routes;
}

// Auto-generated API documentation from registered routes
router.get('/', (req, res) => {
  const routes = discoverRoutes(req.app);

  const groups = {};
  for (const r of routes) {
    const parts = r.path.split('/').filter(Boolean);
    const group = parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : r.path;
    if (!groups[group]) groups[group] = [];
    groups[group].push(r);
  }

  res.json({
    name: 'Hyperion API',
    version: '1.0.0',
    totalRoutes: routes.length,
    groups,
  });
});

// OpenAPI 3.0 spec auto-generated from Express routes
router.get('/openapi.json', (req, res) => {
  const routes = discoverRoutes(req.app);
  const paths = {};

  for (const route of routes) {
    const oaPath = route.path.replace(/:(\w+)/g, '{$1}');
    if (!paths[oaPath]) paths[oaPath] = {};

    const segments = route.path.split('/').filter(Boolean);
    const tag = segments[1] || segments[0] || 'default';
    const summary = segments.slice(1).map(s =>
      s.startsWith(':') ? s : s.charAt(0).toUpperCase() + s.slice(1)
    ).join(' ') || route.path;

    for (const method of route.methods) {
      paths[oaPath][method.toLowerCase()] = {
        summary,
        tags: [tag],
        security: [{ SessionAuth: [] }],
        responses: {
          200: { description: 'Success' },
          401: { description: 'Unauthorized' },
        },
      };
    }
  }

  res.json({
    openapi: '3.0.0',
    info: {
      title: 'Hyperion API',
      version: '1.0.0',
      description: 'Self-hosted universal computing platform API',
    },
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        SessionAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Session-Id',
        },
      },
    },
    paths,
  });
});

// Swagger UI HTML page
router.get('/swagger', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html>
<head>
  <title>Hyperion API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({ url: '/api/docs/openapi.json', dom_id: '#swagger-ui' });</script>
</body>
</html>`);
});

module.exports = router;
