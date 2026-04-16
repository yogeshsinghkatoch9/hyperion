/**
 * LLM Service — Multi-provider AI with failover chain + circuit breaker
 * Providers: Ollama (local), OpenAI (cloud), Gemini (cloud), Anthropic (cloud)
 * Config: LLM_PROVIDERS=ollama,openai,gemini,anthropic (comma-separated priority)
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

// ── Provider Definitions ──
const PROVIDER_CONFIGS = {
  ollama: {
    url: (model) => `${process.env.LLM_BASE_URL || 'http://localhost:11434'}/api/generate`,
    chatUrl: () => `${process.env.LLM_BASE_URL || 'http://localhost:11434'}/api/chat`,
    embedUrl: () => `${process.env.LLM_BASE_URL || 'http://localhost:11434'}/api/embeddings`,
    defaultModel: 'llama3',
    needsKey: false,
    buildChat: (messages, model, opts) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || 'llama3', messages, stream: false, ...opts }),
    }),
    buildGenerate: (prompt, model) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || 'llama3', prompt, stream: false }),
    }),
    buildEmbed: (text, model) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model || 'nomic-embed-text', prompt: text }),
    }),
    parseChat: (json) => json.message?.content || '',
    parseGenerate: (json) => json.response || '',
    parseEmbed: (json) => json.embedding || null,
  },
  openai: {
    url: () => 'https://api.openai.com/v1/chat/completions',
    embedUrl: () => 'https://api.openai.com/v1/embeddings',
    defaultModel: 'gpt-4o-mini',
    needsKey: true,
    keyEnv: 'OPENAI_API_KEY',
    buildChat: (messages, model, opts) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY || process.env.LLM_API_KEY}` },
      body: JSON.stringify({ model: model || 'gpt-4o-mini', messages, max_tokens: opts?.max_tokens || 500, temperature: opts?.temperature ?? 0.1 }),
    }),
    buildEmbed: (text) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY || process.env.LLM_API_KEY}` },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    }),
    parseChat: (json) => json.choices?.[0]?.message?.content || '',
    parseEmbed: (json) => json.data?.[0]?.embedding || null,
  },
  gemini: {
    url: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${process.env.GEMINI_API_KEY || process.env.LLM_API_KEY}`,
    embedUrl: (model) => `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY || process.env.LLM_API_KEY}`,
    defaultModel: 'gemini-2.0-flash',
    needsKey: true,
    keyEnv: 'GEMINI_API_KEY',
    buildChat: (messages, model, opts) => {
      const systemMsg = messages.find(m => m.role === 'system');
      const contents = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const body = { contents, generationConfig: { maxOutputTokens: opts?.max_tokens || 500, temperature: opts?.temperature ?? 0.1 } };
      if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
      return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    },
    buildEmbed: (text) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text }] } }),
    }),
    parseChat: (json) => json.candidates?.[0]?.content?.parts?.[0]?.text || '',
    parseEmbed: (json) => json.embedding?.values || null,
  },
  anthropic: {
    url: () => 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-20250514',
    needsKey: true,
    keyEnv: 'ANTHROPIC_API_KEY',
    buildChat: (messages, model, opts) => {
      const systemMsg = messages.find(m => m.role === 'system');
      const filtered = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.tool_results ? m.content : (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)),
      }));
      const body = {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: opts?.max_tokens || 4096,
        messages: filtered,
      };
      if (systemMsg) body.system = systemMsg.content;
      if (opts?.tools) body.tools = opts.tools;
      if (opts?.stream) body.stream = true;
      if (opts?.temperature !== undefined) body.temperature = opts.temperature;
      return {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      };
    },
    parseChat: (json) => {
      if (!json.content) return '';
      const textBlock = json.content.find(b => b.type === 'text');
      return textBlock?.text || '';
    },
    parseToolCalls: (json) => {
      if (!json.content) return [];
      return json.content.filter(b => b.type === 'tool_use').map(b => ({
        id: b.id,
        name: b.name,
        arguments: b.input,
      }));
    },
  },
  xai: {
    url: () => 'https://api.x.ai/v1/chat/completions',
    defaultModel: 'grok-3-mini',
    needsKey: true,
    keyEnv: 'XAI_API_KEY',
    buildChat: (messages, model, opts) => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.XAI_API_KEY || process.env.LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'grok-3-mini',
        messages,
        max_tokens: opts?.max_tokens || 4096,
        temperature: opts?.temperature ?? 0.1,
        stream: !!opts?.stream,
        ...(opts?.tools ? { tools: opts.tools } : {}),
      }),
    }),
    parseChat: (json) => json.choices?.[0]?.message?.content || '',
  },
};

// ── Provider Health Tracking ──
const providerHealth = new Map();

function getHealth(name) {
  if (!providerHealth.has(name)) {
    providerHealth.set(name, { failures: 0, circuitOpen: false, lastFailure: 0, lastSuccess: 0, latency: 0 });
  }
  return providerHealth.get(name);
}

function recordSuccess(name, latency) {
  const h = getHealth(name);
  h.failures = 0;
  h.circuitOpen = false;
  h.lastSuccess = Date.now();
  h.latency = latency;
}

function recordFailure(name) {
  const h = getHealth(name);
  h.failures++;
  h.lastFailure = Date.now();
  if (h.failures >= 3) h.circuitOpen = true;
}

const CIRCUIT_RESET_MS = 60000; // 60s

function isAvailable(name) {
  const h = getHealth(name);
  if (!h.circuitOpen) return true;
  if (Date.now() - h.lastFailure > CIRCUIT_RESET_MS) {
    h.circuitOpen = false; // half-open: allow retry
    return true;
  }
  return false;
}

// ── Provider Order ──
let _providerOrder = null;

function getProviderOrder() {
  if (_providerOrder) return _providerOrder;
  const env = process.env.LLM_PROVIDERS || process.env.LLM_PROVIDER || '';
  return env.split(',').map(s => s.trim().toLowerCase()).filter(s => PROVIDER_CONFIGS[s]);
}

function setProviderOrder(order) {
  _providerOrder = order.filter(s => PROVIDER_CONFIGS[s]);
}

// ── System Prompt ──
function defaultSystemPrompt() {
  return `You are a shell command generator for ${os.platform()} (${os.arch()}). The user's shell is ${os.platform() === 'darwin' ? 'zsh' : 'bash'}. Respond with ONLY a valid shell command. No markdown, no explanations, no backticks, no comments. Just the raw command.`;
}

// ── Prompt Injection (BOOT.md / SOUL.md / AGENTS.md) ──
const HYPERION_DIR = path.join(os.homedir(), '.hyperion');
const promptFiles = { boot: null, soul: null, agents: null };
const promptWatchers = new Map();

function loadPromptFile(name) {
  const filePath = path.join(HYPERION_DIR, `${name.toUpperCase()}.md`);
  try {
    if (fs.existsSync(filePath)) {
      promptFiles[name] = fs.readFileSync(filePath, 'utf8').trim();
    } else {
      promptFiles[name] = null;
    }
  } catch {
    promptFiles[name] = null;
  }
}

function initPromptInjection() {
  try { fs.mkdirSync(HYPERION_DIR, { recursive: true }); } catch {}

  // Create defaults if missing
  const defaults = {
    BOOT: '# System Instructions\nYou are Hyperion, a powerful self-hosted computing assistant. Help users manage their system, run commands, write code, and automate tasks efficiently.',
    SOUL: '# Personality\nYou are precise, knowledgeable, and efficient. You communicate clearly and concisely. You respect the user\'s system and always explain potentially destructive operations before executing them.',
    AGENTS: '# Agent Definitions\nAgents are background tasks that run autonomously. When managing agents, ensure they have proper error handling and logging.',
  };

  for (const [name, defaultContent] of Object.entries(defaults)) {
    const filePath = path.join(HYPERION_DIR, `${name}.md`);
    if (!fs.existsSync(filePath)) {
      try { fs.writeFileSync(filePath, defaultContent, 'utf8'); } catch {}
    }
  }

  // Load all
  for (const name of ['boot', 'soul', 'agents']) {
    loadPromptFile(name);
  }

  // Watch for changes
  for (const name of ['boot', 'soul', 'agents']) {
    const filePath = path.join(HYPERION_DIR, `${name.toUpperCase()}.md`);
    try {
      if (promptWatchers.has(name)) promptWatchers.get(name).close();
      const watcher = fs.watch(filePath, () => {
        loadPromptFile(name);
        console.log(`[LLM] Reloaded ${name.toUpperCase()}.md`);
      });
      watcher.on('error', () => {});
      promptWatchers.set(name, watcher);
    } catch {}
  }
}

function getInjectedSystemPrompt(basePrompt) {
  const parts = [];
  if (promptFiles.boot) parts.push(promptFiles.boot);
  if (promptFiles.soul) parts.push(promptFiles.soul);
  if (promptFiles.agents) parts.push(promptFiles.agents);
  if (basePrompt) parts.push(basePrompt);
  return parts.join('\n\n');
}

function getPromptFiles() {
  return {
    boot: promptFiles.boot || '',
    soul: promptFiles.soul || '',
    agents: promptFiles.agents || '',
  };
}

function savePromptFile(name, content) {
  const filePath = path.join(HYPERION_DIR, `${name.toUpperCase()}.md`);
  fs.writeFileSync(filePath, content, 'utf8');
  promptFiles[name] = content;
}

// ── Dangerous Command Patterns ──
const DANGEROUS = [
  /rm\s+(-rf?|--force)\s+\//i,
  /mkfs/i,
  /dd\s+if=/i,
  /:\(\)\{\s*:\|:&\s*\};:/,
  />\s*\/dev\/sd/i,
  /chmod\s+-R\s+777\s+\//i,
  /rm\s+-rf\s+~\//i,
];

function isDangerous(cmd) {
  return DANGEROUS.some(p => p.test(cmd));
}

function cleanResponse(text) {
  let cmd = text.trim();
  cmd = cmd.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
  cmd = cmd.replace(/^\$\s+/, '').replace(/^>\s+/, '');
  cmd = cmd.split('\n')[0].trim();
  return cmd;
}

// ── Core: Call with Failover ──
async function callWithFailover(messages, opts = {}) {
  const order = getProviderOrder();
  if (!order.length) throw new Error('No LLM providers configured');

  const errors = [];

  for (const name of order) {
    if (!isAvailable(name)) {
      errors.push({ provider: name, error: 'Circuit open' });
      continue;
    }

    const config = PROVIDER_CONFIGS[name];
    const apiKey = process.env[config.keyEnv] || process.env.LLM_API_KEY;
    if (config.needsKey && !apiKey) {
      errors.push({ provider: name, error: 'API key not configured' });
      continue;
    }

    const model = opts.model || process.env[`${name.toUpperCase()}_MODEL`] || process.env.LLM_MODEL || config.defaultModel;

    try {
      const url = typeof config.url === 'function' ? config.url(model) : config.url;
      const fetchOpts = config.buildChat(messages, model, opts);
      const start = Date.now();
      const res = await fetch(url, { ...fetchOpts, signal: AbortSignal.timeout(opts.timeout || 30000) });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }

      const json = await res.json();
      const content = config.parseChat(json);
      const latency = Date.now() - start;

      recordSuccess(name, latency);
      return { content, provider: name, model, latency };
    } catch (err) {
      recordFailure(name);
      errors.push({ provider: name, error: err.message });
      console.error(`[LLM] ${name} failed:`, err.message);
    }
  }

  const err = new Error('All LLM providers failed');
  err.providerErrors = errors;
  throw err;
}

// ── Generate Command (legacy compat) ──
async function generateCommand(input) {
  const order = getProviderOrder();
  if (!order.length) return null;

  try {
    const messages = [
      { role: 'system', content: defaultSystemPrompt() },
      { role: 'user', content: input },
    ];
    const result = await callWithFailover(messages, { max_tokens: 200, temperature: 0.1 });
    const command = cleanResponse(result.content);
    if (!command) return null;

    if (isDangerous(command)) {
      console.warn(`[LLM] Rejected dangerous command: ${command}`);
      return { command: null, rejected: true, reason: 'Command rejected for safety', provider: result.provider };
    }

    return { command, provider: result.provider };
  } catch {
    return null;
  }
}

// ── Embeddings with Failover ──
async function getEmbedding(text) {
  const order = getProviderOrder();

  for (const name of order) {
    if (!isAvailable(name)) continue;
    const config = PROVIDER_CONFIGS[name];
    if (!config.buildEmbed || !config.embedUrl) continue;

    const apiKey = process.env[config.keyEnv] || process.env.LLM_API_KEY;
    if (config.needsKey && !apiKey) continue;

    try {
      const model = process.env.LLM_MODEL || config.defaultModel;
      const url = typeof config.embedUrl === 'function' ? config.embedUrl(model) : config.embedUrl;
      const fetchOpts = config.buildEmbed(text, model);
      const res = await fetch(url, { ...fetchOpts, signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const json = await res.json();
      const embedding = config.parseEmbed(json);
      if (embedding) return embedding;
    } catch {}
  }

  return null; // Caller should use TF-IDF fallback
}

// ── Provider Info ──
function getProvidersInfo() {
  const order = getProviderOrder();
  return Object.keys(PROVIDER_CONFIGS).map(name => {
    const config = PROVIDER_CONFIGS[name];
    const health = getHealth(name);
    const apiKey = process.env[config.keyEnv] || process.env.LLM_API_KEY;
    return {
      name,
      configured: !config.needsKey || !!apiKey,
      priority: order.indexOf(name),
      inChain: order.includes(name),
      model: process.env[`${name.toUpperCase()}_MODEL`] || process.env.LLM_MODEL || config.defaultModel,
      health: {
        failures: health.failures,
        circuitOpen: health.circuitOpen,
        lastSuccess: health.lastSuccess || null,
        lastFailure: health.lastFailure || null,
        latency: health.latency,
      },
    };
  });
}

async function testProvider(name) {
  const config = PROVIDER_CONFIGS[name];
  if (!config) return { ok: false, error: 'Unknown provider' };

  const apiKey = process.env[config.keyEnv] || process.env.LLM_API_KEY;
  if (config.needsKey && !apiKey) return { ok: false, error: 'API key not configured' };

  const model = process.env[`${name.toUpperCase()}_MODEL`] || process.env.LLM_MODEL || config.defaultModel;

  try {
    const url = typeof config.url === 'function' ? config.url(model) : config.url;
    const messages = [{ role: 'user', content: 'Reply with exactly: ok' }];
    const fetchOpts = config.buildChat(messages, model, { max_tokens: 10, temperature: 0 });
    const start = Date.now();
    const res = await fetch(url, { ...fetchOpts, signal: AbortSignal.timeout(10000) });
    const latency = Date.now() - start;

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}`, details: body.slice(0, 200), latency };
    }

    const json = await res.json();
    const content = config.parseChat(json);
    recordSuccess(name, latency);
    return { ok: true, content, latency, model };
  } catch (err) {
    recordFailure(name);
    return { ok: false, error: err.message };
  }
}

function isConfigured() {
  return getProviderOrder().length > 0;
}

// ── Streaming Call (async generator) ──
async function* callWithStreaming(messages, opts = {}) {
  const order = getProviderOrder();
  if (!order.length) { yield { type: 'error', data: 'No LLM providers configured' }; return; }

  for (const name of order) {
    if (!isAvailable(name)) continue;
    const config = PROVIDER_CONFIGS[name];
    const apiKey = process.env[config.keyEnv] || process.env.LLM_API_KEY;
    if (config.needsKey && !apiKey) continue;

    const model = opts.model || process.env[`${name.toUpperCase()}_MODEL`] || process.env.LLM_MODEL || config.defaultModel;
    const streamOpts = { ...opts, stream: true, max_tokens: opts.max_tokens || 4096 };
    if (opts.tools) streamOpts.tools = buildToolsForProvider(name, opts.tools);

    try {
      const url = typeof config.url === 'function' ? config.url(model) : config.url;
      const fetchOpts = config.buildChat(messages, model, streamOpts);
      const start = Date.now();
      const res = await fetch(url, { ...fetchOpts, signal: AbortSignal.timeout(opts.timeout || 120000) });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        recordFailure(name);
        continue;
      }

      yield { type: 'provider', data: { provider: name, model } };
      yield* readSSEStream(res, name);
      recordSuccess(name, Date.now() - start);
      return;
    } catch (err) {
      recordFailure(name);
      console.error(`[LLM] Streaming ${name} failed:`, err.message);
    }
  }
  yield { type: 'error', data: 'All LLM providers failed' };
}

// ── SSE Stream Parser ──
async function* readSSEStream(response, provider) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let toolCalls = [];
  let currentToolCall = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim() || line.startsWith(':')) continue;

        if (provider === 'anthropic') {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          let parsed;
          try { parsed = JSON.parse(data); } catch { continue; }

          if (parsed.type === 'content_block_start') {
            if (parsed.content_block?.type === 'tool_use') {
              currentToolCall = { id: parsed.content_block.id, name: parsed.content_block.name, arguments: '' };
            }
          } else if (parsed.type === 'content_block_delta') {
            if (parsed.delta?.type === 'text_delta') {
              yield { type: 'text_delta', data: parsed.delta.text };
            } else if (parsed.delta?.type === 'input_json_delta') {
              if (currentToolCall) currentToolCall.arguments += parsed.delta.partial_json;
            }
          } else if (parsed.type === 'content_block_stop') {
            if (currentToolCall) {
              try { currentToolCall.arguments = JSON.parse(currentToolCall.arguments); } catch { currentToolCall.arguments = {}; }
              toolCalls.push(currentToolCall);
              yield { type: 'tool_call', data: currentToolCall };
              currentToolCall = null;
            }
          } else if (parsed.type === 'message_stop') {
            // done
          } else if (parsed.type === 'error') {
            yield { type: 'error', data: parsed.error?.message || 'Anthropic stream error' };
          }
        } else if (provider === 'openai' || provider === 'xai') {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          let parsed;
          try { parsed = JSON.parse(data); } catch { continue; }
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.content) yield { type: 'text_delta', data: delta.content };
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                if (currentToolCall) {
                  try { currentToolCall.arguments = JSON.parse(currentToolCall.arguments); } catch { currentToolCall.arguments = {}; }
                  toolCalls.push(currentToolCall);
                  yield { type: 'tool_call', data: currentToolCall };
                }
                currentToolCall = { id: tc.id, name: tc.function?.name || '', arguments: '' };
              }
              if (tc.function?.arguments) {
                if (currentToolCall) currentToolCall.arguments += tc.function.arguments;
              }
            }
          }
          if (parsed.choices?.[0]?.finish_reason === 'tool_calls' && currentToolCall) {
            try { currentToolCall.arguments = JSON.parse(currentToolCall.arguments); } catch { currentToolCall.arguments = {}; }
            toolCalls.push(currentToolCall);
            yield { type: 'tool_call', data: currentToolCall };
            currentToolCall = null;
          }
        } else if (provider === 'gemini') {
          // Gemini streams JSON objects separated by newlines
          let parsed;
          try { parsed = JSON.parse(line.startsWith('data: ') ? line.slice(6) : line); } catch { continue; }
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) yield { type: 'text_delta', data: text };
          const fnCall = parsed.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
          if (fnCall) {
            const tc = { id: `gemini-${Date.now()}`, name: fnCall.functionCall.name, arguments: fnCall.functionCall.args || {} };
            toolCalls.push(tc);
            yield { type: 'tool_call', data: tc };
          }
        } else if (provider === 'ollama') {
          let parsed;
          try { parsed = JSON.parse(line); } catch { continue; }
          if (parsed.message?.content) yield { type: 'text_delta', data: parsed.message.content };
          if (parsed.done) break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: 'done', data: { toolCalls } };
}

// ── Tool Format Adapters ──
function buildToolsForProvider(provider, tools) {
  if (!tools?.length) return undefined;

  if (provider === 'anthropic') {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters || { type: 'object', properties: {} },
    }));
  }
  if (provider === 'openai' || provider === 'xai') {
    return tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters || { type: 'object', properties: {} } },
    }));
  }
  if (provider === 'gemini') {
    return [{ functionDeclarations: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters || { type: 'object', properties: {} },
    })) }];
  }
  return undefined; // ollama doesn't support tools natively
}

function formatToolResult(provider, toolCallId, toolName, result) {
  const content = typeof result === 'string' ? result : JSON.stringify(result);
  if (provider === 'anthropic') {
    return { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolCallId, content }] };
  }
  if (provider === 'openai' || provider === 'xai') {
    return { role: 'tool', tool_call_id: toolCallId, content };
  }
  if (provider === 'gemini') {
    return { role: 'user', parts: [{ functionResponse: { name: toolName, response: { result: content } } }] };
  }
  // Fallback: inject as user message
  return { role: 'user', content: `[Tool Result: ${toolName}]\n${content}` };
}

// Initialize prompt injection on load
initPromptInjection();

module.exports = {
  generateCommand,
  isConfigured,
  callWithFailover,
  callWithStreaming,
  getEmbedding,
  getProvidersInfo,
  testProvider,
  setProviderOrder,
  getProviderOrder,
  getInjectedSystemPrompt,
  getPromptFiles,
  savePromptFile,
  defaultSystemPrompt,
  isDangerous,
  cleanResponse,
  buildToolsForProvider,
  formatToolResult,
  PROVIDER_CONFIGS,
};
