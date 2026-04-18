# Architecture

Technical reference for Hyperion internals. For usage and installation, see the [README](../README.md).

---

## Directory Structure

```
hyperion/
  server.js                # Entry point — Express + WebSocket + SQLite
  │
  ├── routes/              # 67+ REST API route modules
  │     admin, agents, analytics, audit, backup, base64, bookmarks, browser,
  │     canvas, channels, chat, clipboard, code, colorTools, cron, cronBuilder,
  │     dashboard, dataViewer, dbExplorer, depAuditor, devToolkit, diffViewer,
  │     discovery, docker, doctor, envManager, files, git, hash, http,
  │     imageTools, json, jwtDebugger, linkChecker, llm, loadTester, logViewer,
  │     lorem, markdownEditor, mcp, memory, metrics, mockServer, monitor,
  │     netTools, notebooks, notes, notifications, nova, plugins, pomodoro,
  │     processManager, regexTester, remote, search, settings, snippets, ssh,
  │     system, textTransform, uuid, vault, webhooks, workflows, wsClient, yaml
  │
  ├── services/            # 81+ business logic modules
  │     agentLoop, auth, db, auditLog, sessionStore, rbac, themeManager,
  │     configPorter, healthCheck, pluginLoader, skillLoader, mcpServer,
  │     discovery, cronScheduler, vectorMemory, remoteDesktop, monitor,
  │     loadTester, processManager, docker, llmService, ...
  │
  ├── tests/               # 94+ test files, 1,970+ tests (Vitest)
  │
  ├── public/              # SPA frontend (vanilla JS, no build step)
  │     ├── index.html     # Single HTML shell with inline critical CSS
  │     ├── js/hyperion.js # 13,000+ line SPA engine
  │     └── css/hyperion.css
  │
  ├── agents/              # AI agent definitions
  ├── notebooks/           # User notebooks
  ├── scripts/             # Setup and utility scripts
  └── docs/                # Documentation
```

---

## Server

Single-process Node.js application (`server.js`):

- **HTTP**: Express 4 with security headers (CSP, XSS-Protection, CORS)
- **WebSocket**: `ws` library for live terminal streams, system monitoring, notebook collaboration, and AI agent events
- **Database**: SQLite via `better-sqlite3` in WAL mode for concurrent reads/writes
- **Auth**: bcrypt password hashing, 24-hour sessions, rate limiting (5/min/IP), optional TOTP 2FA, API key support, RBAC

Core modules loaded at startup:
- `auth` — Authentication & session management
- `pluginLoader` — Dynamic plugin system with hot reload
- `skillLoader` — Skill management for AI
- `cronScheduler` — Background job scheduling
- `vectorMemory` — Vector memory for AI context
- `discovery` — Service auto-discovery on local network
- `mcpServer` — Model Context Protocol integration
- `remoteDesktop` — Remote desktop capabilities
- `monitor` — System monitoring
- `auditLog` — Security audit trail
- `metricsService` — Performance metrics

---

## Database

44+ SQLite tables with 22+ performance indexes. Single file (`hyperion.db`), created automatically on first run. WAL mode for concurrent read/write performance.

Key tables:
- `users` — Accounts with bcrypt hashes and roles
- `sessions` — Active authentication sessions
- `agents` — AI agent definitions and state
- `notebooks` — Jupyter-like notebook storage
- `audit_log` — Complete action audit trail
- `metrics` — Historical system metrics
- `vault` — AES-256-GCM encrypted secrets

---

## Frontend

No React, no Vue, no build step. The entire UI is:

- `public/index.html` — Single HTML shell with inline critical CSS
- `public/js/hyperion.js` — 13,000+ line SPA engine
- `public/css/hyperion.css` — Styles with 8 theme variants

Every page is a function. Navigation is a `go()` call. Hamburger sidebar with organized sections. The entire UI loads in under 500ms.

---

## AI System

Multi-provider LLM service supporting 5 providers:

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| Ollama | Yes (fully local) | Best for privacy, no API key needed |
| Gemini | Yes (rate limited) | Google AI, good free tier |
| OpenAI | No | GPT-4o and variants |
| Claude | No | Anthropic models |
| Grok | No | xAI models |

Agentic chat with tool-calling, command execution approval, and streaming responses. Provider settings persisted via `applyLlmSettings()` bridge. Automatic failover between providers.

---

## API

All endpoints live under `/api/*`. Authentication is session-based via `X-Session-Id` header.

### Common Endpoints

```bash
# Health check (no auth)
curl http://localhost:3333/api/health

# Register
curl -X POST http://localhost:3333/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"myuser","password":"mypassword"}'

# Login (returns session ID)
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"myuser","password":"mypassword"}'

# Authenticated request
curl http://localhost:3333/api/files/list \
  -H "X-Session-Id: your-session-id"

# Test AI provider
curl -X POST http://localhost:3333/api/llm/test \
  -H "X-Session-Id: your-session-id"

# AI Chat
curl -X POST http://localhost:3333/api/chat \
  -H "X-Session-Id: your-session-id" \
  -H "Content-Type: application/json" \
  -d '{"message":"List all running Docker containers","sessionId":"chat-session-1"}'
```

### WebSocket

Connect to `/ws/*` for:
- Live terminal streams
- System monitoring data
- Notebook collaboration
- AI agent events

### API Keys

Generate long-lived API keys in Settings > Security for programmatic access without session management.

---

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3333` | HTTP server port |
| `CSP_DISABLED` | `false` | Disable Content Security Policy |
| `MCP_ENABLED` | `false` | Enable MCP server |
| `MCP_PORT` | `3334` | MCP server port |
| `DISCOVERY_ENABLED` | `false` | Enable service discovery |
| `LLM_PROVIDER` | — | Active LLM provider (`ollama`, `openai`, `gemini`, `anthropic`, `xai`) |
| `LLM_API_KEY` | — | API key for the configured provider |
| `LLM_MODEL` | — | Model name override |
| `LLM_FALLBACK_PROVIDER` | — | Fallback if primary fails |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `LOG_LEVEL` | `info` | Logging: `debug`, `info`, `warn`, `error` |
| `LOG_FILE` | — | Path to write logs |

See [`.env.example`](../.env.example) for provider-specific options.

---

## Onboarding System

New users get a 6-step setup wizard:

1. **Welcome** — Branding + intro
2. **AI Provider** — Choose from 5 providers, enter API key, test connection
3. **AI Capabilities** — Overview of agentic features
4. **Workspace Preset** — DevOps / Developer / System Admin / All-Purpose
5. **Theme** — Dark, Light, or System with live preview
6. **Ready** — Summary checklist + launch

Followed by a 5-step spotlight guided tour of the UI.

---

## Navigation

Hamburger sidebar (272px slide-out) with sections:

| Section | Tools |
|---------|-------|
| **Core** | Terminal, Files, Code Runner, Notebooks, Snippets |
| **Workspace** | Canvas, Markdown, Notes, Bookmarks, Clipboard, Data Viewer, Pomodoro |
| **AI & Automation** | Assistant, NOVA, AI Chat, Agents, Workflows, Skills, Plugins |
| **DevOps** | Git, Docker, SSH Tunnels, DB Explorer, Env Vars, Cron, Processes |
| **Network & API** | HTTP Client, WebSocket, Mock API, Network, Load Test, Link Check, Webhooks |
| **Monitoring** | System Info, Monitor, Logs, Analytics, Metrics, Health, Remote Desktop |
| **Dev Tools** | Toolkit, Regex, JWT, Diff, JSON, YAML, Base64, Hash, UUID, Colors, Cron Builder, Images, Text Tools, Lorem, Deps Audit |
| **Security** | Vault |
| **Admin** | Backups, Audit Log, API Docs, Shortcuts, Widgets, File History |

Pin favorites with stars. Search with `/`. Command palette with `Cmd+K`.

---

## Dependencies

Runtime (7 packages):

| Package | Purpose |
|---------|---------|
| `express` | HTTP server and routing |
| `better-sqlite3` | SQLite database (WAL mode) |
| `bcryptjs` | Password hashing |
| `uuid` | Session and entity IDs |
| `ws` | WebSocket server |
| `multer` | File upload handling |
| `node-pty` | Terminal PTY spawning |

Dev (1 package):

| Package | Purpose |
|---------|---------|
| `vitest` | Test framework |
