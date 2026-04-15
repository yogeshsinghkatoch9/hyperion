/**
 * MCP Server — Model Context Protocol JSON-RPC server
 * Exposes Hyperion tools (terminal, files, agents, code, search) as MCP tools.
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
];

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
    default:
      return { error: `Unknown tool: ${name}` };
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
          capabilities: { tools: {} },
          serverInfo: { name: 'hyperion', version: '1.0.0' },
        },
      };

    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };

    case 'tools/call': {
      const { name, arguments: args } = params || {};
      try {
        const result = await handleToolCall(name, args || {});
        return {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
        };
      } catch (err) {
        return {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true },
        };
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
