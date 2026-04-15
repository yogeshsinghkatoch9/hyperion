# Phase 2: Master Roadmap — Hyperion Improvement Plan

## TIER 1 — BUILD NOW (highest impact, feasible in hours)

### 1. Sidebar Navigation Overhaul
**Source**: Design Audit (P11 — CRITICAL), all agents flagged this
- Group 62 nav items into 8 collapsible categories
- Add favorites/pinned section at top
- Add recently-used section
- Inline search filter (type to filter nav items)
- Keyboard navigation (arrow keys, type-ahead)

### 2. Command Palette Enhancement (Cmd+K)
**Source**: Design Audit, Feature Ideas, Delight
- Already exists — enhance with fuzzy search
- Add recent commands, action shortcuts
- Make it the primary navigation method

### 3. Security Hardening — Critical Fixes
**Source**: Technical Audit (CRITICAL-01 through CRITICAL-06)
- Enable CSP by default
- Add CSRF token middleware
- Fix command injection in SSH/process manager/docker (use spawn, not execSync)
- Block private IPs in load tester (SSRF)
- Fix SSH StrictHostKeyChecking

### 4. Performance: Replace execSync on Hot Paths
**Source**: Technical Audit (PERF-01, PERF-02)
- System monitor: replace `execSync('netstat')` with async child_process
- Replace all hot-path execSync calls with spawn/exec async

### 5. Boot Animation & Micro-Interactions
**Source**: Delight Agent (Tier 1)
- Terminal-style boot sequence animation (CSS only)
- Page transition animations (120ms exit, 180ms enter)
- Button hover glow effects
- Success/error toast animations

### 6. Theme System — Sci-Fi Named Themes
**Source**: Delight Agent, Design Audit
- 8 named themes (HAL, JARVIS, LCARS, Wintermute, etc.)
- Fix `--green: #DA7756` naming → `--accent`
- Full light mode polish
- Theme preview in settings

### 7. Onboarding Redesign
**Source**: Design Audit (P1-P5), Delight Agent
- Interactive onboarding with real tool interaction
- Run a real terminal command
- Ask the AI a question
- See live system metrics
- 60-second time-to-value

### 8. Database Indexes
**Source**: Technical Audit (PERF-05)
- Add missing indexes to 15+ tables
- Index frequently-queried columns (created_at, user_id, agent_id)

### 9. Achievement System
**Source**: Delight Agent
- Track milestones (first terminal command, first AI conversation, etc.)
- Toast notifications with gold borders
- Stored in SQLite

### 10. Loading States & Empty States
**Source**: Technical Audit (MISS-01, MISS-02)
- Skeleton loaders for all pages
- Meaningful empty states with CTAs
- Error states with retry buttons

---

## TIER 2 — BUILD TODAY (high impact, medium complexity)

### 11. Frontend Modularization — Phase 1
- Split hyperion.js into page modules (lazy-loaded)
- Split hyperion.css into component files
- Dynamic import() for page loaders

### 12. Intent-Based Computing (AI Plan-Execute)
**Source**: Feature Ideas (#2, score 90)
- Natural language → execution plan DAG
- Show editable plan before executing
- Rollback support

### 13. Ambient Context Engine
**Source**: Feature Ideas (#3, score 90)
- Passively observe terminal/file/API activity
- Build context graph for AI assistant
- "AI already knows what you're working on"

### 14. Executable Runbooks
**Source**: Feature Ideas (#8, score 72)
- Markdown with executable code blocks
- Run in correct context (terminal, SSH, HTTP)
- Results inline, versioned, shareable

### 15. Security Posture Dashboard
**Source**: Feature Ideas (#11, score 64)
- Scan open ports, exposed secrets, outdated deps
- Traffic-light scoring
- AI remediation suggestions

### 16. RBAC Enforcement on All Routes
**Source**: Technical Audit (SEC-06)
- Viewer role should NOT access code execution, Docker, processes
- Add permission checks per route
- Admin-only routes for sensitive operations

### 17. Predictive Command Completion
**Source**: Feature Ideas (#6, score 72)
- Ghost commands in terminal based on history + context
- Time-of-day and directory-aware predictions

### 18. Service Worker & PWA
**Source**: Product Analysis, Design Audit
- Proper offline caching strategy
- App-like install experience
- Push notifications for alerts

### 19. Mobile Bottom Navigation
**Source**: Design Audit (P18)
- 5-item bottom nav for core tools
- Touch-optimized terminal
- Responsive layout overhaul

### 20. Smart Alerts with Context
**Source**: Feature Ideas (#22, score 56)
- Correlate events across services
- Causal chain reconstruction
- AI-generated incident summaries

---

## TIER 3 — BUILD THIS WEEK (visionary, complex)

### 21. Cross-Machine Mesh
### 22. Self-Healing Infrastructure
### 23. Temporal Undo/Redo (System Time-Travel)
### 24. Multiplayer Terminal
### 25. Live Environment Diffing
### 26. AI Code Archaeologist
### 27. Terminal Session Branching
### 28. Data Pipeline Builder (Visual)
### 29. Performance Flame Graph Generator
### 30. Voice-Controlled Operations

---

## Implementation Order (Top 20)

Starting with highest-impact, lowest-effort items:

| Priority | Item | Est. Effort | Impact |
|:---:|---|---|---|
| 1 | Sidebar Nav Overhaul | 2-3 hours | Fixes #1 UX problem |
| 2 | Security Critical Fixes | 2-3 hours | Fixes 6 vulnerabilities |
| 3 | Boot Animation + Micro-Interactions | 1-2 hours | Instant wow factor |
| 4 | Database Indexes | 30 min | Free perf boost |
| 5 | Theme System (Sci-Fi Themes) | 1-2 hours | Delight + shareability |
| 6 | Loading/Empty States | 1-2 hours | Polish |
| 7 | Command Palette Enhancement | 1-2 hours | Power user satisfaction |
| 8 | Onboarding Redesign | 2-3 hours | First impression |
| 9 | Replace execSync Hot Paths | 1-2 hours | Perf fix |
| 10 | Achievement System | 2-3 hours | Engagement + retention |
| 11 | Frontend Split Phase 1 | 3-4 hours | Architecture |
| 12 | RBAC Route Enforcement | 2-3 hours | Security |
| 13 | Mobile Bottom Nav | 2-3 hours | Mobile users |
| 14 | Service Worker/PWA | 2-3 hours | Offline + install |
| 15 | Executable Runbooks | 4-6 hours | Novel feature |
| 16 | Intent-Based AI | 6-8 hours | Killer feature |
| 17 | Ambient Context Engine | 4-6 hours | AI differentiation |
| 18 | Security Posture Dashboard | 4-6 hours | Trust builder |
| 19 | Predictive Commands | 4-6 hours | Terminal differentiation |
| 20 | Smart Alerts | 3-4 hours | Monitoring upgrade |
