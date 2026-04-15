# Hyperion: Delight & Virality Playbook

> Make every interaction unforgettable. Make users reach for the screenshot button.

---

## Table of Contents

1. [The Boot Sequence — First 5 Seconds](#1-the-boot-sequence)
2. [Micro-Interactions](#2-micro-interactions)
3. [The "Wow Moment" Pipeline](#3-the-wow-moment-pipeline)
4. [Easter Eggs & Personality](#4-easter-eggs--personality)
5. [Screenshot-Worthy Features](#5-screenshot-worthy-features)
6. [Onboarding That Hooks](#6-onboarding-that-hooks)
7. [Making It Feel Alive](#7-making-it-feel-alive)
8. [Achievement System](#8-achievement-system)
9. [Shareability Engine](#9-shareability-engine)
10. [Sound Design](#10-sound-design)
11. [Implementation Priority Matrix](#11-implementation-priority-matrix)

---

## 1. The Boot Sequence

The first 5 seconds determine whether a user thinks "this is a tool" or "this is MY tool." Hyperion already prints a beautiful ASCII banner to stdout on server start. The frontend needs to match that energy.

### 1a. Terminal-Style Startup Splash

When the app first loads (before auth), render a brief "boot sequence" animation in the main area. This should take no more than 2 seconds and should be skippable with any keypress.

```
[  0ms] HYPERION v1.0.0
[ 80ms] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[160ms] Initializing kernel ........................ OK
[240ms] Loading services (55 modules) .............. OK
[320ms] Mounting file system ....................... OK
[400ms] Starting PTY bridge ........................ OK
[480ms] Neural interface ready ..................... OK
[560ms] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[640ms] Your computer, unleashed.
[800ms] [fade to login/dashboard]
```

Each line types in with a monospaced font at ~80ms intervals. The "OK" markers appear in `--green` (#DA7756). The progress dots animate left-to-right. The whole thing uses `IBM Plex Mono` and the existing dark theme (`--bg: #1C1917`).

**Why it works:** It sets the tone instantly. This is not a web app. This is a computing platform. The boot sequence tells users they are in control of something powerful.

**Implementation:** Pure CSS animations with `@keyframes` and staggered `animation-delay`. No JS needed for the typing effect if done with clip-path reveals. Store a `hyperion_booted` flag in sessionStorage so it only shows once per session. Total JS addition: ~30 lines in `hyperion.js`.

### 1b. The Logo Pulse

On first render, the "H" logo icon in the sidebar should emit a single radial pulse — a ring of `rgba(218,119,86,0.3)` expanding outward and fading. This is the "heartbeat" that tells the user Hyperion is alive. The existing `.pulse-dot` animation in the sidebar bottom already uses this language. Extend it.

```css
@keyframes logoPulse {
  0% { box-shadow: 0 0 0 0 rgba(218,119,86,0.4); }
  70% { box-shadow: 0 0 0 12px rgba(218,119,86,0); }
  100% { box-shadow: 0 0 0 0 rgba(218,119,86,0); }
}
.logo-icon.alive { animation: logoPulse 2s ease-out 1; }
```

---

## 2. Micro-Interactions

These are the details that separate "functional" from "delightful." Each should be subtle enough that users feel them before they notice them.

### 2a. Page Transitions

Currently, `go(p)` immediately replaces `main.innerHTML`. Add a two-phase transition:

1. **Exit:** Current page fades out + slides down 6px over 120ms (`opacity: 0, transform: translateY(6px)`)
2. **Enter:** New page fades in + slides up from 6px below over 180ms (`opacity: 1, transform: translateY(0)`)

```css
.page-enter {
  animation: pageIn 180ms ease-out forwards;
}
@keyframes pageIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Total perceived delay: ~200ms. Fast enough to feel instant, slow enough to feel intentional. The existing `fadeSlide` keyframe in the CSS (used by `.nova-line`) already proves this pattern works in Hyperion.

### 2b. Button Hover Effects

The existing `.btn:hover` adds `background: var(--bg4)`. Enhance with:

- **Glow effect on accent buttons:** `.btn-green:hover` gets a subtle `box-shadow: 0 0 20px rgba(218,119,86,0.15)` — the button appears to warm up.
- **Sidebar nav press:** On `mousedown`, the active nav button scales to `0.97` for 80ms, then bounces back. Gives tactile feedback.
- **Run button pulse:** When code is executing, the `.run-btn` gets a breathing glow animation:

```css
@keyframes runPulse {
  0%, 100% { box-shadow: 0 0 8px rgba(218,119,86,0.2); }
  50%      { box-shadow: 0 0 20px rgba(218,119,86,0.4); }
}
.run-btn.running { animation: runPulse 1.5s ease-in-out infinite; }
```

### 2c. Success & Error Animations

**Success (e.g., file saved, agent created, code ran):**
- Flash a thin green line across the top of the main area (like a progress bar that fills instantly then fades)
- The success toast slides in from the right with a spring-physics bounce

**Error (already has `_showErrorToast`):**
- Add a subtle screen shake: `transform: translateX(2px)` alternating over 200ms on the relevant container
- The error border pulses red once then settles

**Copy to clipboard:**
- The button briefly transforms into a checkmark icon with a scale bounce
- A ghost of the copied text rises and fades out (like +1 in a game)

### 2d. Terminal Startup Animation

When a new terminal tab opens, before the shell prompt appears, display a brief header:

```
  HYPERION SHELL  ·  Session f7a2c1  ·  /Users/you
```

This line appears in `--text3` color above the first prompt. It contextualizes the session and makes each terminal feel like a named workspace, not just another tab.

### 2e. Input Focus Rings

The existing `form-group input:focus` uses `box-shadow: 0 0 0 3px rgba(218,119,86,0.08)`. Enhance:
- Animate the ring expansion from 0 to 3px over 150ms
- The border color transition should be slightly delayed (50ms) for a layered feel
- The assistant input box already has a beautiful focus state — replicate it to all inputs

### 2f. Skeleton Loading States

Replace blank/empty states during API calls with skeleton loaders that match the expected layout. Use CSS-only shimmer:

```css
.skeleton {
  background: linear-gradient(90deg, var(--bg3) 25%, var(--bg4) 50%, var(--bg3) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Apply to: dashboard cards, file tree items, agent cards, notebook cells, system stat cards.

---

## 3. The "Wow Moment" Pipeline

Every user should hit at least one "wow" moment within 60 seconds of landing. Here is the hierarchy of wow moments, ordered by how fast they hit.

### 3a. Instant Recognition — The Dashboard

The dashboard should feel like a mission control center. When it loads:

1. **Staggered card entrance:** Each `.sys-card` fades in with a 40ms delay between cards (not all at once). Creates a "cascade" effect.
2. **Live counters:** CPU %, memory %, and uptime should animate from 0 to their actual value over 400ms using a count-up animation. This is the "alive" signal.
3. **Sparkline charts:** The existing system history (`_sysHistory`, 60 snapshots) should render as tiny inline sparkline charts inside each card. A 60-point SVG path that updates in real-time. Users see their machine breathing.

```
  CPU                           MEMORY
  ┌──────────────────────┐      ┌──────────────────────┐
  │   23%                │      │   67%                │
  │   ▂▃▅▃▂▁▂▃▅▇▅▃▂▁▂   │      │   ▅▅▅▅▅▆▆▅▅▅▅▅▅▅▅   │
  └──────────────────────┘      └──────────────────────┘
```

### 3b. The First Terminal Command

The terminal is the core of Hyperion. The first command should feel premium.

- **Instant response:** The existing PTY bridge is already fast. Emphasize this.
- **Smart welcome:** If it is the user's first terminal session (no `hyperion_first_term` in localStorage), inject a one-line hint: `# Try: ls, htop, or ask the assistant for help`
- **Command completion glow:** When a command finishes executing, briefly flash the prompt line background with a 100ms green tint that fades. Confirms "done" visually.

### 3c. AI Answering a Question

The assistant page hero (`assistant-hero`) is already beautiful. The wow moment is response speed and presentation.

- **Typing indicator:** When the AI is generating, show a three-dot loader inside a chat bubble with the existing warm color scheme. The dots should use the `pulse` animation already defined.
- **Streaming appearance:** If responses stream in, each paragraph/code block should fade-in as it arrives, not pop in. Use the same `pageIn` animation at the paragraph level.
- **Code blocks get copy buttons** that show on hover with a slide-in from the right.
- **Command suggestions** that the user can click to auto-execute — this collapses the gap between asking and doing.

### 3d. The Command Palette

The quick launcher (`Cmd+K`) is Hyperion's power move. It searches 55+ tools instantly.

**Enhancements:**
- **Fuzzy match highlighting:** Matched characters in tool names should be highlighted in `--green`.
- **Category grouping:** Results grouped as "Pages | Recent | Commands | Settings" with thin dividers.
- **Keyboard-first:** Arrow keys + Enter should feel zero-latency. No animation on item selection — just instant highlight color swap.
- **Recent commands:** Show the last 5 navigated pages at the top before the user types anything.
- **Transition:** When selecting a result, the launcher modal should shrink-to-point toward the selected sidebar item, then the page loads. This creates a visual connection between the launcher and navigation.

---

## 4. Easter Eggs & Personality

These are the moments users screenshot and share. They should be discoverable but not intrusive.

### 4a. The 404 Page

Currently, unknown API routes return `{ error: 'Not found' }`. The frontend catch-all serves `index.html`. For actual 404 states (bad page name in `go()`), show:

```
                    ╦ ╦╔╦╗╔═╗
                    ║ ║ ║ ╠═╝
                    ╚═╝ ╩ ╩

            This page has escaped containment.

            It was last seen near /api/whoops
            at 14:23:07 UTC on a Tuesday.

            [Return to Dashboard]    [File a Report]
```

The "File a Report" button opens a pre-filled GitHub issue. The ASCII art uses the same style as the server startup banner.

### 4b. Konami Code

`Up Up Down Down Left Right Left Right B A` triggers:

1. All text on the page briefly renders in green-on-black Matrix-style for 3 seconds
2. A toast appears: `"HYPERION // GOD MODE ACTIVATED"` (purely cosmetic)
3. The sidebar pulse dot turns gold for the rest of the session
4. Unlocks a hidden "Retro" theme (amber monochrome CRT aesthetic with scanlines)

Implementation: Add a keypress sequence detector in `initGlobalKeyHandler()`. ~20 lines.

### 4c. Terminal Easter Eggs

When specific commands are typed in the Hyperion terminal:

| Command | Response |
|---------|----------|
| `hyperion` | Prints the ASCII banner from server.js |
| `hyperion version` | Shows version, build date, uptime, tool count |
| `hyperion credits` | Scrolling credits in the terminal (movie-style) |
| `hyperion matrix` | Green falling-character animation for 5 seconds |
| `hyperion neofetch` | Custom system info display styled like neofetch but with Hyperion branding |

These are handled client-side by intercepting input before sending to the PTY. They do not execute on the actual shell.

### 4d. Sci-Fi Computer Themes

Named themes that transform the entire UI personality:

| Theme Name | Inspiration | Color Scheme |
|------------|-------------|--------------|
| **Hyperion** (default) | Warm dark | `#1C1917` bg, `#DA7756` accent |
| **HAL** | 2001: A Space Odyssey | Deep black bg, red accent, calm typography |
| **JARVIS** | Iron Man | Dark blue bg, electric blue accent, HUD-style borders |
| **LCARS** | Star Trek | Black bg, warm orange/purple/blue panels, rounded corners |
| **Wintermute** | Neuromancer | Black bg, green text, heavy monospace, no rounded corners |
| **Mother** | Alien (1979) | Dark green bg, amber text, CRT scanlines, flicker effect |
| **GERTY** | Moon (2009) | Clean white bg, yellow smiley accent, minimal borders |
| **Cortana** | Halo | Dark purple bg, holographic blue accent, glass morphism |

Each theme overrides the CSS custom properties in `:root`. The settings page already supports theme switching via `localStorage.getItem('hyperion_theme')`. Extend the theme object to include all custom properties.

### 4e. Random Tips in Empty States

When a page has no content (no agents, no notebooks, no snippets), instead of a blank area, show rotating tips:

- "Press Cmd+K to find anything instantly"
- "Hyperion runs 55+ tools from a single process"
- "Try typing 'hyperion neofetch' in the terminal"
- "Connect to remote servers with SSH tunnels under Network"
- "The NOVA engine can automate multi-step tasks in plain English"

One tip per empty state, rotating on each visit. Rendered in `--text3` with the serif font for personality.

---

## 5. Screenshot-Worthy Features

These are the features users will screengrab and post to Twitter/X, HackerNews, or Discord.

### 5a. System Dashboard as Art

The dashboard should look like it belongs in a sci-fi movie control room.

**Enhancements:**
- **Radial CPU gauge:** A circular SVG gauge (not a bar) for CPU usage. The arc fills clockwise with a gradient from green to amber to red based on load. Smooth CSS transitions on updates.
- **Memory ring:** A donut chart for RAM usage with used/free segments. Hover shows exact bytes.
- **Network activity:** A real-time waveform (like an audio visualizer) showing bytes in/out. Uses the `netBytesIn`/`netBytesOut` data already collected in `collectSystemSnapshot()`.
- **Process constellation:** Top 5 processes by CPU shown as circles sized by usage, arranged in a cluster. Pure SVG, updates every 2 seconds.
- **Battery widget (macOS):** The existing `battery` data from the system snapshot rendered as a sleek battery icon with percentage and "charging" lightning bolt.

**The dashboard should have a "screenshot mode"** button that temporarily hides navigation chrome and adds a subtle watermark: "Powered by Hyperion" in the bottom-right. This makes sharing frictionless.

### 5b. Terminal Themes Gallery

The terminal already supports themes via `_termTheme`. Create a visual theme gallery in settings:

Each theme shown as a small preview card with actual terminal output rendered. Clicking applies it live. Themes:

| Name | Background | Foreground | Accent | Cursor |
|------|-----------|------------|--------|--------|
| Hyperion | `#0F0E0D` | `#F5EFE6` | `#DA7756` | Block, amber |
| Tokyo Night | `#1a1b26` | `#a9b1d6` | `#7aa2f7` | Line, blue |
| Dracula | `#282a36` | `#f8f8f2` | `#bd93f9` | Block, purple |
| Solarized | `#002b36` | `#839496` | `#b58900` | Block, yellow |
| Monokai | `#272822` | `#f8f8f2` | `#a6e22e` | Block, green |
| Nord | `#2e3440` | `#d8dee9` | `#88c0d0` | Block, cyan |
| Gruvbox | `#282828` | `#ebdbb2` | `#fabd2f` | Block, yellow |
| Catppuccin | `#1e1e2e` | `#cdd6f4` | `#cba6f7` | Block, mauve |

### 5c. AI Conversation Beauty

When the assistant generates a response with code, render it in a styled code block with:
- Language label in the top-right corner
- Syntax highlighting (even basic keyword highlighting adds a lot)
- Copy button with a smooth checkmark animation
- "Run in Terminal" button for shell commands
- "Open in Code Runner" button for code snippets

This turns every AI interaction into something worth sharing.

### 5d. Workflow Visualizer

The workflows page should render workflows as a visual node graph:
- Each step is a rounded rectangle with an icon
- Connections shown as curved lines between nodes
- Running steps pulse with the `runPulse` animation
- Completed steps have a checkmark overlay
- Failed steps have a red border with a shake animation

Even a simple linear layout (step1 -> step2 -> step3) with arrows looks impressive.

---

## 6. Onboarding That Hooks

The existing `showOnboarding()` in `hyperion.js` (lines 263-307) has 4 steps. It works but is text-heavy. Here is how to make it unforgettable.

### 6a. Interactive Steps, Not Slides

Replace passive text with interactive micro-tasks:

**Step 1: "Say hello"**
- Embed a mini terminal in the onboarding card
- User types `echo "hello"` and sees the response
- Text: "This terminal is real. Full PTY access to your machine."
- Wow factor: The user just ran a real command during onboarding

**Step 2: "Ask anything"**
- Embed the assistant input
- User types a question, gets a real AI response
- Text: "55+ tools. One brain. Ask it to find files, write code, or explain errors."

**Step 3: "See your machine"**
- Auto-show the system dashboard with live CPU/memory
- Counters animate from 0 to real values
- Text: "Real-time vitals. Your computer has never looked this good."

**Step 4: "Make it yours"**
- Theme picker (already exists)
- Terminal theme preview
- "Choose your callsign" — set display name
- Text: "Hyperion adapts to you."

### 6b. Progressive Disclosure

After onboarding, do not show all 55+ sidebar items at once. Start with the core 8:

1. Dashboard
2. Assistant
3. Terminal
4. Code Runner
5. Files
6. Notebooks
7. Agents
8. Settings

Show a "More Tools" expandable section for the rest. As the user uses tools from the expanded section, they automatically graduate to the main list. This prevents overwhelm while still making everything accessible.

Store the user's "discovered tools" in localStorage. After 2 weeks or 20 discovered tools, expand everything permanently.

### 6c. Quick Wins

Design the first 60 seconds to deliver rapid dopamine hits:

- **0-10s:** Boot animation plays. User feels something special is happening.
- **10-20s:** Account creation. Single form. Instant.
- **20-30s:** Interactive onboarding step 1. User runs a real terminal command.
- **30-45s:** Onboarding step 2. User asks the AI something and gets a real answer.
- **45-55s:** System dashboard appears with live metrics animating in.
- **55-60s:** User is on the dashboard, sidebar is visible, pulse dot is green. They own this.

---

## 7. Making It Feel Alive

Hyperion should never feel static. Even when idle, subtle indicators should convey that the system is running, watching, and ready.

### 7a. The System Pulse

The existing `.pulse-dot` in the sidebar (green dot, 2s pulse animation) is great. Extend this concept:

- **Pulse rate reflects system load:** At 0-30% CPU, pulse every 2s (calm). At 30-70%, pulse every 1.2s (active). At 70-100%, pulse every 0.6s (stressed). The dot color shifts from green to amber to red accordingly.
- **Memory pressure indicator:** The `sidebarMem` text already updates. Add a color transition: green < 60%, amber 60-85%, red > 85%.
- **Network activity sparkle:** When `netBytesIn` or `netBytesOut` spikes, the sidebar network icon (if visible) briefly glows blue. Indicates traffic.

### 7b. Activity Feed

Add a subtle activity ticker at the bottom of the dashboard:

```
14:23:07  Agent "deploy-checker" completed successfully
14:22:45  File saved: /home/user/project/index.js
14:22:30  Terminal session started (zsh)
14:21:12  Notebook "ML Pipeline" cell executed
```

Events are collected from existing API calls. No new backend needed — the audit log (`auditLog.middleware()`) already captures mutations. The frontend periodically polls `/api/audit` for recent events.

### 7c. Connection Status Banner

WebSocket state should be visible:

- **Connected:** Green pulse dot (existing)
- **Reconnecting:** Amber dot + thin amber banner at top: "Reconnecting..." (auto-dismiss on reconnect)
- **Disconnected:** Red dot + persistent banner: "Connection lost. [Retry]"

The existing `systemWs.onclose` already retries after 3s. Add visual feedback.

### 7d. Ambient Background

A very subtle (nearly invisible) CSS gradient animation on the main background:

```css
@keyframes ambientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.main {
  background: linear-gradient(135deg, var(--bg) 0%, rgba(218,119,86,0.02) 50%, var(--bg) 100%);
  background-size: 200% 200%;
  animation: ambientShift 30s ease infinite;
}
```

This is nearly invisible — a whisper of warmth that moves across the background. Users will not consciously notice it, but they will feel the product is not static. Make it toggleable in settings for users who prefer zero animation.

### 7e. Uptime Counter

In the sidebar or dashboard, show a live uptime counter that ticks every second:

```
UPTIME 3d 14h 22m 07s
```

Uses the `uptime` value from system snapshots. The seconds digit ticking is a constant reminder that Hyperion is running and stable. Format in `IBM Plex Mono` at the smallest readable size.

---

## 8. Achievement System

Gamification done right. Not childish badges — professional milestones that celebrate mastery.

### 8a. Achievement Categories

**Explorer Tier** (Discovering features):
| Achievement | Trigger | Icon |
|---|---|---|
| First Light | Open the dashboard for the first time | Sun |
| Shell Shocked | Run your first terminal command | Terminal |
| Mind Reader | Ask the AI assistant a question | Brain |
| Architect | Create your first workflow | Blueprint |
| Librarian | Create your first notebook | Book |
| Vault Keeper | Store your first secret | Lock |
| Docker Captain | View Docker containers | Ship |
| Git Guru | Open the Git client | Branch |
| Full House | Visit all 55+ pages | Crown |

**Power User Tier** (Using features deeply):
| Achievement | Trigger | Icon |
|---|---|---|
| Polyglot | Run code in 5+ languages | Globe |
| Multitasker | Open 5+ terminal tabs simultaneously | Layers |
| Automator | Create an agent that runs successfully | Robot |
| Night Owl | Use Hyperion after midnight | Moon |
| Marathon | Keep a session active for 24+ hours | Timer |
| API Warrior | Make 100+ HTTP requests from the client | Bolt |
| Inspector | Debug a JWT token | Magnifier |
| Regex Master | Write a regex that matches | Asterisk |

**Legend Tier** (Rare accomplishments):
| Achievement | Trigger | Icon |
|---|---|---|
| Konami | Enter the Konami code | Star |
| Self-Hosted | Run for 30+ days without restart | Shield |
| Completionist | Use every single tool at least once | Diamond |
| Inception | SSH into another machine running Hyperion | Portal |

### 8b. Implementation

- Store achievements in SQLite (`hyperion.db`) alongside user data
- New table: `achievements (id, user_id, achievement_key, unlocked_at)`
- New API: `GET /api/achievements`, automatic `POST /api/achievements/check` on page navigation
- Frontend: Toast notification on unlock — the achievement name + icon slide in from the bottom-right with a gold shimmer border
- Achievement gallery in Settings > Profile showing all achievements as cards (locked ones grayed out)

### 8c. Presentation

Unlocked achievements have a gold border glow. The notification is:

```
  ┌─────────────────────────────────┐
  │  Achievement Unlocked           │
  │  ⚡ POLYGLOT                    │
  │  Run code in 5+ languages       │
  └─────────────────────────────────┘
```

The toast auto-dismisses after 4 seconds. A subtle confetti burst (CSS-only, ~10 squares falling and fading) accompanies Legend-tier unlocks.

---

## 9. Shareability Engine

Make it trivially easy for users to share their Hyperion experience.

### 9a. Screenshot Mode

Global keyboard shortcut: `Cmd+Shift+S`

1. Hides the sidebar
2. Hides the browser chrome indicators
3. Adds a clean border radius to the main area
4. Adds a subtle "HYPERION" watermark in the bottom-right corner (10% opacity)
5. Shows a floating "Copy Screenshot" button that uses `html2canvas` to capture and copy to clipboard

### 9b. Export Dashboard as Image

A "Share" button on the dashboard that:
1. Renders the current dashboard state as a clean PNG
2. Includes system stats, hostname, uptime
3. Uses a dark background with the Hyperion branding
4. Copies to clipboard + offers download

### 9c. Share Terminal Snippets

Select text in the terminal, right-click > "Share as Image"
- Renders the selected terminal output as a styled code image (like Carbon or Ray.so)
- Dark background, Hyperion font stack, line numbers optional
- Copies to clipboard

### 9d. OG Meta Tags

The existing meta tags are good. Add dynamic OG images for when users share the URL:
- Generate an OG image at build time showing the Hyperion logo + tagline
- The `og:image` meta tag should point to `/og-image.png`
- This ensures every shared link has a rich preview

---

## 10. Sound Design

All sounds optional, off by default. Toggled in Settings. Volume control 0-100%.

### 10a. Sound Library

| Event | Sound | Duration |
|---|---|---|
| App boot | Low synth hum rising to a click | 800ms |
| Page transition | Soft whoosh | 100ms |
| Terminal command complete | Subtle "blip" | 50ms |
| AI response received | Soft chime (two ascending notes) | 200ms |
| File saved | Quick click | 30ms |
| Error | Low buzzer | 150ms |
| Achievement unlocked | Rising three-note arpeggio | 400ms |
| Copy to clipboard | Crisp snap | 40ms |
| Agent started | Engine rev (subtle) | 300ms |
| Agent completed | Success chord | 250ms |

### 10b. Implementation

Use the Web Audio API to generate sounds programmatically (no audio file downloads needed). Each sound is a function that creates an `OscillatorNode` with specific frequency, type, and envelope. Total code: ~80 lines.

```javascript
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBlip() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = 880;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}
```

---

## 11. Implementation Priority Matrix

Ranked by (impact on delight) x (ease of implementation). Do these in order.

### Tier 1: Quick Wins (1-2 hours each, massive impact)

1. **Page transition animations** (CSS only, ~15 lines)
2. **Skeleton loading states** (CSS only, ~20 lines)
3. **Button hover glow effects** (CSS only, ~10 lines)
4. **System pulse rate tied to CPU load** (JS tweak, ~15 lines)
5. **Staggered dashboard card entrance** (CSS `animation-delay`, ~10 lines)
6. **Copy-to-clipboard checkmark animation** (CSS + JS, ~20 lines)
7. **Connection status banner** (JS + CSS, ~30 lines)
8. **Empty state tips** (HTML strings + JS rotation, ~25 lines)

### Tier 2: High Impact (half-day each)

9. **Boot sequence animation** (JS + CSS, skippable, sessionStorage flag)
10. **Terminal startup header line** (client-side intercept, ~20 lines)
11. **Dashboard sparkline charts** (SVG generation from `_sysHistory`, ~60 lines)
12. **Radial CPU gauge** (SVG + CSS animation, ~80 lines)
13. **Command palette enhancements** (fuzzy highlighting, recent items, categories)
14. **Sci-fi themes** (CSS custom property sets, ~100 lines per theme)
15. **Konami code easter egg** (JS keypress listener, ~25 lines)

### Tier 3: Signature Features (1-2 days each)

16. **Interactive onboarding** (embed real terminal + assistant in onboarding steps)
17. **Achievement system** (DB table + API route + toast notifications + gallery page)
18. **Screenshot mode** (`Cmd+Shift+S`, html2canvas integration)
19. **Terminal theme gallery** (visual picker with xterm.js theme configs)
20. **Sound design** (Web Audio API, settings toggle, ~80 lines)
21. **404 page with personality** (ASCII art + humor)
22. **Progressive sidebar disclosure** (localStorage tracking + expand/collapse)

### Tier 4: Polish (when everything else is done)

23. **Ambient background gradient** (CSS animation, 4 lines)
24. **Activity feed on dashboard** (polling `/api/audit`)
25. **Share terminal as image** (canvas rendering)
26. **Workflow visual node graph** (SVG rendering)
27. **Terminal easter egg commands** (client-side intercept before PTY)
28. **Confetti for Legend achievements** (CSS-only particle effect)

---

## Appendix A: Design Tokens Reference

All delight features should use the existing Hyperion design tokens to maintain visual consistency:

```
Background tiers:  --bg (#1C1917), --bg2 (#231F1C), --bg3 (#2A2520), --bg4 (#353028)
Text tiers:        --text (#F5EFE6), --text2 (#A8A29E), --text3 (#78716C)
Accent:            --green (#DA7756) — despite the variable name, this is warm amber/terracotta
Semantic colors:   --red (#EF5350), --blue (#5B9CF6), --amber (#F59E0B), --purple (#A78BFA), --cyan (#67D1E8)
Fonts:             --mono (IBM Plex Mono), --sans (Plus Jakarta Sans), --serif (Libre Baskerville)
Border:            --border (rgba(245,230,210,0.08))
Border radius:     Buttons 10px, Cards 12-14px, Modals 16px, Logo 9px
Transitions:       Default 0.15s, Fast 0.1s, Slow 0.3s
```

## Appendix B: Performance Guardrails

Delight must never cost performance.

- All animations must use `transform` and `opacity` only (GPU-composited, no layout reflow)
- No animation should exceed 300ms for interactive elements (buttons, navigation)
- Ambient animations (pulse, shimmer, gradient) should use `will-change` sparingly
- Skeleton loaders replace empty states, never add to them
- Sound effects are lazy-initialized (AudioContext created on first user gesture)
- Achievement checks are debounced (once per page navigation, not per click)
- The boot sequence uses `sessionStorage` (not localStorage) so it plays once per session, not once ever
- All animations respect `prefers-reduced-motion: reduce` — degrade to instant transitions
- Total CSS addition for Tier 1: approximately 100 lines
- Total JS addition for Tier 1: approximately 100 lines

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
```

## Appendix C: Viral Loop Anatomy

```
User discovers Hyperion
        |
        v
Boot sequence creates intrigue ("what IS this?")
        |
        v
First terminal command delivers "it's real" moment
        |
        v
Dashboard sparklines create "my machine looks beautiful" moment
        |
        v
User screenshots dashboard / terminal
        |
        v
Posts to Twitter/HN/Discord: "Just found this self-hosted tool..."
        |
        v
Achievement unlock creates second share moment
        |
        v
Sci-fi themes create third share moment ("Look at my HAL theme")
        |
        v
New users discover Hyperion from shared screenshots
        |
        v
[Loop repeats]
```

The entire delight system is designed to create *multiple* share triggers, not just one. Each user should encounter at least 3 screenshot-worthy moments in their first hour.
