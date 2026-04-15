# Hyperion Monetization & Growth Playbook

**Date:** 2026-04-15
**Status:** Strategic Plan
**Scope:** Revenue model, growth channels, competitive positioning, execution roadmap

---

## Table of Contents

1. [Product Audit & Competitive Position](#1-product-audit--competitive-position)
2. [Pricing Model Recommendation](#2-pricing-model-recommendation)
3. [Feature Tiering — What to Paywall](#3-feature-tiering--what-to-paywall)
4. [Integrations That Unlock New Users](#4-integrations-that-unlock-new-users)
5. [Growth Strategies](#5-growth-strategies)
6. [Viral Loops & Network Effects](#6-viral-loops--network-effects)
7. [SEO & Content Strategy](#7-seo--content-strategy)
8. [Revenue Projections & Milestones](#8-revenue-projections--milestones)
9. [Execution Roadmap](#9-execution-roadmap)

---

## 1. Product Audit & Competitive Position

### 1.1 What Hyperion Actually Is

Based on a full codebase analysis (`server.js`, 80+ services, 70+ routes, SPA frontend), Hyperion is a **single-process, self-hosted universal computing platform** with:

**Core Infrastructure (12 capabilities):**
- Web terminal (node-pty + xterm.js, SSH support, Python PTY fallback)
- File manager with versioning (`fileVersioning.js`)
- Code runner (multi-language)
- Notebook environment with real-time collaboration (WebSocket)
- Docker management (containers, images, volumes, networks, compose)
- Git client
- Process manager
- System monitor (CPU, memory, network, disk, battery)
- SSH tunnels
- Remote desktop (WebSocket-based screen sharing)
- Cron scheduler
- Backup service with scheduled auto-backups

**AI Layer (6 capabilities):**
- Multi-provider LLM integration (Ollama/OpenAI/Gemini) with circuit breaker failover
- NOVA — English-like programming language (lexer, parser, compiler, runtime)
- AI assistant with conversational memory (vector embeddings + TF-IDF fallback)
- Customizable AI personality (BOOT.md/SOUL.md/AGENTS.md prompt injection)
- Command translation (natural language to shell commands, with safety checks)
- MCP server (Model Context Protocol, exposing tools to external AI agents)

**Developer Tools (30+ capabilities):**
- HTTP client, WebSocket tester, mock API server
- JSON/YAML/Base64/Hash/UUID/Lorem generators
- Regex tester, JWT debugger, diff viewer
- Color tools, image tools, cron expression builder
- Link checker, load tester, dependency auditor
- Text transform, clipboard manager, markdown editor
- Code snippets, bookmarks, notes

**Platform Layer (10 capabilities):**
- Plugin system (`~/.hyperion/plugins/`) with formal SDK (sandboxed DB, notifications, settings, HTTP)
- Skills system (`~/.hyperion/skills/` with SKILL.md frontmatter triggers)
- Workflow engine (conditional execution, loops, variables)
- Webhook dispatcher (inbound + outbound)
- Channels (Telegram bot, Discord bot, webhook)
- Device discovery (mDNS multicast)
- Dashboard with custom widgets

**Security & Admin (8 capabilities):**
- Authentication with 2FA/TOTP (backup codes, encrypted secrets)
- RBAC (4 built-in roles: admin/operator/developer/viewer, custom roles, 16 permissions)
- Encrypted vault (AES-256-GCM, PBKDF2 key derivation, auto-lock)
- Audit logging (all mutating requests)
- Environment variable manager
- Rate limiting (login: 5/min/IP, API: 100/min/IP, configurable)
- Security headers (CSP, HSTS, XSS protection)
- Session management with cleanup

**Observability (5 capabilities):**
- Prometheus-compatible metrics endpoint
- Request metrics (p95/p99 latency, by method/status)
- Metrics history with persistence
- Log viewer
- Health check endpoint (`/api/health`)

### 1.2 Competitive Landscape

| Feature | Hyperion | Portainer | Cockpit | Webmin | code-server | Coolify |
|---------|----------|-----------|---------|--------|-------------|---------|
| Terminal | Full PTY | Basic | Full | Basic | VS Code term | No |
| File Manager | Yes + versioning | No | Basic | Yes | VS Code | No |
| Docker GUI | Yes | **Core focus** | Plugin | No | No | **Core focus** |
| AI Assistant | **Multi-provider** | No | No | No | Copilot ($) | No |
| Code Runner | Multi-lang | No | No | No | VS Code | No |
| Notebooks | Collaborative | No | No | No | Jupyter ext | No |
| System Monitor | Full | Host stats | **Core focus** | **Core focus** | No | Basic |
| Dev Tools (30+) | **Unique** | No | No | No | Extensions | No |
| Plugin System | SDK | No | No | Modules | Extensions | No |
| Self-hosted | Yes | Yes | Yes | Yes | Yes | Yes |
| Cloud option | No | Yes | No | No | Yes (Coder) | Yes |
| Pricing | Free (MIT) | Free CE + Paid BE | Free | Free | Free / Paid | Free + Cloud |
| License | MIT | Zlib (CE) | LGPL | BSD | MIT | Apache 2.0 |

**Hyperion's unique moat:** No competitor combines terminal + AI + code runner + 30 dev tools + notebooks + Docker + monitoring in a single binary. Portainer focuses solely on Docker. Cockpit/Webmin focus on sysadmin. Code-server is just VS Code in a browser. Coolify is deployment only.

### 1.3 Key Insight

Hyperion occupies a **new category** — the universal developer workstation in a browser. The closest mental model is "if tmux, VS Code, Docker Desktop, Postman, and ChatGPT had a self-hosted baby." This matters because category creation enables premium pricing and media attention.

---

## 2. Pricing Model Recommendation

### 2.1 Recommended: Open-Core + Cloud Hosted Hybrid

After analyzing Portainer ($5-15K/year enterprise), Grafana ($250M+ ARR from 1% of 20M users), GitLab ($11B valuation via buyer-based open-core), and Coolify (free self-hosted + $5/mo cloud), the optimal model for Hyperion is:

**Three-axis monetization:**

```
Axis 1: Open-Core (self-hosted free vs. self-hosted Pro)
Axis 2: Cloud-Hosted (managed Hyperion instances)
Axis 3: Usage-Based (AI/LLM token consumption)
```

### 2.2 Tier Structure

#### Free Tier (Community Edition) — $0 forever
- Full MIT-licensed core (everything that exists today)
- Single user
- All 55+ dev tools
- Terminal, file manager, code runner
- Basic AI (bring your own API key)
- Plugin and skill system
- Community support (GitHub Issues, Discord)
- Self-hosted only

**Why free core matters:** Grafana's Raj Dutt: "90% of our users will never pay us, and that's by design." The free tier builds the community, generates word-of-mouth, and creates the funnel. GitLab grew to 50% of the Fortune 100 by starting free.

#### Pro Tier — $12/user/month (self-hosted) or $29/user/month (cloud-hosted)
- Everything in Free, plus:
- Multi-user with full RBAC
- Team collaboration on notebooks
- SSO/LDAP integration
- Advanced audit logging with export
- Priority backup/restore with cloud sync
- Custom branding (logo, colors, domain)
- Advanced workflow engine (webhooks, scheduled, event-driven)
- Dashboard templates and sharing
- Email/Slack notifications for alerts
- Prometheus metrics export
- 14-day email support SLA

#### Enterprise Tier — Custom pricing (contact sales, typically $5-15K/year)
- Everything in Pro, plus:
- Air-gapped deployment support
- SAML 2.0 / OIDC SSO
- Advanced RBAC (custom permission scopes, API key scoping)
- Compliance reporting (SOC2 readiness, audit export)
- High-availability / clustering support
- Dedicated support engineer
- Custom plugin development
- SLA guarantees (99.9% uptime for cloud)
- White-label (full rebrand, remove all Hyperion branding)
- Volume licensing for 50+ seats

#### AI Add-On — Usage-based, $0.01 per AI interaction
- For users who want managed AI without bringing their own keys
- Hyperion proxies to LLM providers, handles failover
- Includes: command generation, assistant chat, NOVA processing, embeddings
- Bundled credits: Pro includes 500/month, Enterprise includes 5,000/month
- Overage: $0.01/interaction (covers LLM API cost + margin)

### 2.3 Why This Model Works

| Revenue axis | Captures value from... | Precedent |
|-------------|----------------------|-----------|
| Open-core self-hosted | Teams who need collaboration + security | GitLab, Portainer |
| Cloud-hosted | Users who do not want to manage infrastructure | Coolify, Grafana Cloud |
| AI usage-based | Power users of AI features | GitHub Copilot, Cursor |

The hybrid model generates three independent revenue streams and matches buyer intent: hobbyists get free, small teams pay monthly, enterprises pay annually, and AI-heavy users pay per-use.

---

## 3. Feature Tiering -- What to Paywall

### 3.1 The Paywall Principle

Follow GitLab's "buyer-based" approach: paywall features that **teams and organizations** need, not features that individual developers need. Never paywall the core workflow. The individual developer must always feel that Hyperion is the best free tool they have ever used.

### 3.2 Feature Gate Map

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Terminal (local + SSH) | Yes | Yes | Yes |
| File manager + versioning | Yes | Yes | Yes |
| Code runner | Yes | Yes | Yes |
| All 30+ dev tools | Yes | Yes | Yes |
| Docker management | Yes | Yes | Yes |
| Git client | Yes | Yes | Yes |
| System monitor | Yes | Yes | Yes |
| AI assistant (BYOK) | Yes | Yes | Yes |
| NOVA language | Yes | Yes | Yes |
| Plugins + Skills | Yes | Yes | Yes |
| Single-user auth | Yes | Yes | Yes |
| **Multi-user (2+ users)** | No | **Yes** | Yes |
| **RBAC (custom roles)** | No | **Yes** | Yes |
| **Notebook collaboration** | No | **Yes** | Yes |
| **SSO (LDAP)** | No | **Yes** | Yes |
| **SSO (SAML/OIDC)** | No | No | **Yes** |
| **Cloud backup sync** | No | **Yes** | Yes |
| **Audit log export** | No | **Yes** | Yes |
| **Custom branding** | No | **Yes** | Yes |
| **White-label** | No | No | **Yes** |
| **Prometheus export** | No | **Yes** | Yes |
| **Advanced workflows** | No | **Yes** | Yes |
| **Dashboard sharing** | No | **Yes** | Yes |
| **Alert notifications** | Basic | Full | Full |
| **HA / Clustering** | No | No | **Yes** |
| **Compliance reporting** | No | No | **Yes** |
| **Managed AI (no BYOK)** | No | 500/mo | 5,000/mo |
| **API access (external)** | No | **Yes** | Yes |
| **MCP server** | Yes | Yes | Yes |
| **Device discovery** | 3 nodes | Unlimited | Unlimited |
| Support | Community | Email (14d SLA) | Dedicated engineer |

### 3.3 Implementation Strategy

The paywall is enforced at the **middleware level** in `server.js`. A license check service validates a signed JWT license key on startup:

```
FREE:  No license key needed. Default behavior.
PRO:   License key stored in ~/.hyperion/license.key, validated on startup.
ENTERPRISE: Same mechanism, but the signed JWT includes enterprise feature flags.
```

Feature gates are checked via `license.hasFeature('multi_user')` in route middleware. This keeps the core open-source and transparent (users can see exactly what is gated), while preventing casual circumvention.

---

## 4. Integrations That Unlock New Users

### 4.1 Priority 1 — High impact, low effort (existing infrastructure)

**GitHub/GitLab/Bitbucket Integration**
- Hyperion already has a Git client (`services/git.js`, `routes/git.js`)
- Add: OAuth login via GitHub, clone/push with token auth, PR review in-app
- Unlocks: Every developer who uses Git (99% of target audience)
- Effort: 2-3 weeks (OAuth flow + Git credential helper)

**Slack/Discord Notifications**
- Hyperion already has Discord and Telegram channels (`services/channels/`)
- Add: Slack webhook for alerts (CPU spike, backup complete, agent finished)
- Unlocks: Teams that live in Slack (virtually all tech companies)
- Effort: 1 week (Slack Incoming Webhooks API)

**Prometheus/Grafana Metrics Export**
- Hyperion already has metrics (`services/metricsService.js`, `/api/metrics` route)
- Add: Prometheus text format endpoint (`/metrics` in Prometheus exposition format)
- Unlocks: Every DevOps team running Grafana/Prometheus stacks
- Effort: 1 week (format conversion of existing metrics data)

### 4.2 Priority 2 — Medium effort, strategic value

**AWS/GCP/Azure Cloud Provider Integration**
- Add: Cloud resource viewer (EC2 instances, S3 buckets, Lambda functions)
- Use existing HTTP client infrastructure (`services/httpClient.js`)
- Unlocks: Cloud engineers who want a unified dashboard
- Effort: 4-6 weeks per provider (API wrappers + UI panels)

**Terraform/Ansible Integration**
- Add: Terraform state viewer, plan preview, apply from UI
- Ansible playbook runner with output streaming
- Unlocks: Infrastructure-as-code practitioners
- Effort: 3-4 weeks (shell wrapper + state file parser)

**CI/CD Pipeline Viewer**
- Add: View GitHub Actions / GitLab CI pipeline status
- Trigger rebuilds, view logs inline
- Unlocks: Full DevOps workflow without leaving Hyperion
- Effort: 3-4 weeks (API integration per CI provider)

### 4.3 Priority 3 — Long-term ecosystem plays

**VS Code Extension**
- "Open in Hyperion" — connect VS Code to a running Hyperion instance
- Use Hyperion's terminal, AI, and tools from within VS Code
- Unlocks: Developers who cannot leave VS Code but want Hyperion's AI/tools

**Kubernetes Dashboard**
- kubectl integration, pod logs, deployment management
- Natural extension of Docker management
- Unlocks: Kubernetes operators (large, growing market)

**Database Client Expansion**
- Hyperion has `dbExplorer.js` for SQLite
- Add: PostgreSQL, MySQL, MongoDB, Redis connection support
- Unlocks: Full-stack developers, DBAs

---

## 5. Growth Strategies

### 5.1 Developer Community Building

**Discord Community (Months 1-3)**
- Create Hyperion Discord server with channels: #general, #plugins, #skills, #showcase, #support, #contributing
- Staff with early contributors who get "Community Pioneer" role
- Weekly "What I Built" thread — users share Hyperion setups
- Target: 500 members in 90 days

**GitHub Strategy (Ongoing)**
- Maintain high-quality README with GIF demos (terminal, AI, Docker in one screen)
- "Good first issue" labels on 20+ issues at all times
- CONTRIBUTING.md with clear plugin/skill development guide
- GitHub Discussions for Q&A (moves support volume off Issues)
- GitHub Sponsors for individual contributors
- Target: 1,000 stars in 6 months, 5,000 in 12 months

**Plugin Marketplace (Months 4-8)**
- Web-based gallery at `plugins.hyperion.dev`
- Submit plugins via GitHub PR to a `hyperion-plugins` registry repo
- Categories: AI, DevOps, Monitoring, Utilities, Fun
- Featured plugins highlighted in dashboard
- Revenue share: 70/30 split for paid plugins (Phase 2)

### 5.2 Content Marketing

**"Swiss Army Knife" Narrative**
Position Hyperion as the one tool that replaces 10 tabs. Every content piece should reinforce: "One process. One URL. Everything you need."

**Blog Posts (2/month cadence):**
1. "I Replaced Portainer, Cockpit, and Postman with One Tool"
2. "How I Manage My Homelab with Hyperion on a Raspberry Pi"
3. "Building AI Agents That Control Your Server: A NOVA Tutorial"
4. "The Case Against Tab Overload: Why Developers Need a Unified Workstation"
5. "Hyperion vs Portainer vs Cockpit vs Webmin: Honest Comparison"
6. "Self-Hosted AI Assistant: Connect Ollama to Hyperion in 5 Minutes"
7. "50 Developer Tools in One Binary (and They Actually Work)"
8. "From Zero to Productive: My First Week with Hyperion"

**YouTube/Video Strategy:**
- 60-second "Speed Run" — install Hyperion, open terminal, run AI command, manage Docker, all in one take
- 10-minute deep dives on each major feature
- Monthly "Community Showcase" compilating user setups
- Target: 1 video/week for first 3 months, then 2/month

### 5.3 Homelab / Raspberry Pi Community

This is Hyperion's **highest-ROI growth channel.** The homelab community (r/selfhosted: 500K+, r/homelab: 1.5M+) is obsessive about self-hosted tools and actively evangelize. They are the Hacker News / Product Hunt early adopters who write blog posts and create YouTube videos.

**Actions:**
- Official Raspberry Pi image (pre-configured, one-line install)
- Docker image on Docker Hub (already natural since Hyperion has Docker management)
- ARM64 build verification (Node.js on ARM is mature)
- Post to r/selfhosted, r/homelab, r/linux with honest "here is what I built" framing
- Target the "awesome-selfhosted" GitHub list (3rd-party curated list of self-hosted software, 200K+ stars)
- Partnered guides with homelab YouTubers (Techno Tim, Jeff Geerling, NetworkChuck)

### 5.4 Educational Market

**University and Bootcamp Use Cases:**
- Instructor creates a Hyperion instance, students connect to shared notebooks
- Code runner with multi-language support replaces separate tool setup
- Terminal access without giving students full SSH
- Built-in RBAC means instructor is admin, students are developers

**Actions:**
- "Hyperion for Education" landing page
- Free Pro tier for verified educators (like GitHub Education)
- Template notebooks for common CS courses (Python, Data Structures, Web Dev)
- Partnership outreach to 10 coding bootcamps

### 5.5 Conference and Launch Strategy

**Target Events:**
- Hacker News "Show HN" (free, high impact — aim for front page)
- Product Hunt launch (coordinate with community for day-one upvotes)
- FOSDEM (open source conference, Europe)
- KubeCon (DevOps audience)
- local tech meetups (demo Hyperion live, 5-minute lightning talk)

**Demo Script (60 seconds):**
1. Open browser, show Hyperion dashboard
2. Open terminal, run `docker ps`
3. Switch to AI assistant: "find all containers using more than 500MB"
4. Open NOVA: "monitor CPU every 5 seconds and alert if above 80%"
5. Switch to notebook, show collaborative editing
6. Close: "One Node.js process. One URL. Your computer, unleashed."

---

## 6. Viral Loops & Network Effects

### 6.1 "Powered by Hyperion" Badge

Every Hyperion instance that serves a public dashboard or shared notebook includes a subtle "Powered by Hyperion" badge with a link to the homepage. This is the Grafana/Notion playbook — free advertising from every user's deployment.

**Implementation:** Add optional footer badge to dashboard/notebook share views. Removable in Pro tier (paying customers should not be forced to advertise).

### 6.2 Shareable Dashboards

Allow users to generate a public read-only URL for their Hyperion dashboards. This creates content that spreads organically:
- "Here is my homelab monitoring dashboard" (shared on Reddit)
- "Here is my team's project notebook" (shared on Slack)
- Every viewer sees Hyperion's UI and is one click from installing it

**Implementation:** Signed, time-limited URLs with read-only session tokens. No auth required for viewers. Dashboard data is static snapshot (not live, to prevent abuse).

### 6.3 Public Plugin Gallery

`plugins.hyperion.dev` — a searchable gallery of community plugins. Every plugin page includes an install command:

```
hyperion plugin install awesome-docker-cleanup
```

This creates a reason for developers to visit hyperion.dev even if they already have Hyperion installed, driving organic traffic and community engagement.

### 6.4 Template Sharing

Pre-built Hyperion "workspace templates" that configure dashboards, widgets, agents, and workflows for specific use cases:
- "Homelab Monitor" template (system stats, Docker, alerts)
- "Web Dev Workspace" template (terminal, code runner, HTTP client, JSON tools)
- "DevOps Command Center" template (Docker, Git, SSH tunnels, cron, process manager)
- "AI Playground" template (assistant, NOVA, notebooks, LLM config)

One-click import via `hyperion template import <url>`. Templates are shared on GitHub, Reddit, and the plugin gallery.

### 6.5 Referral Program (Pro Tier)

- "Refer a team, get 2 months free"
- Referrer gets $24 credit per signup that converts to Pro
- Referee gets 1 month free Pro trial (extended from default 14-day)
- Track via referral codes embedded in share URLs

### 6.6 Multi-Instance Discovery

Hyperion already has mDNS device discovery (`services/discovery.js`). This is a built-in network effect: the more Hyperion instances on a network, the more useful each one becomes. Lean into this:
- "Hyperion Mesh" — federated view across all instances on your network
- Central dashboard showing all Hyperion nodes, their health, running agents
- Cross-instance terminal (SSH from one Hyperion to another)

---

## 7. SEO & Content Strategy

### 7.1 Target Keywords

**Primary (high intent, moderate competition):**
- "self-hosted developer tools" (1.2K monthly searches)
- "web-based terminal" (2.4K)
- "self-hosted AI assistant" (3.6K, growing rapidly)
- "Docker management GUI" (1.8K)
- "server monitoring dashboard" (4.2K)
- "self-hosted Postman alternative" (800)
- "self-hosted code runner" (600)

**Long-tail (low competition, high conversion):**
- "self-hosted AI chatbot for server management"
- "web terminal with SSH for Raspberry Pi"
- "Docker GUI for homelab"
- "all-in-one developer dashboard self-hosted"
- "open source alternative to [Portainer/Cockpit/Webmin]"
- "self-hosted notebook with code execution"
- "Ollama web interface self-hosted"

**Comparison Keywords (high buyer intent):**
- "Portainer vs Cockpit"
- "Webmin alternatives 2026"
- "code-server alternatives"
- "self-hosted VS Code alternative"
- "Coolify vs Portainer"

### 7.2 Landing Pages to Build

**Homepage:** `hyperion.dev`
- Hero: animated GIF showing terminal, AI, Docker, all in one screen
- Feature grid with icons for all 55+ tools
- One-line install command front and center
- Social proof: GitHub stars, community size, "used by X teams"

**Comparison Pages (SEO magnets):**
- `hyperion.dev/vs/portainer` — "Portainer does Docker. Hyperion does everything."
- `hyperion.dev/vs/cockpit` — "Cockpit monitors your server. Hyperion runs your workflow."
- `hyperion.dev/vs/webmin` — "Webmin was built in 1997. Hyperion was built for 2026."
- `hyperion.dev/vs/code-server` — "Code-server is VS Code in a browser. Hyperion is your entire workstation."
- `hyperion.dev/vs/coolify` — "Coolify deploys apps. Hyperion manages your life as a developer."

Each comparison page follows the template:
1. Honest feature comparison table
2. "Where [competitor] wins" section (builds trust)
3. "Where Hyperion wins" section
4. "When to use each" recommendation
5. CTA: "Try Hyperion free — one command install"

**Use Case Pages:**
- `hyperion.dev/homelab` — Raspberry Pi setup guide, homelab dashboard showcase
- `hyperion.dev/devops` — Docker + monitoring + CI/CD integration story
- `hyperion.dev/education` — classroom deployment, student collaboration
- `hyperion.dev/ai` — Ollama integration, NOVA language, AI agents

### 7.3 Documentation as Marketing

The documentation site (`docs.hyperion.dev`) should be designed to rank for long-tail searches:
- Every feature page has a standalone URL that can rank independently
- Tutorial format: "How to manage Docker containers with Hyperion"
- API reference for plugin developers (attracts developer traffic)
- "Recipes" section with copy-paste solutions for common tasks

### 7.4 Content Calendar (First 90 Days)

| Week | Blog Post | Video | Community |
|------|-----------|-------|-----------|
| 1 | "Introducing Hyperion" | 60s speed run | HN Show HN post |
| 2 | "Hyperion vs Portainer" | Terminal deep dive | r/selfhosted post |
| 3 | "AI Assistant Setup" | Ollama + Hyperion guide | Product Hunt launch |
| 4 | "Homelab on Pi" | Pi setup walkthrough | r/homelab post |
| 5 | "NOVA Language Guide" | NOVA demo | Discord launch |
| 6 | "Plugin Development" | Build a plugin in 10min | Plugin contest launch |
| 7 | "Docker Management" | Docker deep dive | awesome-selfhosted PR |
| 8 | "Hyperion vs Cockpit" | System monitoring tour | Dev.to cross-post |
| 9 | "Notebook Collaboration" | Collab demo | Education outreach |
| 10 | "Workflow Automation" | Workflow builder demo | Integration blog |
| 11 | "Hyperion vs Webmin" | 30 tools in 3 minutes | Community showcase |
| 12 | "Q1 Retrospective" | User story compilation | AMA on Discord |

---

## 8. Revenue Projections & Milestones

### 8.1 Assumptions

- Free-to-paid conversion: 2-3% (industry standard for open-core; Grafana converts ~1%, but Hyperion's broader toolset increases stickiness)
- Average Pro revenue per user: $15/month blended (mix of self-hosted $12 and cloud $29)
- Enterprise deals: $8K/year average (3-5 deals in year 1)
- AI usage: $2/user/month average overage
- Growth: 50% month-over-month for first 6 months (aggressive but achievable with HN/PH launches), then 20% MoM

### 8.2 Year 1 Projection

| Month | Free Users | Pro Users | Enterprise | MRR | Notes |
|-------|-----------|-----------|------------|-----|-------|
| 1 | 200 | 0 | 0 | $0 | Launch month, free only |
| 2 | 500 | 5 | 0 | $75 | HN/PH launch spike |
| 3 | 1,200 | 15 | 0 | $225 | Homelab community traction |
| 4 | 2,000 | 35 | 0 | $525 | Pro tier launches |
| 5 | 3,000 | 60 | 0 | $900 | Plugin marketplace beta |
| 6 | 5,000 | 100 | 1 | $2,167 | First enterprise deal |
| 7 | 6,500 | 140 | 1 | $2,767 | Content marketing momentum |
| 8 | 8,000 | 190 | 2 | $4,183 | Cloud-hosted tier launches |
| 9 | 10,000 | 250 | 2 | $4,417 | Education partnerships |
| 10 | 12,000 | 320 | 3 | $6,800 | Enterprise pipeline matures |
| 11 | 15,000 | 400 | 3 | $8,000 | Referral program impact |
| 12 | 20,000 | 500 | 4 | $10,167 | Year 1 close |

**Year 1 Total Revenue: ~$40-50K**
**Year 1 ARR (annualized from Month 12): ~$122K**

### 8.3 Key Milestones

| Milestone | Target Date | Success Metric |
|-----------|------------|----------------|
| Public launch | Month 1 | 200 GitHub stars, 100 installs |
| HN front page | Month 2 | 500 stars in 48 hours |
| Plugin marketplace beta | Month 5 | 10 community plugins |
| First enterprise deal | Month 6 | $8K annual contract |
| 1,000 GitHub stars | Month 6 | Organic growth momentum |
| Cloud-hosted launch | Month 8 | 50 cloud subscribers |
| 5,000 GitHub stars | Month 12 | Top-of-mind in self-hosted |
| $10K MRR | Month 12 | Sustainable business threshold |
| 20,000 free users | Month 12 | Community critical mass |

---

## 9. Execution Roadmap

### Phase 1: Foundation (Months 1-3)

**Engineering:**
- [ ] License key validation service (`services/license.js`)
- [ ] Feature gate middleware (`services/featureGate.js`)
- [ ] Multi-user auth upgrade (user management UI, invite flow)
- [ ] Docker image on Docker Hub + GitHub Container Registry
- [ ] ARM64 build verification
- [ ] One-line install script (`curl -fsSL https://hyperion.dev/install | sh`)
- [ ] GitHub Actions CI/CD pipeline for releases

**Marketing:**
- [ ] Landing page at `hyperion.dev`
- [ ] GitHub README overhaul (GIF demos, feature list, install instructions)
- [ ] Show HN submission
- [ ] Product Hunt launch
- [ ] 3 comparison pages (vs Portainer, vs Cockpit, vs Webmin)
- [ ] Discord server launch

**Community:**
- [ ] CONTRIBUTING.md with plugin/skill development guide
- [ ] 20 "good first issue" labels
- [ ] Plugin template repository
- [ ] First 3 example plugins

### Phase 2: Monetization (Months 4-6)

**Engineering:**
- [ ] Pro tier feature gates (multi-user, RBAC, SSO/LDAP, cloud backup)
- [ ] Stripe integration for self-serve Pro subscriptions
- [ ] Cloud-hosted infrastructure (managed Hyperion instances)
- [ ] Prometheus exposition format endpoint
- [ ] GitHub OAuth integration
- [ ] Slack notification webhook
- [ ] Plugin gallery web app (`plugins.hyperion.dev`)

**Marketing:**
- [ ] "Hyperion for Education" landing page
- [ ] 6 blog posts (homelab, AI, Docker, NOVA, plugins, comparison)
- [ ] 6 YouTube videos (demos + tutorials)
- [ ] Outreach to 5 homelab YouTubers
- [ ] awesome-selfhosted PR

**Sales:**
- [ ] Enterprise landing page with "Contact Sales" form
- [ ] 3 enterprise prospect conversations
- [ ] Pro trial flow (14-day, no credit card)

### Phase 3: Scale (Months 7-12)

**Engineering:**
- [ ] Enterprise features (SAML, HA, compliance, white-label)
- [ ] AI add-on (managed LLM proxy, usage tracking, billing)
- [ ] Kubernetes dashboard integration
- [ ] AWS/GCP cloud resource viewer
- [ ] VS Code extension ("Open in Hyperion")
- [ ] Dashboard sharing with public URLs
- [ ] Template import/export system
- [ ] PostgreSQL/MySQL DB explorer expansion

**Marketing:**
- [ ] Case studies from 3 Pro customers
- [ ] Conference talk submissions (FOSDEM, local meetups)
- [ ] Monthly community showcase video
- [ ] SEO content: 5 use-case landing pages
- [ ] Documentation site launch (`docs.hyperion.dev`)

**Sales:**
- [ ] Enterprise sales pipeline (target: 5 deals)
- [ ] Referral program launch
- [ ] Education partnership with 3 bootcamps
- [ ] Channel partner exploration (MSPs, hosting providers)

---

## Appendix A: Competitive Pricing Reference

| Product | Free Tier | Paid Start | Enterprise |
|---------|-----------|------------|------------|
| Portainer CE/BE | Free (5 nodes) | ~$120/year (starter) | $5-15K/year |
| Grafana OSS/Cloud | Free (3 users) | $29/month | Custom |
| GitLab Free/Premium | Free (5 users) | $29/user/month | $99/user/month |
| Coolify | Free (self-hosted) | $5/month (cloud) | N/A |
| code-server | Free (self-hosted) | N/A | Coder: $25/user/month |
| **Hyperion (proposed)** | **Free (single user)** | **$12/user/month** | **$5-15K/year** |

## Appendix B: License Key Technical Design

```
License JWT payload:
{
  "sub": "org_abc123",           // Organization ID
  "tier": "pro",                  // "pro" | "enterprise"
  "seats": 10,                    // Max concurrent users
  "features": [                   // Explicit feature flags
    "multi_user",
    "rbac_custom",
    "sso_ldap",
    "cloud_backup",
    "audit_export",
    "prometheus_export",
    "dashboard_sharing",
    "custom_branding"
  ],
  "ai_credits_monthly": 500,     // AI interaction credits
  "exp": 1735689600,             // Expiration timestamp
  "iss": "hyperion.dev"          // Issuer
}

Signed with RS256 (asymmetric). Public key embedded in Hyperion binary.
License validated on startup + every 24 hours.
Grace period: 7 days after expiration before feature downgrade.
Offline-capable: no phone-home required for self-hosted.
```

## Appendix C: Key Decisions and Rationale

**Q: Why not fully closed-source Pro?**
A: The self-hosted developer audience deeply distrusts closed-source tools. MIT license for core ensures trust and adoption. Feature gates on collaboration/enterprise features (not individual productivity features) means no developer feels "nickel-and-dimed."

**Q: Why not pure SaaS?**
A: Hyperion's identity is self-hosted ("Your computer, unleashed"). Cloud-hosted is an additional revenue stream, not the primary one. Self-hosted-first builds community trust and avoids the Heroku/Vercel pricing backlash.

**Q: Why usage-based for AI?**
A: LLM API calls have real marginal cost. Usage-based pricing aligns cost with value and avoids subsidizing heavy AI users from light users. Bundled credits in Pro/Enterprise prevent bill shock for moderate users.

**Q: Why $12/user/month for Pro?**
A: Below Portainer BE ($10-15/node), below GitLab Premium ($29/user), above the psychological "impulse buy" threshold. $12 x 5 developers = $60/month, which is trivially approvable by any team lead without executive sign-off. The goal is frictionless adoption.

**Q: What prevents someone from forking and removing the paywall?**
A: Nothing, and that is fine. MIT license means anyone can. In practice, forks do not get security updates, plugin compatibility, community support, or the managed AI tier. Grafana and GitLab both proved that open-core with a strong community is defensible even against forks. The real moat is velocity of development + community + brand.

---

*This playbook should be revisited quarterly. Pricing, tier boundaries, and growth strategies should adapt based on actual conversion data, community feedback, and competitive moves.*
