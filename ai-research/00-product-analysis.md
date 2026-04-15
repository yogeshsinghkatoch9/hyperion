# Phase 0: Deep Product Analysis — Hyperion

## What is Hyperion?
A **self-hosted universal computing platform** — a single Node.js process that gives developers a web-based terminal, file manager, code runner, AI agents, notebooks, system monitoring, and 55+ developer tools. Think "Cockpit meets VS Code meets DevToolbox" in one SPA.

## Who is it for?
- Developers who want remote access to their machines
- DevOps/SRE engineers managing servers
- Power users who want a unified web dashboard for all dev tools
- Hobbyists running home servers / Raspberry Pi setups

## Tech Stack
| Layer | Technology |
|---|---|
| Runtime | Node.js (single process) |
| HTTP | Express 4 |
| Database | better-sqlite3 (WAL mode) |
| WebSocket | ws (terminal, system monitor, notebooks, remote desktop) |
| Terminal | node-pty (with Python PTY bridge fallback) |
| Frontend | Vanilla JS SPA — NO framework, NO build step |
| Auth | Session-based + TOTP 2FA + RBAC + rate limiting |
| Testing | Vitest (95 test files) |

## Architecture
```
server.js (938 lines)         — Entry point, Express + WS + SQLite
├── routes/ (67 files)        — REST API handlers
├── services/ (82 files)      — Business logic, integrations
├── public/
│   ├── index.html (334 lines)  — SPA shell with 45+ nav buttons
│   ├── js/hyperion.js (11,700 lines) — ENTIRE frontend logic
│   └── css/hyperion.css (4,425 lines) — All styles
├── tests/ (95 files)         — Vitest suite
└── hyperion.db               — SQLite database
```

## Current Features (55+ tools across 10 waves)
### Core
- Terminal (PTY with xterm.js), SSH terminal, File Manager, Code Runner, System Monitor

### AI
- Nova (natural-language shell), LLM Service (Ollama/OpenAI/Gemini failover), AI Agents, AI Assistant

### Dev Tools
- Git client, Docker manager, SSH tunnel manager, Process Manager, HTTP Client, DB Explorer, Cron scheduler, Vault (encrypted secrets), Remote Desktop

### Notebooks
- Jupyter-like editing with real-time WebSocket collaboration

### Infrastructure
- Plugin system, Skill loader, MCP server, Service discovery, Vector memory, Webhooks, Channels (Telegram/Discord)

### Utility Tools (Waves 7-10)
- WebSocket client, Markdown editor, Mock server, Dependency auditor, Notes, Bookmarks
- Load tester, Data viewer, Text transform, Clipboard manager, Pomodoro timer, Link checker
- Regex tester, JWT debugger, Diff viewer, Image tools, Cron builder, Color tools
- Base64 codec, Hash generator, UUID tools, JSON formatter, YAML tools, Lorem generator

### Admin
- Dashboard, Analytics, Backup/restore, Audit viewer, Health dashboard, Metrics history, API docs

## Obvious Weaknesses

### 1. Monolithic Frontend (Critical)
- **11,700 lines in a SINGLE JS file** — impossible to maintain, no code splitting, no lazy loading
- **4,425 lines in a SINGLE CSS file** — no component-level styles, no CSS modules
- **Everything loaded upfront** — all 55+ page renderers loaded on first page hit
- No framework = no virtual DOM, no reactivity, no component lifecycle

### 2. Navigation Overwhelm
- **45+ nav items** in a flat sidebar list — no grouping, no categories, no search
- Users must scroll through everything to find what they need
- No recently-used, no favorites, no command palette

### 3. No Mobile Experience
- 45 nav items don't collapse well on mobile
- Terminal and code runner need keyboard which is poor on mobile
- No responsive design visible in the CSS

### 4. Performance Concerns
- Single JS file = huge initial payload (~400KB+ estimated)
- System monitor spawns `netstat` every 2 seconds via execSync (blocking!)
- No service worker caching strategy despite sw.js existing
- No CDN for xterm.js and fonts (loaded from jsdelivr/Google)

### 5. Security Gaps
- `StrictHostKeyChecking=no` in SSH terminal (MITM vulnerability)
- Terminal env cleanup removes CLAUDECODE but exposes all other env vars
- CSP disabled by default (`CSP_ENABLED` env var needed)
- No CSRF protection
- Rate limiter is in-memory only (bypassed by restarting server)

### 6. No Onboarding/First-Run Experience
- Just dumps you into the assistant page after account creation
- No guided tour, no feature discovery
- No way to know which tools exist or what they do

### 7. No Offline/PWA Support
- manifest.json exists but sw.js is minimal
- No offline capability despite being a local-first tool

## What's Missing That Users Would Want
1. **Command palette** (Cmd+K) — the #1 power user feature
2. **Tabs/split panes** — multiple tools open simultaneously
3. **Keyboard shortcuts** — developers live on keyboard
4. **Search across all tools** — unified search
5. **Customizable dashboard** — drag/drop widgets
6. **Theme system** — proper light/dark with custom themes
7. **File editor** (Monaco/CodeMirror) — can browse files but not edit inline
8. **Activity feed** — what happened while you were away
9. **Mobile companion** — at minimum, monitoring + terminal
10. **Extension marketplace** — beyond plugins, community-shared tools

## What Would Make a Competitor Terrified
- AI that can autonomously manage your entire server
- Real-time collaboration (pair programming via shared terminal)
- One-click deployment pipelines
- Integrated monitoring with intelligent alerting
- Natural language → any operation (not just shell commands)
