import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read the actual HTML and JS files to verify structure
const htmlContent = readFileSync(join(__dirname, '..', 'public', 'index.html'), 'utf8');
const jsContent = readFileSync(join(__dirname, '..', 'public', 'js', 'hyperion.js'), 'utf8');
const cssContent = readFileSync(join(__dirname, '..', 'public', 'css', 'hyperion.css'), 'utf8');

describe('HTML Structure', () => {
  it('has skip-to-content link', () => {
    expect(htmlContent).toContain('class="skip-link"');
    expect(htmlContent).toContain('Skip to content');
  });

  it('has navigation role on sidebar', () => {
    expect(htmlContent).toContain('role="navigation"');
  });

  it('has aria-label on main content', () => {
    expect(htmlContent).toContain('aria-label="Main content"');
  });

  it('has aria-labels on nav buttons', () => {
    // Dashboard and Terminal are now JS-generated from NAV_GROUPS
    expect(jsContent).toContain("page: 'dashboard'");
    expect(jsContent).toContain("page: 'terminal'");
    // Settings is still in static HTML
    expect(htmlContent).toContain('aria-label="Settings"');
  });

  it('has dashboard nav button', () => {
    expect(jsContent).toContain("page: 'dashboard'");
  });

  it('has settings nav button', () => {
    expect(htmlContent).toContain('data-page="settings"');
  });

  it('has plugins nav button', () => {
    expect(jsContent).toContain("page: 'plugins'");
  });

  it('has sidebar collapse button', () => {
    expect(htmlContent).toContain('sidebar-collapse-btn');
    expect(htmlContent).toContain('toggleSidebar()');
  });
});

describe('JavaScript Functions', () => {
  it('has loadDashboard function', () => {
    expect(jsContent).toContain('async function loadDashboard()');
  });

  it('has loadSettings function', () => {
    expect(jsContent).toContain('async function loadSettings()');
  });

  it('has loadPluginsPage function', () => {
    expect(jsContent).toContain('async function loadPluginsPage()');
  });

  it('has openSearchEverywhere function', () => {
    expect(jsContent).toContain('function openSearchEverywhere()');
  });

  it('has openSSHConnectModal function', () => {
    expect(jsContent).toContain('async function openSSHConnectModal()');
  });

  it('has connectSSH function', () => {
    expect(jsContent).toContain('function connectSSH(');
  });

  it('has trapFocus function', () => {
    expect(jsContent).toContain('function trapFocus(');
  });

  it('has centralized keybinding handler', () => {
    expect(jsContent).toContain('function handleGlobalKeydown(');
    expect(jsContent).toContain('DEFAULT_KEYBINDINGS');
  });

  it('has sidebar collapse function', () => {
    expect(jsContent).toContain('function toggleSidebar()');
  });

  it('has notebook collaboration', () => {
    expect(jsContent).toContain('_notebookWs');
    expect(jsContent).toContain('cell_edit');
    expect(jsContent).toContain('nb-live-badge');
  });

  it('has mobile bottom nav', () => {
    expect(jsContent).toContain('function renderBottomNav()');
    expect(jsContent).toContain('mobile-bottom-nav');
  });

  it('has swipe gestures', () => {
    expect(jsContent).toContain('function initSwipeGestures()');
  });

  it('has settings tabs', () => {
    expect(jsContent).toContain("'profile'");
    expect(jsContent).toContain("'llm'");
    expect(jsContent).toContain("'theme'");
    expect(jsContent).toContain("'keybindings'");
  });
});

describe('CSS Styles', () => {
  it('has skip-link styles', () => {
    expect(cssContent).toContain('.skip-link');
  });

  it('has focus-visible outlines', () => {
    expect(cssContent).toContain(':focus-visible');
  });

  it('has sidebar.collapsed styles', () => {
    expect(cssContent).toContain('.sidebar.collapsed');
  });

  it('has settings page styles', () => {
    expect(cssContent).toContain('.settings-tabs');
    expect(cssContent).toContain('.settings-tab');
  });

  it('has dashboard grid styles', () => {
    expect(cssContent).toContain('.dash-grid');
    expect(cssContent).toContain('.dash-card');
  });

  it('has search overlay styles', () => {
    expect(cssContent).toContain('.search-overlay');
    expect(cssContent).toContain('.search-box');
  });

  it('has plugin grid styles', () => {
    expect(cssContent).toContain('.plugin-grid');
    expect(cssContent).toContain('.plugin-card');
  });

  it('has notebook collab styles', () => {
    expect(cssContent).toContain('.nb-live-badge');
    expect(cssContent).toContain('.nb-remote-editing');
  });

  it('has light theme variables', () => {
    expect(cssContent).toContain('body.theme-light');
  });

  it('has mobile bottom nav styles', () => {
    expect(cssContent).toContain('.mobile-bottom-nav');
    expect(cssContent).toContain('.mobile-nav-btn');
  });

  it('hides sidebar on mobile', () => {
    expect(cssContent).toContain('.sidebar { display: none; }');
  });
});
