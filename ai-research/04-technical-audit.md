# Phase 4: Technical Debt & Architecture Audit -- Hyperion

**Date**: 2026-04-15
**Scope**: Full codebase audit covering security, performance, architecture, code quality, and missing basics.
**Files examined**: server.js, services/db.js, services/auth.js, services/monitor.js, services/vault.js, services/dbExplorer.js, services/ssh.js, services/netTools.js, services/docker.js, services/processManager.js, services/loadTester.js, services/envManager.js, services/remoteDesktop.js, services/metricsService.js, services/browserControl.js, services/nova.js, routes/files.js, routes/code.js, routes/ssh.js, routes/docker.js, routes/processManager.js, routes/netTools.js, routes/agents.js, routes/dbExplorer.js, routes/browser.js, routes/envManager.js, routes/loadTester.js, routes/backup.js, routes/system.js, routes/metrics.js, routes/admin.js, public/js/hyperion.js, tests/auth.test.js, plus broad grep/search across the entire codebase.

---

## Executive Summary

Hyperion has **17 critical security vulnerabilities**, **9 serious performance issues**, and **23 architecture/quality problems** that collectively represent significant technical debt. The most severe issues are:

1. **Command injection surfaces** in 6+ services that shell out to system commands
2. **SSRF via the load tester** -- an authenticated user can fire 10,000 HTTP requests at any internal endpoint
3. **CSP disabled by default** combined with 447 uses of `innerHTML` in an 11,700-line monolithic JS file
4. **Synchronous `execSync` calls** on hot paths (system monitor every 2 seconds, every route in processManager, monitor, docker, git)
5. **No CSRF protection** whatsoever on a session-based API
6. **Missing database indexes** on 15+ tables used in frequent queries

---

## 1. SECURITY VULNERABILITIES

### CRITICAL-01: Command Injection via SSH Command Execution
**File**: `/services/ssh.js`, lines 89-110
**Severity**: CRITICAL

The `executeCommand()` function passes user-supplied commands directly to `execSync` via shell:
```javascript
// Line 95
const output = execSync(`ssh ${args.map(a => `"${a}"`).join(' ')}`, {
```
The `command` argument on line 92 (`args.push(command)`) comes from `req.body.command` in routes/ssh.js line 62. While the host/user are sanitized, **the command itself has zero sanitization**. An attacker with a valid session can execute arbitrary commands on remote hosts, and the quoting is fragile enough that injection into the shell invocation is possible.

**Fix**: Use `spawn('ssh', args)` instead of `execSync` with string interpolation. Never pass commands through a shell.

---

### CRITICAL-02: SSRF via Load Tester
**File**: `/services/loadTester.js`, lines 36-73 and `/routes/loadTester.js`, line 12
**Severity**: CRITICAL

The load tester fires up to 10,000 HTTP requests at any URL provided by the user, with configurable concurrency up to 500. An authenticated user (even a "viewer" role) can:
- Hit internal services (169.254.169.254 for cloud metadata, localhost:3333 for Hyperion itself)
- DDoS any external target
- Enumerate internal network services

There is **no URL allowlist**, no private IP check, and no rate limit beyond the global 100req/min.

```javascript
// loadTester.js line 40 - accepts ANY URL
const parsed = new URL(urlStr);
const mod = parsed.protocol === 'https:' ? https : http;
```

**Fix**: Block requests to private IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, fd00::/8). Add rate limiting specific to load test runs. Consider restricting to admin role.

---

### CRITICAL-03: Command Injection in Process Manager
**File**: `/services/processManager.js`, lines 38-56
**Severity**: HIGH

`searchProcesses()` sanitizes the query by removing shell metacharacters, but the sanitization is incomplete:
```javascript
// Line 40 -- misses newlines, which can break out of grep
const safe = query.replace(/[`$();|&><"'\\]/g, '');
// Line 42 -- injected into shell
const output = execSync(`ps aux | grep -i "${safe}" | grep -v grep`, ...);
```
A query containing a newline character followed by a shell command would bypass the regex since `.` does not match `\n` by default. The `kill` command on line 70 also shells out via `execSync` rather than using `process.kill()`.

**Fix**: Use `process.kill(pid, signal)` directly (no shell). For search, use the already-existing `getProcesses()` function and filter in JS.

---

### CRITICAL-04: SSH Uses StrictHostKeyChecking=no
**File**: `/services/ssh.js`, line 74; `/server.js`, line 571
**Severity**: HIGH

Every SSH connection, both for saved connections and the interactive terminal, disables host key verification:
```javascript
args.push('-o', 'StrictHostKeyChecking=no');
```
This makes all SSH connections vulnerable to man-in-the-middle attacks. An attacker on the network can intercept SSH connections and capture credentials or inject commands.

**Fix**: Default to `StrictHostKeyChecking=ask` or `yes`. Store host keys in Hyperion's own known_hosts file and let users accept them through the UI.

---

### CRITICAL-05: Content Security Policy Off by Default
**File**: `/server.js`, lines 40-42
**Severity**: HIGH

CSP is gated behind an environment variable that defaults to off:
```javascript
if (process.env.CSP_ENABLED === 'true') {
  res.setHeader('Content-Security-Policy', ...);
}
```
Even when enabled, the policy allows `'unsafe-inline'` for both scripts and styles, which largely negates XSS protection. Combined with 447 uses of `.innerHTML` in the frontend, this leaves a wide XSS attack surface.

**Fix**: Enable CSP by default. Use nonces for inline scripts. Migrate away from `innerHTML` for user-generated content.

---

### CRITICAL-06: No CSRF Protection
**File**: `/server.js` (entire auth flow)
**Severity**: HIGH

The application uses session-based auth via `X-Session-Id` header, but:
- There are no CSRF tokens on any mutating endpoint
- The session ID is stored in `localStorage` and sent as a custom header, which provides some protection against classic CSRF (browsers don't auto-send custom headers)
- However, if CSP is off (the default), an XSS vulnerability can read localStorage and exfiltrate the session ID

The combination of **no CSP + no CSRF + XSS surface** creates a chain where one XSS vulnerability grants full account takeover.

**Fix**: Enable CSRF tokens for state-changing operations, or at minimum ensure CSP is on by default to prevent the XSS -> session theft chain.

---

### HIGH-01: Arbitrary SQL Execution via DB Explorer
**File**: `/services/dbExplorer.js`, lines 198-238; `/routes/dbExplorer.js`, line 79
**Severity**: HIGH

The DB Explorer allows execution of arbitrary SQL against any connected SQLite database, including Hyperion's own internal database:
```javascript
// dbExplorer.js line 210-212
const stmt = db.prepare(trimmed);
const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
```
The `connectHyperion` endpoint (line 23 of dbExplorer route) explicitly exposes Hyperion's own DB. Any authenticated user can:
- Read password hashes from the `users` table
- Read TOTP secrets from `totp_secrets`
- Read vault encryption salts from `vault_config`
- Modify sessions, roles, or any other data

**Fix**: Add admin-only restriction to DB Explorer routes. Block access to sensitive tables (users, totp_secrets, vault_config, sessions). Or at minimum, force Hyperion DB connections to read-only mode.

---

### HIGH-02: Code Execution Without Role Restriction
**File**: `/routes/code.js`, lines 50-135, 138-158
**Severity**: HIGH

The code runner `/api/code/run` and raw shell executor `/api/code/exec` allow ANY authenticated user to:
- Execute arbitrary code in 17+ languages
- Run raw shell commands via `bash -c <user_input>`
- Install packages globally via `/api/code/install`

There is **no role check** -- even a "viewer" role can run code. The package install endpoint accepts package names without validation:
```javascript
// Line 193 -- unvalidated package name
const cmds = {
  pip: ['pip3', ['install', pkg]],
  npm: ['npm', ['install', '-g', pkg]],
```

**Fix**: Restrict code execution and package install to admin role. Consider sandboxing (Docker containers, nsjail).

---

### HIGH-03: Browser Control Exposes Arbitrary JS Evaluation
**File**: `/routes/browser.js`, lines 39-53
**Severity**: HIGH

The `/api/browser/action` endpoint with `action: 'evaluate'` allows execution of arbitrary JavaScript in a Chrome browser session:
```javascript
case 'evaluate': result = await browser.evaluate(js); break;
```
Combined with the navigate endpoint, this gives any authenticated user a full server-side browser they can use for:
- Accessing internal services behind the firewall
- Scraping authenticated web apps
- Reading local files via `file://` protocol

**Fix**: Restrict to admin role. Block `file://` protocol in navigation. Consider whether this feature needs to exist.

---

### HIGH-04: Env Manager Has No Path Restriction
**File**: `/routes/envManager.js`, lines 6-53; `/services/envManager.js`
**Severity**: HIGH

The env manager reads and writes `.env` files at any path on the filesystem:
```javascript
router.post('/read', (req, res) => {
  res.json(env.readEnvFile(req.body.path, mask));
});
router.post('/write', (req, res) => {
  res.json(env.writeEnvFile(req.body.path, req.body.entries));
});
```
There is **no path validation** like the file manager has. Any authenticated user can:
- Read any `.env` file on the system (e.g., `/etc/environment`, other apps' secrets)
- Write to any `.env` file
- Discover `.env` files across the filesystem via the `/discover` endpoint

The file manager at least restricts to the home directory. The env manager has no such guard.

**Fix**: Apply the same `validatePath()` restriction used in routes/files.js. Restrict write operations to admin role.

---

### HIGH-05: Docker Command Injection via Compose Path
**File**: `/services/docker.js`, lines 10-22, 305-340; `/routes/docker.js`, lines 224-256
**Severity**: HIGH

The docker service shells out commands with string interpolation:
```javascript
// docker.js line 12
const result = execSync(`docker ${args}`, { ... });
```

The compose endpoints pass user-provided file paths directly:
```javascript
// docker.js line 307 (inferred from route)
return execSync(`docker compose -f "${file}" up ${d}`, { ... });
```
A crafted `composePath` value could break out of the double-quote escaping and inject shell commands.

**Fix**: Use `spawn` with argument arrays instead of `execSync` with string concatenation. Validate compose file paths.

---

### HIGH-06: Metrics Endpoint Exposed Pre-Authentication
**File**: `/server.js`, line 67
**Severity**: MEDIUM

```javascript
// Line 67 -- BEFORE auth middleware on line 246
app.use('/api/metrics', require('./routes/metrics'));
```
The metrics endpoint exposes request counts, response times, memory usage, CPU usage, and uptime to unauthenticated users. The Prometheus endpoint at `/api/metrics/prometheus` provides a structured data feed.

This leaks:
- Whether the server is under load
- Response time patterns (useful for timing attacks)
- Memory/CPU usage patterns

**Fix**: Move metrics routes after the auth middleware, or add an API key check for monitoring tools.

---

### HIGH-07: Vault Master Password Has Weak Minimum (6 chars)
**File**: `/services/vault.js`, line 60
**Severity**: MEDIUM

```javascript
if (!password || password.length < 6) {
  throw new Error('Master password must be at least 6 characters');
}
```
The vault protects secrets with AES-256-GCM derived from a master password, but only enforces a 6-character minimum. With PBKDF2 at 100K iterations, a 6-character password can be brute-forced in hours on commodity hardware.

**Fix**: Require 12+ characters for the vault master password. Consider adding password strength checking (zxcvbn).

---

### MEDIUM-01: XSS Risk in Frontend innerHTML Usage
**File**: `/public/js/hyperion.js` -- 447 uses of `.innerHTML`
**Severity**: MEDIUM

The frontend uses `innerHTML` extensively (447 occurrences). An `esc()` function exists at line 1464:
```javascript
function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```
However, spot-checking reveals inconsistent usage. For example, the HTTP client renders JSON responses without escaping:
```javascript
// Line 4888 - _httpSyntaxHighlight output goes into innerHTML unescaped
content.innerHTML = `<pre class="http-response-body">${_httpSyntaxHighlight(JSON.stringify(body, null, 2))}</pre>`;
```
If `_httpSyntaxHighlight` does not properly escape HTML entities, response bodies containing `<script>` tags would execute.

**Fix**: Audit all 447 innerHTML assignments. Use `textContent` for plain text. Create a DOM builder utility instead of HTML string interpolation.

---

### MEDIUM-02: Session ID in WebSocket Query Parameters
**File**: `/services/auth.js`, lines 103-107
**Severity**: MEDIUM

WebSocket authentication passes the session ID as a URL query parameter:
```javascript
function authenticateWs(request, db) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const sid = url.searchParams.get('sid');
  return getSession(sid, db);
}
```
Session IDs in URLs get logged in server access logs, proxy logs, browser history, and referrer headers.

**Fix**: Pass session ID in the WebSocket subprotocol or in the first message after connection.

---

### MEDIUM-03: File Manager Path Traversal via Symlinks
**File**: `/routes/files.js`, lines 12-19
**Severity**: MEDIUM

The `validatePath()` function resolves the path and checks it starts with the home directory:
```javascript
resolved = path.resolve(resolved);
const home = os.homedir();
if (!resolved.startsWith(home)) return null;
```
However, this does not follow symlinks. A symlink inside the home directory pointing to `/etc` or `/` would pass validation but allow access outside the intended boundary. An attacker with file-write access (which any authenticated user has) could create a symlink and then read/write arbitrary files.

**Fix**: Use `fs.realpathSync()` to resolve symlinks before checking the path.

---

### MEDIUM-04: Agent Environment Variable Inheritance
**File**: `/routes/agents.js`, lines 175-178
**Severity**: MEDIUM

Agents inherit the full server environment:
```javascript
const agentEnv = { ...process.env };
try {
  Object.assign(agentEnv, JSON.parse(agent.env || '{}'));
} catch {}
```
This means agent scripts have access to all server environment variables, which may include API keys, database URLs, or other secrets. The user-provided env vars override server vars, potentially enabling attacks on child processes.

**Fix**: Start agents with a clean environment. Only pass explicitly whitelisted variables.

---

### MEDIUM-05: Backup Restore Could Overwrite Active Database
**File**: `/routes/backup.js`, line 33
**Severity**: MEDIUM

The backup restore endpoint allows overwriting the active Hyperion database while the server is running. There is no confirmation step, no integrity validation, and no way to abort. A corrupted or malicious backup file could destroy all data.

**Fix**: Validate backup integrity before restore. Take an automatic pre-restore backup. Consider requiring a restart to load the restored database.

---

## 2. PERFORMANCE ISSUES

### PERF-01: execSync Blocks Event Loop in System Monitor
**File**: `/server.js`, lines 741-746
**Severity**: CRITICAL

The system WebSocket handler calls `collectSystemSnapshot()` every 2 seconds. This function runs `netstat` via `execSync`, which **blocks the Node.js event loop**:
```javascript
// Line 742
const raw = execSync("netstat -ib 2>/dev/null | awk 'NR>1 && $1!~/lo/{in+=$7;out+=$10}END{print in,out}'",
  { encoding: 'utf8', timeout: 2000 }).trim();
```
On a busy system, `netstat -ib` can take 500ms+, and this runs every 2 seconds per connected WebSocket client. With 3 clients, the event loop is blocked ~750ms out of every 2 seconds.

Battery check (line 759) also uses `execSync` with `pmset -g batt`.

**Fix**: Replace `execSync` with `exec` (async) or `spawn`. Cache results for 2 seconds so multiple clients share one lookup. Better: read from `/proc/net/dev` (Linux) or use the `os.networkInterfaces()` API.

---

### PERF-02: 11,700-Line Single JavaScript File
**File**: `/public/js/hyperion.js` -- 11,700 lines
**Severity**: HIGH

The entire frontend application is a single 11,700-line JavaScript file loaded eagerly on every page visit. There is:
- No code splitting
- No lazy loading
- No minification
- No tree shaking
- No module system (everything is global functions)

The CSS is similarly a single 4,425-line file. Initial page load requires downloading and parsing ~16,000 lines of unminified code.

**Fix**: Split into modules using ES modules or a bundler (Vite, esbuild). Lazy-load tool-specific code. Add minification for production builds.

---

### PERF-03: Monitor Service Runs execSync on Every Snapshot
**File**: `/services/monitor.js`, lines 29-81
**Severity**: HIGH

`getProcesses()` has a 1.5-second cache but calls `execSync('ps -eo pid,ppid,user,...')` which produces megabytes of output on a system with hundreds of processes (10MB maxBuffer). The `getFullSnapshot()` function (line 488) calls multiple `execSync` commands sequentially: `ps`, `df -h`, potentially `du`.

The live monitoring WebSocket (line 548) calls `getFullSnapshot()` every 2 seconds, which means:
- `ps` via execSync (blocking, 100-500ms)
- `df` via execSync (blocking, 50-200ms)
- Total: 150-700ms of blocking per 2-second interval

**Fix**: Use async `exec()`. Cache `ps` output for 2+ seconds. Use `os` module for memory/CPU instead of shell commands where possible.

---

### PERF-04: Missing Database Indexes on Frequently-Queried Tables
**File**: `/services/db.js`
**Severity**: HIGH

The following tables have **no indexes** beyond their primary key, despite being queried with WHERE clauses:

| Table | Missing Index | Query Pattern |
|---|---|---|
| `agents` | `status` | `WHERE status = 'running'` (server.js:867) |
| `agent_logs` | `agent_id` (has FK but no explicit index) | `WHERE agent_id = ?` (agents.js:115) |
| `command_history` | `created_at` | `ORDER BY created_at DESC` (code.js:164) |
| `notebooks` | `updated_at` | `ORDER BY updated_at` |
| `conversations` | `user_id`, `created_at` | Vector search queries |
| `canvas_items` | `user_id` | `WHERE user_id = ?` |
| `channels` | `status` | `WHERE status = 'running'` |
| `http_history` | `created_at` | `ORDER BY created_at DESC` |
| `ws_messages` | `conn_id` | `WHERE conn_id = ?` |
| `cron_runs` | `agent_id` | `WHERE agent_id = ?` |
| `clipboard_items` | `created_at` | `ORDER BY created_at` |
| `quick_notes` | `pinned`, `updated_at` | Sort by pin status and date |
| `bookmarks` | `created_at` | `ORDER BY created_at DESC` |
| `mock_endpoints` | `active` | `WHERE active = 1` |
| `dashboard_widgets` | `user_id` | `WHERE user_id = ?` |

Only `audit_logs`, `analytics_events`, `file_versions`, `webhook_deliveries`, `sessions`, `login_history`, `api_keys`, and `metrics_snapshots` have proper indexes.

**Fix**: Add indexes for all frequently-queried columns. At minimum: `agent_logs(agent_id)`, `command_history(created_at)`, `conversations(user_id)`, `http_history(created_at)`.

---

### PERF-05: Unbounded Query Results in Multiple Routes
**File**: Multiple route files
**Severity**: MEDIUM

Several routes fetch all rows from tables with no pagination:
- `/routes/code.js` line 171: `SELECT * FROM snippets ORDER BY created_at DESC` (no LIMIT)
- `/routes/agents.js` line 96: `SELECT * FROM agents ORDER BY created_at DESC` (no LIMIT)
- `/services/dbExplorer.js` line 278: `SELECT * FROM saved_queries ORDER BY created_at DESC` (no LIMIT)
- `/routes/docker.js` -- All container/image/volume/network listing endpoints have no pagination

For a user with hundreds of agents, snippets, or Docker containers, these queries return unbounded result sets.

**Fix**: Add default LIMIT and pagination to all list endpoints.

---

### PERF-06: File Search Does Synchronous Recursive Directory Walk
**File**: `/routes/files.js`, lines 224-258
**Severity**: MEDIUM

The file search endpoint recursively walks directories using synchronous `fs.readdirSync` and `fs.readFileSync` (for content search). For content search, it reads entire files into memory:
```javascript
// Line 240 -- reads entire file into memory
const content = fs.readFileSync(fullPath, 'utf-8');
```
With a depth limit of 5 and no file size limit on the content search, this can read hundreds of megabytes of files synchronously, blocking the event loop.

**Fix**: Use async `fs.promises.readdir` and `fs.promises.readFile`. Add file size limit for content search. Consider using a streaming approach or `ripgrep` subprocess.

---

### PERF-07: Docker Service Uses execSync for Every Operation
**File**: `/services/docker.js`, lines 10-22
**Severity**: MEDIUM

Every Docker API call shells out synchronously:
```javascript
function dockerExec(args, timeout = 15000) {
  try {
    const result = execSync(`docker ${args}`, { ... });
```
Docker operations can be slow (1-30 seconds for image pulls, stats collection). These block the entire Node.js process.

**Fix**: Use Docker Engine API over HTTP socket (`/var/run/docker.sock`) with async HTTP calls, or use `exec`/`spawn` for async operations.

---

### PERF-08: Port Scan Creates Thousands of Sequential Connections
**File**: `/services/processManager.js`, lines 156-172; `/services/monitor.js`, lines 280-336
**Severity**: MEDIUM

Port scanning creates TCP connections in batches of 50, but scans up to 1024 ports:
```javascript
// processManager.js line 159
if (end - start > 1000) throw new Error('Port range too large (max 1000)');
```
That is still 1000 TCP connections, taking 20 batches * ~2 seconds timeout = 40+ seconds of operation. During this time, the server is responsive but consuming many sockets.

**Fix**: Reduce default range. Add abort capability. Consider using the existing `lsof` output instead of active scanning for local ports.

---

### PERF-09: In-Memory Rate Limit Maps Never Shrink Under Load
**File**: `/server.js`, lines 103-121, 221-243
**Severity**: LOW

The login and API rate limit Maps are cleaned every 5 minutes, but under a DDoS with many unique IPs, the Maps grow unbounded during each 5-minute window:
```javascript
const loginAttempts = new Map();
const apiRateLimit = new Map();
```
With 100K unique IPs in 5 minutes, these Maps consume ~50MB of memory.

**Fix**: Use a bounded LRU cache or a sliding window counter with a fixed-size array.

---

## 3. ARCHITECTURE PROBLEMS

### ARCH-01: 938-Line God Server File
**File**: `/server.js` -- 938 lines
**Severity**: HIGH

`server.js` is the entry point and contains:
- Express app setup (lines 1-65)
- CORS handling (lines 47-57)
- Rate limiting (lines 102-243)
- All auth endpoints (lines 124-301)
- All 67 route mounts (lines 307-382)
- SPA fallback (lines 385-394)
- Error handler (lines 391-394)
- WebSocket upgrade handler (lines 397-420)
- PTY terminal handler (lines 469-497)
- Python PTY fallback (lines 500-550)
- SSH terminal handler (lines 553-610)
- Remote desktop handler (lines 613-634)
- Monitor WebSocket handler (lines 637-648)
- Notebook collaboration handler (lines 651-709)
- System history ring buffer (lines 711-807)
- System WebSocket stream (lines 809-823)
- Service initialization (lines 826-884)
- Graceful shutdown (lines 907-928)

This makes changes risky (one mistake breaks everything) and review difficult.

**Fix**: Extract WebSocket handlers into `services/wsHandlers.js`. Move auth endpoints into `routes/auth.js`. Move rate limiting into a middleware module. Move system monitoring into the existing monitor service.

---

### ARCH-02: No Dependency Injection -- Global DB Access Pattern
**File**: All route and service files
**Severity**: MEDIUM

The database is passed through `req.app.locals.db` in routes and through function parameters in services. But some services use module-level state:
- `services/auth.js` -- `_memSessions` Map (line 6)
- `services/vault.js` -- `_derivedKey` (line 17)
- `services/monitor.js` -- `_processCache` (line 12), `monitorClients` (line 525)
- `services/dbExplorer.js` -- `connections` Map (line 10)

This makes testing difficult (can't easily substitute mocks) and creates hidden coupling between modules.

**Fix**: Use a dependency injection pattern or at minimum pass `db` through a factory function. Avoid module-level mutable state.

---

### ARCH-03: No Input Validation Framework
**File**: All route files
**Severity**: MEDIUM

Input validation is ad hoc -- each route handler manually checks `req.body` fields:
```javascript
// routes/admin.js line 33
if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
```

There is no schema validation (no Joi, Zod, or express-validator). This leads to:
- Inconsistent error messages
- Missing validation on many endpoints
- No type coercion or sanitization

**Fix**: Add a validation library (Zod is lightweight and TypeScript-friendly). Create middleware that validates `req.body` against a schema before the handler runs.

---

### ARCH-04: Inconsistent Error Handling Patterns
**File**: All route files
**Severity**: MEDIUM

Error handling varies wildly across routes:

Pattern 1 -- try/catch with service delegation (ssh.js):
```javascript
try { res.json(ssh.saveConnection(req.app.locals.db, req.body)); }
catch (e) { res.status(400).json({ error: e.message }); }
```

Pattern 2 -- async/await with try/catch (browser.js):
```javascript
try { await browser.navigate(url); res.json({ ok: true, ...info }); }
catch (err) { res.status(500).json({ error: err.message }); }
```

Pattern 3 -- no error handling at all (processManager.js):
```javascript
router.get('/search', (req, res) => {
  res.json(pm.searchProcesses(req.query.q || ''));
});
```

Pattern 4 -- inconsistent status codes -- some routes return 400 for not-found, others return 404, others return 500.

**Fix**: Create an `asyncHandler` wrapper that catches promise rejections. Standardize error response format. Use consistent HTTP status codes.

---

### ARCH-05: Viewers Can Perform Admin-Level Operations
**File**: `/server.js`, line 246; all routes
**Severity**: HIGH

The auth middleware only checks that a session exists -- it does not check roles:
```javascript
app.use('/api/', auth.requireAuth);
```

Only `/routes/admin.js` applies `requireAdmin`. All other routes (code execution, process killing, file deletion, Docker management, SSH connections, vault access, env file reading) are accessible to ANY authenticated user, including "viewer" role.

**Fix**: Create route-level permission middleware. Map features to required roles. At minimum: make code execution, process management, file write, Docker, SSH, vault, and env routes admin-only.

---

### ARCH-06: No Request-Level Database Transactions
**File**: Multiple routes
**Severity**: MEDIUM

Operations that span multiple database writes have no transaction wrapping:
```javascript
// routes/agents.js lines 281-283 -- two deletes, no transaction
db.prepare('DELETE FROM agent_logs WHERE agent_id = ?').run(req.params.id);
db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
```
If the server crashes between the first and second delete, the data is inconsistent.

**Fix**: Wrap multi-statement operations in `db.transaction()` calls.

---

### ARCH-07: WebSocket Authentication Bypass Window
**File**: `/server.js`, lines 410-415
**Severity**: MEDIUM

```javascript
const session = auth.authenticateWs(request, db);
if (!session && auth.hasUsers(db)) {
  socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
  socket.destroy();
  return;
}
```
If no users exist (fresh install), WebSocket connections are allowed without authentication. This is intended for first-time setup, but creates a race condition: if a server is deployed but no admin has completed setup yet, anyone can connect to the terminal WebSocket and execute commands.

**Fix**: Require setup completion before allowing any WebSocket connections.

---

### ARCH-08: No Graceful Degradation for Optional Dependencies
**File**: `/server.js`, lines 432-443
**Severity**: LOW

`node-pty` failure is handled gracefully, but other optional services fail silently:
```javascript
// Line 827
try { require('./services/rbac').seedRoles(db); } catch {}
```
Empty catch blocks hide initialization failures. If RBAC fails to seed, users get no error -- they just have no roles. If plugin loading fails, plugins silently don't load.

**Fix**: Log warnings when optional services fail. Distinguish between "not available" and "failed to initialize."

---

## 4. CODE QUALITY ISSUES

### QUALITY-01: 20+ Services Use execSync for Shell Commands
**Files**: services/processManager.js, services/docker.js, services/ssh.js, services/netTools.js, services/monitor.js, services/remoteDesktop.js, services/git.js, services/nova.js, services/cron.js, services/devToolkit.js, services/doctor.js, services/windowManager.js, services/healthCheck.js, services/fileVersioning.js, services/fts.js, services/workflowEngine.js, services/regexTester.js, services/linkChecker.js, services/depAuditor.js
**Severity**: MEDIUM

Grep found 20 service files using `execSync`. This is the single most pervasive anti-pattern in the codebase. Every synchronous shell command blocks the Node.js event loop, and string interpolation in shell commands creates injection vectors.

**Fix**: Create a utility function `execAsync(cmd, args, opts)` that wraps `child_process.spawn` with proper argument array handling (no shell). Migrate all callsites.

---

### QUALITY-02: Swallowed Errors Throughout Codebase
**File**: Multiple files -- server.js, routes/agents.js, services/monitor.js, etc.
**Severity**: MEDIUM

Empty catch blocks are extremely common:
```javascript
try { logInsert.run(agent.id, 'stdout', msg); } catch {}  // agents.js:213
try { ws.send(JSON.stringify({ type: 'output', data })); } catch {}  // server.js:485
try {} catch {}  // Dozens more throughout
```

These hide bugs. A failing database insert, a broken WebSocket, or a corrupt JSON payload all get silently ignored.

**Fix**: At minimum, add `catch (e) { logger.debug('...', e) }` to all error-swallowing catch blocks. For database operations, consider whether the error should propagate.

---

### QUALITY-03: Duplicate Functionality Across Services
**Severity**: MEDIUM

Several services duplicate the same logic:
- `services/processManager.js` and `services/monitor.js` both implement process listing, killing, and port scanning
- `routes/system.js` and `services/monitor.js` both implement process listing and network info
- `services/processManager.js` lines 10-36 and `services/monitor.js` lines 29-81 both parse `ps` output with nearly identical code
- `services/monitor.js` `formatUptime()` and `services/processManager.js` `formatUptime()` are duplicated

**Fix**: Consolidate into a single `systemInfo` service. Remove the duplicates.

---

### QUALITY-04: Test Coverage Gaps
**File**: `/tests/` directory
**Severity**: MEDIUM

Tests exist for 20+ service modules (auth, rbac, session, audit, etc.), but there are no tests for:
- Any route handler (no integration tests)
- The 11,700-line frontend
- WebSocket handlers
- The code runner/executor
- The file manager path validation
- The SSH/Docker/process management services
- The NOVA language engine
- Input validation edge cases

The existing tests are unit tests with mocked dependencies, which means they don't catch issues at the integration boundary (e.g., route -> service -> database).

**Fix**: Add integration tests for critical paths: auth flow, file operations, code execution. Add security-specific tests (path traversal, command injection payloads).

---

### QUALITY-05: Inconsistent Module Patterns
**Severity**: LOW

Services use different export patterns:
- `module.exports = function(db) { ... }` (db.js -- factory pattern)
- `module.exports = { fn1, fn2 }` (most services -- object of functions)
- `module.exports = router` (all routes)
- Some services use closures over module state (vault.js with `_derivedKey`)
- Some services use `require()` inside functions (server.js lines 166, 184, 250, 251)

**Fix**: Standardize on one pattern. For stateful services, use a class or explicit factory. Move `require()` calls to the top of files.

---

### QUALITY-06: No TypeScript, JSDoc, or Type Checking
**Severity**: LOW

The entire codebase is untyped JavaScript. Function signatures have no documentation:
```javascript
function executeQuery(connId, sql, params = []) {  // What types? What can connId be?
```
No JSDoc, no TypeScript, no `@ts-check`. This makes refactoring risky and IDE support poor.

**Fix**: Add JSDoc annotations to all public service APIs. Consider gradual TypeScript migration starting with service interfaces.

---

## 5. MISSING BASICS

### MISSING-01: No Rate Limiting on Resource-Heavy Endpoints
**File**: `/server.js`, lines 220-236
**Severity**: HIGH

The global rate limiter allows 100 requests/minute/IP, but some endpoints are orders of magnitude more expensive:
- `/api/load/run` fires up to 10,000 outbound HTTP requests
- `/api/code/run` spawns a child process
- `/api/processes/scan` opens up to 1000 TCP connections
- `/api/net/traceroute` takes 30-60 seconds of execSync
- `/api/files/search` with `type=content` reads arbitrary amounts of data from disk
- `/api/docker/images/pull` downloads potentially gigabytes

A user could fire 100 load tests per minute, generating 1 million outbound HTTP requests.

**Fix**: Add per-endpoint rate limits for expensive operations. Consider a token bucket or cost-based rate limiter.

---

### MISSING-02: No Request Size Limits Per Endpoint
**File**: `/server.js`, line 60
**Severity**: MEDIUM

```javascript
app.use(express.json({ limit: '50mb' }));
```
A 50MB JSON body limit applies to ALL endpoints. A code execution request with 50MB of code, or a canvas item with 50MB of content, would be accepted and stored in SQLite.

**Fix**: Set a conservative global limit (1MB) and raise it per-route where needed (file upload already uses multer with its own limit).

---

### MISSING-03: No Health Check for Dependencies
**File**: `/server.js`, lines 70-100
**Severity**: MEDIUM

The health endpoint checks database, disk, and memory, but does not check:
- Whether the terminal backend (node-pty or Python bridge) works
- Whether Docker is accessible (for Docker features)
- Whether Chrome is available (for browser control)
- Whether external services (if configured) are reachable

**Fix**: Add optional dependency health checks to the health endpoint.

---

### MISSING-04: No Structured Logging
**File**: `/services/logger.js`
**Severity**: MEDIUM

The logger service exists but the application uses `console.log` in several places (e.g., `remoteDesktop.js` line 72). Error objects are logged inconsistently -- sometimes `err.message`, sometimes `String(reason)`, sometimes the entire error object.

There is no request correlation ID, no structured JSON output format, and no log levels configured via environment variables.

**Fix**: Replace all `console.log` with the logger service. Add request correlation IDs. Support JSON log format for production.

---

### MISSING-05: No Database Migration System
**File**: `/services/db.js` -- 633 lines of CREATE TABLE IF NOT EXISTS
**Severity**: MEDIUM

All schema definitions use `CREATE TABLE IF NOT EXISTS`, which means:
- Adding a column to an existing table requires manual ALTER TABLE
- Schema changes cannot be tracked or rolled back
- There is no migration history
- Developers cannot tell which schema version is running

The file is 633 lines of raw SQL in a single `db.exec()` call.

**Fix**: Implement a migration system. Even a simple numbered-file approach (001_initial.sql, 002_add_column.sql) with a `migrations` table tracking applied migrations.

---

### MISSING-06: No Graceful WebSocket Error Recovery
**File**: `/server.js`, WebSocket handlers
**Severity**: LOW

When WebSocket connections drop, there is no client-side reconnection logic visible in the server code, and the server-side handlers simply delete the client from their tracking Sets/Maps. Terminal sessions, notebook collaborations, and monitor streams all silently die.

**Fix**: Implement server-sent heartbeat pings. Add client reconnection with exponential backoff. Persist terminal scroll buffer for reconnection.

---

### MISSING-07: No API Versioning
**File**: `/server.js`, all route mounts
**Severity**: LOW

All routes are at `/api/<feature>` with no version prefix. Breaking changes to the API would affect all clients simultaneously.

**Fix**: Mount routes at `/api/v1/<feature>` to enable future versioning.

---

### MISSING-08: Static Files Served Without Cache Headers
**File**: `/server.js`, line 62
**Severity**: LOW

```javascript
app.use(express.static(path.join(__dirname, 'public')));
```
No `maxAge` option means the 11,700-line JS file and 4,425-line CSS file are re-downloaded on every page visit (browser may use conditional GET, but this varies).

**Fix**: Add `maxAge: '1d'` or use content hashing in filenames for cache busting.

---

## Priority Matrix

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| P0 | CRITICAL-02: SSRF via load tester | Data breach via cloud metadata | 2h |
| P0 | CRITICAL-01: Command injection via SSH | Remote code execution | 4h |
| P0 | CRITICAL-05: CSP off by default | Enables XSS chain attacks | 1h |
| P0 | ARCH-05: Viewers can execute code | Privilege escalation | 4h |
| P0 | HIGH-02: Code exec without role check | Any user runs arbitrary code | 2h |
| P1 | HIGH-01: DB Explorer exposes internal DB | Read password hashes, TOTP secrets | 2h |
| P1 | HIGH-04: Env manager no path restriction | Read any .env file on system | 1h |
| P1 | HIGH-05: Docker command injection | Remote code execution | 4h |
| P1 | CRITICAL-06: No CSRF protection | Account takeover chain | 4h |
| P1 | PERF-01: execSync blocks event loop | Server hangs under load | 8h |
| P2 | PERF-04: Missing database indexes | Slow queries at scale | 2h |
| P2 | PERF-02: 11,700-line single JS file | Poor load times | 16h |
| P2 | QUALITY-01: 20+ services use execSync | Systemic blocking + injection risk | 24h |
| P2 | MISSING-01: No per-endpoint rate limits | Resource exhaustion | 4h |
| P3 | ARCH-01: 938-line server file | Maintenance difficulty | 8h |
| P3 | ARCH-03: No input validation framework | Inconsistent validation | 8h |
| P3 | MISSING-05: No migration system | Schema change difficulty | 8h |
| P3 | QUALITY-04: Test coverage gaps | Regression risk | 40h |

**Total estimated effort to address P0+P1**: ~32 hours
**Total estimated effort for full remediation**: ~150 hours
