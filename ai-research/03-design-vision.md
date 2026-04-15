# Hyperion Design Vision & UX Audit

## Executive Summary

Hyperion is a self-hosted computing platform with 55+ tools, delivered as a vanilla JS SPA across three monolithic files: `index.html` (334 lines), `hyperion.js` (11,700 lines), and `hyperion.css` (4,425 lines). The current UI has a solid foundation -- warm dark palette, IBM Plex Mono + Plus Jakarta Sans typography, functional command palette (Cmd+K), and comprehensive responsive breakpoints. However, the architecture has hit scaling limits that create real UX problems. This document maps every user flow, identifies friction points, audits patterns against world-class apps, and proposes a complete visual language and component redesign plan.

---

## Part 1: User Flow Mapping

### Flow 1: First-Run / Onboarding

```
Visit URL -> checkAuth() -> needsSetup=true -> showSetup()
-> Create admin account (username + password + confirm)
-> showOnboarding() -> 4-step wizard (Welcome / Tour / Theme / Done)
-> localStorage 'hyperion_onboarded' = 1
-> go('dashboard') + startSystemWs() + loadUserSettings()
```

**Current experience**: Setup form is inline HTML rendered via JS string interpolation. Onboarding is a 4-step card carousel with step dots. Theme selection offers only dark/light toggle. No keyboard shortcut education beyond "press Cmd+K." No guided tour of the sidebar or any specific tool.

**Problems identified**:
- P1: No password strength indicator during account creation
- P2: Onboarding skips critical context -- what is Hyperion, what can it do, how is it different from alternatives
- P3: Theme selection step has no preview -- user picks blind
- P4: No way to re-trigger onboarding or see a help tour later
- P5: After onboarding, user lands on dashboard with 50+ sidebar items and zero guidance on where to start

### Flow 2: Login / 2FA

```
Visit URL -> checkAuth() -> authenticated=false -> showLogin()
-> Enter username + password -> doLogin()
-> If 2FA enabled: _show2FAPrompt(tempToken)
-> _validate2FA() -> session stored in localStorage
-> Sidebar shown, go('dashboard')
```

**Current experience**: Clean minimal login card. 2FA flow works but is a separate full-page render (not a modal or step within the same card).

**Problems identified**:
- P6: No "remember me" or session duration indication
- P7: No password visibility toggle
- P8: Login error message is generic ("Connection failed") -- no help for incorrect credentials vs server down
- P9: 2FA transition is jarring -- entire page replaces instead of animating within the login card
- P10: No biometric/passkey support mentioned

### Flow 3: Navigation (Primary Pain Point)

```
User scans sidebar (50 items in a single scrollable list)
-> Clicks nav-btn -> go(pageName)
-> Page loader function renders HTML into <main>
-> Previous page state destroyed
```

**Current sidebar inventory (50 items, ordered as in HTML)**:
1. Dashboard, 2. Assistant, 3. Terminal, 4. NOVA, 5. Code Runner, 6. Files, 7. Notebooks, 8. Agents, 9. Workflows, 10. Plugins, 11. Skills, 12. Canvas, 13. Git, 14. Docker, 15. DB Explorer, 16. Vault, 17. HTTP, 18. Toolkit, 19. Snippets, 20. Env, 21. Cron, 22. Processes, 23. Network, 24. WebSocket, 25. Markdown, 26. MockAPI, 27. Deps, 28. Notes, 29. Bookmarks, 30. LoadTest, 31. DataView, 32. TextTools, 33. Clipboard, 34. Pomodoro, 35. LinkCheck, 36. Regex, 37. JWT, 38. Diff, 39. Images, 40. CronExpr, 41. Colors, 42. Base64, 43. Hash, 44. UUID, 45. JSON, 46. YAML, 47. Lorem, 48. Logs, 49. Monitor, 50. Analytics, 51. Remote, 52. System, 53. Backups, 54. API Docs, 55. Shortcuts, 56. Tunnels, 57. File History, 58. Webhooks, 59. Widgets, 60. Metrics, 61. Audit, 62. Health

**Plus sidebar bottom**: Settings, Notifications, Collapse toggle, System pulse

**Problems identified**:
- P11: **CRITICAL** -- 62 items in a flat list with zero grouping, no headers, no separators, no hierarchy. This is the single biggest UX failure in the app.
- P12: No search/filter within the sidebar itself (Cmd+K launcher exists but is a separate overlay)
- P13: No favorites/pinning -- power users cannot surface their 5 most-used tools
- P14: No recently-used section -- common "return to where I was" pattern is missing
- P15: Active state is subtle (10% opacity tint + color change) -- in a list of 62 items, finding where you are requires scanning
- P16: Collapsed sidebar shows only icons with no tooltips beyond aria-labels (icons are small 18x18 SVGs, many look similar)
- P17: No keyboard navigation within sidebar (no arrow key traversal, no type-ahead filtering)
- P18: Mobile experience hides all 62 items behind a hamburger -- no bottom nav prioritization of core tools

### Flow 4: Tool Usage (e.g., Terminal)

```
Click Terminal -> go('terminal') -> loadTerminal()
-> Renders xterm.js with tabs
-> WebSocket connection to /ws/terminal
-> Tab management, split panes, theme selection
```

**Current experience**: Terminal is well-built with multi-tab, split panes, and broadcast mode. The xterm.js integration is solid.

**Problems identified**:
- P19: Page transitions destroy all state -- switching from Terminal to Files and back creates a new terminal session
- P20: No breadcrumb or context indicator -- user cannot tell which directory the terminal is in from the page header
- P21: Terminal tab management is basic -- no drag-to-reorder, no rename, no color coding

### Flow 5: Assistant / AI

```
Click Assistant -> loadAssistant()
-> Hero section with logo + title + subtitle
-> Input box with suggested action chips
-> Type query -> assistantRun() -> POST /api/assistant/ask
-> Results rendered inline with command bar + output
```

**Problems identified**:
- P22: Hero section takes ~200px of vertical space on every visit -- wastes prime real estate for returning users
- P23: Suggested workflows are not personalized -- same suggestions for every user every time
- P24: No conversation history persistence across page navigations (assistantHistory array resets)
- P25: Results are append-only with no way to clear, collapse, or bookmark useful outputs

### Flow 6: Settings

```
Click Settings -> loadSettings()
-> Sidebar with tabs: General, Appearance, Keybindings, Security, About
-> Each tab renders a settings panel
```

**Problems identified**:
- P26: Settings are disconnected from the tools they configure -- no "configure this tool" link from within each tool
- P27: Keybindings editor shows defaults but editing UX is unclear
- P28: No settings search (common in apps with many settings)

---

## Part 2: UX Problem Analysis

### 2.1 Information Architecture Failure

The root problem is that 62 tools are presented with zero taxonomy. Hyperion contains at least 8 distinct categories of functionality:

| Category | Tools | Count |
|----------|-------|-------|
| **Core** | Dashboard, Assistant, Terminal, NOVA | 4 |
| **Development** | Code Runner, Notebooks, Git, Docker, DB Explorer, Deps, Logs, Processes | 8 |
| **Files & Content** | Files, Markdown, Notes, Bookmarks, Snippets, Clipboard, File History, Images | 8 |
| **Networking** | HTTP Client, WebSocket, Network Tools, Remote, Tunnels, Webhooks, MockAPI, LoadTest, LinkCheck | 9 |
| **Data & Transform** | DataView, TextTools, Regex, JWT, Diff, JSON, YAML, Base64, Hash, UUID, Lorem, Colors, CronExpr | 13 |
| **Automation** | Agents, Workflows, Skills, Plugins, Cron, Env Manager, Canvas | 7 |
| **Security** | Vault | 1 |
| **System** | System, Monitor, Analytics, Backups, Health, Metrics, Audit, Widgets, API Docs, Shortcuts | 10 |

Users must scroll through ALL items to find what they need. The cognitive load is extreme. Compare this to:
- **Linear**: ~12 sidebar items organized into clear groups (Issues, Projects, Views, Teams) with collapsible sections
- **Vercel**: ~8 top-level items with nested sub-navigation
- **VS Code**: Activity bar (5-6 icons) + sidebar panel pattern separates categories from items

### 2.2 Overwhelming First Impression

A new user seeing 62 sidebar items with no grouping will experience decision paralysis. Research shows that menus with more than 7-9 items significantly increase selection time (Hick's Law). Hyperion has 7x that number in a single flat list.

### 2.3 State Loss on Navigation

Every `go(pageName)` call re-renders `<main>` from scratch. This means:
- Terminal sessions are restarted
- Unsaved notebook cells are lost
- File editor contents disappear
- Assistant conversation history resets to in-memory array

This is the second most impactful UX problem. Users cannot confidently multitask.

### 2.4 Inconsistent Visual Density

The CSS reveals a "wave" development pattern (Wave 1 through Wave 10) where each wave introduced new tool styles. Earlier tools (Terminal, Files, Assistant) follow a tighter, more consistent pattern. Later tools (Wave 7-10: WebSocket, Markdown, MockAPI, etc.) introduced a "phosphor terminal aesthetic" with different visual language:
- Wave 1-6: `var(--bg2)`, `var(--border)` -- solid backgrounds
- Wave 7+: `rgba(255,255,255,0.04)`, `rgba(218,119,86,0.12)` -- translucent overlays with scanline effects

This creates an inconsistent feel as users move between tools.

### 2.5 Accessibility Gaps

**Positives** (already implemented):
- Skip link (`<a href="#main" class="skip-link">`)
- `aria-label` on all nav buttons
- `:focus-visible` styles with orange outline
- `prefers-reduced-motion` media query
- `sr-only` utility class
- `role="navigation"` on sidebar
- Error toast has `role="alert"` and `aria-live="assertive"`

**Gaps**:
- P29: No `aria-current="page"` on active nav button
- P30: No `role="tablist"` / `role="tab"` / `role="tabpanel"` on any tab interfaces (Terminal tabs, Settings tabs, HTTP Client tabs)
- P31: Color contrast issues -- `--text3: #78716C` on `--bg: #1C1917` is approximately 3.8:1, below WCAG AA minimum of 4.5:1 for normal text
- P32: `--green: #DA7756` (the accent color, confusingly named "green") on `--bg` is ~4.7:1 which passes AA but fails AAA
- P33: No `aria-expanded` on collapsible sections
- P34: Inline onclick handlers (`onclick="go('dashboard')"`) prevent proper focus management
- P35: No live region announcements for page changes (screen reader users get no feedback when navigation occurs)
- P36: Modal dialogs have no focus trap implementation
- P37: Command palette (Cmd+K) and Search (Cmd+Shift+F) have no `aria-combobox` pattern

---

## Part 3: Design Pattern Audit

### 3.1 What Works Well

1. **Warm dark palette** -- The `#1C1917` base with `#DA7756` (terra cotta) accent is distinctive and avoids the "generic dark mode" trap. It has personality.
2. **Typography trio** -- IBM Plex Mono for code, Plus Jakarta Sans for UI, Libre Baskerville for headings creates clear typographic hierarchy.
3. **Command palette** -- The Cmd+K launcher exists and follows established patterns (560px overlay, fuzzy search, keyboard navigation).
4. **System pulse** -- The live memory indicator in the sidebar bottom is a clever affordance for a self-hosted computing platform.
5. **Notification panel** -- Slide-in panel from right with proper overlay is a clean pattern.
6. **Theme system** -- CSS custom properties enable dark/light switching without full reload. The early-load script prevents flash.
7. **Responsive breakpoints** -- Three tiers (desktop, tablet 768px, mobile 480px) with appropriate layout adjustments.

### 3.2 What Feels Dated

1. **Flat sidebar list** -- This was common in 2015-era dashboards. Modern apps use collapsible groups (Notion), activity bars (VS Code), or search-first (Raycast).
2. **Full-page renders** -- SPA apps in 2026 use component-level updates, not `innerHTML` replacement. Even jQuery-era apps had better state preservation.
3. **Inline styles** -- Login, setup, and onboarding use extensive inline `style=""` attributes instead of utility classes or CSS classes.
4. **String template rendering** -- The JS builds HTML via template literals with `innerHTML`. This is XSS-prone and makes components non-reusable.
5. **Card hover effects** -- The subtle border-color change on hover is underperforming. Modern apps use elevation shifts, subtle scale transforms, or directional light effects.
6. **Status badges** -- The mono-font uppercase letter-spaced badges (`.agent-status`, `.plugin-badge`) are functional but lack the refinement of modern status indicators (dot + text, or colored pill with icon).

### 3.3 Inconsistencies

| Pattern | Location A | Location B | Issue |
|---------|-----------|-----------|-------|
| Button styles | `.btn` (border + bg3) | `.btn-green` (bg with opacity) | Two competing button systems |
| Button styles | `.btn-sm` (4px 10px) in Wave 1 | `.btn-sm` redefined in Wave 4 (5px 12px) | Duplicate class with different values |
| Card backgrounds | `.agent-card` (bg2) | `.mock-ep-card` (linear-gradient) | Cards use 3 different background strategies |
| Tab patterns | `.term-tab` (border-bottom) | `.mon-tab` (rounded pill) | At least 4 different tab component designs |
| Input styling | `.form-group input` (7px 10px) | `.tk-input` (10px 12px) | Input padding varies by tool |
| Page padding | `.page-pad` (24px 28px) | `.tk-page` (16px 20px) | Page content padding is inconsistent |
| Color naming | `--green: #DA7756` | Actual green: `#4ADE80` (pulse-dot) | The accent color is orange but named "green" |

---

## Part 4: World-Class App Inspiration

### 4.1 Linear (Product Development)

**Key patterns to adopt**:
- **Dimmed sidebar**: Navigation recedes, content takes focus. Linear recently made their sidebar dimmer to reduce visual noise.
- **Reduced color vocabulary**: Linear moved to monochrome with very few accent colors. Color appears only for status.
- **Compact tabs**: Rounded corners, smaller icons, tighter spacing.
- **Command palette as primary nav**: Power users rarely touch the sidebar.
- **Grouped sidebar sections** with collapsible headers.

**Source**: [How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui), [A calmer interface](https://linear.app/now/behind-the-latest-design-refresh)

### 4.2 Vercel (Developer Platform)

**Key patterns to adopt**:
- **Extreme restraint**: Two colors, one font family (Geist), sharp edges, generous whitespace.
- **Color carries meaning only**: No decorative color. Status indicators, links, and errors are the only colored elements.
- **Typography-driven hierarchy**: The system relies on font weight, size, and spacing rather than background colors or borders.
- **Dark mode as first-class**: `color-scheme: dark` on HTML element for native scrollbar adaptation.

**Source**: [Vercel Design System Breakdown](https://seedflip.co/blog/vercel-design-system), [Vercel Typography](https://vercel.com/geist/typography), [Web Interface Guidelines](https://vercel.com/design/guidelines)

### 4.3 Raycast (Productivity Launcher)

**Key patterns to adopt**:
- **Search + Act paradigm**: Find something, then immediately act on it. Not just search-to-navigate.
- **Minimal chrome**: The command palette IS the interface, not an overlay on top of one.
- **Keyboard-first**: Every interaction can be completed without touching the mouse.
- **Consolidated utilities**: Multiple tools (clipboard history, snippets, window management) accessible from a single search interface.

**Source**: [Raycast](https://www.raycast.com/), [Command Palette Interfaces](https://fountn.design/resource/command-palette-interfaces/)

### 4.4 Arc Browser / Craft / Notion

**Patterns observed**:
- **Arc**: Sidebar is collapsible to icons, with spaces (workspaces) that group tabs by context.
- **Craft**: Document-first UI with a gentle, slightly warm palette. Transitions are slow and intentional (200-400ms springs).
- **Notion**: Sidebar with nested pages, favorites section at top, search prominently placed.

---

## Part 5: New Visual Language

### 5.1 Color System (Dark-First)

The current warm palette (`#1C1917` base, `#DA7756` accent) is strong and distinctive. We keep and refine it.

#### Dark Mode (Default)

```css
:root {
  /* Surfaces — 5-level depth scale */
  --surface-0: #141210;       /* App background, deepest */
  --surface-1: #1C1917;       /* Sidebar, panels */
  --surface-2: #231F1C;       /* Cards, elevated content */
  --surface-3: #2A2520;       /* Inputs, wells */
  --surface-4: #353028;       /* Hover states, tooltips */

  /* Text — 4-level hierarchy */
  --text-primary: #F5EFE6;    /* Headlines, important content */
  --text-secondary: #BEB8B0;  /* Body text, descriptions */
  --text-tertiary: #8A8480;   /* Labels, placeholders (WCAG AA on surface-1) */
  --text-disabled: #5C5854;   /* Disabled states */

  /* Accent — Terra Cotta */
  --accent: #DA7756;
  --accent-hover: #E8956E;
  --accent-muted: rgba(218, 119, 86, 0.12);
  --accent-subtle: rgba(218, 119, 86, 0.06);

  /* Semantic colors */
  --success: #4ADE80;
  --success-muted: rgba(74, 222, 128, 0.12);
  --warning: #FBBF24;
  --warning-muted: rgba(251, 191, 36, 0.12);
  --error: #F87171;
  --error-muted: rgba(248, 113, 113, 0.12);
  --info: #60A5FA;
  --info-muted: rgba(96, 165, 250, 0.12);

  /* Borders — 3 levels */
  --border-subtle: rgba(245, 239, 230, 0.06);
  --border-default: rgba(245, 239, 230, 0.10);
  --border-strong: rgba(245, 239, 230, 0.16);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.5);
  --shadow-overlay: 0 24px 80px rgba(0, 0, 0, 0.6);
}
```

#### Light Mode

```css
[data-theme="light"] {
  --surface-0: #FAFAF8;
  --surface-1: #F5F2EE;
  --surface-2: #FFFFFF;
  --surface-3: #EDE9E4;
  --surface-4: #E5E0DA;

  --text-primary: #1C1917;
  --text-secondary: #57534E;
  --text-tertiary: #A8A29E;
  --text-disabled: #D6D3D1;

  --accent: #C4684A;
  --accent-hover: #B85C3F;
  --accent-muted: rgba(196, 104, 74, 0.10);
  --accent-subtle: rgba(196, 104, 74, 0.05);

  --border-subtle: rgba(0, 0, 0, 0.04);
  --border-default: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.14);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.12);
}
```

**Key changes from current**:
1. Renamed `--green` to `--accent` (fixes the "green that is orange" confusion)
2. Raised `--text-tertiary` from `#78716C` to `#8A8480` to meet WCAG AA contrast on `surface-1`
3. Added dedicated `--success` color (`#4ADE80`, actual green) separate from the accent
4. 5-level surface scale instead of 4 (`bg`, `bg2`, `bg3`, `bg4`) -- adds a deeper base for the app chrome
5. Separated border into 3 semantic levels instead of a single `--border`
6. Light mode uses `[data-theme]` attribute instead of `body.theme-light` class for cleaner CSS specificity

### 5.2 Typography Scale

Keep the three-family approach but formalize the scale on a modular system.

```css
:root {
  /* Font families */
  --font-mono: 'IBM Plex Mono', 'JetBrains Mono', 'SF Mono', monospace;
  --font-sans: 'Plus Jakarta Sans', -apple-system, system-ui, sans-serif;
  --font-display: 'Libre Baskerville', 'Georgia', serif;

  /* Type scale (1.200 minor third) */
  --text-xs: 0.694rem;    /* 11.1px -- badges, tertiary labels */
  --text-sm: 0.833rem;    /* 13.3px -- sidebar items, metadata */
  --text-base: 1rem;      /* 16px -- body text (increased from 13px) */
  --text-md: 1.2rem;      /* 19.2px -- section headings */
  --text-lg: 1.44rem;     /* 23px -- page titles */
  --text-xl: 1.728rem;    /* 27.6px -- hero headings */
  --text-2xl: 2.074rem;   /* 33.2px -- display text */

  /* Font weights */
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;

  /* Line heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* Letter spacing */
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.05em;
  --tracking-wider: 0.1em;
}
```

**Key change**: Base font size increases from 13px to 16px. The current 13px is too small for sustained reading on a tool-heavy platform. Code blocks and terminal remain at 13-14px via `--text-sm`.

### 5.3 Spacing System (4px Grid)

```css
:root {
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;
  --space-10: 64px;
  --space-11: 80px;
  --space-12: 96px;

  /* Component-specific spacing */
  --sidebar-width: 240px;
  --sidebar-collapsed: 56px;
  --page-padding-x: var(--space-7);    /* 32px */
  --page-padding-y: var(--space-6);    /* 24px */
  --card-padding: var(--space-5);      /* 20px */
  --input-padding-x: var(--space-3);   /* 12px */
  --input-padding-y: var(--space-2);   /* 8px */

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

### 5.4 Motion Principles

```css
:root {
  /* Durations */
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-slower: 600ms;

  /* Easings */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);        /* For elements entering */
  --ease-in: cubic-bezier(0.55, 0, 1, 0.45);         /* For elements leaving */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);     /* For state changes */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);  /* For playful interactions */
}
```

**Motion rules**:
1. **Hover/focus states**: `--duration-instant` with `--ease-in-out`. These should feel immediate.
2. **Panel transitions** (sidebar collapse, notification slide): `--duration-normal` with `--ease-out`.
3. **Page transitions**: `--duration-fast` fade + 8px translate-Y. Content should feel like it's settling into place, not sliding in dramatically.
4. **Overlays** (modal, command palette): `--duration-normal` for backdrop, `--duration-slow` with `--ease-spring` for the box itself.
5. **Micro-interactions** (checkbox, toggle, button press): `--duration-instant`. Snappy, no lag.
6. **Data loading**: Skeleton screens with a gentle shimmer (not spinner dots). Shimmer direction left-to-right, 1.5s cycle.
7. **Reduced motion**: All animations collapse to `--duration-instant` or are disabled entirely.

### 5.5 Component Patterns

#### Buttons

```
Primary:    Solid accent fill, white text, --radius-md
Secondary:  Ghost with border-default, text-secondary, --radius-md
Tertiary:   No border, text-tertiary, hover: surface-3 background
Danger:     Ghost with error border, error text
Sizes:      sm (28px height), md (36px height), lg (44px height)
Icon-only:  Square with --radius-md, same height as text variant
```

#### Cards

```
Base:       surface-2 background, border-default, --radius-lg, --shadow-sm
Hover:      border-strong, --shadow-md, 1px translate-Y
Active:     accent border-left (3px), rest same as base
Group:      No gap between cards, shared border (table-like density)
```

#### Inputs

```
Default:    surface-3 background, border-default, --radius-md
Focus:      accent border, accent shadow ring (0 0 0 3px accent-muted)
Error:      error border, error shadow ring
Disabled:   surface-2 background, text-disabled, no interaction
Sizes:      sm (28px), md (36px), lg (44px) -- matching button heights
```

#### Tabs

**One tab pattern for the entire app** (replacing the current 4+ variants):

```
Container:  surface-1 background, border-default bottom, no padding
Tab:        text-tertiary, no background, border-bottom 2px transparent
Tab hover:  text-secondary
Tab active: text-primary, accent border-bottom
```

#### Badges / Pills

```
Status:     Dot (6px circle) + text, colored by semantic
Category:   Rounded full, surface-3 background, text-tertiary
Count:      Rounded full, accent-muted background, accent text
```

---

## Part 6: Component Redesign Plan

Prioritized by impact on user experience, technical difficulty, and dependency chain.

### Phase 1: Navigation Overhaul (CRITICAL -- Do First)

**Estimated scope**: 3-4 days

#### 1A. Sidebar Grouping & Hierarchy

Replace the flat list with collapsible groups:

```
[Search field]                    <- Always visible at top

CORE
  Dashboard
  Assistant
  Terminal
  NOVA

DEVELOPMENT
  Code Runner
  Notebooks
  Git
  Docker
  DB Explorer
  Logs
  Processes
  Deps

FILES & CONTENT
  Files
  Markdown
  Notes
  Bookmarks
  Snippets
  Clipboard
  File History
  Images

NETWORKING
  HTTP Client
  WebSocket
  Network
  Remote
  Tunnels
  Webhooks
  MockAPI
  LoadTest
  LinkCheck

DATA & TRANSFORM
  DataView
  TextTools
  Regex
  JWT
  Diff
  JSON / YAML     <- Combine into one tool
  Base64 / Hash   <- Combine into one tool
  UUID
  Lorem
  Colors
  CronExpr

AUTOMATION
  Agents
  Workflows
  Skills
  Plugins
  Cron Manager
  Env Manager
  Canvas

SYSTEM
  System Info
  Monitor
  Analytics
  Health
  Metrics
  Audit
  Backups
  Widgets
  API Docs

[Settings]                        <- Pinned at bottom
[Notifications]
```

**Implementation**:
- Add `data-group` attributes to nav buttons
- CSS: Group headers are uppercase `--text-xs` with `--tracking-wider`, `text-tertiary`
- Groups are collapsible via CSS `details/summary` or JS toggle
- Collapsed state persisted in localStorage
- Search field at top of sidebar filters items in real-time (fuzzy match)

#### 1B. Favorites / Pinned Section

Add a "Favorites" group at the very top (above Core) that users can populate by right-clicking any sidebar item and selecting "Pin to favorites." Default favorites for new users: Dashboard, Terminal, Files, Assistant.

#### 1C. Recently Used

Below Favorites, show "Recent" section with last 5 visited pages. Auto-populated, no user action needed.

#### 1D. Command Palette Enhancement

Upgrade the existing Cmd+K launcher:
- Add action verbs: "Open Terminal", "Create Agent", "New Snippet", "Run Workflow"
- Add recent items section at the top when query is empty
- Add fuzzy matching with highlighted match characters
- Add `aria-combobox` accessibility pattern
- Add category icons in results

### Phase 2: Design Token Migration (Foundation)

**Estimated scope**: 2-3 days

#### 2A. Replace All Hardcoded Colors

Migrate from the current color variables to the new semantic token system. This is a mechanical change but enables everything that follows.

- `var(--bg)` -> `var(--surface-0)` or `var(--surface-1)` depending on context
- `var(--bg2)` -> `var(--surface-2)`
- `var(--green)` -> `var(--accent)` (and fix the naming confusion permanently)
- `var(--text3)` -> `var(--text-tertiary)`
- etc.

#### 2B. Spacing Token Adoption

Replace magic numbers with spacing tokens. Current CSS has hundreds of `padding: 8px 12px` and `gap: 6px` -- standardize to the 4px grid.

#### 2C. Light Theme Refactor

The current light theme has 200+ override rules using `body.theme-light .selector` pattern. Migrate to `[data-theme="light"]` with CSS custom property overrides only -- no selector-based overrides.

### Phase 3: Consistent Component Library (Visual Polish)

**Estimated scope**: 3-4 days

#### 3A. Unified Button Component

Define 4 button variants (primary, secondary, tertiary, danger) x 3 sizes (sm, md, lg). Replace all existing button classes:
- `.btn`, `.btn-green`, `.btn-red`, `.btn-sm` (Wave 1)
- `.btn-green` redefined (Wave 4)
- `.run-btn`, `.mock-btn`, `.dep-action-btn`, `.note-add-btn` (Wave 7+)
- `.ws-btn-connect`, `.ws-send-btn` (Wave 7)

All should become compositions of base button + variant + size.

#### 3B. Unified Tab Component

Consolidate the 4+ tab patterns:
- `.term-tab` (border-bottom underline)
- `.mon-tab` (rounded pill)
- `.dbe-tab` / `.dock-tab` / `.git-tab` (border-bottom underline, different active colors)
- `.proc-tab` (pill with border)
- `.settings-tab` (sidebar vertical tabs)
- `.http-section-tab` (underline, again)

Into a single `.tabs` / `.tab` / `.tab-panel` system with horizontal and vertical variants.

#### 3C. Unified Card Component

Consolidate card patterns:
- `.sys-card`, `.dash-card`, `.agent-card`, `.workflow-card`, `.plugin-card` (Wave 1-4)
- `.mock-ep-card`, `.dep-card`, `.note-card`, `.bm-card`, `.cb-card` (Wave 7-8)
- `.lt-card`, `.lc-card` (Wave 8)

Into `.card` with modifiers: `.card--elevated`, `.card--bordered`, `.card--interactive`, `.card--status-{color}`.

#### 3D. Unified Input Component

Consolidate:
- `.form-group input` (generic forms)
- `.tk-input`, `.tk-field` (toolkit)
- `.net-field`, `.proc-field`, `.env-field` (various tools)
- `.ws-url-input`, `.http-url-input` (networking)

Into `.input` with size variants and states (default, focus, error, disabled, readonly).

### Phase 4: Page State Preservation (Architecture)

**Estimated scope**: 4-5 days

#### 4A. Page Caching

Instead of destroying DOM on navigation, implement a page cache:

```javascript
const pageCache = new Map();

function go(pageName) {
  // Hide current page
  const current = document.querySelector('.page.active');
  if (current) {
    current.classList.remove('active');
    current.style.display = 'none';
  }

  // Check cache
  if (pageCache.has(pageName)) {
    const cached = pageCache.get(pageName);
    cached.style.display = '';
    cached.classList.add('active');
    return;
  }

  // Create new page
  const page = document.createElement('div');
  page.className = 'page active';
  page.dataset.page = pageName;
  document.getElementById('main').appendChild(page);
  pageCache.set(pageName, page);

  // Load content into the page element
  loaders[pageName]?.(page);
}
```

This preserves terminal sessions, editor states, and conversation history.

#### 4B. Maximum Cache Size

Limit cache to 8-10 pages. When exceeded, evict the least recently used page (excluding Terminal and Assistant which should always be cached).

### Phase 5: Accessibility Hardening

**Estimated scope**: 2-3 days

#### 5A. ARIA Landmarks & Roles
- Add `aria-current="page"` to active nav button
- Add `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"` to all tab interfaces
- Add `aria-expanded` to collapsible sidebar groups
- Add `aria-live="polite"` region for page change announcements

#### 5B. Focus Management
- Implement focus trap for modals and command palette
- On page navigation, move focus to page heading or first interactive element
- On modal close, return focus to trigger element

#### 5C. Keyboard Navigation
- Arrow keys traverse sidebar items within groups
- Tab/Shift+Tab moves between groups
- Type-ahead in sidebar filters items
- Escape closes current overlay/panel

#### 5D. Contrast Fixes
- Raise `--text-tertiary` to meet 4.5:1 on `--surface-1`
- Ensure all interactive text meets 4.5:1 minimum
- Ensure focus indicators have 3:1 contrast against adjacent colors

### Phase 6: Mobile Experience

**Estimated scope**: 2-3 days

#### 6A. Smart Bottom Navigation

Replace the current "show all 62 items behind hamburger" with a context-aware bottom nav:

```
[Dashboard] [Terminal] [Assistant] [Files] [More...]
```

"More..." opens a full-screen sheet with the grouped sidebar content. The 4 pinned items are customizable (user's favorites).

#### 6B. Gesture Support
- Swipe right from edge: Open sidebar
- Swipe left on sidebar: Close
- Swipe down on page: Pull to refresh
- Long press on sidebar item: Context menu (Pin, Open in new tab)

#### 6C. Responsive Layout Improvements
- Terminal: Full-screen mode with floating controls
- Split-pane tools (Code Runner, Markdown, HTTP Client): Stack vertically with resizable divider
- DataView/tables: Horizontal scroll with frozen first column

### Phase 7: Onboarding & First-Run

**Estimated scope**: 1-2 days

#### 7A. Progressive Disclosure

Instead of showing all 62 tools immediately, new users see a curated "Getting Started" view:

```
Welcome to Hyperion

Start with these essential tools:
[Terminal]  [Files]  [Assistant]  [Code Runner]

Discover more as you need them -- press Cmd+K anytime.
```

Additional tools appear in the sidebar as the user explores (or they can click "Show all tools" to reveal everything).

#### 7B. Contextual Tips

First-time visits to key pages show a subtle tooltip:
- Terminal: "Tip: Press Cmd+T for a new tab, Cmd+D to split"
- Files: "Tip: Right-click for context menu, drag to upload"
- Assistant: "Tip: Try 'show system info' or 'list docker containers'"

Tips are dismissible and remember dismissed state.

#### 7C. Setup Improvements
- Password strength meter
- Password visibility toggle
- Animated theme preview on theme step
- "Import settings" option for returning users

### Phase 8: Modularization Plan (Long-term Architecture)

**Estimated scope**: 2+ weeks (can be done incrementally)

The single 11,700-line `hyperion.js` file should be split into modules. Recommended structure:

```
public/js/
  hyperion.js          <- Entry point, router, global state (~300 lines)
  core/
    auth.js            <- Login, setup, 2FA, session management
    navigation.js      <- go(), sidebar, command palette
    websocket.js       <- System WS, terminal WS
    notifications.js   <- Notification polling, panel
    settings.js        <- User settings, theme, keybindings
  pages/
    dashboard.js
    assistant.js
    terminal.js
    nova.js
    code-runner.js
    files.js
    notebooks.js
    agents.js
    ... (one file per page/tool)
  shared/
    api.js             <- fetch wrapper
    dom.js             <- esc(), showToast(), createElement helpers
    state.js           <- Page cache, global state management
```

**Migration strategy**:
1. Start with ES modules (`<script type="module">`)
2. Extract one page at a time, starting with the largest/most complex
3. Use a simple build step (esbuild, 1-line config) to bundle for production
4. No framework needed -- the vanilla JS approach is fine, it just needs modular organization

Similarly, `hyperion.css` should be split:

```
public/css/
  tokens.css           <- All CSS custom properties
  reset.css            <- Box-sizing, body, html
  layout.css           <- Shell, sidebar, main, page
  components/
    buttons.css
    cards.css
    tabs.css
    inputs.css
    modals.css
    badges.css
    tables.css
  pages/
    terminal.css
    assistant.css
    files.css
    ... (one file per page)
  themes/
    dark.css
    light.css
```

Use CSS `@import` or a build step to concatenate. The split is primarily for developer experience; production can still serve a single file.

---

## Part 7: Priority Matrix

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| 1. Navigation Overhaul | **CRITICAL** | Medium (3-4d) | **P0 -- Do First** |
| 2. Design Token Migration | High | Medium (2-3d) | **P1** |
| 3. Component Library | High | Medium (3-4d) | **P1** |
| 4. Page State Preservation | High | High (4-5d) | **P1** |
| 5. Accessibility | Medium | Low (2-3d) | **P2** |
| 6. Mobile Experience | Medium | Medium (2-3d) | **P2** |
| 7. Onboarding | Medium | Low (1-2d) | **P2** |
| 8. Modularization | Low (DX) | High (2+ weeks) | **P3** |

**Recommended execution order**: Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 7 -> Phase 6 -> Phase 8

Phase 1 (navigation) is non-negotiable and should be done before any other UI work. A user who cannot find tools will not stay to appreciate polished buttons.

---

## Appendix A: Sidebar Item Consolidation Opportunities

Some tools could be merged to reduce the total count:

| Merge candidates | Rationale | New name |
|-----------------|-----------|----------|
| JSON + YAML | Same pattern: paste input, transform, output | **Data Format Tools** |
| Base64 + Hash + UUID | All are simple encode/decode/generate | **Encoder/Generator** |
| Cron Manager + CronExpr | CronExpr is a subset of Cron Manager | **Cron Manager** (add expression builder tab) |
| Notes + Bookmarks | Both are "save and organize things" | Keep separate but group together |
| Monitor + Health + Metrics | Overlapping system observability | **System Monitor** (with tabs) |
| Audit + Logs | Both are log viewing | **Log Viewer** (with audit tab) |

This could reduce the sidebar from 62 items to ~50, which combined with grouping makes the nav manageable.

## Appendix B: Naming Fixes

| Current | Issue | Proposed |
|---------|-------|----------|
| `--green: #DA7756` | It is orange/terra cotta | `--accent: #DA7756` |
| `--green2` | Muted version of the non-green green | `--accent-muted` |
| `--dim` (alias of `--text3`) | Redundant variable | Remove, use `--text-tertiary` |
| `--surface` (alias of `--bg3`) | Redundant, confusing | Remove, use `--surface-3` |
| `btn-green` | Not green | `btn-primary` |
| `.active` on nav buttons | Too generic, conflicts with other `.active` uses | `.nav-btn[aria-current="page"]` |

## Appendix C: CSS Audit Statistics

| Metric | Value |
|--------|-------|
| Total lines | 4,425 |
| CSS custom properties | 23 (should be 50+) |
| Unique colors (hardcoded) | ~45 |
| `!important` usage | 5 instances |
| Duplicate class names (redefined) | `btn-sm` (2x), `btn-green` (2x) |
| Wave-specific styles | Wave 1-6: ~870 lines, Wave 7: ~850 lines, Wave 8: ~480 lines, Wave 9: ~350 lines, Wave 10: ~30 lines |
| Light theme overrides | ~330 lines (body.theme-light selectors) |
| Media queries (@media) | 12 blocks |
| Animations (@keyframes) | 10 definitions |
| Inline SVG icons in HTML | 62 (one per sidebar item) |
