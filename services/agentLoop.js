/**
 * Agent Loop — Agentic tool-calling loop for autonomous AI operations
 * Streams text + tool calls via async generator. Max 10 iterations.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const llm = require('./llmService');

const HOME = os.homedir();
const MAX_ITERATIONS = 10;
const TOOL_TIMEOUT = 30000;
const CMD_TIMEOUT = 120000;

// ── Approval Rules ──
// 'always' = always needs approval, 'never' = auto-execute, function = conditional
const APPROVAL_RULES = {
  run_command: 'always',
  read_file: 'never',
  write_file: 'always',
  list_directory: 'never',
  search_files: 'never',
  docker_action: (args) => ['stop', 'restart', 'pull', 'rm', 'remove'].includes(args?.action),
  git_action: (args) => ['commit', 'push', 'pull', 'reset', 'checkout'].includes(args?.action),
  http_request: 'never',
  system_info: 'never',
  process_action: (args) => args?.action === 'kill',
};

// ── Tool Definitions ──
const TOOLS = [
  {
    name: 'run_command',
    description: 'Execute a shell command and return stdout/stderr. Use for any system operation.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute' },
        cwd: { type: 'string', description: 'Working directory (default: home)' },
        timeout: { type: 'number', description: 'Timeout in ms (default: 120000)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file. Returns text content or error.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative file path' },
        encoding: { type: 'string', description: 'Encoding (default: utf8)' },
        maxLines: { type: 'number', description: 'Max lines to read (default: 500)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Creates parent directories if needed.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' },
        append: { type: 'boolean', description: 'Append instead of overwrite (default: false)' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and directories at a given path with metadata.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (default: home)' },
        showHidden: { type: 'boolean', description: 'Show hidden files (default: false)' },
      },
    },
  },
  {
    name: 'search_files',
    description: 'Search for files by name pattern or search within file contents.',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory to search in (default: home)' },
        pattern: { type: 'string', description: 'File name glob pattern (e.g. *.js)' },
        content: { type: 'string', description: 'Search within file contents (grep)' },
        maxResults: { type: 'number', description: 'Max results (default: 20)' },
      },
    },
  },
  {
    name: 'docker_action',
    description: 'Manage Docker containers and images. Actions: ps, images, logs, inspect, stop, restart, pull, rm, stats.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['ps', 'images', 'logs', 'inspect', 'stop', 'restart', 'pull', 'rm', 'stats'], description: 'Docker action' },
        target: { type: 'string', description: 'Container/image name or ID' },
        tail: { type: 'number', description: 'Number of log lines (default: 50)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'git_action',
    description: 'Perform Git operations. Actions: status, log, diff, branch, commit, push, pull, checkout.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'log', 'diff', 'branch', 'commit', 'push', 'pull', 'checkout'], description: 'Git action' },
        cwd: { type: 'string', description: 'Repository directory' },
        message: { type: 'string', description: 'Commit message (for commit)' },
        branch: { type: 'string', description: 'Branch name (for checkout/branch)' },
        args: { type: 'string', description: 'Additional arguments' },
      },
      required: ['action'],
    },
  },
  {
    name: 'http_request',
    description: 'Send an HTTP request and return the response.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Request URL' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'], description: 'HTTP method (default: GET)' },
        headers: { type: 'object', description: 'Request headers' },
        body: { type: 'string', description: 'Request body (for POST/PUT/PATCH)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'system_info',
    description: 'Get system information: cpu, memory, disk, network, ports, uptime.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['all', 'cpu', 'memory', 'disk', 'network', 'ports', 'uptime'], description: 'Info category (default: all)' },
      },
    },
  },
  {
    name: 'process_action',
    description: 'List, search, or kill system processes.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'search', 'kill'], description: 'Action to perform' },
        query: { type: 'string', description: 'Search query or PID (for search/kill)' },
        signal: { type: 'string', description: 'Kill signal (default: SIGTERM)' },
      },
      required: ['action'],
    },
  },
];

// ── Path Security ──
function resolveSafePath(p) {
  const resolved = path.resolve(p.startsWith('~') ? p.replace('~', HOME) : p);
  // Allow access to home dir and common system paths for reading
  return resolved;
}

function isPathSafe(p) {
  const resolved = resolveSafePath(p);
  // Block write access outside home
  if (resolved.startsWith(HOME)) return true;
  if (resolved.startsWith('/tmp')) return true;
  return false;
}

// ── Dangerous Command Check ──
const BLOCKED_PATTERNS = [
  /rm\s+(-rf?|--force)\s+\//i,
  /rm\s+-rf\s+~\s*$/i,
  /mkfs/i,
  /dd\s+if=/i,
  /:\(\)\{\s*:\|:&\s*\};:/,
  />\s*\/dev\/sd/i,
  /chmod\s+-R\s+777\s+\//i,
  /shutdown|reboot|halt|poweroff/i,
  /rm\s+-rf\s+\*/,
];

function isCmdBlocked(cmd) {
  return BLOCKED_PATTERNS.some(p => p.test(cmd));
}

// ── Tool Executors ──
const executors = {
  async run_command({ command, cwd, timeout }) {
    if (isCmdBlocked(command)) return { error: `Blocked: dangerous command pattern detected`, blocked: true };
    const execCwd = cwd ? resolveSafePath(cwd) : HOME;
    try {
      const output = execSync(command, {
        cwd: execCwd,
        encoding: 'utf8',
        timeout: timeout || CMD_TIMEOUT,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, HOME },
      });
      return { stdout: output.slice(0, 10000), exitCode: 0 };
    } catch (err) {
      return { stdout: (err.stdout || '').slice(0, 5000), stderr: (err.stderr || '').slice(0, 5000), exitCode: err.status || 1 };
    }
  },

  async read_file({ path: filePath, encoding, maxLines }) {
    const resolved = resolveSafePath(filePath);
    try {
      let content = fs.readFileSync(resolved, encoding || 'utf8');
      if (maxLines) {
        const lines = content.split('\n');
        if (lines.length > maxLines) {
          content = lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
        }
      }
      return { content: content.slice(0, 50000), size: fs.statSync(resolved).size, path: resolved };
    } catch (err) {
      return { error: err.message };
    }
  },

  async write_file({ path: filePath, content, append }) {
    const resolved = resolveSafePath(filePath);
    if (!isPathSafe(resolved)) return { error: 'Write blocked: path outside home directory' };
    try {
      const dir = path.dirname(resolved);
      fs.mkdirSync(dir, { recursive: true });
      if (append) {
        fs.appendFileSync(resolved, content, 'utf8');
      } else {
        fs.writeFileSync(resolved, content, 'utf8');
      }
      return { ok: true, path: resolved, size: fs.statSync(resolved).size };
    } catch (err) {
      return { error: err.message };
    }
  },

  async list_directory({ path: dirPath, showHidden }) {
    const resolved = resolveSafePath(dirPath || HOME);
    try {
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const items = entries
        .filter(e => showHidden || !e.name.startsWith('.'))
        .slice(0, 100)
        .map(e => {
          let size = 0, mtime = null;
          try {
            const stat = fs.statSync(path.join(resolved, e.name));
            size = stat.size;
            mtime = stat.mtime.toISOString();
          } catch {}
          return { name: e.name, type: e.isDirectory() ? 'directory' : 'file', size, mtime };
        });
      return { path: resolved, count: items.length, items };
    } catch (err) {
      return { error: err.message };
    }
  },

  async search_files({ directory, pattern, content, maxResults }) {
    const dir = resolveSafePath(directory || HOME);
    const max = maxResults || 20;
    try {
      let cmd;
      if (content) {
        cmd = `grep -rl --include="${pattern || '*'}" "${content.replace(/"/g, '\\"')}" "${dir}" 2>/dev/null | head -${max}`;
      } else if (pattern) {
        cmd = `find "${dir}" -maxdepth 5 -name "${pattern}" 2>/dev/null | head -${max}`;
      } else {
        return { error: 'Either pattern or content is required' };
      }
      const output = execSync(cmd, { encoding: 'utf8', timeout: TOOL_TIMEOUT, maxBuffer: 512 * 1024 });
      const files = output.trim().split('\n').filter(Boolean);
      return { count: files.length, files };
    } catch (err) {
      return { count: 0, files: [], note: err.stderr?.slice(0, 200) || 'No matches' };
    }
  },

  async docker_action({ action, target, tail }) {
    const cmds = {
      ps: 'docker ps --format "table {{.ID}}\\t{{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"',
      images: 'docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}\\t{{.CreatedSince}}"',
      logs: `docker logs --tail ${tail || 50} ${target || ''}`,
      inspect: `docker inspect ${target || ''}`,
      stop: `docker stop ${target || ''}`,
      restart: `docker restart ${target || ''}`,
      pull: `docker pull ${target || ''}`,
      rm: `docker rm ${target || ''}`,
      stats: 'docker stats --no-stream --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.NetIO}}"',
    };
    const cmd = cmds[action];
    if (!cmd) return { error: `Unknown action: ${action}` };
    if (['stop', 'restart', 'pull', 'rm', 'logs', 'inspect'].includes(action) && !target) {
      return { error: `Target container/image required for ${action}` };
    }
    try {
      const output = execSync(cmd, { encoding: 'utf8', timeout: TOOL_TIMEOUT, maxBuffer: 1024 * 1024 });
      return { output: output.slice(0, 10000) };
    } catch (err) {
      return { error: (err.stderr || err.message).slice(0, 2000) };
    }
  },

  async git_action({ action, cwd, message, branch, args }) {
    const dir = cwd ? resolveSafePath(cwd) : process.cwd();
    const cmds = {
      status: 'git status --porcelain',
      log: `git log --oneline -20 ${args || ''}`,
      diff: `git diff ${args || ''}`,
      branch: `git branch ${args || '-a'}`,
      commit: `git commit -m "${(message || 'auto commit').replace(/"/g, '\\"')}"`,
      push: `git push ${args || ''}`,
      pull: `git pull ${args || ''}`,
      checkout: `git checkout ${branch || args || ''}`,
    };
    const cmd = cmds[action];
    if (!cmd) return { error: `Unknown git action: ${action}` };
    try {
      const output = execSync(cmd, { cwd: dir, encoding: 'utf8', timeout: TOOL_TIMEOUT });
      return { output: output.slice(0, 10000) };
    } catch (err) {
      return { stdout: (err.stdout || '').slice(0, 3000), stderr: (err.stderr || '').slice(0, 3000), exitCode: err.status };
    }
  },

  async http_request({ url, method, headers, body }) {
    try {
      const opts = { method: method || 'GET', headers: headers || {}, signal: AbortSignal.timeout(TOOL_TIMEOUT) };
      if (body && ['POST', 'PUT', 'PATCH'].includes(opts.method)) {
        opts.body = body;
        if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
      }
      const res = await fetch(url, opts);
      const text = await res.text();
      return { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers), body: text.slice(0, 10000) };
    } catch (err) {
      return { error: err.message };
    }
  },

  async system_info({ category }) {
    const cat = category || 'all';
    const info = {};

    if (cat === 'all' || cat === 'cpu') {
      const cpus = os.cpus();
      info.cpu = { model: cpus[0]?.model, cores: cpus.length, arch: os.arch(), loadavg: os.loadavg() };
    }
    if (cat === 'all' || cat === 'memory') {
      const total = os.totalmem(), free = os.freemem();
      info.memory = { total, free, used: total - free, percent: Math.round(((total - free) / total) * 100) };
    }
    if (cat === 'all' || cat === 'disk') {
      try {
        const output = execSync("df -h / | tail -1", { encoding: 'utf8', timeout: 5000 });
        const parts = output.trim().split(/\s+/);
        info.disk = { filesystem: parts[0], size: parts[1], used: parts[2], available: parts[3], percent: parts[4] };
      } catch { info.disk = { error: 'unavailable' }; }
    }
    if (cat === 'all' || cat === 'network') {
      const ifaces = os.networkInterfaces();
      info.network = Object.entries(ifaces).flatMap(([name, addrs]) =>
        addrs.filter(a => !a.internal).map(a => ({ name, address: a.address, family: a.family }))
      );
    }
    if (cat === 'all' || cat === 'ports') {
      try {
        const output = execSync("lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null | tail -20", { encoding: 'utf8', timeout: 5000 });
        info.ports = output.trim();
      } catch { info.ports = 'unavailable'; }
    }
    if (cat === 'all' || cat === 'uptime') {
      info.uptime = { system: os.uptime(), hostname: os.hostname(), platform: os.platform(), release: os.release() };
    }
    return info;
  },

  async process_action({ action, query, signal }) {
    if (action === 'list') {
      try {
        const output = execSync('ps aux --sort=-%mem | head -25', { encoding: 'utf8', timeout: 5000 });
        return { output };
      } catch {
        // macOS fallback
        try {
          const output = execSync('ps aux | head -25', { encoding: 'utf8', timeout: 5000 });
          return { output };
        } catch (err) { return { error: err.message }; }
      }
    }
    if (action === 'search') {
      if (!query) return { error: 'Query required' };
      try {
        const output = execSync(`ps aux | grep -i "${query.replace(/"/g, '\\"')}" | grep -v grep`, { encoding: 'utf8', timeout: 5000 });
        return { output: output.slice(0, 5000) };
      } catch { return { output: 'No matching processes' }; }
    }
    if (action === 'kill') {
      if (!query) return { error: 'PID required' };
      const pid = parseInt(query);
      if (isNaN(pid) || pid <= 1) return { error: 'Invalid PID' };
      try {
        process.kill(pid, signal || 'SIGTERM');
        return { ok: true, pid, signal: signal || 'SIGTERM' };
      } catch (err) { return { error: err.message }; }
    }
    return { error: `Unknown action: ${action}` };
  },
};

// ── Check if tool needs approval ──
function needsApproval(toolName, args) {
  const rule = APPROVAL_RULES[toolName];
  if (rule === 'always') return true;
  if (rule === 'never') return false;
  if (typeof rule === 'function') return rule(args);
  return true; // Default: require approval for unknown tools
}

// ── System Prompt ──
function buildSystemPrompt() {
  const injected = llm.getInjectedSystemPrompt();
  return `${injected}

You are Hyperion AI, an autonomous computing agent. You have access to system tools to help the user manage their computer.

RULES:
- Use tools when appropriate — don't just describe what you'd do, actually do it
- Be precise and efficient with tool usage
- When a tool returns an error, explain it clearly and suggest alternatives
- For destructive operations, explain what will happen before the tool executes
- Format your text responses with markdown when helpful
- You can chain multiple tool calls in sequence to accomplish complex tasks
- Always show relevant output from tool calls in your response

ENVIRONMENT:
- Platform: ${os.platform()} (${os.arch()})
- Shell: ${os.platform() === 'darwin' ? 'zsh' : 'bash'}
- Home: ${HOME}
- Hostname: ${os.hostname()}`;
}

// ── Pending Approvals Store ──
const pendingApprovals = new Map(); // sessionId -> { toolCallId, toolName, args, resolve }

function getPendingApproval(sessionId) {
  return pendingApprovals.get(sessionId);
}

function setPendingApproval(sessionId, data) {
  pendingApprovals.set(sessionId, data);
}

function clearPendingApproval(sessionId) {
  pendingApprovals.delete(sessionId);
}

// ── Main Agent Loop (async generator) ──
async function* runAgentLoop(userMessage, conversationHistory = [], sessionId = null) {
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let iteration = 0;
  let provider = null;

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    let fullText = '';
    let toolCalls = [];

    // Stream from LLM
    const stream = llm.callWithStreaming(messages, { tools: TOOLS, max_tokens: 4096 });

    for await (const event of stream) {
      if (event.type === 'provider') {
        provider = event.data.provider;
        yield { type: 'provider', data: event.data };
      } else if (event.type === 'text_delta') {
        fullText += event.data;
        yield { type: 'text', data: event.data };
      } else if (event.type === 'tool_call') {
        toolCalls.push(event.data);
      } else if (event.type === 'error') {
        yield { type: 'error', data: event.data };
        return;
      } else if (event.type === 'done') {
        if (event.data?.toolCalls?.length) toolCalls = event.data.toolCalls;
      }
    }

    // No tool calls = conversation done
    if (toolCalls.length === 0) {
      // Add assistant response to messages
      if (fullText) messages.push({ role: 'assistant', content: fullText });
      yield { type: 'done', data: { iterations: iteration, provider } };
      return;
    }

    // Build assistant message with tool calls (for Anthropic format)
    const assistantContent = [];
    if (fullText) assistantContent.push({ type: 'text', text: fullText });
    for (const tc of toolCalls) {
      assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
    }
    messages.push({ role: 'assistant', content: assistantContent });

    // Execute tool calls
    const toolResults = [];
    for (const tc of toolCalls) {
      yield { type: 'tool_start', data: { id: tc.id, name: tc.name, arguments: tc.arguments } };

      // Check approval
      if (needsApproval(tc.name, tc.arguments)) {
        yield { type: 'approval_needed', data: { id: tc.id, name: tc.name, arguments: tc.arguments } };

        // Wait for approval via promise
        const approved = await new Promise((resolve) => {
          setPendingApproval(sessionId, { toolCallId: tc.id, toolName: tc.name, args: tc.arguments, resolve });
          // Auto-timeout after 5 minutes
          setTimeout(() => { clearPendingApproval(sessionId); resolve(false); }, 300000);
        });
        clearPendingApproval(sessionId);

        if (!approved) {
          const result = { denied: true, message: 'User denied tool execution' };
          toolResults.push(llm.formatToolResult(provider, tc.id, tc.name, JSON.stringify(result)));
          yield { type: 'tool_result', data: { id: tc.id, name: tc.name, result, denied: true } };
          continue;
        }
      }

      // Execute
      const executor = executors[tc.name];
      if (!executor) {
        const result = { error: `Unknown tool: ${tc.name}` };
        toolResults.push(llm.formatToolResult(provider, tc.id, tc.name, JSON.stringify(result)));
        yield { type: 'tool_result', data: { id: tc.id, name: tc.name, result } };
        continue;
      }

      try {
        const result = await Promise.race([
          executor(tc.arguments || {}),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Tool execution timed out')), TOOL_TIMEOUT)),
        ]);
        toolResults.push(llm.formatToolResult(provider, tc.id, tc.name, JSON.stringify(result)));
        yield { type: 'tool_result', data: { id: tc.id, name: tc.name, result } };
      } catch (err) {
        const result = { error: err.message };
        toolResults.push(llm.formatToolResult(provider, tc.id, tc.name, JSON.stringify(result)));
        yield { type: 'tool_result', data: { id: tc.id, name: tc.name, result } };
      }
    }

    // Feed tool results back to LLM
    messages.push(...toolResults);
  }

  yield { type: 'error', data: 'Max iterations reached (10)' };
  yield { type: 'done', data: { iterations: MAX_ITERATIONS, provider, maxReached: true } };
}

module.exports = {
  runAgentLoop,
  TOOLS,
  needsApproval,
  executors,
  getPendingApproval,
  setPendingApproval,
  clearPendingApproval,
  isCmdBlocked,
  resolveSafePath,
  isPathSafe,
};
