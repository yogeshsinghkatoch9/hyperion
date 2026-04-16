<p align="center">
  <br />
  <pre align="center">
╦ ╦╦ ╦╔═╗╔═╗╦═╗╦╔═╗╔╗╔
╠═╣╚╦╝╠═╝║╣ ╠╦╝║║ ║║║║
╩ ╩ ╩ ╩  ╚═╝╩╚═╩╚═╝╝╚╝
  </pre>
  <br />
  <strong>Your computer, unleashed.</strong>
  <br />
  <em>A self-hosted universal computing platform with 60+ tools in a single web UI.</em>
  <br />
  <br />
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#onboarding">Onboarding</a> &middot;
  <a href="#configuration">Configuration</a> &middot;
  <a href="#api">API</a> &middot;
  <a href="#architecture">Architecture</a>
</p>

---

## The Problem

Developers juggle dozens of disconnected tools every day: a terminal here, a file manager there, separate apps for Docker, SSH, databases, HTTP testing, note-taking, and system monitoring. Each one requires its own setup, its own context-switching, and its own mental overhead. If you work across multiple machines or access your dev environment remotely, the fragmentation gets worse.

**Hyperion replaces all of that with one thing.**

One Node.js process. One browser tab. One URL you can hit from your phone, your laptop, or any machine on your network. Terminal, file manager, code runner, AI agents, notebooks, Docker control, SSH manager, database explorer, and 50+ developer utilities -- unified under a single authentication layer and a single cohesive interface.

No Electron. No build step. No framework dependencies. Just `npm start` and you have a full computing platform at `localhost:3333`.

---

## Quick Start

```bash
git clone https://github.com/yogeshsinghkatoch9/hyperion.git && cd hyperion
npm install
npm start
```

Open **http://localhost:3333** in your browser. On first launch you'll create an account through the **6-step onboarding wizard**, and you're in.

### Docker

```bash
docker compose up -d
```

Data persists in a `./data` volume. Custom port: `PORT=8080 docker compose up -d`.

### Development

```bash
npm run dev   # auto-reload on file changes
```

---

## Onboarding

New users get a polished 6-step setup wizard followed by an interactive guided tour:

### Setup Wizard

| Step | What Happens |
|------|-------------|
| **1. Welcome** | Hyperion branding + quick intro — takes under a minute |
| **2. AI Provider** | Choose from 5 providers (Ollama, Gemini, OpenAI, Claude, Grok). Enter API key, test connection with live latency feedback |
| **3. AI Capabilities** | Overview of agentic features — command execution, Docker/Git control, automation |
| **4. Workspace Preset** | Pick a preset (DevOps, Developer, System Admin, All-Purpose) to auto-configure your pinned favorites |
| **5. Theme** | Choose Dark, Light, or System theme with live preview |
| **6. Ready** | Summary checklist + pulsing "Launch Hyperion" button |

### Guided Tour

After setup, a 5-step spotlight walkthrough highlights key UI areas:
1. **Sidebar Navigation** — 55+ tools organized in collapsible sections
2. **Terminal** — Full PTY with split panes and broadcast mode
3. **AI Chat** — Agentic chat that can run commands and manage infrastructure
4. **Quick Actions** — Settings, notifications, system memory
5. **Command Palette** — `Cmd+K` for instant search and launch

### Account Registration

Users can create new accounts directly from the login page — no admin intervention needed. Accounts are created with the `user` role by default.

---

## Navigation

Hyperion uses a **hamburger sidebar** navigation system:

- **Top bar**: Logo | ☰ Menu | Search | Settings | Notifications | Memory | Logout
- **☰ Hamburger** opens a slide-out sidebar (272px) with all tools organized by section
- **Pin favorites** with ★ stars for quick access
- **Search** (`/` shortcut) filters across all 55+ tools instantly
- **Command palette** (`Cmd+K`) for keyboard-driven navigation

### Navigation Sections

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

---

## Features

Hyperion ships **67 route modules**, **81 services**, and **1,970 tests** out of the box. Here's what you get:

### Core Platform

| Tool | What It Does |
|------|-------------|
| **Terminal** | Full PTY terminal in your browser. Multiple tabs, resize, copy/paste. Powered by `node-pty`. |
| **File Manager** | Browse, create, edit, rename, delete, upload, download. Drag-and-drop. Real-time file watching. |
| **Code Runner** | Execute Python, JavaScript, Bash, Go, Rust, and more. Syntax highlighting, output capture, execution history. |
| **System Monitor** | Live CPU, memory, disk, network, battery, process list. Historical metrics with trend charts. |
| **Dashboard** | Customizable widget grid. Drag and arrange cards for system stats, quick actions, recent activity. |

### AI & Automation

| Tool | What It Does |
|------|-------------|
| **AI Chat** | Agentic chat interface with tool-calling support. Run commands, manage Docker, automate tasks through conversation. Side-by-side tool approval system. |
| **AI Agents** | Create autonomous agents with goals, tools, and memory. Schedule them on cron. |
| **Nova** | Natural-language shell -- describe what you want in English and Nova translates it to commands. |
| **LLM Service** | Multi-provider AI with 5 providers: **Ollama** (free, local), **Gemini** (free tier), **OpenAI**, **Claude/Anthropic**, **Grok/xAI**. Automatic failover between providers. |
| **Workflows** | Visual workflow builder. Chain steps, conditionals, loops. Run manually or on schedule. |
| **Skills** | Extensible skill system for adding custom AI capabilities. |
| **Plugins** | Hot-reloadable plugin architecture with isolated contexts. |
| **Cron Scheduler** | Full cron expression builder. Schedule any task, agent, or workflow. Execution history and logs. |

### Developer Tools

| Tool | What It Does |
|------|-------------|
| **Git** | Visual git interface: status, diff, commit, push, pull, branch, merge, stash, log. |
| **Docker** | Container and image management. Start, stop, logs, exec, build, compose -- all from the browser. |
| **SSH Manager** | Save connections, launch SSH sessions, manage keys. Tunnel support for port forwarding. |
| **HTTP Client** | Postman-like REST client. Send requests, save history, organize collections, inspect responses. |
| **WebSocket Client** | Connect to WebSocket servers, send/receive messages, view frame history. |
| **Database Explorer** | Browse SQLite databases. Run queries, view tables, export results. |
| **Process Manager** | View all system processes. Sort, filter, search, kill. Port scanner built in. |
| **Load Tester** | Stress-test HTTP endpoints. Configure concurrency, duration, and see detailed latency reports. |

### Notebooks & Knowledge

| Tool | What It Does |
|------|-------------|
| **Notebooks** | Jupyter-like editing with markdown and code cells. Real-time collaboration via WebSocket. |
| **Snippets** | Save and organize reusable code snippets. Tag, search, copy with one click. |
| **Quick Notes** | Fast note-taking with pinning and search. Markdown support. |
| **Bookmarks** | Save and organize URLs. Tag and search. |
| **Canvas** | Freeform spatial canvas for brainstorming. Place text, images, links anywhere. |
| **Markdown Editor** | Full-featured markdown editor with live preview and export. |

### Infrastructure

| Tool | What It Does |
|------|-------------|
| **Plugin System** | Extend Hyperion with custom plugins. Hot-reload, isolated contexts. |
| **MCP Server** | Model Context Protocol server for AI tool integration. |
| **Service Discovery** | Auto-discover other Hyperion instances and services on your network. |
| **Vault** | Encrypted secret storage. AES-256-GCM. Store API keys, tokens, credentials safely. |
| **Backup** | Export and restore your entire Hyperion database. Scheduled automatic backups. |
| **Webhooks** | Subscribe to events and receive HTTP callbacks. Build integrations. |
| **Audit Log** | Complete audit trail of every action. Timeline view, suspicious activity detection, CSV export. |
| **Settings Import/Export** | Bulk transfer your configuration between Hyperion instances. |

### Everyday Utilities

| | | | |
|---|---|---|---|
| Regex Tester | JWT Debugger | Diff Viewer | Image Tools |
| Cron Builder | Color Picker | Base64 Codec | Hash Generator |
| UUID Tools | JSON Formatter | YAML Tools | Lorem Generator |
| Text Transform | Clipboard Manager | Pomodoro Timer | Link Checker |
| Data Viewer | Dependency Auditor | Mock Server | Env Manager |

### Security

- **Authentication** with bcrypt-hashed passwords and rate limiting (5 attempts/min/IP)
- **Account Registration** — new users can self-register from the login page
- **Two-Factor Authentication** (TOTP) with QR code setup
- **API Key** support for programmatic access
- **Role-Based Access Control** (Admin, Operator, Developer, Viewer + custom roles)
- **Content Security Policy** enabled by default
- **SSRF Protection** on load tester and network tools
- **Command Injection** prevention across all shell-executing endpoints
- **Audit Logging** for every authenticated action

### Theming

Eight built-in themes inspired by sci-fi computing systems:

| Theme | Accent | Vibe |
|-------|--------|------|
| **Hyperion** | Warm orange | The default. Earthy, focused. |
| **Hyperion Light** | Warm orange | Light mode variant. |
| **HAL 9000** | Red | Cold, precise, slightly unsettling. |
| **JARVIS** | Sky blue | Clean, futuristic, professional. |
| **LCARS** | Amber | Star Trek bridge console. Bold and rounded. |
| **Wintermute** | Green | Neuromancer terminal. Compact and sharp. |
| **Cortana** | Purple | Soft, intelligent, approachable. |
| **Solarized** | Gold | Classic developer palette. Easy on the eyes. |

Custom accent colors, font sizes, border radius, and compact mode. Themes persist per user. Theme selection is part of the onboarding wizard.

---

## How It Makes Your Life Easier

### 1. One Tab, Everything

Stop alt-tabbing between 15 different apps. Your terminal, files, Docker, databases, SSH, HTTP testing, notes, and system monitoring are all in the same window, sharing the same context.

### 2. Access From Anywhere

Hyperion runs as a web server. Access your full development environment from your phone, tablet, another computer, or over SSH tunnel from anywhere in the world. Your machine stays where it is -- you don't have to.

### 3. Zero Setup Tools

Every tool works immediately. No installing Postman, no configuring pgAdmin, no setting up a separate terminal emulator. `npm start` and you have 60+ tools ready to go.

### 4. AI That Knows Your System

AI Chat and Nova have direct access to your terminal, files, and system state. They don't just generate text -- they can actually run commands, read your code, manage your processes, and automate your workflows. Connect any provider (Ollama, Gemini, OpenAI, Claude, Grok) in the onboarding wizard or settings.

### 5. Lightweight By Design

One Node.js process. ~7 runtime dependencies. SQLite for storage. No Docker required (but supported). No build step. No webpack. No React. Starts in under 2 seconds. Runs on a Raspberry Pi.

### 6. Self-Hosted & Private

Your data never leaves your machine. No cloud accounts, no telemetry, no tracking. The database is a single SQLite file you can back up, move, or delete.

---

## Configuration

All configuration is through environment variables. Create a `.env` file or pass them directly.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3333` | HTTP server port |
| `CSP_DISABLED` | `false` | Set `true` to disable Content Security Policy |
| `MCP_ENABLED` | `false` | Enable the MCP (Model Context Protocol) server |
| `MCP_PORT` | `3334` | MCP server port |
| `DISCOVERY_ENABLED` | `false` | Enable service discovery |
| `LLM_PROVIDER` | -- | Active LLM provider (`ollama`, `openai`, `gemini`, `anthropic`, `xai`) |
| `LLM_API_KEY` | -- | API key for the configured LLM provider |
| `LLM_MODEL` | -- | Model name (e.g. `gemini-2.5-flash`, `gpt-4o`, `llama3.1`) |
| `LLM_FALLBACK_PROVIDER` | -- | Fallback provider if primary fails |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL (for local models) |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `LOG_FILE` | -- | Path to write logs to a file |

### AI Provider Setup

Configure your AI provider during onboarding or via settings:

```bash
# Ollama (free, local)
LLM_PROVIDER=ollama

# Google Gemini (free tier available)
LLM_PROVIDER=gemini
LLM_API_KEY=your-gemini-key

# OpenAI
LLM_PROVIDER=openai
LLM_API_KEY=sk-...

# Anthropic Claude
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...

# xAI Grok
LLM_PROVIDER=xai
LLM_API_KEY=xai-...
```

---

## API

**REST** -- All endpoints live under `/api/*`. Authentication is session-based; include the `X-Session-Id` header with every request.

```bash
# Health check (no auth required)
curl http://localhost:3333/api/health

# Register a new account
curl -X POST http://localhost:3333/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"myuser","password":"mypassword"}'

# Login
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"myuser","password":"mypassword"}'

# Use the returned session ID
curl http://localhost:3333/api/files/list \
  -H "X-Session-Id: your-session-id"

# Test AI provider connection
curl -X POST http://localhost:3333/api/llm/test \
  -H "X-Session-Id: your-session-id"

# AI Chat
curl -X POST http://localhost:3333/api/chat \
  -H "X-Session-Id: your-session-id" \
  -H "Content-Type: application/json" \
  -d '{"message":"List all running Docker containers","sessionId":"chat-session-1"}'
```

**WebSocket** -- Connect to `/ws/*` for live terminal streams, system monitoring, notebook collaboration, and AI agent events.

**API Keys** -- Generate long-lived API keys in Settings > Security for programmatic access without session management.

---

## Architecture

```
hyperion/
  server.js                # Entry point -- Express + WebSocket + SQLite
  |
  +-- routes/              # 67+ REST API route modules
  |     admin, agents, analytics, audit, backup, base64, bookmarks, browser,
  |     canvas, channels, chat, clipboard, code, colorTools, cron, cronBuilder,
  |     dashboard, dataViewer, dbExplorer, depAuditor, devToolkit, diffViewer,
  |     discovery, docker, doctor, envManager, files, git, hash, http,
  |     imageTools, json, jwtDebugger, linkChecker, llm, loadTester, logViewer,
  |     lorem, markdownEditor, mcp, memory, metrics, mockServer, monitor,
  |     netTools, notebooks, notes, notifications, nova, plugins, pomodoro,
  |     processManager, regexTester, remote, search, settings, snippets, ssh,
  |     system, textTransform, uuid, vault, webhooks, workflows, wsClient, yaml
  |
  +-- services/            # 81+ business logic modules
  |     agentLoop, auth, db, auditLog, sessionStore, rbac, themeManager,
  |     configPorter, healthCheck, pluginLoader, skillLoader, mcpServer,
  |     discovery, cronScheduler, vectorMemory, remoteDesktop, monitor,
  |     loadTester, processManager, docker, llmService, ...
  |
  +-- tests/               # 94+ test files, 1,970+ tests (Vitest)
  |
  +-- public/              # SPA frontend (vanilla JS, no build step)
  |     +-- index.html     # Single HTML shell with inline critical CSS
  |     +-- js/hyperion.js # 13,000+ line SPA engine
  |     +-- css/hyperion.css
  |
  +-- agents/              # AI agent definitions
  +-- notebooks/           # User notebooks
  +-- scripts/             # Setup and utility scripts
```

**Tech stack**: Node.js, Express 4, better-sqlite3 (WAL mode), WebSocket (`ws`), `node-pty`, vanilla JavaScript SPA.

**Database**: 44+ SQLite tables with 22+ performance indexes. Single file (`hyperion.db`), created automatically on first run. WAL mode for concurrent read/write performance.

**Frontend**: No React, no Vue, no build step. One HTML file, one 13,000+ line JavaScript file, one CSS file. Every page is a function. Navigation is a `go()` call. Hamburger sidebar with organized sections. The entire UI loads in under 500ms.

**Auth**: bcrypt password hashing, self-service registration, 24-hour sessions, rate limiting (5/min/IP), optional TOTP 2FA, API key support, RBAC with granular permissions.

**AI**: Multi-provider LLM service supporting Ollama, Gemini, OpenAI, Claude, and Grok. Agentic chat with tool-calling, command execution approval, and streaming responses. Provider settings persisted to environment via `applyLlmSettings()` bridge.

**Dependencies**: Intentionally minimal -- 7 runtime packages: `express`, `better-sqlite3`, `bcryptjs`, `uuid`, `ws`, `multer`, `node-pty`.

---

## Testing

```bash
npm test              # run all 1,970+ tests
npx vitest            # watch mode
npx vitest run -t "auth"   # run tests matching "auth"
```

94+ test files covering routes, services, security, UI, and integration scenarios.

---

## System Requirements

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- Any OS: macOS, Linux, Windows (WSL recommended)
- Optional: Docker for containerized deployment
- Optional: Ollama for free local AI models

---

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Write tests for your changes
4. Ensure all 1,970+ tests pass (`npm test`)
5. Submit a pull request

---

## License

[MIT](LICENSE) -- use it however you want.

---

<p align="center">
  <strong>Hyperion</strong> -- Stop installing tools. Start building things.
</p>
