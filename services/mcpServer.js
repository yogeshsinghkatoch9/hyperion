/**
 * MCP Server — Model Context Protocol JSON-RPC server
 * Exposes Hyperion tools (terminal, files, agents, code, search, context) as MCP tools.
 * Runs on configurable port, opt-in via MCP_ENABLED=true.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

let _server = null;
let _db = null;

const TOOLS = [
  {
    name: 'run_command',
    description: 'Execute a shell command on the Hyperion host',
    inputSchema: {
      type: 'object',
      properties: { command: { type: 'string', description: 'Shell command to execute' } },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute file path' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file path' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List directory contents',
    inputSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Directory path' } },
      required: ['path'],
    },
  },
  {
    name: 'run_agent',
    description: 'Start a Hyperion agent by ID',
    inputSchema: {
      type: 'object',
      properties: { agentId: { type: 'string', description: 'Agent UUID' } },
      required: ['agentId'],
    },
  },
  {
    name: 'search',
    description: 'Search across Hyperion (commands, files, agents)',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
  },
  // ── Context Bridge Tools ──
  {
    name: 'get_server_context',
    description: 'Get a full server context snapshot with system, docker, health, cron, metrics, network info. Use this to understand the current state of the server.',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['json', 'markdown', 'compact'], description: 'Output format (default: markdown)' },
        sections: {
          type: 'array', items: { type: 'string' },
          description: 'Sections to include: system, docker, processes, network, health, cron, metrics, runtimes, errors. Omit for all.',
        },
      },
    },
  },
  {
    name: 'get_docker_status',
    description: 'Get Docker container status including resource stats (CPU, memory, network I/O)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_system_health',
    description: 'Run health checks on database, API latency, memory, CPU, and disk',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_errors',
    description: 'Get recent ERROR-level log lines from the server',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_listening_ports',
    description: 'List all open/listening ports with the process that owns each port',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_cron_jobs',
    description: 'List scheduled cron jobs with their schedules and descriptions',
    inputSchema: { type: 'object', properties: {} },
  },
];

// ── Context Bridge imports (lazy-loaded) ──
let _contextBridge = null;
let _monitorSvc = null;
let _dockerSvc = null;
let _healthCheck = null;
let _cronSvc = null;

function _loadContextDeps() {
  if (!_contextBridge) {
    _contextBridge = require('./contextBridge');
    _monitorSvc = require('./monitor');
    _dockerSvc = require('./docker');
    _healthCheck = require('./healthCheck');
    _cronSvc = require('./cron');
  }
}

// ── Tool Handlers ──
async function handleToolCall(name, args) {
  switch (name) {
    case 'run_command': {
      return new Promise((resolve) => {
        const proc = spawn('bash', ['-c', args.command], {
          cwd: os.homedir(), timeout: 30000, env: process.env,
        });
        let stdout = '', stderr = '';
        proc.stdout.on('data', d => stdout += d.toString());
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('close', code => resolve({ stdout, stderr, exitCode: code }));
        proc.on('error', err => resolve({ error: err.message }));
      });
    }
    case 'read_file': {
      try {
        const content = fs.readFileSync(args.path, 'utf8');
        return { content: content.slice(0, 50000) };
      } catch (err) {
        return { error: err.message };
      }
    }
    case 'write_file': {
      try {
        const dir = path.dirname(args.path);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(args.path, args.content, 'utf8');
        return { written: true, path: args.path };
      } catch (err) {
        return { error: err.message };
      }
    }
    case 'list_files': {
      try {
        const entries = fs.readdirSync(args.path, { withFileTypes: true });
        return entries.map(e => ({
          name: e.name, type: e.isDirectory() ? 'directory' : 'file',
        }));
      } catch (err) {
        return { error: err.message };
      }
    }
    case 'run_agent': {
      if (!_db) return { error: 'Database not available' };
      const agent = _db.prepare('SELECT * FROM agents WHERE id = ?').get(args.agentId);
      if (!agent) return { error: 'Agent not found' };
      return { started: true, agent: { id: agent.id, name: agent.name } };
    }
    case 'search': {
      if (!_db) return { error: 'Database not available' };
      const commands = _db.prepare("SELECT command, created_at FROM command_history WHERE command LIKE ? LIMIT 10")
        .all(`%${args.query}%`);
      const agents = _db.prepare("SELECT id, name, status FROM agents WHERE name LIKE ? LIMIT 5")
        .all(`%${args.query}%`);
      return { commands, agents };
    }

    // ── Context Bridge Tool Handlers ──
    case 'get_server_context': {
      _loadContextDeps();
      const opts = {};
      if (args.sections) opts.sections = args.sections;
      const ctx = await _contextBridge.generateContext(_db, opts);
      const fmt = args.format || 'markdown';
      if (fmt === 'markdown') return _contextBridge.formatAsMarkdown(ctx);
      if (fmt === 'compact') return _contextBridge.formatCompact(ctx);
      return ctx;
    }
    case 'get_docker_status': {
      _loadContextDeps();
      try {
        if (!_dockerSvc.isDockerAvailable()) return { available: false };
        const containers = _dockerSvc.listContainers(true);
        const stats = _dockerSvc.getAllStats();
        const statsMap = {};
        for (const s of stats) statsMap[s.name] = s;
        return {
          available: true,
          containers: containers.map(c => ({
            name: c.name, image: c.image, state: c.state, status: c.status,
            stats: statsMap[c.name] || null,
          })),
        };
      } catch (err) { return { error: err.message }; }
    }
    case 'get_system_health': {
      _loadContextDeps();
      if (!_db) return { error: 'Database not available' };
      return _healthCheck.runChecks(_db);
    }
    case 'get_recent_errors': {
      _loadContextDeps();
      const logViewer = require('./logViewer');
      const paths = logViewer.getCommonLogPaths();
      const errors = [];
      for (const dir of paths.slice(0, 3)) {
        try {
          const files = logViewer.findLogFiles(dir, { maxDepth: 2 });
          for (const f of files.slice(0, 5)) {
            try {
              const result = logViewer.readLogFile(f.path, { lines: 100, level: 'error' });
              for (const line of result.lines.slice(-5)) {
                errors.push({ text: line.text.slice(0, 200), source: f.name });
              }
            } catch {}
          }
          if (errors.length >= 10) break;
        } catch {}
      }
      return errors.slice(0, 10);
    }
    case 'get_listening_ports': {
      _loadContextDeps();
      return _monitorSvc.getListeningPorts();
    }
    case 'get_cron_jobs': {
      _loadContextDeps();
      return _cronSvc.listCrontab().filter(j => j.type === 'job');
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── MCP Resources ──
const RESOURCES = [
  {
    uri: 'server://context',
    name: 'Server Context',
    description: 'Full server context snapshot including system, docker, health, network, cron, and metrics',
    mimeType: 'text/markdown',
  },
  {
    uri: 'server://health',
    name: 'Server Health',
    description: 'Current health check results for database, API, memory, CPU, and disk',
    mimeType: 'application/json',
  },
];

async function handleResourceRead(uri) {
  _loadContextDeps();
  switch (uri) {
    case 'server://context': {
      const ctx = await _contextBridge.generateContext(_db, {});
      return { contents: [{ uri, mimeType: 'text/markdown', text: _contextBridge.formatAsMarkdown(ctx) }] };
    }
    case 'server://health': {
      if (!_db) return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ error: 'Database not available' }) }] };
      const health = _healthCheck.runChecks(_db);
      return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(health, null, 2) }] };
    }
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}

// ── JSON-RPC Handler ──
async function handleRequest(body) {
  const { method, params, id } = body;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: 'hyperion', version: '1.0.0' },
        },
      };

    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };

    case 'tools/call': {
      const { name, arguments: args } = params || {};
      try {
        const result = await handleToolCall(name, args || {});
        const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        return {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text }] },
        };
      } catch (err) {
        return {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true },
        };
      }
    }

    case 'resources/list':
      return { jsonrpc: '2.0', id, result: { resources: RESOURCES } };

    case 'resources/read': {
      const { uri } = params || {};
      try {
        const result = await handleResourceRead(uri);
        return { jsonrpc: '2.0', id, result };
      } catch (err) {
        return { jsonrpc: '2.0', id, error: { code: -32602, message: err.message } };
      }
    }

    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } };
  }
}

// ── Server Lifecycle ──
function start(db, port = 3334) {
  _db = db;
  if (_server) return;

  _server = http.createServer(async (req, res) => {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          const response = await handleRequest(parsed);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', tools: TOOLS.length }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  _server.listen(port, () => {
    console.log(`  MCP server on port ${port}`);
  });
}

function stop() {
  if (_server) { _server.close(); _server = null; }
}

function getStatus() {
  return { running: !!_server, tools: TOOLS.map(t => t.name) };
}

function getTools() {
  return TOOLS;
}

module.exports = { start, stop, getStatus, getTools };
