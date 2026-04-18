<p align="center">
  <br />
  <pre align="center">
╦ ╦╦ ╦╔═╗╔═╗╦═╗╦╔═╗╔╗╔
╠═╣╚╦╝╠═╝║╣ ╠╦╝║║ ║║║║
╩ ╩ ╩ ╩  ╚═╝╩╚═╩╚═╝╝╚╝
  </pre>
  <br />
  <strong>The most beautiful way to manage your server.</strong>
  <br />
  <em>Self-hosted admin panel with real-time monitoring, Docker management, terminal, file manager, and 55+ tools.</em>
  <br />
  <br />

  [![CI](https://github.com/yogeshsinghkatoch9/hyperion/actions/workflows/ci.yml/badge.svg)](https://github.com/yogeshsinghkatoch9/hyperion/actions/workflows/ci.yml)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node 18+](https://img.shields.io/badge/node-18%2B-green.svg)](https://nodejs.org)
</p>

<!-- SCREENSHOT: Replace this comment with your hero screenshot -->
<!-- ![Hyperion Dashboard](docs/screenshots/dashboard.png) -->

---

## Install (30 seconds)

**One-line Docker install:**

```bash
curl -fsSL https://raw.githubusercontent.com/yogeshsinghkatoch9/hyperion/main/scripts/install.sh | bash
```

**Or manually:**

```bash
git clone https://github.com/yogeshsinghkatoch9/hyperion.git && cd hyperion
npm install
node server.js
```

Open **http://localhost:3333** — create your admin account on first login.

**Docker Compose:**

```bash
docker compose up -d
```

---

## What You Get

| Feature | Description |
|---------|-------------|
| **Real-time Dashboard** | CPU, RAM, disk, network — live sparkline charts with historical data |
| **Docker Management** | Start, stop, restart, logs, exec — manage all your containers from the browser |
| **Browser Terminal** | Full PTY terminal with tabs, split panes, and broadcast mode |
| **File Manager** | Browse, edit, upload, download, drag-and-drop — no FTP needed |
| **System Monitoring** | Process manager, port scanner, network tools, historical metrics |
| **Cron Job Editor** | Visual cron builder with execution history |
| **AI Assistant** | Agentic chat that can run commands and manage infrastructure (Ollama / Gemini / OpenAI / Claude / Grok) |
| **55+ Dev Tools** | HTTP client, Git UI, SSH manager, DB explorer, JWT debugger, regex tester, and more |

<!-- SCREENSHOTS: Replace these comments with your actual screenshots -->
<!--
<p align="center">
  <img src="docs/screenshots/dashboard.png" width="45%" alt="Dashboard" />
  <img src="docs/screenshots/terminal.png" width="45%" alt="Terminal" />
</p>
<p align="center">
  <img src="docs/screenshots/docker.png" width="45%" alt="Docker Management" />
  <img src="docs/screenshots/files.png" width="45%" alt="File Manager" />
</p>
-->

---

## Why Hyperion?

- **7 dependencies.** No React. No webpack. No build step. Starts in under 2 seconds.
- **SQLite database.** Zero config. Single file backup. No Postgres/MySQL required.
- **Self-hosted & private.** Your data never leaves your machine. No cloud, no telemetry.
- **Access from anywhere.** Phone, tablet, laptop — one URL for your entire server.
- **Runs on anything.** Raspberry Pi to bare-metal. Docker or just `node server.js`.

---

## Features

### Core

- **Terminal** — Full PTY with tabs, split panes, resize, copy/paste (`node-pty`)
- **File Manager** — Browse, create, edit, rename, delete, upload, download. Drag-and-drop. Real-time file watching
- **Code Runner** — Execute Python, JavaScript, Bash, Go, Rust with syntax highlighting
- **Dashboard** — Customizable widget grid with live system metrics

### Server Management

- **Docker** — Container & image management. Start, stop, logs, exec, compose
- **Process Manager** — View, filter, kill processes. Built-in port scanner
- **Cron Scheduler** — Visual cron builder with execution history
- **SSH Manager** — Saved connections, key management, tunnel support
- **System Monitor** — CPU, memory, disk, network, battery with trend charts

### AI & Automation

- **AI Chat** — Agentic interface with tool-calling. Run commands through conversation
- **AI Agents** — Autonomous agents with goals, tools, and memory. Schedule on cron
- **Nova** — Natural-language shell. Describe what you want in English
- **5 Providers** — Ollama (free, local), Gemini, OpenAI, Claude, Grok

### Developer Tools

- **Git** — Visual status, diff, commit, push, pull, branch, merge, stash, log
- **HTTP Client** — Postman-like REST client with collections and history
- **Database Explorer** — Browse SQLite databases. Run queries, export results
- **WebSocket Client** — Connect, send/receive, view frame history
- **Network Tools** — Port scanner, DNS lookup, ping, traceroute
- **Load Tester** — Stress-test endpoints with concurrency and latency reports

### Utilities

Regex Tester · JWT Debugger · Diff Viewer · JSON/YAML Formatter · Base64 Codec · Hash Generator · UUID Tools · Color Picker · Image Tools · Text Transform · Cron Builder · Lorem Generator · Link Checker · Mock Server · Dependency Auditor · Clipboard Manager · Bookmarks · Quick Notes · Markdown Editor · Canvas · Notebooks · Pomodoro Timer

### Security

- bcrypt passwords + rate limiting (5 attempts/min/IP)
- Two-Factor Authentication (TOTP) with QR setup
- Role-Based Access Control (Admin, Operator, Developer, Viewer + custom)
- API key support for programmatic access
- Encrypted vault (AES-256-GCM) for secrets
- Full audit trail with suspicious activity detection
- Content Security Policy enabled by default
- SSRF & command injection protection

---

## Configuration

All configuration via environment variables or `.env` file:

```bash
PORT=3333                    # Server port
LLM_PROVIDER=ollama          # AI provider: ollama, gemini, openai, anthropic, xai
LLM_API_KEY=                 # API key for your provider
CSP_ENABLED=false            # Content Security Policy
MCP_ENABLED=false            # Model Context Protocol server
```

See [`.env.example`](.env.example) for all options. Configure AI during the onboarding wizard or in Settings.

---

## Themes

Eight built-in themes: **Hyperion** (warm orange), **HAL 9000** (red), **JARVIS** (sky blue), **LCARS** (amber), **Wintermute** (green), **Cortana** (purple), **Solarized** (gold), plus light mode. Custom accent colors and compact mode.

---

## Tech Stack

```
7 runtime dependencies:  express, better-sqlite3, bcryptjs, uuid, ws, multer, node-pty
67+ route modules  ·  81+ services  ·  1,970+ tests (Vitest)
Vanilla JS SPA  ·  No build step  ·  SQLite (WAL mode)  ·  Single-process Node.js
```

For architecture details, API docs, and database schema, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Testing

```bash
npm test                        # Run all 1,970+ tests
npx vitest                      # Watch mode
npx vitest run -t "auth"        # Run matching tests
```

---

## System Requirements

- Node.js 18+ (LTS recommended)
- Any OS: macOS, Linux, Windows (WSL recommended)
- Optional: Docker for containerized deployment
- Optional: Ollama for free local AI models

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

[MIT](LICENSE) — use it however you want.

---

<p align="center">
  <strong>Hyperion</strong> — Stop alt-tabbing. Start managing.
</p>
