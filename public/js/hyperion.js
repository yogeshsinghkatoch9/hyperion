/* ═══ HYPERION — Frontend Engine ═══ */

let page = 'assistant';
let terminals = [];
let activeTermIdx = 0;
let systemWs = null;
let fileCurrentPath = '';
let editingFile = null;
let assistantHistory = [];
let _lastSuggestions = [];
let _sessionId = localStorage.getItem('hyperion_sid') || '';

// ── Wave 2 State ──
let _launcherOpen = false;
let _launcherIdx = 0;
let _notifPanelOpen = false;
let _notifPollTimer = null;
let _sysHistory = [];
let _fileViewMode = 'list';
let _termTheme = 'hyperion';
let _termLayout = 'single';
let _broadcastInput = false;

// ── Wave 3 State ──
let _userSettings = {};
let _sidebarCollapsed = false;
let _searchOpen = false;
let _searchIdx = 0;
let _notebookWs = null;
let _notebookLiveCount = 0;

// ── Grouped Sidebar Navigation ──
const NAV_GROUPS = [
  { id: 'core', label: 'Core', icon: '&#9670;', items: [
    { page: 'dashboard', label: 'Dashboard', icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
    { page: 'terminal', label: 'Terminal', icon: '<polyline points="4,17 10,11 4,5"/><line x1="12" y1="19" x2="20" y2="19"/>' },
    { page: 'files', label: 'Files', icon: '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>' },
    { page: 'code', label: 'Code Runner', icon: '<polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/>' },
    { page: 'notebooks', label: 'Notebooks', icon: '<path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>' },
    { page: 'snippets', label: 'Snippets', icon: '<polyline points="16,18 22,12 16,6"/><polyline points="8,6 2,12 8,18"/>' },
  ]},
  { id: 'ai', label: 'AI & Automation', icon: '&#9733;', items: [
    { page: 'assistant', label: 'Assistant', icon: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>' },
    { page: 'nova', label: 'NOVA', icon: '<polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>' },
    { page: 'agents', label: 'Agents', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>' },
    { page: 'workflows', label: 'Workflows', icon: '<path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
    { page: 'skills', label: 'Skills', icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>' },
    { page: 'plugins', label: 'Plugins', icon: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>' },
    { page: 'chat', label: 'AI Chat', icon: '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>' },
  ]},
  { id: 'devops', label: 'DevOps', icon: '&#9881;', items: [
    { page: 'gitclient', label: 'Git', icon: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 012 2v7"/><path d="M6 9v12"/>' },
    { page: 'docker', label: 'Docker', icon: '<rect x="1" y="12" width="6" height="5" rx="1"/><rect x="9" y="12" width="6" height="5" rx="1"/><rect x="17" y="12" width="6" height="5" rx="1"/><rect x="5" y="6" width="6" height="5" rx="1"/><rect x="13" y="6" width="6" height="5" rx="1"/><path d="M1 17c0 2 3 4 11 4s11-2 11-4"/>' },
    { page: 'ssh', label: 'SSH', icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h4M6 12h.01M10 12h8M6 16h12"/>', hidden: true },
    { page: 'tunnels', label: 'SSH Tunnels', icon: '<path d="M4 14a1 1 0 01-1-1v-2a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1"/><line x1="6" y1="8" x2="6" y2="16"/><line x1="18" y1="8" x2="18" y2="16"/>' },
    { page: 'dbexplorer', label: 'DB Explorer', icon: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>' },
    { page: 'envmanager', label: 'Env Vars', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
    { page: 'cronmanager', label: 'Cron', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>' },
    { page: 'processes', label: 'Processes', icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>' },
  ]},
  { id: 'network', label: 'Network & API', icon: '&#8644;', items: [
    { page: 'httpclient', label: 'HTTP Client', icon: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>' },
    { page: 'wstester', label: 'WebSocket', icon: '<path d="M4 4l4.5 4.5"/><path d="M19.5 19.5L15 15"/><path d="M4 20l4.5-4.5"/><path d="M19.5 4.5L15 9"/><circle cx="12" cy="12" r="3"/>' },
    { page: 'mockapi', label: 'Mock API', icon: '<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 12h8"/><path d="M8 8h8"/><path d="M8 16h4"/>' },
    { page: 'nettools', label: 'Network', icon: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>' },
    { page: 'loadtest', label: 'Load Test', icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>' },
    { page: 'linkcheck', label: 'Link Check', icon: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/><path d="M9 15l6-6"/>' },
    { page: 'webhooks', label: 'Webhooks', icon: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>' },
  ]},
  { id: 'tools', label: 'Dev Tools', icon: '&#9874;', items: [
    { page: 'toolkit', label: 'Toolkit', icon: '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>' },
    { page: 'regex', label: 'Regex', icon: '<path d="M17 3l-5 5M12 12l5 5M7 8l5 4-5 4"/><line x1="3" y1="12" x2="7" y2="12"/>' },
    { page: 'jwt', label: 'JWT', icon: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1"/><line x1="12" y1="17" x2="12" y2="19"/>' },
    { page: 'diff', label: 'Diff', icon: '<path d="M12 3v18"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="M8 6l-2 2 2 2"/><path d="M16 14l2 2-2 2"/>' },
    { page: 'jsontools', label: 'JSON', icon: '<path d="M8 3H7a2 2 0 00-2 2v5a2 2 0 01-2 2 2 2 0 012 2v5a2 2 0 002 2h1"/><path d="M16 3h1a2 2 0 012 2v5a2 2 0 002 2 2 2 0 00-2 2v5a2 2 0 01-2 2h-1"/>' },
    { page: 'yamltools', label: 'YAML', icon: '<path d="M4 4l4 6v10M20 4l-4 6v10M12 4v6l-4 6"/>' },
    { page: 'base64', label: 'Base64', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h2v2H8zM14 8h2v2h-2zM8 14h2v2H8zM14 14h2v2h-2z"/>' },
    { page: 'hashgen', label: 'Hash', icon: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>' },
    { page: 'uuidgen', label: 'UUID', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h4M13 10h4M7 14h10"/>' },
    { page: 'colors', label: 'Colors', icon: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="8" r="2" fill="currentColor" opacity="0.3"/><circle cx="8" cy="14" r="2" fill="currentColor" opacity="0.3"/><circle cx="16" cy="14" r="2" fill="currentColor" opacity="0.3"/>' },
    { page: 'cronexpr', label: 'Cron Builder', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 8,14"/><path d="M20 4l1.5-1.5M4 4L2.5 2.5"/>' },
    { page: 'images', label: 'Images', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>' },
    { page: 'texttools', label: 'Text Tools', icon: '<polyline points="4,7 4,4 20,4 20,7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>' },
    { page: 'loremgen', label: 'Lorem', icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>' },
    { page: 'deps', label: 'Deps Audit', icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>' },
  ]},
  { id: 'workspace', label: 'Workspace', icon: '&#9998;', items: [
    { page: 'canvas', label: 'Canvas', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>' },
    { page: 'markdown', label: 'Markdown', icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
    { page: 'notes', label: 'Notes', icon: '<path d="M15.5 3H5a2 2 0 00-2 2v14c0 1.1.9 2 2 2h14a2 2 0 002-2V8.5L15.5 3z"/><polyline points="14,3 14,8 21,8"/>' },
    { page: 'bookmarks', label: 'Bookmarks', icon: '<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>' },
    { page: 'clipboard', label: 'Clipboard', icon: '<path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>' },
    { page: 'dataview', label: 'Data Viewer', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>' },
    { page: 'pomodoro', label: 'Pomodoro', icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3l-2 2"/><path d="M19 3l2 2"/>' },
  ]},
  { id: 'security', label: 'Security', icon: '&#128274;', items: [
    { page: 'vault', label: 'Vault', icon: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><circle cx="12" cy="16" r="1"/>' },
  ]},
  { id: 'monitoring', label: 'Monitoring', icon: '&#9632;', items: [
    { page: 'system', label: 'System Info', icon: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' },
    { page: 'monitor', label: 'Monitor', icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
    { page: 'logs', label: 'Logs', icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
    { page: 'analytics', label: 'Analytics', icon: '<rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>' },
    { page: 'metricshistory', label: 'Metrics', icon: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>' },
    { page: 'healthdash', label: 'Health', icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/><circle cx="12" cy="12" r="1" fill="currentColor"/>' },
    { page: 'remote', label: 'Remote Desktop', icon: '<rect x="2" y="3" width="20" height="14" rx="2"/><circle cx="12" cy="10" r="1" fill="currentColor"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/>' },
  ]},
  { id: 'admin', label: 'Admin', icon: '&#9881;', items: [
    { page: 'backups', label: 'Backups', icon: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>' },
    { page: 'auditviewer', label: 'Audit Log', icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/>' },
    { page: 'apidocs', label: 'API Docs', icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>' },
    { page: 'shortcuts', label: 'Shortcuts', icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h4M6 12h.01M10 12h8M6 16h12"/>' },
    { page: 'widgets', label: 'Widgets', icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
    { page: 'filehistory', label: 'File History', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>' },
  ]},
];

// Build flat lookup for quick access
const _navItemMap = {};
NAV_GROUPS.forEach(g => g.items.forEach(item => { if (!item.hidden) _navItemMap[item.page] = item; }));

let _navFavorites = JSON.parse(localStorage.getItem('hyperion_nav_favs') || '[]');
let _navRecents = JSON.parse(localStorage.getItem('hyperion_nav_recents') || '[]');
let _navCollapsed = {};

// ── Mega-menu: combine 10 groups into 4 categories ──
const NAV_MEGA = [
  { id: 'dev', label: 'Dev', groups: ['core', 'workspace'] },
  { id: 'ai', label: 'AI', groups: ['ai'] },
  { id: 'infra', label: 'Infra', groups: ['devops', 'network', 'monitoring'] },
  { id: 'toolkit', label: 'Toolkit', groups: ['tools', 'security', 'admin'] },
];

function _navSvg(iconPath) {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconPath}</svg>`;
}

function _navBtn(item, showPin) {
  const isPinned = _navFavorites.includes(item.page);
  const pinCls = isPinned ? ' pinned' : '';
  const pinHtml = showPin ? `<button class="nav-pin${pinCls}" onclick="event.stopPropagation();_toggleNavPin('${item.page}')" title="${isPinned ? 'Unpin' : 'Pin to favorites'}">${isPinned ? '&#9733;' : '&#9734;'}</button>` : '';
  return `<button class="dd-item" data-page="${item.page}" onclick="go('${item.page}');_closeAllDropdowns()" aria-label="${item.label}">${_navSvg(item.icon)}<span>${item.label}</span>${pinHtml}</button>`;
}

function _favBtn(item) {
  return `<button class="fav-btn" data-page="${item.page}" onclick="go('${item.page}')" aria-label="${item.label}">${_navSvg(item.icon)}<span>${item.label}</span></button>`;
}

function buildGroupedNav() {
  // All navigation lives in the hamburger sidebar — no dropdown rendering
  var container = document.getElementById('navItems');
  if (container) container.innerHTML = '';
}

function _toggleDropdown(groupId) {
  var allDropdowns = document.querySelectorAll('.topnav-dropdown');
  var allBtns = document.querySelectorAll('.topnav-group-btn');
  var dd = document.getElementById('dd-' + groupId);
  var btn = dd ? dd.previousElementSibling : null;
  var overlay = document.getElementById('dropdownOverlay');
  var isOpen = dd ? dd.classList.contains('open') : false;

  // Close all
  allDropdowns.forEach(function(d) { d.classList.remove('open'); });
  allBtns.forEach(function(b) { b.classList.remove('open'); });

  if (!isOpen && dd) {
    dd.classList.add('open');
    if (btn) btn.classList.add('open');
    var btnRect = btn.getBoundingClientRect();
    var navRect = document.querySelector('.topnav').getBoundingClientRect();
    dd.style.top = navRect.bottom + 'px';

    if (dd.classList.contains('mega')) {
      // Mega-menu: center under button, clamped to viewport
      dd.style.left = '0';
      requestAnimationFrame(function() {
        var ddW = dd.offsetWidth;
        var left = btnRect.left + btnRect.width / 2 - ddW / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - ddW - 8));
        dd.style.left = left + 'px';
      });
    } else {
      dd.style.left = Math.max(4, btnRect.left) + 'px';
      requestAnimationFrame(function() {
        var ddRect = dd.getBoundingClientRect();
        if (ddRect.right > window.innerWidth - 8) {
          dd.style.left = (window.innerWidth - ddRect.width - 8) + 'px';
        }
      });
    }
    if (overlay) overlay.classList.add('open');
  } else {
    if (overlay) overlay.classList.remove('open');
  }
}

window._closeAllDropdowns = function() {
  document.querySelectorAll('.topnav-dropdown').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.topnav-group-btn').forEach(b => b.classList.remove('open'));
  document.getElementById('dropdownOverlay')?.classList.remove('open');
  const sr = document.getElementById('navSearchResults');
  if (sr) sr.classList.remove('open');
};

// ── Hamburger sidebar nav ──
window._toggleMobileNav = function() {
  var nav = document.getElementById('mobileNav');
  var btn = document.getElementById('hamburgerBtn');
  var overlay = document.getElementById('navSidebarOverlay');
  if (!nav) return;
  if (nav.classList.contains('open')) {
    nav.classList.remove('open');
    if (btn) btn.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    return;
  }
  // Build sidebar content
  var groupMap = {};
  NAV_GROUPS.forEach(function(g) { groupMap[g.id] = g; });
  var html = '';
  // Dashboard first
  html += '<button class="ns-item' + (page === 'dashboard' ? ' active' : '') + '" onclick="go(\'dashboard\');_toggleMobileNav()">' + _navSvg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>') + '<span>Dashboard</span></button>';
  for (var m = 0; m < NAV_MEGA.length; m++) {
    var mega = NAV_MEGA[m];
    var subGroups = mega.groups.map(function(gid) { return groupMap[gid]; }).filter(Boolean);
    for (var s = 0; s < subGroups.length; s++) {
      var sg = subGroups[s];
      var vis = sg.items.filter(function(i) { return !i.hidden && i.page !== 'dashboard'; });
      if (!vis.length) continue;
      html += '<div class="ns-section"><div class="ns-section-title">' + sg.label + '</div>';
      for (var v = 0; v < vis.length; v++) {
        var item = vis[v];
        var isPinned = _navFavorites.indexOf(item.page) >= 0;
        html += '<button class="ns-item' + (item.page === page ? ' active' : '') + '" onclick="go(\'' + item.page + '\');_toggleMobileNav()">' + _navSvg(item.icon) + '<span>' + item.label + '</span>';
        html += '<span class="ns-pin' + (isPinned ? ' pinned' : '') + '" onclick="event.stopPropagation();_toggleNavPin(\'' + item.page + '\');_rebuildSidebar()">' + (isPinned ? '&#9733;' : '&#9734;') + '</span>';
        html += '</button>';
      }
      html += '</div>';
    }
  }
  nav.innerHTML = html;
  nav.classList.add('open');
  if (btn) btn.classList.add('open');
  if (overlay) overlay.classList.add('open');
};

window._rebuildSidebar = function() {
  var nav = document.getElementById('mobileNav');
  if (nav && nav.classList.contains('open')) {
    nav.classList.remove('open');
    _toggleMobileNav();
  }
};

function _toggleNavGroup(groupId) {
  _toggleDropdown(groupId);
}

function _toggleNavPin(pageName) {
  const idx = _navFavorites.indexOf(pageName);
  if (idx >= 0) _navFavorites.splice(idx, 1);
  else _navFavorites.push(pageName);
  localStorage.setItem('hyperion_nav_favs', JSON.stringify(_navFavorites));
  buildGroupedNav();
}

function _trackNavRecent(pageName) {
  _navRecents = _navRecents.filter(p => p !== pageName);
  _navRecents.unshift(pageName);
  if (_navRecents.length > 5) _navRecents = _navRecents.slice(0, 5);
  localStorage.setItem('hyperion_nav_recents', JSON.stringify(_navRecents));
  _renderNavRecents();
}

function _renderNavFavorites() {
  // Favorites shown in hamburger sidebar only
}

function _renderNavRecents() {
  // Recents shown in hamburger sidebar only
}

function _highlightActiveNav() {
  document.querySelectorAll('.dd-item, .fav-btn, .topnav-dash-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
}

function _filterNav(query) {
  const q = query.toLowerCase().trim();
  _closeAllDropdowns();

  // Get or create search results dropdown
  let sr = document.getElementById('navSearchResults');
  if (!sr) {
    sr = document.createElement('div');
    sr.id = 'navSearchResults';
    sr.className = 'topnav-search-results';
    document.querySelector('.topnav-right .nav-search-wrap').appendChild(sr);
  }

  if (!q) {
    sr.classList.remove('open');
    return;
  }

  // Search all nav items
  let results = '';
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.hidden) continue;
      const match = item.label.toLowerCase().includes(q) || item.page.includes(q);
      if (match) {
        results += `<button class="dd-item${item.page === page ? ' active' : ''}" data-page="${item.page}" onclick="go('${item.page}');_closeAllDropdowns();document.getElementById('navSearch').value=''" aria-label="${item.label}">${_navSvg(item.icon)}<span>${item.label}</span><span style="margin-left:auto;font:10px var(--mono);color:var(--text3)">${group.label}</span></button>`;
      }
    }
  }

  sr.innerHTML = results || '<div style="padding:12px;color:var(--text3);font:12px var(--sans);text-align:center">No results</div>';
  const navRect = document.querySelector('.topnav').getBoundingClientRect();
  sr.style.top = navRect.bottom + 'px';
  sr.classList.add('open');
}

// ── Default Keybindings ──
const DEFAULT_KEYBINDINGS = {
  launcher: { key: 'k', meta: true, desc: 'Quick Launcher' },
  search: { key: 'f', meta: true, shift: true, desc: 'Search Everywhere' },
  dashboard: { key: '1', ctrl: true, desc: 'Dashboard' },
  assistant: { key: '2', ctrl: true, desc: 'Assistant' },
  terminal: { key: '3', ctrl: true, desc: 'Terminal' },
  nova: { key: '4', ctrl: true, desc: 'NOVA' },
  code: { key: '5', ctrl: true, desc: 'Code Runner' },
  files: { key: '6', ctrl: true, desc: 'Files' },
  notebooks: { key: '7', ctrl: true, desc: 'Notebooks' },
  agents: { key: '8', ctrl: true, desc: 'Agents' },
  settings: { key: ',', meta: true, desc: 'Settings' },
  newTerminal: { key: 't', meta: true, desc: 'New Terminal' },
};

function getKeybindings() {
  const merged = { ...DEFAULT_KEYBINDINGS };
  for (const [action, kb] of Object.entries(merged)) {
    const override = _userSettings[`keybinding_${action}`];
    if (override) Object.assign(merged[action], override);
  }
  return merged;
}

// ── Error Boundary ──
window.addEventListener('error', (e) => {
  console.error('[Hyperion Error]', e.error);
  _showErrorToast(e.message || 'An unexpected error occurred');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Hyperion Rejection]', e.reason);
  _showErrorToast(String(e.reason || 'An unexpected error occurred'));
});
function _showErrorToast(msg) {
  let toast = document.getElementById('errorToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'errorToast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#2A2520;border:1px solid #EF5350;color:#EF5350;padding:12px 20px;border-radius:8px;font:13px/1.5 var(--mono);max-width:400px;z-index:99999;opacity:0;transition:opacity .3s;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg.length > 150 ? msg.slice(0, 150) + '...' : msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 5000);
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  buildGroupedNav();
  // Show boot animation only on fresh visits (not refreshes with active session)
  if (!sessionStorage.getItem('hyperion_booted')) {
    runBootSequence();
    sessionStorage.setItem('hyperion_booted', '1');
  }
  checkAuth();
  initGlobalKeyHandler();
  startNotifPoll();
  // Focus nav search on "/" key
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.contentEditable === 'true')) return;
      e.preventDefault();
      const navSearch = document.getElementById('navSearch');
      if (navSearch) navSearch.focus();
    }
  });
});

// ═══ AUTH ═══
async function checkAuth() {
  try {
    const status = await fetch('/api/auth/status', {
      headers: { 'X-Session-Id': _sessionId }
    }).then(r => r.json());

    if (status.needsSetup) {
      showSetup();
    } else if (!status.authenticated) {
      showLogin();
    } else {
      go('dashboard');
      startSystemWs();
      loadUserSettings();
    }
  } catch {
    go('dashboard');
    startSystemWs();
  }
}

function showLogin(isRegister) {
  const main = document.getElementById('main');
  document.querySelector('.topnav').style.display = 'none';
  const reg = !!isRegister;
  main.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg)">
      <div style="width:340px;padding:32px;background:var(--bg2);border:1px solid var(--border);border-radius:12px">
        <div style="text-align:center;margin-bottom:24px">
          <div class="assistant-logo" style="margin:0 auto 12px">H</div>
          <h2 style="font:700 20px var(--sans)">HYPERION</h2>
          <p style="color:var(--text3);font:13px var(--sans);margin-top:4px">${reg ? 'Create your account' : 'Sign in to continue'}</p>
        </div>
        <div id="loginError" style="display:none;color:var(--red);font:12px var(--sans);margin-bottom:10px;padding:8px;background:rgba(239,83,80,0.1);border-radius:4px"></div>
        <div class="form-group"><label>Username</label><input id="loginUser" autofocus></div>
        <div class="form-group"><label>Password${reg ? ' (min 6 chars)' : ''}</label><input id="loginPass" type="password" ${reg ? '' : 'onkeydown="if(event.key===\'Enter\')doLogin()"'}></div>
        ${reg ? '<div class="form-group"><label>Confirm Password</label><input id="loginPass2" type="password" onkeydown="if(event.key===\'Enter\')doRegister()"></div>' : ''}
        <button class="btn btn-green" style="width:100%;justify-content:center;margin-top:8px" onclick="${reg ? 'doRegister()' : 'doLogin()'}">
          ${reg ? 'Create Account' : 'Sign In'}
        </button>
        <p style="text-align:center;margin-top:14px;font:13px var(--sans);color:var(--text3)">
          ${reg
            ? 'Already have an account? <a href="#" onclick="showLogin();return false" style="color:var(--green);text-decoration:none">Sign in</a>'
            : 'Don\'t have an account? <a href="#" onclick="showLogin(true);return false" style="color:var(--green);text-decoration:none">Create one</a>'}
        </p>
      </div>
    </div>
  `;
}

async function doLogin() {
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(r => r.json());

    if (res.error) {
      errEl.textContent = res.error;
      errEl.style.display = 'block';
      return;
    }

    // 2FA challenge
    if (res.requires2fa) {
      _show2FAPrompt(res.tempToken);
      return;
    }

    _sessionId = res.sessionId;
    localStorage.setItem('hyperion_sid', _sessionId);
    document.querySelector('.topnav').style.display = '';
    go('dashboard');
    startSystemWs();
    loadUserSettings();
  } catch {
    errEl.textContent = 'Connection failed';
    errEl.style.display = 'block';
  }
}

async function doRegister() {
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;
  const password2 = document.getElementById('loginPass2').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';

  if (password !== password2) {
    errEl.textContent = 'Passwords do not match';
    errEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(r => r.json());

    if (res.error) {
      errEl.textContent = res.error;
      errEl.style.display = 'block';
      return;
    }

    _sessionId = res.sessionId;
    localStorage.setItem('hyperion_sid', _sessionId);
    showOnboarding();
  } catch {
    errEl.textContent = 'Connection failed';
    errEl.style.display = 'block';
  }
}

function _show2FAPrompt(tempToken) {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg)">
      <div style="width:340px;padding:32px;background:var(--bg2);border:1px solid var(--border);border-radius:12px">
        <div style="text-align:center;margin-bottom:24px">
          <div class="assistant-logo" style="margin:0 auto 12px">H</div>
          <h2 style="font:700 20px var(--sans)">Two-Factor Auth</h2>
          <p style="color:var(--text3);font:13px var(--sans);margin-top:4px">Enter the code from your authenticator app</p>
        </div>
        <div id="totpLoginError" style="display:none;color:var(--red);font:12px var(--sans);margin-bottom:10px;padding:8px;background:rgba(239,83,80,0.1);border-radius:4px"></div>
        <div class="form-group"><label>6-digit code</label><input id="totpLoginCode" maxlength="8" autofocus onkeydown="if(event.key==='Enter')_validate2FA('${tempToken}')"></div>
        <button class="btn btn-green" style="width:100%;justify-content:center;margin-top:8px" onclick="_validate2FA('${tempToken}')">Verify</button>
        <button class="btn" style="width:100%;justify-content:center;margin-top:8px" onclick="showLogin()">Back</button>
      </div>
    </div>
  `;
}

async function _validate2FA(tempToken) {
  const token = document.getElementById('totpLoginCode').value.trim();
  const errEl = document.getElementById('totpLoginError');
  errEl.style.display = 'none';
  try {
    const res = await fetch('/api/auth/totp/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, token }),
    }).then(r => r.json());
    if (res.error) { errEl.textContent = res.error; errEl.style.display = 'block'; return; }
    _sessionId = res.sessionId;
    localStorage.setItem('hyperion_sid', _sessionId);
    document.querySelector('.topnav').style.display = '';
    go('dashboard');
    startSystemWs();
    loadUserSettings();
  } catch { errEl.textContent = 'Verification failed'; errEl.style.display = 'block'; }
}

function showSetup() {
  const main = document.getElementById('main');
  document.querySelector('.topnav').style.display = 'none';
  main.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg)">
      <div style="width:340px;padding:32px;background:var(--bg2);border:1px solid var(--border);border-radius:12px">
        <div style="text-align:center;margin-bottom:24px">
          <div class="assistant-logo" style="margin:0 auto 12px">H</div>
          <h2 style="font:700 20px var(--sans)">Welcome to HYPERION</h2>
          <p style="color:var(--text3);font:13px var(--sans);margin-top:4px">Create your admin account</p>
        </div>
        <div id="setupError" style="display:none;color:var(--red);font:12px var(--sans);margin-bottom:10px;padding:8px;background:rgba(239,83,80,0.1);border-radius:4px"></div>
        <div class="form-group"><label>Username</label><input id="setupUser" autofocus></div>
        <div class="form-group"><label>Password (min 6 chars)</label><input id="setupPass" type="password"></div>
        <div class="form-group"><label>Confirm Password</label><input id="setupPass2" type="password" onkeydown="if(event.key==='Enter')doSetup()"></div>
        <button class="btn btn-green" style="width:100%;justify-content:center;margin-top:8px" onclick="doSetup()">Create Account</button>
      </div>
    </div>
  `;
}

async function doSetup() {
  const username = document.getElementById('setupUser').value;
  const password = document.getElementById('setupPass').value;
  const password2 = document.getElementById('setupPass2').value;
  const errEl = document.getElementById('setupError');
  errEl.style.display = 'none';

  if (password !== password2) {
    errEl.textContent = 'Passwords do not match';
    errEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }).then(r => r.json());

    if (res.error) {
      errEl.textContent = res.error;
      errEl.style.display = 'block';
      return;
    }

    _sessionId = res.sessionId;
    localStorage.setItem('hyperion_sid', _sessionId);
    showOnboarding();
  } catch {
    errEl.textContent = 'Connection failed';
    errEl.style.display = 'block';
  }
}

/* ═══ Onboarding Wizard + Guided Tour ═══ */

const OB_PROVIDERS = [
  { id: 'ollama', name: 'Ollama', hint: 'Local models, no API key', badge: 'FREE', needsKey: false, defaultModel: 'llama3' },
  { id: 'gemini', name: 'Google Gemini', hint: 'Free tier available', badge: 'FREE TIER', needsKey: true, defaultModel: 'gemini-2.5-flash' },
  { id: 'openai', name: 'OpenAI', hint: 'GPT-4o, GPT-4o-mini', badge: null, needsKey: true, defaultModel: 'gpt-4o-mini' },
  { id: 'anthropic', name: 'Claude / Anthropic', hint: 'Claude 4 Sonnet, Haiku', badge: null, needsKey: true, defaultModel: 'claude-sonnet-4-6' },
  { id: 'xai', name: 'Grok / xAI', hint: 'Grok-2, Grok-3', badge: null, needsKey: true, defaultModel: 'grok-2' },
];

const OB_PRESETS = [
  { id: 'devops', label: 'DevOps', icon: '🐳', desc: 'Docker, monitoring, and CI/CD', favs: ['docker', 'gitclient', 'terminal', 'monitor', 'logs', 'cronmanager'], defaultPage: 'terminal' },
  { id: 'developer', label: 'Developer', icon: '💻', desc: 'Code, notebooks, and version control', favs: ['terminal', 'code', 'notebooks', 'snippets', 'deps', 'gitclient'], defaultPage: 'code' },
  { id: 'sysadmin', label: 'System Admin', icon: '🖥️', desc: 'System management and networking', favs: ['system', 'processes', 'nettools', 'backups', 'vault', 'logs'], defaultPage: 'system' },
  { id: 'general', label: 'All-Purpose', icon: '⚡', desc: 'A bit of everything', favs: ['dashboard', 'terminal', 'files', 'assistant', 'chat', 'docker'], defaultPage: 'dashboard' },
];

function showOnboarding() {
  let _obStep = 0;
  let _obProvider = null;
  let _obApiKey = '';
  let _obPreset = OB_PRESETS[3]; // default all-purpose
  let _obTheme = 'dark';
  let _obProviderTested = false;

  function _obDots() {
    return Array.from({ length: 6 }, (_, i) =>
      `<div class="ob-dot${i === _obStep ? ' active' : ''}"></div>`
    ).join('');
  }

  function _obRender() {
    // Remove existing overlay
    const old = document.querySelector('.ob-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ob-overlay';

    let body = '';
    switch (_obStep) {
      case 0: // Welcome
        body = `
          <div style="text-align:center">
            <div class="ob-icon">H</div>
            <div class="ob-title">Welcome to Hyperion</div>
            <div class="ob-sub">Your self-hosted computing platform with 55+ tools.<br>Let's get you set up — takes under a minute.</div>
          </div>
          <div class="ob-footer">
            <div class="ob-dots">${_obDots()}</div>
            <div style="display:flex;gap:8px">
              <button class="btn" onclick="_obSkip()">Skip setup</button>
              <button class="btn btn-green" onclick="_obNext()">Get Started</button>
            </div>
          </div>`;
        break;

      case 1: // AI Provider
        body = `
          <div style="text-align:center">
            <div class="ob-icon">🤖</div>
            <div class="ob-title">AI Provider</div>
            <div class="ob-sub">Choose an AI backend for chat, code generation, and automation.</div>
          </div>
          <div class="ob-providers">
            ${OB_PROVIDERS.map(p => `
              <div class="ob-prov-card${_obProvider && _obProvider.id === p.id ? ' selected' : ''}" onclick="_obSelectProvider('${p.id}')">
                ${p.badge ? `<span class="ob-prov-badge">${p.badge}</span>` : ''}
                <div class="prov-name">${p.name}</div>
                <div class="prov-hint">${p.hint}</div>
              </div>
            `).join('')}
          </div>
          <div id="obProviderConfig"></div>
          <div class="ob-footer">
            <div class="ob-dots">${_obDots()}</div>
            <div style="display:flex;gap:8px">
              <button class="btn" onclick="_obPrev()">Back</button>
              <button class="btn" onclick="_obNext()">Skip</button>
              ${_obProvider ? `<button class="btn btn-green" onclick="_obNext()">Next</button>` : ''}
            </div>
          </div>`;
        break;

      case 2: // AI Intro
        body = `
          <div style="text-align:center">
            <div class="ob-icon">✨</div>
            <div class="ob-title">AI-Powered Tools</div>
            <div class="ob-sub">Your AI assistant can do more than just chat.</div>
          </div>
          <div class="ob-features">
            <div class="ob-feat-card">
              <div class="feat-icon">⌨️</div>
              <div><div class="feat-title">Run Commands</div><div class="feat-desc">Execute shell commands, install packages, and manage files — all from natural language.</div></div>
            </div>
            <div class="ob-feat-card">
              <div class="feat-icon">🐳</div>
              <div><div class="feat-title">Docker & Git</div><div class="feat-desc">Build containers, manage repos, review diffs, and deploy — through conversation.</div></div>
            </div>
            <div class="ob-feat-card">
              <div class="feat-icon">🔄</div>
              <div><div class="feat-title">Automation</div><div class="feat-desc">Create cron jobs, write scripts, set up monitoring, and automate workflows.</div></div>
            </div>
          </div>
          <div class="ob-footer">
            <div class="ob-dots">${_obDots()}</div>
            <div style="display:flex;gap:8px">
              <button class="btn" onclick="_obPrev()">Back</button>
              <button class="btn btn-green" onclick="_obNext()">Next</button>
            </div>
          </div>`;
        break;

      case 3: // Workspace Preset
        body = `
          <div style="text-align:center">
            <div class="ob-icon">📐</div>
            <div class="ob-title">Workspace Preset</div>
            <div class="ob-sub">Choose a starting layout. You can customize everything later.</div>
          </div>
          <div class="ob-presets">
            ${OB_PRESETS.map(p => `
              <div class="ob-preset-card${_obPreset.id === p.id ? ' selected' : ''}" onclick="_obSelectPreset('${p.id}')">
                <div class="preset-icon">${p.icon}</div>
                <div class="preset-label">${p.label}</div>
                <div class="preset-desc">${p.desc}</div>
              </div>
            `).join('')}
          </div>
          <div class="ob-footer">
            <div class="ob-dots">${_obDots()}</div>
            <div style="display:flex;gap:8px">
              <button class="btn" onclick="_obPrev()">Back</button>
              <button class="btn btn-green" onclick="_obNext()">Next</button>
            </div>
          </div>`;
        break;

      case 4: // Theme
        body = `
          <div style="text-align:center">
            <div class="ob-icon">◐</div>
            <div class="ob-title">Choose Your Theme</div>
            <div class="ob-sub">Pick a look that suits you.</div>
          </div>
          <div class="ob-themes">
            <div class="ob-theme-card${_obTheme === 'dark' ? ' selected' : ''}" onclick="_obSetTheme('dark')">
              <div class="theme-preview" style="background:#1C1917;"></div>
              <div class="theme-label">Dark</div>
            </div>
            <div class="ob-theme-card${_obTheme === 'light' ? ' selected' : ''}" onclick="_obSetTheme('light')">
              <div class="theme-preview" style="background:#F5F5F0;"></div>
              <div class="theme-label">Light</div>
            </div>
            <div class="ob-theme-card${_obTheme === 'system' ? ' selected' : ''}" onclick="_obSetTheme('system')">
              <div class="theme-preview" style="background:linear-gradient(135deg,#1C1917 50%,#F5F5F0 50%);"></div>
              <div class="theme-label">System</div>
            </div>
          </div>
          <div class="ob-footer">
            <div class="ob-dots">${_obDots()}</div>
            <div style="display:flex;gap:8px">
              <button class="btn" onclick="_obPrev()">Back</button>
              <button class="btn btn-green" onclick="_obNext()">Next</button>
            </div>
          </div>`;
        break;

      case 5: // Ready
        const provLabel = _obProvider
          ? `<span class="check">✓</span> ${_obProvider.name}${_obProviderTested ? ' (tested)' : ''}`
          : `<span class="skip">—</span> Skipped (configure later in Settings)`;
        body = `
          <div style="text-align:center">
            <div class="ob-icon">🚀</div>
            <div class="ob-title">You're Ready</div>
            <div class="ob-sub">Here's your setup summary.</div>
          </div>
          <ul class="ob-summary">
            <li>${provLabel}</li>
            <li><span class="check">✓</span> Workspace: ${_obPreset.label}</li>
            <li><span class="check">✓</span> Theme: ${_obTheme.charAt(0).toUpperCase() + _obTheme.slice(1)}</li>
          </ul>
          <button class="ob-launch-btn" onclick="_obFinish()">Launch Hyperion</button>
          <div class="ob-footer" style="margin-top:16px">
            <div class="ob-dots">${_obDots()}</div>
            <button class="btn" onclick="_obPrev()">Back</button>
          </div>`;
        break;
    }

    overlay.innerHTML = `<div class="ob-card">${body}</div>`;
    document.body.appendChild(overlay);

    // Re-render provider config if on step 1 and a provider is selected
    if (_obStep === 1 && _obProvider) {
      _obRenderProviderConfig();
    }
  }

  function _obRenderProviderConfig() {
    const el = document.getElementById('obProviderConfig');
    if (!el) return;
    const p = _obProvider;
    if (p.needsKey) {
      el.innerHTML = `
        <div class="ob-key-row">
          <input type="password" id="obApiKey" placeholder="Paste your ${p.name} API key" value="${_obApiKey}" oninput="_obApiKey=this.value">
          <button onclick="_obTestProvider()">Test</button>
        </div>
        <div class="ob-test-status" id="obTestStatus"></div>`;
    } else {
      el.innerHTML = `
        <div style="margin-top:12px">
          <button class="btn btn-green" onclick="_obTestProvider()" style="width:100%">Test Ollama Connection</button>
        </div>
        <div class="ob-test-status" id="obTestStatus"></div>`;
    }
  }

  window._obNext = () => { _obStep = Math.min(_obStep + 1, 5); _obRender(); };
  window._obPrev = () => { _obStep = Math.max(_obStep - 1, 0); _obRender(); };
  window._obSkip = () => {
    localStorage.setItem('hyperion_onboarded', '1');
    const overlay = document.querySelector('.ob-overlay');
    if (overlay) overlay.remove();
    document.querySelector('.topnav').style.display = '';
    go('dashboard');
    startSystemWs();
    loadUserSettings();
  };

  window._obSelectProvider = (id) => {
    _obProvider = OB_PROVIDERS.find(p => p.id === id);
    _obApiKey = '';
    _obProviderTested = false;
    _obRender();
  };

  window._obSelectPreset = (id) => {
    _obPreset = OB_PRESETS.find(p => p.id === id);
    _obRender();
  };

  window._obSetTheme = (t) => {
    _obTheme = t;
    // Live preview
    if (t === 'system') {
      _applySystemTheme();
    } else if (t === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
    _obRender();
  };

  window._obTestProvider = async () => {
    const statusEl = document.getElementById('obTestStatus');
    if (!statusEl) return;
    statusEl.className = 'ob-test-status';
    statusEl.style.display = 'block';
    statusEl.textContent = 'Testing connection…';
    statusEl.style.color = 'var(--text2)';
    statusEl.style.background = 'var(--bg3)';

    try {
      const p = _obProvider;
      // Save provider settings first
      const settingsPayload = { llm_provider: p.id };
      if (p.needsKey) {
        _obApiKey = document.getElementById('obApiKey')?.value || _obApiKey;
        settingsPayload.llm_api_key = _obApiKey;
      }
      settingsPayload.llm_model = p.defaultModel;
      await api('/api/settings', 'PUT', settingsPayload);

      // Test connection
      const start = Date.now();
      const res = await api('/api/llm/test', 'POST', { provider: p.id });
      const latency = Date.now() - start;

      if (res.ok || res.success || res.status === 'ok') {
        statusEl.className = 'ob-test-status ok';
        statusEl.textContent = `Connected — ${p.defaultModel} (${latency}ms)`;
        _obProviderTested = true;
      } else {
        statusEl.className = 'ob-test-status err';
        statusEl.textContent = res.error || res.message || 'Connection failed';
      }
    } catch (e) {
      statusEl.className = 'ob-test-status err';
      statusEl.textContent = e.message || 'Connection failed';
    }
  };

  window._obFinish = async () => {
    try {
      // 1. Save LLM provider settings
      if (_obProvider) {
        const payload = { llm_provider: _obProvider.id, llm_model: _obProvider.defaultModel };
        if (_obProvider.needsKey && _obApiKey) payload.llm_api_key = _obApiKey;
        await api('/api/settings', 'PUT', payload);
      }

      // 2. Set nav favorites from preset
      _navFavorites = [..._obPreset.favs];
      localStorage.setItem('hyperion_nav_favs', JSON.stringify(_navFavorites));
      buildGroupedNav();

      // 3. Save theme
      await api('/api/settings', 'PUT', { theme: _obTheme });

      // 4. Mark onboarded
      localStorage.setItem('hyperion_onboarded', '1');

      // 5. Clean up overlay and show app
      const overlay = document.querySelector('.ob-overlay');
      if (overlay) overlay.remove();
      document.querySelector('.topnav').style.display = '';
      go(_obPreset.defaultPage);
      startSystemWs();
      loadUserSettings();

      // 6. Start guided tour after a brief delay
      setTimeout(startGuidedTour, 600);
    } catch (e) {
      console.error('Onboarding finish error:', e);
      // Fallback — still let user in
      localStorage.setItem('hyperion_onboarded', '1');
      const overlay = document.querySelector('.ob-overlay');
      if (overlay) overlay.remove();
      document.querySelector('.topnav').style.display = '';
      go('dashboard');
      startSystemWs();
      loadUserSettings();
    }
  };

  _obRender();
}

/* ═══ Guided Tour — Spotlight Walkthrough ═══ */

function startGuidedTour() {
  if (localStorage.getItem('hyperion_toured') === '1') return;

  const TOUR_STEPS = [
    { target: '.topnav-groups', title: 'Navigation', desc: '55+ tools organized in dropdown menus. Click any category to see its tools. Star items to pin them to the top bar.', position: 'below' },
    { target: '.nav-search-wrap', title: 'Quick Search', desc: 'Search for any tool instantly. Press / from anywhere to focus the search bar.', position: 'below' },
    { target: '.topnav-right', title: 'Quick Actions', desc: 'Access settings, notifications, and system stats. Everything you need is one click away.', position: 'below' },
    { target: 'body', title: 'Command Palette (Cmd+K)', desc: 'Press Cmd+K (or Ctrl+K) anywhere to instantly search and launch any tool, page, or action.', position: 'center' },
  ];

  let tourStep = 0;
  let backdrop, spotlight, tooltip;

  function createTourElements() {
    backdrop = document.createElement('div');
    backdrop.className = 'tour-backdrop';
    backdrop.onclick = () => {}; // absorb clicks

    spotlight = document.createElement('div');
    spotlight.className = 'tour-spotlight';

    tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';

    document.body.appendChild(backdrop);
    document.body.appendChild(spotlight);
    document.body.appendChild(tooltip);
  }

  function positionTour() {
    const step = TOUR_STEPS[tourStep];
    const isCenter = step.position === 'center';

    if (isCenter) {
      // Centered overlay — no spotlight cutout
      spotlight.style.display = 'none';

      const tw = 320;
      const th = 200;
      tooltip.style.left = `${(window.innerWidth - tw) / 2}px`;
      tooltip.style.top = `${(window.innerHeight - th) / 2}px`;
    } else {
      const el = document.querySelector(step.target);
      if (!el) { tourNext(); return; }

      const rect = el.getBoundingClientRect();
      const pad = 6;

      // Position spotlight over target
      spotlight.style.display = '';
      spotlight.style.left = `${rect.left - pad}px`;
      spotlight.style.top = `${rect.top - pad}px`;
      spotlight.style.width = `${rect.width + pad * 2}px`;
      spotlight.style.height = `${rect.height + pad * 2}px`;

      // Position tooltip
      const tw = 320;
      let tooltipLeft, tooltipTop;

      if (step.position === 'below') {
        tooltipLeft = rect.left;
        tooltipTop = rect.bottom + 12;
        if (tooltipLeft + tw > window.innerWidth - 16) tooltipLeft = window.innerWidth - tw - 16;
      } else if (step.position === 'right-above') {
        tooltipLeft = rect.right + 16;
        tooltipTop = rect.bottom - 200;
      } else {
        tooltipLeft = rect.right + 16;
        tooltipTop = rect.top;
      }

      // Viewport clamping
      if (tooltipLeft + tw > window.innerWidth - 16) tooltipLeft = rect.left - tw - 16;
      if (tooltipLeft < 16) tooltipLeft = 16;
      if (tooltipTop < 16) tooltipTop = 16;
      if (tooltipTop + 200 > window.innerHeight - 16) tooltipTop = window.innerHeight - 216;

      tooltip.style.left = `${tooltipLeft}px`;
      tooltip.style.top = `${tooltipTop}px`;
    }

    const isLast = tourStep === TOUR_STEPS.length - 1;
    tooltip.innerHTML = `
      <div class="tour-step">Step ${tourStep + 1} of ${TOUR_STEPS.length}</div>
      <div class="tour-title">${step.title}</div>
      <div class="tour-desc">${step.desc}</div>
      <div class="tour-btns">
        <button class="tour-skip" onclick="_tourDismiss()">Skip tour</button>
        <button class="tour-next" onclick="_tourNext()">${isLast ? 'Done' : 'Next'}</button>
      </div>`;
  }

  function tourNext() {
    tourStep++;
    if (tourStep >= TOUR_STEPS.length) {
      tourDismiss();
      return;
    }
    positionTour();
  }

  function tourDismiss() {
    localStorage.setItem('hyperion_toured', '1');
    if (backdrop) backdrop.remove();
    if (spotlight) spotlight.remove();
    if (tooltip) tooltip.remove();
  }

  window._tourNext = tourNext;
  window._tourDismiss = tourDismiss;

  createTourElements();
  positionTour();
}

function logout() {
  const sid = _sessionId;
  _sessionId = '';
  localStorage.removeItem('hyperion_sid');
  localStorage.removeItem('hyperion_onboarded');
  localStorage.removeItem('hyperion_toured');
  showLogin();
  if (sid) fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Id': sid } }).catch(() => {});
}

// ── Navigation ──
async function go(p) {
  page = p;
  closeMobileSidebar();
  _trackNavRecent(p);
  _highlightActiveNav();
  const main = document.getElementById('main');
  const loaders = { dashboard: loadDashboard, assistant: loadAssistant, nova: loadNova, terminal: loadTerminal, code: loadCode, files: loadFiles, notebooks: loadNotebooks, agents: loadAgents, workflows: loadWorkflows, system: loadSystem, settings: loadSettings, plugins: loadPluginsPage, skills: loadSkillsPage, canvas: loadCanvasPage, doctor: loadDoctorPage, memory: loadMemoryPage, channels: loadChannelsPage, remote: loadRemote, monitor: loadMonitor, analytics: loadAnalytics, httpclient: loadHttpClient, vault: loadVault, dbexplorer: loadDbExplorer, docker: loadDocker, gitclient: loadGitClient, logs: loadLogViewer, toolkit: loadToolkit, snippets: loadSnippets, envmanager: loadEnvManager, cronmanager: loadCronManager, processes: loadProcessManager, nettools: loadNetTools, wstester: loadWsTester, markdown: loadMarkdown, mockapi: loadMockApi, deps: loadDeps, notes: loadNotes, bookmarks: loadBookmarks, loadtest: loadLoadTest, dataview: loadDataView, texttools: loadTextTools, clipboard: loadClipboard, pomodoro: loadPomodoro, linkcheck: loadLinkCheck, regex: loadRegex, jwt: loadJwt, diff: loadDiff, images: loadImages, cronexpr: loadCronExpr, colors: loadColors, base64: loadBase64, hashgen: loadHashGen, uuidgen: loadUuidGen, jsontools: loadJsonTools, yamltools: loadYamlTools, loremgen: loadLoremGen, backups: loadBackups, shortcuts: loadShortcuts, apidocs: loadApiDocs, tunnels: loadTunnels, filehistory: loadFileHistory, webhooks: loadWebhooks, widgets: loadWidgets, metricshistory: loadMetricsHistory, auditviewer: loadAuditViewer, healthdash: loadHealthDashboard, chat: loadChat };
  // Page exit animation
  if (main.innerHTML && !main.classList.contains('page-enter')) {
    main.classList.add('page-exit');
    await new Promise(r => setTimeout(r, 120));
    main.classList.remove('page-exit');
  }
  try {
    await loaders[p]?.();
  } catch (err) {
    main.innerHTML = `<div style="padding:40px;color:var(--red)">Error loading page: ${esc(err.message)}</div>`;
  }
  // Page enter animation
  main.classList.add('page-enter');
  main.addEventListener('animationend', () => main.classList.remove('page-enter'), { once: true });
}

// ── Boot Sequence Animation ──
function runBootSequence() {
  const overlay = document.createElement('div');
  overlay.className = 'boot-overlay';
  overlay.id = 'bootOverlay';
  overlay.innerHTML = `
    <div class="boot-logo">H</div>
    <div class="boot-lines" id="bootLines"></div>
  `;
  document.body.appendChild(overlay);

  const lines = [
    { text: 'HYPERION v2.0 — initializing', cls: 'dim' },
    { text: 'kernel .......... <span class="ok">OK</span>' },
    { text: 'database ........ <span class="ok">OK</span>' },
    { text: 'auth module ..... <span class="ok">OK</span>' },
    { text: 'websocket ....... <span class="ok">OK</span>' },
    { text: 'plugins ......... <span class="ok">OK</span>' },
    { text: 'system ready', cls: 'ok' },
  ];

  const container = document.getElementById('bootLines');
  let i = 0;
  const interval = setInterval(() => {
    if (i >= lines.length) {
      clearInterval(interval);
      setTimeout(() => {
        overlay.classList.add('done');
        setTimeout(() => overlay.remove(), 500);
      }, 300);
      return;
    }
    const line = document.createElement('div');
    line.className = 'boot-line';
    line.style.animationDelay = '0ms';
    line.innerHTML = lines[i].cls ? `<span class="${lines[i].cls}">${lines[i].text}</span>` : lines[i].text;
    container.appendChild(line);
    i++;
  }, 100);
}

// ── System WebSocket ──
function startSystemWs() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  systemWs = new WebSocket(`${proto}://${location.host}/ws/system?sid=${encodeURIComponent(_sessionId)}`);
  systemWs.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'system') {
        document.getElementById('sidebarMem').textContent = `${msg.data.memPercent}% MEM`;
        _sysHistory.push(msg.data);
        if (_sysHistory.length > 60) _sysHistory.shift();
        if (page === 'system') updateSystemLive(msg.data);
      } else if (msg.type === 'system_history') {
        _sysHistory = msg.data || [];
        if (page === 'system') refreshSystemCharts();
      }
    } catch {}
  };
  systemWs.onclose = () => setTimeout(startSystemWs, 3000);
}

// ═══ ASSISTANT ═══
async function loadAssistant() {
  const main = document.getElementById('main');
  const [actions, suggestions] = await Promise.all([
    api('/api/assistant/actions'),
    api('/api/assistant/suggestions').catch(() => []),
  ]);

  _lastSuggestions = suggestions || [];
  const suggestionsHtml = _lastSuggestions.length ? `
    <div style="width:100%;max-width:640px;margin:0 auto 16px">
      <div class="action-cat-title" style="margin-bottom:6px">Suggested Workflows</div>
      ${suggestions.map((s, i) => `
        <div class="suggestion-card">
          <div style="flex:1">
            <div class="sug-text">${esc(s.message)}</div>
            <div class="sug-cmds">${s.commands.map(c => esc(c)).join(' → ')}</div>
          </div>
          <button class="sug-btn" onclick="createWorkflowFromSuggestion(${i})">Create</button>
        </div>
      `).join('')}
    </div>
  ` : '';

  main.innerHTML = `
    <div class="page assistant-page">
      <div class="assistant-hero">
        <div class="assistant-logo">H</div>
        <h1 class="assistant-title">What do you want to do?</h1>
        <p class="assistant-sub">Natural language commands, app control, system toggles, workflows, and more.</p>
      </div>

      <div class="assistant-input-wrap">
        <div class="assistant-input-box">
          <input class="assistant-input" id="assistantInput" placeholder="Try: 'open chrome with google.com', 'set volume to 50', 'generate password'"
            onkeydown="if(event.key==='Enter')assistantGo()">
          <button class="assistant-send" onclick="assistantGo()">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
          </button>
        </div>
      </div>

      ${suggestionsHtml}

      <div class="assistant-actions">
        ${(actions || []).map(cat => `
          <div class="action-category">
            <div class="action-cat-title">${cat.category}${cat._plugin ? ' <span class="plugin-badge">Plugin</span>' : ''}</div>
            <div class="action-btns">
              ${cat.actions.map(a => `<button class="action-chip" onclick="assistantRun('${esc(a.query)}')">${a.label}</button>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="assistant-results" id="assistantResults">
        ${assistantHistory.map(renderAssistantEntry).join('')}
      </div>
    </div>
  `;

  document.getElementById('assistantInput')?.focus();
}

async function createWorkflowFromSuggestion(idx) {
  const sug = _lastSuggestions[idx];
  if (!sug || !sug.commands || !sug.commands.length) return showToast('No suggestion data');
  const name = prompt('Workflow name:', sug.commands.join(' + ').slice(0, 40));
  if (!name) return;
  const actions = sug.commands.map(cmd => ({ type: 'command', command: cmd, app: '' }));
  try {
    await api('/api/workflows', 'POST', { name, description: sug.message, actions });
    showToast(`Workflow "${name}" created!`);
    // Remove the suggestion card
    const cards = document.querySelectorAll('.suggestion-card');
    if (cards[idx]) cards[idx].style.display = 'none';
  } catch (e) {
    showToast('Failed to create workflow: ' + e.message);
  }
}

function assistantGo() {
  const input = document.getElementById('assistantInput');
  if (!input?.value.trim()) return;
  assistantRun(input.value.trim());
  input.value = '';
}

async function assistantRun(query) {
  const results = document.getElementById('assistantResults');
  if (!results) return;

  // Add user entry
  const entry = { query, status: 'thinking' };
  assistantHistory.push(entry);
  results.insertAdjacentHTML('beforeend', renderAssistantEntry(entry));
  results.scrollTop = results.scrollHeight;

  // Call assistant
  const data = await api('/api/assistant/ask', 'POST', { input: query });
  entry.data = data;
  entry.status = 'done';

  // Re-render last entry
  const entries = results.querySelectorAll('.assistant-entry');
  if (entries.length) entries[entries.length - 1].outerHTML = renderAssistantEntry(entry);
}

function renderAssistantEntry(entry) {
  if (entry.status === 'thinking') {
    return `<div class="assistant-entry">
      <div class="ae-user"><span class="ae-you">YOU</span> ${esc(entry.query)}</div>
      <div class="ae-thinking">Thinking<span class="ae-dots"></span></div>
    </div>`;
  }

  const d = entry.data || {};
  if (d.error) {
    return `<div class="assistant-entry">
      <div class="ae-user"><span class="ae-you">YOU</span> ${esc(entry.query)}</div>
      <div class="ae-not-sure">${esc(d.error)}</div>
    </div>`;
  }

  if (!d.command) {
    return `<div class="assistant-entry">
      <div class="ae-user"><span class="ae-you">YOU</span> ${esc(entry.query)}</div>
      <div class="ae-not-sure">I'm not sure how to do that.
        ${d.suggestions ? `<div class="ae-suggestions"><span class="ae-sug-label">Try:</span>${d.suggestions.map(s => `<button class="action-chip small" onclick="assistantRun('${esc(s)}')">${s}</button>`).join('')}</div>` : ''}
      </div>
    </div>`;
  }

  const exitClass = d.exitCode === 0 ? 'ok' : 'err';
  const outputClass = d.exitCode === 0 ? '' : ' error';
  return `<div class="assistant-entry">
    <div class="ae-user"><span class="ae-you">YOU</span> ${esc(entry.query)}</div>
    <div class="ae-bot">
      <div class="ae-command-bar">
        <span class="ae-cmd-label">CMD</span>
        <span class="ae-cmd">${esc(d.command)}</span>
        <span class="ae-exit ${exitClass}">exit ${d.exitCode ?? '?'}</span>
        ${d.duration ? `<span class="ae-duration">${d.duration}ms</span>` : ''}
      </div>
      ${d.description ? `<div class="ae-desc">${esc(d.description)}</div>` : ''}
      <div class="ae-output-wrap"><pre class="ae-output${outputClass}">${esc(d.stdout || d.stderr || '(no output)')}</pre></div>
    </div>
  </div>`;
}

// ═══ WORKFLOWS ═══
async function loadWorkflows() {
  const main = document.getElementById('main');
  const workflows = await api('/api/workflows');

  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <span class="page-title">Workflows</span>
        <button class="btn btn-green" onclick="createWorkflowModal()">+ New Workflow</button>
      </div>
      <div class="page-pad">
        ${(workflows || []).length ? workflows.map(wf => {
          const actions = typeof wf.actions === 'string' ? JSON.parse(wf.actions) : (wf.actions || []);
          return `
          <div class="workflow-card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <strong style="font:600 14px var(--sans)">${esc(wf.name)}</strong>
                <span style="font:11px var(--mono);color:var(--text3);margin-left:8px">${actions.length} action${actions.length !== 1 ? 's' : ''}</span>
              </div>
              <div style="display:flex;gap:4px">
                <button class="btn btn-green btn-sm" onclick="runWorkflow('${esc(wf.id)}')">Run</button>
                <button class="btn btn-sm" onclick="editWorkflowModal('${esc(wf.id)}')">Edit</button>
                <button class="btn btn-red btn-sm" onclick="deleteWorkflow('${esc(wf.id)}')">Del</button>
              </div>
            </div>
            ${wf.description ? `<div style="font:12px var(--sans);color:var(--text3);margin-top:4px">${esc(wf.description)}</div>` : ''}
            <div class="workflow-actions">
              ${actions.map(a => `<span class="workflow-action ${a.type || 'open'}">${a.type === 'close' ? '✕' : '▸'} ${esc(a.app || a.command || '')}</span>`).join('')}
            </div>
          </div>`;
        }).join('') : '<div style="color:var(--text3);padding:40px;text-align:center">No workflows yet. Create one or say "start dev mode" in the Assistant.</div>'}
      </div>
    </div>
  `;
}

async function runWorkflow(id) {
  const res = await api(`/api/workflows/${id}/run`, 'POST');
  if (res.results) {
    showToast(`Workflow executed: ${res.results.length} actions`);
  }
}

async function deleteWorkflow(id) {
  const confirmed = await showConfirmModal('Delete this workflow?');
  if (!confirmed) return;
  await api(`/api/workflows/${id}`, 'DELETE');
  loadWorkflows();
}

function createWorkflowModal() {
  showModal('Create Workflow', `
    <div class="form-group"><label>Name</label><input id="wfName" placeholder="Dev Mode"></div>
    <div class="form-group"><label>Description</label><input id="wfDesc" placeholder="What this workflow does..."></div>
    <div id="wfActions">
      <label style="font:500 11px var(--sans);text-transform:uppercase;letter-spacing:0.5px;color:var(--text3);display:block;margin-bottom:6px">Actions</label>
      <div id="wfActionList"></div>
      <button class="btn btn-sm" style="margin-top:6px" onclick="addWfAction()">+ Add Action</button>
    </div>
  `, async () => {
    const actions = [];
    document.querySelectorAll('.wf-action-row').forEach(row => {
      const type = row.querySelector('.wf-type').value;
      const app = row.querySelector('.wf-app').value;
      const cmd = row.querySelector('.wf-cmd').value;
      if (type === 'command') {
        if (cmd) actions.push({ type, command: cmd, app: '' });
      } else {
        if (app) actions.push({ type, app });
      }
    });
    await api('/api/workflows', 'POST', {
      name: document.getElementById('wfName').value,
      description: document.getElementById('wfDesc').value,
      actions,
    });
    closeModal();
    loadWorkflows();
  });
  addWfAction();
}

function addWfAction() {
  const list = document.getElementById('wfActionList');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'wf-action-row';
  row.style.cssText = 'display:flex;gap:6px;margin-bottom:4px;align-items:center;flex-wrap:wrap';
  const inputStyle = 'background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:5px 8px;font:12px var(--sans)';
  row.innerHTML = `
    <select class="wf-type" style="${inputStyle}" onchange="wfTypeChanged(this)">
      <option value="open">Open</option>
      <option value="close">Close</option>
      <option value="command">Command</option>
    </select>
    <input class="wf-app" placeholder="App name" style="flex:1;${inputStyle}">
    <input class="wf-cmd" placeholder="Shell command" style="flex:1;${inputStyle};display:none">
    <button class="btn btn-red btn-sm" onclick="this.parentElement.remove()">✕</button>
  `;
  list.appendChild(row);
}

function wfTypeChanged(sel) {
  const row = sel.closest('.wf-action-row');
  const appInput = row.querySelector('.wf-app');
  const cmdInput = row.querySelector('.wf-cmd');
  if (sel.value === 'command') {
    appInput.style.display = 'none';
    cmdInput.style.display = '';
  } else {
    appInput.style.display = '';
    cmdInput.style.display = 'none';
  }
}

async function editWorkflowModal(id) {
  const workflows = await api('/api/workflows');
  const wf = workflows.find(w => w.id === id);
  if (!wf) return;
  const actions = typeof wf.actions === 'string' ? JSON.parse(wf.actions) : (wf.actions || []);

  showModal('Edit Workflow', `
    <div class="form-group"><label>Name</label><input id="wfName" value="${esc(wf.name)}"></div>
    <div class="form-group"><label>Description</label><input id="wfDesc" value="${esc(wf.description || '')}"></div>
    <div id="wfActions">
      <label style="font:500 11px var(--sans);text-transform:uppercase;letter-spacing:0.5px;color:var(--text3);display:block;margin-bottom:6px">Actions</label>
      <div id="wfActionList"></div>
      <button class="btn btn-sm" style="margin-top:6px" onclick="addWfAction()">+ Add Action</button>
    </div>
  `, async () => {
    const newActions = [];
    document.querySelectorAll('.wf-action-row').forEach(row => {
      const type = row.querySelector('.wf-type').value;
      const app = row.querySelector('.wf-app').value;
      const cmd = row.querySelector('.wf-cmd').value;
      if (type === 'command') {
        if (cmd) newActions.push({ type, command: cmd, app: '' });
      } else {
        if (app) newActions.push({ type, app });
      }
    });
    await api(`/api/workflows/${id}`, 'PUT', {
      name: document.getElementById('wfName').value,
      description: document.getElementById('wfDesc').value,
      actions: newActions,
    });
    closeModal();
    loadWorkflows();
  });

  // Pre-fill existing actions after modal renders
  setTimeout(() => {
    for (const a of actions) {
      addWfAction();
      const rows = document.querySelectorAll('.wf-action-row');
      const last = rows[rows.length - 1];
      if (last) {
        const typeSel = last.querySelector('.wf-type');
        typeSel.value = a.type || 'open';
        wfTypeChanged(typeSel);
        if (a.type === 'command') {
          last.querySelector('.wf-cmd').value = a.command || '';
        } else {
          last.querySelector('.wf-app').value = a.app || '';
        }
      }
    }
  }, 50);
}

// ═══ TERMINAL ═══
function loadTerminal() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page" style="padding:0;display:flex;flex-direction:column">
      <div class="terminal-tabs" id="termTabs"></div>
      <div id="termContainers" style="flex:1;position:relative"></div>
    </div>
  `;

  if (!terminals.length) addTerminal();
  else renderTermTabs();
}

function addTerminal() {
  const idx = terminals.length;
  const container = document.createElement('div');
  container.className = 'terminal-wrap';
  container.style.display = 'none';

  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
    theme: { background: '#1C1917', foreground: '#F5EFE6', cursor: '#DA7756', selectionBackground: 'rgba(218,119,86,0.2)' },
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon.WebLinksAddon());

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/terminal?cols=${term.cols}&rows=${term.rows}&sid=${encodeURIComponent(_sessionId)}`);

  ws.onopen = () => {
    term.onData(data => ws.send(JSON.stringify({ type: 'input', data })));
    term.onResize(({ cols, rows }) => ws.send(JSON.stringify({ type: 'resize', cols, rows })));
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'output') term.write(msg.data);
      else if (msg.type === 'exit') term.write(`\r\n[Process exited with code ${msg.code}]\r\n`);
    } catch {}
  };

  terminals.push({ term, fit, ws, container });
  activeTermIdx = idx;
  renderTermTabs();

  const containers = document.getElementById('termContainers');
  if (containers) {
    containers.appendChild(container);
    container.style.display = '';
    term.open(container);
    setTimeout(() => fit.fit(), 50);
  }

  window.addEventListener('resize', () => { if (page === 'terminal') terminals.forEach(t => t.fit.fit()); });
}

function closeTermTab(idx) {
  if (idx < 0 || idx >= terminals.length) return;
  const t = terminals[idx];
  try { t.term.dispose(); } catch {}
  try { t.ws.close(); } catch {}
  try { t.container.remove(); } catch {}
  terminals.splice(idx, 1);
  if (terminals.length === 0) {
    addTerminal();
  } else {
    activeTermIdx = Math.min(activeTermIdx, terminals.length - 1);
    renderTermTabs();
  }
}

function switchTerm(idx) {
  activeTermIdx = idx;
  terminals.forEach((t, i) => { t.container.style.display = i === idx ? '' : 'none'; });
  renderTermTabs();
  terminals[idx]?.fit.fit();
}

function renderTermTabs() {
  const tabs = document.getElementById('termTabs');
  if (!tabs) return;
  tabs.innerHTML = terminals.map((_, i) =>
    `<button class="term-tab ${i === activeTermIdx ? 'active' : ''}" onclick="switchTerm(${i})">Terminal ${i + 1}<span class="term-close" onclick="event.stopPropagation();closeTermTab(${i})">&times;</span></button>`
  ).join('') + `<button class="term-add" onclick="addTerminal()">+</button>`;

  terminals.forEach((t, i) => {
    t.container.style.display = i === activeTermIdx ? '' : 'none';
    const containers = document.getElementById('termContainers');
    if (containers && !containers.contains(t.container)) {
      containers.appendChild(t.container);
      t.term.open(t.container);
      setTimeout(() => t.fit.fit(), 50);
    }
  });
}

// ═══ NOVA ═══
function loadNova() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page" style="padding:0;display:flex;flex-direction:column">
      <div class="nova-toolbar">
        <div class="nova-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
          <span style="font:700 13px var(--mono);color:var(--purple)">NOVA</span>
        </div>
        <button class="run-btn" onclick="runNova()" style="background:var(--purple);color:#fff">&#9654; Run</button>
        <button class="btn btn-sm" onclick="explainNova()">Explain</button>
        <button class="btn btn-sm" onclick="showNovaExamples()">Examples</button>
        <button class="btn btn-sm" onclick="clearNovaOutput()">Clear</button>
      </div>
      <div class="nova-area">
        <div class="nova-editor-wrap">
          <textarea class="nova-textarea" id="novaInput" placeholder="# Write NOVA code here...&#10;# English-like commands for your computer&#10;&#10;show system info&#10;print &quot;Hello from NOVA!&quot;" spellcheck="false"
            onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();runNova()}">show system info
print "Hello from NOVA!"</textarea>
        </div>
        <div class="nova-output-wrap">
          <div class="nova-output" id="novaOutput">
            <div class="nova-welcome">
              <div style="font:700 18px var(--mono);color:var(--purple);margin-bottom:6px">NOVA Language</div>
              <div style="color:var(--text3);font:13px var(--sans)">Write English-like commands. Press Run or Ctrl+Enter.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function runNova() {
  const code = document.getElementById('novaInput').value;
  const output = document.getElementById('novaOutput');
  output.innerHTML = '<div class="nova-running">Running NOVA program...</div>';
  const res = await api('/api/nova/run', 'POST', { code });
  renderNovaOutput(res.results || []);
}

async function explainNova() {
  const code = document.getElementById('novaInput').value;
  const res = await api('/api/nova/explain', 'POST', { code });
  renderNovaOutput(res.steps || [], true);
}

function renderNovaOutput(results, explainMode = false) {
  const output = document.getElementById('novaOutput');
  if (!results.length) {
    output.innerHTML = '<div style="padding:20px;color:var(--text3)">No output</div>';
    return;
  }

  output.innerHTML = results.map(r => {
    const statusClass = r.exitCode === 0 ? 'ok' : r.exitCode === -1 ? 'skip' : 'err';
    return `<div class="nova-line ${r.exitCode > 0 ? 'nova-error' : ''}">
      <div class="nova-line-source">
        <span class="nova-line-type ${r.type || ''}">${r.type || '?'}</span>
        <span>${esc(r.nova || '')}</span>
      </div>
      ${r.command ? `<div class="nova-line-cmd">${esc(r.command)}</div>` : ''}
      ${!explainMode && r.result !== undefined ? `<div class="nova-line-result ${statusClass}">${esc(String(r.result))}</div>` : ''}
      ${r.desc ? `<div class="nova-line-desc">${esc(r.desc)}</div>` : ''}
    </div>`;
  }).join('');
}

function clearNovaOutput() {
  const o = document.getElementById('novaOutput');
  if (o) o.innerHTML = '<div class="nova-welcome"><div style="font:700 18px var(--mono);color:var(--purple);margin-bottom:6px">NOVA Language</div><div style="color:var(--text3);font:13px var(--sans)">Write English-like commands. Press Run or Ctrl+Enter.</div></div>';
}

async function showNovaExamples() {
  const res = await api('/api/nova/examples');
  showModal('NOVA Examples', (res || []).map(ex =>
    `<div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="document.getElementById('novaInput').value=${JSON.stringify(ex.code).replace(/</g, '\\u003c')};closeModal()">
      <div style="font-weight:600">${esc(ex.name)}</div>
      <div style="font:12px var(--sans);color:var(--text3)">${esc(ex.description)}</div>
    </div>`
  ).join(''));
}

// ═══ CODE RUNNER ═══
function loadCode() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page" style="padding:0;display:flex;flex-direction:column">
      <div class="code-toolbar">
        <select class="lang-select" id="codeLang" onchange="updateCodePlaceholder()">
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="bash">Bash</option>
          <option value="ruby">Ruby</option>
          <option value="go">Go</option>
          <option value="c">C</option>
          <option value="cpp">C++</option>
          <option value="swift">Swift</option>
          <option value="r">R</option>
          <option value="lua">Lua</option>
          <option value="perl">Perl</option>
          <option value="php">PHP</option>
          <option value="shell">Shell</option>
          <option value="nova">NOVA</option>
        </select>
        <button class="run-btn" onclick="runCode()">&#9654; Run</button>
        <button class="btn btn-sm" onclick="clearOutput()">Clear</button>
        <button class="btn btn-sm" onclick="showSnippets()">Snippets</button>
        <button class="btn btn-sm" onclick="showHistory()">History</button>
        <span class="exec-time" id="execTime"></span>
      </div>
      <div class="code-area">
        <div class="code-editor-wrap">
          <textarea class="code-textarea" id="codeInput" placeholder="# Write your code here...&#10;print('Hello from Hyperion')" spellcheck="false"
            onkeydown="handleCodeKeys(event)">print("Hello from Hyperion!")</textarea>
        </div>
        <div class="code-output-wrap">
          <div style="padding:6px 12px;background:var(--bg2);border-bottom:1px solid var(--border);font:600 11px var(--sans);color:var(--text3);text-transform:uppercase;letter-spacing:1px">Output</div>
          <div class="code-output" id="codeOutput">Press Run or Ctrl+Enter to execute</div>
        </div>
      </div>
    </div>
  `;
}

async function runCode() {
  const code = document.getElementById('codeInput').value;
  const language = document.getElementById('codeLang').value;
  const output = document.getElementById('codeOutput');
  const timeEl = document.getElementById('execTime');

  output.textContent = 'Running...';
  output.style.color = 'var(--text2)';

  const res = await api('/api/code/run', 'POST', { code, language });

  let text = '';
  if (res.stdout) text += res.stdout;
  if (res.stderr) text += (text ? '\n' : '') + res.stderr;
  if (!text) text = '(no output)';

  output.textContent = text;
  output.style.color = res.exitCode === 0 ? 'var(--green)' : 'var(--red)';
  timeEl.textContent = `${res.duration}ms | exit ${res.exitCode}`;
}

function handleCodeKeys(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runCode(); }
  if (e.key === 'Tab') {
    e.preventDefault();
    const ta = e.target;
    const start = ta.selectionStart;
    ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(ta.selectionEnd);
    ta.selectionStart = ta.selectionEnd = start + 2;
  }
}

function updateCodePlaceholder() {
  const lang = document.getElementById('codeLang')?.value;
  const ta = document.getElementById('codeInput');
  if (!ta) return;
  const placeholders = {
    python: "# Write Python code here...\nprint('Hello!')",
    javascript: "// Write JavaScript code here...\nconsole.log('Hello!');",
    bash: "#!/bin/bash\necho 'Hello!'",
    ruby: "# Write Ruby code here...\nputs 'Hello!'",
    go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello!")\n}',
    c: '#include <stdio.h>\n\nint main() {\n  printf("Hello!\\n");\n  return 0;\n}',
    cpp: '#include <iostream>\n\nint main() {\n  std::cout << "Hello!" << std::endl;\n  return 0;\n}',
    nova: '# Write NOVA code here...\nprint "Hello from NOVA!"',
    shell: '#!/bin/sh\necho "Hello!"',
  };
  ta.placeholder = placeholders[lang] || `# Write ${lang} code here...`;
}

function clearOutput() {
  const o = document.getElementById('codeOutput');
  if (o) { o.textContent = ''; o.style.color = 'var(--text2)'; }
  const t = document.getElementById('execTime');
  if (t) t.textContent = '';
}

async function showHistory() {
  const history = await api('/api/code/history');
  window._snippetCache = (history || []).map(h => h.command || '');
  showModal('Execution History', (history || []).map((h, idx) =>
    `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between"><span style="color:var(--cyan)">${esc(h.language)}</span><span style="color:var(--text3)">${h.duration_ms}ms</span></div>
      <pre style="font:11px var(--mono);color:var(--text2);margin-top:4px;cursor:pointer;max-height:60px;overflow:hidden"
        onclick="loadSnippet(${idx});closeModal()">${esc((h.command || '').slice(0,200))}</pre>
    </div>`
  ).join('') || '<div style="color:var(--text3)">No history yet</div>');
}

function loadSnippet(idx) {
  const code = (window._snippetCache || [])[idx];
  if (code != null) {
    const el = document.getElementById('codeInput');
    if (el) el.value = code;
  }
}

async function showSnippets() {
  const snippets = await api('/api/code/snippets');
  window._snippetCache = (snippets || []).map(s => s.code || '');
  showModal('Saved Snippets',
    `<button class="btn btn-green btn-sm" style="margin-bottom:10px" onclick="saveSnippetModal()">+ Save Current</button>` +
    ((snippets || []).map((s, idx) =>
      `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div style="cursor:pointer" onclick="loadSnippet(${idx});document.getElementById('codeLang').value='${esc(s.language)}';closeModal()">
          <div style="font-weight:600">${esc(s.name)}</div>
          <div style="font:11px var(--mono);color:var(--text3)">${esc(s.language)}</div>
        </div>
        <button class="btn btn-red btn-sm" onclick="deleteSnippet('${esc(s.id)}')">Del</button>
      </div>`
    ).join('') || '<div style="color:var(--text3);margin-top:8px">No snippets saved</div>')
  );
}

async function saveSnippetModal() {
  const name = await showPromptModal('Snippet name:');
  if (!name) return;
  await api('/api/code/snippets', 'POST', {
    name, code: document.getElementById('codeInput').value,
    language: document.getElementById('codeLang').value,
  });
  closeModal(); showSnippets();
}

async function deleteSnippet(id) { await api(`/api/code/snippets/${id}`, 'DELETE'); showSnippets(); }

// ═══ FILES ═══
async function loadFiles(dir) {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page">
      <div class="file-path-bar" id="filePathBar"></div>
      <div class="file-browser">
        <div class="file-tree" id="fileTree"></div>
        <div class="file-preview" id="filePreview">
          <div style="padding:40px;text-align:center;color:var(--text3)">Select a file to preview</div>
        </div>
      </div>
    </div>
  `;
  await browseDir(dir || '~');
}

async function browseDir(dir) {
  const showHidden = false;
  const data = await api(`/api/files/list?path=${encodeURIComponent(dir)}&showHidden=${showHidden}`);
  fileCurrentPath = data.path;

  // Path bar
  const parts = data.path.split('/').filter(Boolean);
  document.getElementById('filePathBar').innerHTML =
    `<span class="path-seg" onclick="browseDir('/')">/</span>` +
    parts.map((p, i) => {
      const full = '/' + parts.slice(0, i + 1).join('/');
      return `<span class="path-seg" onclick="browseDir('${esc(full)}')">${esc(p)}</span><span style="color:var(--text3)">/</span>`;
    }).join('') +
    `<span style="margin-left:auto;display:flex;gap:4px">
      <button class="btn btn-sm" onclick="uploadFile()">Upload</button>
      <button class="btn btn-sm" onclick="createNewFile()">+ File</button>
      <button class="btn btn-sm" onclick="createNewDir()">+ Dir</button>
    </span>`;

  // File list
  const tree = document.getElementById('fileTree');
  tree.innerHTML = (data.parent !== data.path ? `<div class="file-item dir" onclick="browseDir('${esc(data.parent)}')">.. (up)</div>` : '') +
    data.items.map(f => {
      const icon = f.isDirectory ? '&#x1F4C1;' : getFileIcon(f.name);
      const size = f.isFile ? formatSize(f.size) : '';
      return `<div class="file-item ${f.isDirectory ? 'dir' : ''}"
        onclick="${f.isDirectory ? `browseDir('${esc(f.path)}')` : `previewFile('${esc(f.path)}')`}">
        <span>${icon}</span> <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</span>
        <span class="size">${size}</span>
      </div>`;
    }).join('');
}

async function previewFile(filePath) {
  const preview = document.getElementById('filePreview');
  try {
    const data = await api(`/api/files/read?path=${encodeURIComponent(filePath)}`);

    if (data.isBinary) {
      preview.innerHTML = `<div style="padding:20px;color:var(--text3)">Binary file (${formatSize(data.size)}). <a href="/api/files/download?path=${encodeURIComponent(filePath)}" style="color:var(--cyan)">Download</a></div>`;
      return;
    }

    editingFile = filePath;
    preview.innerHTML = `
      <div style="padding:6px 12px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
        <span style="font:12px var(--mono);color:var(--text2);flex:1">${esc(filePath)} (${data.lines} lines, ${formatSize(data.size)})</span>
        <button class="btn btn-green btn-sm" onclick="saveFile()">Save</button>
        <button class="btn btn-sm" onclick="runFile('${esc(filePath)}','${esc(data.language)}')">Run</button>
        <a class="btn btn-sm" href="/api/files/download?path=${encodeURIComponent(filePath)}">Download</a>
        <button class="btn btn-red btn-sm" onclick="deleteFile('${esc(filePath)}')">Delete</button>
      </div>
      <textarea class="file-content editing" id="fileEditor" spellcheck="false">${esc(data.content)}</textarea>
    `;
  } catch (err) {
    preview.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

async function saveFile() {
  const content = document.getElementById('fileEditor')?.value;
  if (!editingFile) return;
  await api('/api/files/write', 'POST', { path: editingFile, content });
  showToast('Saved');
}

async function runFile(filePath, language) {
  const content = document.getElementById('fileEditor')?.value || '';
  go('code');
  setTimeout(() => {
    document.getElementById('codeInput').value = content;
    const langSelect = document.getElementById('codeLang');
    if (langSelect) langSelect.value = language || 'python';
    runCode();
  }, 100);
}

async function deleteFile(filePath) {
  const confirmed = await showConfirmModal(`Delete ${filePath}?`);
  if (!confirmed) return;
  await api(`/api/files/delete?path=${encodeURIComponent(filePath)}`, 'DELETE');
  browseDir(fileCurrentPath);
  document.getElementById('filePreview').innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">File deleted</div>';
}

async function createNewFile() {
  const name = await showPromptModal('File name:');
  if (!name) return;
  await api('/api/files/write', 'POST', { path: `${fileCurrentPath}/${name}`, content: '' });
  browseDir(fileCurrentPath);
}

async function createNewDir() {
  const name = await showPromptModal('Directory name:');
  if (!name) return;
  await api('/api/files/mkdir', 'POST', { path: `${fileCurrentPath}/${name}` });
  browseDir(fileCurrentPath);
}

function uploadFile() {
  const input = document.createElement('input');
  input.type = 'file'; input.multiple = true;
  input.onchange = async () => {
    const form = new FormData();
    for (const f of input.files) form.append('files', f);
    form.append('path', fileCurrentPath);
    await fetch('/api/files/upload', { method: 'POST', body: form, headers: { 'X-Session-Id': _sessionId } });
    browseDir(fileCurrentPath);
    showToast(`${input.files.length} file(s) uploaded`);
  };
  input.click();
}

// ═══ NOTEBOOKS ═══
let currentNotebook = null;

async function loadNotebooks() {
  const main = document.getElementById('main');
  const nbs = await api('/api/notebooks');
  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <span class="page-title">Notebooks</span>
        <button class="btn btn-green" onclick="createNotebook()">+ New Notebook</button>
      </div>
      <div class="page-pad" id="nbContent">
        ${(nbs || []).length ? nbs.map(nb => `
          <div class="agent-card" style="cursor:pointer" onclick="openNotebook('${esc(nb.id)}')">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div><strong>${esc(nb.name)}</strong> <span style="color:var(--text3);font:11px var(--mono)">${esc(nb.language)}</span></div>
              <div style="display:flex;gap:4px">
                <a class="btn btn-sm" href="/api/notebooks/${nb.id}/export">Export</a>
                <button class="btn btn-red btn-sm" onclick="event.stopPropagation();deleteNotebook('${esc(nb.id)}')">Del</button>
              </div>
            </div>
            <div style="font:11px var(--sans);color:var(--text3);margin-top:4px">${esc(nb.description || 'No description')}</div>
          </div>
        `).join('') : '<div style="color:var(--text3);padding:40px;text-align:center">No notebooks yet. Create one to start computing.</div>'}
      </div>
    </div>
  `;
}

async function createNotebook() {
  const name = await showPromptModal('Notebook name:', 'Untitled');
  if (!name) return;
  const { id } = await api('/api/notebooks', 'POST', { name, language: 'python' });
  openNotebook(id);
}

async function openNotebook(id) {
  const nb = await api(`/api/notebooks/${id}`);
  currentNotebook = nb;
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <button class="btn btn-sm" onclick="loadNotebooks()">&larr; Back</button>
        <span class="page-title">${esc(nb.name)}</span>
        <span style="font:11px var(--mono);color:var(--text3)">${esc(nb.language)}</span>
        <div style="margin-left:auto;display:flex;gap:4px">
          <button class="btn btn-green" onclick="runAllCells()">&#9654; Run All</button>
          <button class="btn" onclick="addCell()">+ Cell</button>
          <button class="btn" onclick="saveNotebook()">Save</button>
        </div>
      </div>
      <div class="page-pad" id="nbCells">
        ${nb.cells.map((cell, i) => renderCell(cell, i)).join('')}
      </div>
    </div>
  `;
}

function renderCell(cell, index) {
  const hasOutput = cell.output && cell.output.trim();
  return `
    <div class="nb-cell" id="cell-${cell.id}">
      <div class="nb-cell-header">
        <span>In [${index + 1}]</span>
        <button class="btn btn-green btn-sm" onclick="runCell('${esc(cell.id)}', ${index})">&#9654;</button>
        <span style="margin-left:auto">${cell.duration ? cell.duration + 'ms' : ''}</span>
        <button class="btn btn-red btn-sm" onclick="removeCell('${esc(cell.id)}')">&#215;</button>
      </div>
      <textarea class="nb-cell-input" id="input-${cell.id}" onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();runCell('${esc(cell.id)}',${index})}"
        >${esc(cell.source || '')}</textarea>
      ${hasOutput ? `<div class="nb-cell-output ${cell.exitCode !== 0 ? 'error' : ''}">${esc(cell.output)}</div>` : ''}
    </div>
  `;
}

async function runCell(cellId, index) {
  const source = document.getElementById(`input-${cellId}`)?.value || '';
  const res = await api(`/api/notebooks/${currentNotebook.id}/run-cell`, 'POST', {
    cellId, source, language: currentNotebook.language,
  });

  // Update cell in memory
  const cell = currentNotebook.cells.find(c => c.id === cellId);
  if (cell) { cell.source = source; cell.output = res.stdout + res.stderr; cell.exitCode = res.exitCode; cell.duration = res.duration; }

  // Re-render just this cell's output
  const cellEl = document.getElementById(`cell-${cellId}`);
  const existing = cellEl.querySelector('.nb-cell-output');
  const outputHtml = `<div class="nb-cell-output ${res.exitCode !== 0 ? 'error' : ''}">${esc(res.stdout + res.stderr)}</div>`;
  if (existing) existing.outerHTML = outputHtml;
  else cellEl.insertAdjacentHTML('beforeend', outputHtml);
}

async function runAllCells() {
  // Save sources first
  currentNotebook.cells.forEach(c => {
    const input = document.getElementById(`input-${c.id}`);
    if (input) c.source = input.value;
  });
  await api(`/api/notebooks/${currentNotebook.id}`, 'PUT', { cells: currentNotebook.cells });
  await api(`/api/notebooks/${currentNotebook.id}/run-all`, 'POST');
  openNotebook(currentNotebook.id);
}

function addCell() {
  const id = crypto.randomUUID();
  currentNotebook.cells.push({ id, type: 'code', source: '', output: '', language: currentNotebook.language });
  const container = document.getElementById('nbCells');
  container.insertAdjacentHTML('beforeend', renderCell(currentNotebook.cells.at(-1), currentNotebook.cells.length - 1));
}

function removeCell(cellId) {
  currentNotebook.cells = currentNotebook.cells.filter(c => c.id !== cellId);
  document.getElementById(`cell-${cellId}`)?.remove();
}

async function saveNotebook() {
  currentNotebook.cells.forEach(c => {
    const input = document.getElementById(`input-${c.id}`);
    if (input) c.source = input.value;
  });
  await api(`/api/notebooks/${currentNotebook.id}`, 'PUT', { cells: currentNotebook.cells });
  showToast('Notebook saved');
}

async function deleteNotebook(id) {
  const confirmed = await showConfirmModal('Delete this notebook?');
  if (!confirmed) return;
  await api(`/api/notebooks/${id}`, 'DELETE');
  loadNotebooks();
}

// ═══ AGENTS ═══
async function loadAgents() {
  const main = document.getElementById('main');
  const [agents, presets] = await Promise.all([api('/api/agents'), api('/api/agents/presets/list')]);

  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <span class="page-title">Agents</span>
        <button class="btn btn-green" onclick="createAgentModal()">+ New Agent</button>
        <button class="btn" onclick="showPresets()">Presets</button>
      </div>
      <div class="page-pad">
        ${(agents || []).map(a => `
          <div class="agent-card">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div>
                <strong>${esc(a.name)}</strong>
                <span class="agent-status ${a.status}">${esc(a.status)}${a.pid ? ' (PID '+a.pid+')' : ''}</span>
              </div>
              <div style="display:flex;gap:4px">
                ${a.status === 'running'
                  ? `<button class="btn btn-red btn-sm" onclick="stopAgent('${esc(a.id)}')">Stop</button>`
                  : `<button class="btn btn-green btn-sm" onclick="startAgent('${esc(a.id)}')">Start</button>`}
                <button class="btn btn-sm" onclick="viewAgent('${esc(a.id)}')">Logs</button>
                <button class="btn btn-sm" onclick="editAgent('${esc(a.id)}')">Edit</button>
                <button class="btn btn-red btn-sm" onclick="deleteAgent('${esc(a.id)}')">Del</button>
              </div>
            </div>
            <div style="font:12px var(--sans);color:var(--text3);margin-top:4px">${esc(a.description || '')}</div>
            ${a.last_output ? `<div class="agent-logs">${esc(a.last_output.slice(-500))}</div>` : ''}
          </div>
        `).join('')}
        ${!(agents || []).length ? '<div style="color:var(--text3);padding:40px;text-align:center">No agents. Create one to automate tasks.</div>' : ''}
      </div>
    </div>
  `;
}

async function startAgent(id) { await api(`/api/agents/${id}/start`, 'POST'); loadAgents(); }
async function stopAgent(id) { await api(`/api/agents/${id}/stop`, 'POST'); loadAgents(); }
async function deleteAgent(id) {
  const confirmed = await showConfirmModal('Delete this agent?');
  if (!confirmed) return;
  await api(`/api/agents/${id}`, 'DELETE');
  loadAgents();
}

async function viewAgent(id) {
  const { agent, logs } = await api(`/api/agents/${id}`);
  showModal(`Agent: ${esc(agent.name)}`,
    `<div class="agent-status ${agent.status}" style="margin-bottom:8px">${esc(agent.status)}</div>
    <div class="agent-logs" style="max-height:400px">${(logs || []).map(l =>
      `<div style="color:${l.type === 'stderr' ? 'var(--red)' : l.type === 'system' ? 'var(--cyan)' : 'var(--text2)'}">[${esc(l.type)}] ${esc(l.message)}</div>`
    ).join('') || 'No logs yet'}</div>`
  );
}

function createAgentModal() {
  showModal('Create Agent', `
    <div class="form-group"><label>Name</label><input id="agName"></div>
    <div class="form-group"><label>Description</label><input id="agDesc"></div>
    <div class="form-group"><label>Type</label>
      <select id="agType"><option value="javascript">JavaScript</option><option value="python">Python</option><option value="bash">Bash</option></select>
    </div>
    <div class="form-group"><label>Script</label><textarea id="agScript">console.log("Agent started");\nsetInterval(() => console.log(new Date().toISOString(), "tick"), 5000);</textarea></div>
  `, async () => {
    await api('/api/agents', 'POST', {
      name: document.getElementById('agName').value,
      description: document.getElementById('agDesc').value,
      type: document.getElementById('agType').value,
      script: document.getElementById('agScript').value,
    });
    closeModal(); loadAgents();
  });
}

async function editAgent(id) {
  const { agent } = await api(`/api/agents/${id}`);
  showModal('Edit Agent', `
    <div class="form-group"><label>Name</label><input id="agName" value="${esc(agent.name)}"></div>
    <div class="form-group"><label>Description</label><input id="agDesc" value="${esc(agent.description || '')}"></div>
    <div class="form-group"><label>Script</label><textarea id="agScript">${esc(agent.script || '')}</textarea></div>
  `, async () => {
    await api(`/api/agents/${id}`, 'PUT', {
      name: document.getElementById('agName').value,
      description: document.getElementById('agDesc').value,
      script: document.getElementById('agScript').value,
    });
    closeModal(); loadAgents();
  });
}

async function showPresets() {
  const presets = await api('/api/agents/presets/list');
  showModal('Agent Presets', (presets || []).map(p =>
    `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><strong>${esc(p.name)}</strong> <span style="color:var(--text3);font:11px var(--mono)">${esc(p.type)}</span></div>
        <button class="btn btn-green btn-sm" onclick="deployPreset(${JSON.stringify(p).replace(/"/g, '&quot;').replace(/</g, '&lt;')})">Deploy</button>
      </div>
      <div style="font:12px var(--sans);color:var(--text3);margin-top:2px">${esc(p.description)}</div>
    </div>`
  ).join(''));
}

async function deployPreset(preset) {
  await api('/api/agents', 'POST', { name: preset.name, description: preset.description, type: preset.type, script: preset.script });
  closeModal(); loadAgents();
}

// ═══ SYSTEM ═══
async function loadSystem() {
  const main = document.getElementById('main');
  const [info, runtimes, disks, procs] = await Promise.all([
    api('/api/system/info'), api('/api/system/runtimes'),
    api('/api/system/disk'), api('/api/system/processes'),
  ]);

  main.innerHTML = `
    <div class="page">
      <div class="page-header"><span class="page-title">System</span></div>
      <div class="page-pad">
        <div class="sys-grid">
          <div class="sys-card"><div class="sys-label">Hostname</div><div class="sys-value" style="font-size:16px">${esc(info.hostname)}</div><div class="sys-sub">${esc(info.platform)} ${esc(info.arch)}</div></div>
          <div class="sys-card"><div class="sys-label">CPU</div><div class="sys-value" id="sysCpu">${info.loadavg[0].toFixed(2)}</div><div class="sys-sub">${info.cpuCount} cores</div><div class="meter"><div class="meter-fill" id="sysCpuBar" style="width:${Math.min(info.loadavg[0]/info.cpuCount*100,100)}%;background:var(--cyan)"></div></div></div>
          <div class="sys-card"><div class="sys-label">Memory</div><div class="sys-value" id="sysMem">${info.memPercent}%</div><div class="sys-sub">${formatSize(info.totalMem - info.freeMem)} / ${formatSize(info.totalMem)}</div><div class="meter"><div class="meter-fill" id="sysMemBar" style="width:${info.memPercent}%;background:${info.memPercent>80?'var(--red)':'var(--green)'}"></div></div></div>
          <div class="sys-card"><div class="sys-label">Uptime</div><div class="sys-value" style="font-size:16px">${formatUptime(info.uptime)}</div><div class="sys-sub">Node ${esc(info.nodeVersion)}</div></div>
        </div>

        <h3 style="margin:20px 0 10px;font:600 13px var(--sans);color:var(--text3);text-transform:uppercase;letter-spacing:1px">Installed Runtimes</h3>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:20px">
          ${(runtimes || []).map(r => `<span class="runtime-badge ${r.installed ? 'installed' : ''}">${esc(r.name)} ${r.installed ? esc((r.version || '').split(' ').pop()?.slice(0,12) || 'OK') : 'N/A'}</span>`).join('')}
        </div>

        <h3 style="margin:20px 0 10px;font:600 13px var(--sans);color:var(--text3);text-transform:uppercase;letter-spacing:1px">Disk</h3>
        <div style="overflow-x:auto;margin-bottom:20px">
          <table class="proc-table">
            <thead><tr><th>Filesystem</th><th>Size</th><th>Used</th><th>Avail</th><th>Use%</th><th>Mount</th></tr></thead>
            <tbody>${(disks || []).map(d => `<tr><td>${esc(d.filesystem)}</td><td>${esc(d.size)}</td><td>${esc(d.used)}</td><td>${esc(d.available)}</td><td style="color:${parseInt(d.usePercent)>80?'var(--red)':'var(--text2)'}">${esc(d.usePercent)}</td><td>${esc(d.mountpoint)}</td></tr>`).join('')}</tbody>
          </table>
        </div>

        <h3 style="margin:20px 0 10px;font:600 13px var(--sans);color:var(--text3);text-transform:uppercase;letter-spacing:1px">Top Processes</h3>
        <div style="overflow-x:auto">
          <table class="proc-table">
            <thead><tr><th>PID</th><th>User</th><th>CPU%</th><th>MEM%</th><th>Command</th><th></th></tr></thead>
            <tbody>${(procs.processes || []).slice(0,30).map(p => `<tr>
              <td>${p.pid}</td><td>${esc(p.user)}</td>
              <td style="color:${p.cpu>50?'var(--red)':p.cpu>10?'var(--amber)':'var(--text2)'}">${p.cpu}</td>
              <td style="color:${p.mem>50?'var(--red)':p.mem>10?'var(--amber)':'var(--text2)'}">${p.mem}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.command)}</td>
              <td><button class="btn btn-red btn-sm" onclick="killProc(${p.pid})">Kill</button></td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function updateSystemLive(data) {
  const cpu = document.getElementById('sysCpu');
  const mem = document.getElementById('sysMem');
  const cpuBar = document.getElementById('sysCpuBar');
  const memBar = document.getElementById('sysMemBar');
  if (cpu) cpu.textContent = data.loadavg[0].toFixed(2);
  if (mem) mem.textContent = data.memPercent + '%';
  if (cpuBar) cpuBar.style.width = Math.min(data.loadavg[0] / data.cpuCount * 100, 100) + '%';
  if (memBar) { memBar.style.width = data.memPercent + '%'; memBar.style.background = data.memPercent > 80 ? 'var(--red)' : 'var(--green)'; }
}

async function killProc(pid) {
  const confirmed = await showConfirmModal(`Kill process ${pid}?`);
  if (!confirmed) return;
  await api('/api/system/kill', 'POST', { pid });
  loadSystem();
}

// ═══ UTILS ═══
async function api(url, method = 'GET', body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'X-Session-Id': _sessionId } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (res.status === 401) {
    showLogin();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function formatSize(b) { if (!b) return '0'; const u = ['B','KB','MB','GB','TB']; let i = 0; while(b >= 1024 && i < u.length-1){b/=1024;i++;} return b.toFixed(i?1:0)+' '+u[i]; }
function formatUptime(s) { const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60); return d?`${d}d ${h}h`:h?`${h}h ${m}m`:`${m}m`; }
function getFileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  const map = { js:'&#x1F7E1;',ts:'&#x1F535;',py:'&#x1F40D;',rb:'&#x1F534;',go:'&#x1F7E2;',rs:'&#x1F7E0;',c:'&#x26AA;',
    html:'&#x1F310;',css:'&#x1F3A8;',json:'&#x1F4CB;',md:'&#x1F4C4;',sh:'&#x1F4DF;',yml:'&#x2699;',yaml:'&#x2699;',
    jpg:'&#x1F5BC;',png:'&#x1F5BC;',gif:'&#x1F5BC;',svg:'&#x1F5BC;',mp3:'&#x1F3B5;',mp4:'&#x1F3AC;',
    zip:'&#x1F4E6;',gz:'&#x1F4E6;',tar:'&#x1F4E6;',pdf:'&#x1F4D5;' };
  return map[ext] || '&#x1F4C4;';
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  const color = type === 'error' ? 'var(--red)' : type === 'warning' ? 'var(--amber)' : 'var(--green)';
  t.className = 'toast';
  t.style.cssText = `position:fixed;bottom:20px;right:20px;background:var(--bg4);border:1px solid ${color};color:${color};padding:8px 16px;border-radius:6px;font:12px var(--sans);z-index:200`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ── Skeleton Loaders ──
function renderSkeleton(rows = 3, cols = 1) {
  let html = '<div style="display:flex;flex-direction:column;gap:12px;padding:20px">';
  for (let r = 0; r < rows; r++) {
    html += '<div style="display:flex;gap:12px">';
    for (let c = 0; c < cols; c++) {
      const w = cols > 1 ? '100%' : `${60 + Math.random() * 30}%`;
      html += `<div class="skeleton" style="height:${r === 0 ? '20px' : '14px'};width:${w}"></div>`;
    }
    html += '</div>';
  }
  return html + '</div>';
}

function renderCardSkeleton(count = 3) {
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;padding:20px">';
  for (let i = 0; i < count; i++) {
    html += `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
      <div class="skeleton" style="height:16px;width:60%;margin-bottom:10px"></div>
      <div class="skeleton" style="height:12px;width:80%;margin-bottom:6px"></div>
      <div class="skeleton" style="height:12px;width:40%"></div>
    </div>`;
  }
  return html + '</div>';
}

// ── Empty States ──
function renderEmptyState(icon, title, message, actionLabel, actionFn) {
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center">
    <div style="font-size:40px;margin-bottom:12px;opacity:0.4">${icon}</div>
    <h3 style="font:600 16px var(--sans);color:var(--text);margin-bottom:6px">${esc(title)}</h3>
    <p style="font:13px var(--sans);color:var(--text3);max-width:300px;margin-bottom:${actionLabel ? '16px' : '0'}">${esc(message)}</p>
    ${actionLabel ? `<button class="btn btn-green" onclick="${actionFn}">${esc(actionLabel)}</button>` : ''}
  </div>`;
}

// ── Error State with Retry ──
function renderErrorState(message, retryFn) {
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center">
    <div style="font-size:36px;margin-bottom:12px">&#9888;</div>
    <h3 style="font:600 16px var(--sans);color:var(--red);margin-bottom:6px">Something went wrong</h3>
    <p style="font:13px var(--sans);color:var(--text3);max-width:400px;margin-bottom:16px">${esc(message)}</p>
    ${retryFn ? `<button class="btn" onclick="${retryFn}">Try Again</button>` : ''}
  </div>`;
}

// ── Modal ──
function showModal(title, bodyHtml, onSave) {
  let existing = document.getElementById('hyperionModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'hyperionModal';
  modal.className = 'modal-bg';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-head"><h3>${title}</h3><button class="btn btn-sm" onclick="closeModal()">&#215;</button></div>
      <div class="modal-body">${bodyHtml}</div>
      ${onSave ? '<div class="modal-foot"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-green" id="modalSave">Save</button></div>' : ''}
    </div>
  `;
  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  if (onSave) document.getElementById('modalSave').onclick = onSave;
}

function closeModal() { document.getElementById('hyperionModal')?.remove(); }

// ── Prompt/Confirm Modals (replace native prompt/confirm) ──
function showPromptModal(title, defaultVal = '') {
  return new Promise((resolve) => {
    let existing = document.getElementById('hyperionModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'hyperionModal';
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:400px">
        <div class="modal-head"><h3>${esc(title)}</h3></div>
        <div class="modal-body">
          <input id="promptInput" class="form-group" style="width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:8px 10px;font:13px var(--sans);outline:none" value="${esc(defaultVal)}" autofocus>
        </div>
        <div class="modal-foot">
          <button class="btn" id="promptCancel">Cancel</button>
          <button class="btn btn-green" id="promptOk">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const input = document.getElementById('promptInput');
    input.focus();
    input.select();
    input.onkeydown = (e) => { if (e.key === 'Enter') { modal.remove(); resolve(input.value || null); } if (e.key === 'Escape') { modal.remove(); resolve(null); } };
    document.getElementById('promptCancel').onclick = () => { modal.remove(); resolve(null); };
    document.getElementById('promptOk').onclick = () => { modal.remove(); resolve(input.value || null); };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(null); } };
  });
}

function showConfirmModal(message) {
  return new Promise((resolve) => {
    let existing = document.getElementById('hyperionModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'hyperionModal';
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal-box" style="max-width:400px">
        <div class="modal-head"><h3>Confirm</h3></div>
        <div class="modal-body"><p style="font:14px var(--sans);color:var(--text)">${esc(message)}</p></div>
        <div class="modal-foot">
          <button class="btn" id="confirmCancel">Cancel</button>
          <button class="btn btn-red" id="confirmOk">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('confirmCancel').onclick = () => { modal.remove(); resolve(false); };
    document.getElementById('confirmOk').onclick = () => { modal.remove(); resolve(true); };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };
  });
}

// ═══════════════════════════════════════════════════
// WAVE 2 — Quick Launcher, Notifications, System Charts,
//           File Manager, Terminal Polish, AI Fallback
// ═══════════════════════════════════════════════════

// ═══ QUICK LAUNCHER (Cmd+K) ═══
const LAUNCHER_PAGES = [
  { label: 'Dashboard', desc: 'Overview & quick actions', icon: '📊', action: () => go('dashboard'), shortcut: '⌃1' },
  { label: 'Assistant', desc: 'Natural language commands', icon: '💬', action: () => go('assistant'), shortcut: '⌃2' },
  { label: 'Terminal', desc: 'Shell terminal', icon: '⌨️', action: () => go('terminal'), shortcut: '⌃3' },
  { label: 'NOVA', desc: 'English-like scripting', icon: '⭐', action: () => go('nova'), shortcut: '⌃4' },
  { label: 'Code Runner', desc: 'Execute code in 15+ languages', icon: '🔧', action: () => go('code'), shortcut: '⌃5' },
  { label: 'Files', desc: 'Browse and edit files', icon: '📁', action: () => go('files'), shortcut: '⌃6' },
  { label: 'Notebooks', desc: 'Jupyter-like notebooks', icon: '📓', action: () => go('notebooks'), shortcut: '⌃7' },
  { label: 'Agents', desc: 'Background scripts', icon: '⚙️', action: () => go('agents'), shortcut: '⌃8' },
  { label: 'Workflows', desc: 'Workflow automation', icon: '✅', action: () => go('workflows') },
  { label: 'Plugins', desc: 'Plugin marketplace', icon: '🧩', action: () => go('plugins') },
  { label: 'Skills', desc: 'Loaded skill modules', icon: '⚡', action: () => go('skills') },
  { label: 'Canvas', desc: 'Whiteboard & drawing', icon: '🎨', action: () => go('canvas') },
  { label: 'Git', desc: 'Git repository management', icon: '🔀', action: () => go('gitclient') },
  { label: 'Docker', desc: 'Container management', icon: '🐳', action: () => go('docker') },
  { label: 'DB Explorer', desc: 'Database browser', icon: '🗄️', action: () => go('dbexplorer') },
  { label: 'Vault', desc: 'Secrets & credentials', icon: '🔒', action: () => go('vault') },
  { label: 'HTTP Client', desc: 'API request builder', icon: '🔗', action: () => go('httpclient') },
  { label: 'Toolkit', desc: 'Dev utilities', icon: '🛠️', action: () => go('toolkit') },
  { label: 'Snippets', desc: 'Code snippet manager', icon: '📋', action: () => go('snippets') },
  { label: 'Env Manager', desc: 'Environment variables', icon: '🛡️', action: () => go('envmanager') },
  { label: 'Cron Manager', desc: 'Scheduled jobs', icon: '🕐', action: () => go('cronmanager') },
  { label: 'Processes', desc: 'Process manager', icon: '📊', action: () => go('processes') },
  { label: 'Network', desc: 'Network diagnostics', icon: '🌐', action: () => go('nettools') },
  { label: 'WebSocket', desc: 'WebSocket tester', icon: '🔌', action: () => go('wstester') },
  { label: 'Markdown', desc: 'Markdown editor & preview', icon: '📝', action: () => go('markdown') },
  { label: 'Mock API', desc: 'Mock HTTP endpoints', icon: '🎭', action: () => go('mockapi') },
  { label: 'Deps', desc: 'Dependency auditor', icon: '📦', action: () => go('deps') },
  { label: 'Notes', desc: 'Quick notes', icon: '📌', action: () => go('notes') },
  { label: 'Bookmarks', desc: 'Saved bookmarks', icon: '🔖', action: () => go('bookmarks') },
  { label: 'Load Test', desc: 'HTTP load testing', icon: '⚡', action: () => go('loadtest') },
  { label: 'Data View', desc: 'CSV/JSON data viewer', icon: '📊', action: () => go('dataview') },
  { label: 'Text Tools', desc: 'Text transformations', icon: '🔤', action: () => go('texttools') },
  { label: 'Clipboard', desc: 'Clipboard history', icon: '📋', action: () => go('clipboard') },
  { label: 'Pomodoro', desc: 'Focus timer', icon: '🍅', action: () => go('pomodoro') },
  { label: 'Link Check', desc: 'URL link checker', icon: '🔗', action: () => go('linkcheck') },
  { label: 'Regex', desc: 'Regex tester & builder', icon: '🔍', action: () => go('regex') },
  { label: 'JWT', desc: 'JWT decoder & debugger', icon: '🔐', action: () => go('jwt') },
  { label: 'Diff', desc: 'Text diff viewer', icon: '⇄', action: () => go('diff') },
  { label: 'Images', desc: 'Image tools & optimizer', icon: '🖼️', action: () => go('images') },
  { label: 'Cron Expr', desc: 'Cron expression builder', icon: '⏰', action: () => go('cronexpr') },
  { label: 'Colors', desc: 'Color picker & palettes', icon: '🎨', action: () => go('colors') },
  { label: 'Base64', desc: 'Base64 encode/decode', icon: '🔣', action: () => go('base64') },
  { label: 'Hash', desc: 'Hash & checksum generator', icon: '#️⃣', action: () => go('hashgen') },
  { label: 'UUID', desc: 'UUID generator & validator', icon: '🆔', action: () => go('uuidgen') },
  { label: 'JSON', desc: 'JSON formatter & tools', icon: '{ }', action: () => go('jsontools') },
  { label: 'YAML', desc: 'YAML converter', icon: '📄', action: () => go('yamltools') },
  { label: 'Lorem', desc: 'Lorem ipsum & fake data', icon: '📝', action: () => go('loremgen') },
  { label: 'Logs', desc: 'Log file viewer', icon: '📜', action: () => go('logs') },
  { label: 'Monitor', desc: 'Live system monitor', icon: '📈', action: () => go('monitor') },
  { label: 'Remote', desc: 'Remote desktop', icon: '🖥️', action: () => go('remote') },
  { label: 'System', desc: 'System info & processes', icon: '💻', action: () => go('system') },
  { label: 'Settings', desc: 'Preferences & keybindings', icon: '⚙️', action: () => go('settings'), shortcut: '⌘,' },
];

const LAUNCHER_ACTIONS = [
  { label: 'New Terminal Tab', desc: 'Open a new terminal', icon: '➕', action: () => { go('terminal'); setTimeout(addTerminal, 100); } },
  { label: 'Upload File', desc: 'Upload to current directory', icon: '📤', action: () => { go('files'); setTimeout(uploadFile, 200); } },
  { label: 'Create Notebook', desc: 'New computing notebook', icon: '📝', action: () => { go('notebooks'); setTimeout(createNotebook, 200); } },
  { label: 'Create Agent', desc: 'New background agent', icon: '🤖', action: () => { go('agents'); setTimeout(createAgentModal, 200); } },
  { label: 'Create Workflow', desc: 'New workflow profile', icon: '🔄', action: () => { go('workflows'); setTimeout(createWorkflowModal, 200); } },
  { label: 'Clear Notifications', desc: 'Mark all as read', icon: '🔔', action: () => { api('/api/notifications/read-all', 'PUT'); pollNotifCount(); showToast('Notifications cleared'); } },
  { label: 'Logout', desc: 'Sign out of Hyperion', icon: '🚪', action: () => logout() },
];

function initGlobalKeyHandler() {
  document.addEventListener('keydown', handleGlobalKeydown);
}

function handleGlobalKeydown(e) {
  const kb = getKeybindings();

  // Launcher keyboard nav (when open)
  if (_launcherOpen) {
    if (e.key === 'Escape') { closeLauncher(); e.preventDefault(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveLauncherIdx(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveLauncherIdx(-1); return; }
    if (e.key === 'Enter') { e.preventDefault(); executeLauncherItem(); return; }
  }

  // Search overlay nav (when open)
  if (_searchOpen) {
    if (e.key === 'Escape') { closeSearchEverywhere(); e.preventDefault(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSearchIdx(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveSearchIdx(-1); return; }
    if (e.key === 'Enter') { e.preventDefault(); executeSearchItem(); return; }
  }

  // Cmd/Ctrl + K → toggle launcher
  if (matchKeybinding(e, kb.launcher)) { e.preventDefault(); toggleLauncher(); return; }
  // Cmd+Shift+F → search everywhere
  if (matchKeybinding(e, kb.search)) { e.preventDefault(); openSearchEverywhere(); return; }
  // Cmd+, → settings
  if (matchKeybinding(e, kb.settings)) { e.preventDefault(); go('settings'); return; }
  // Cmd+T → new terminal
  if (matchKeybinding(e, kb.newTerminal)) { e.preventDefault(); go('terminal'); setTimeout(addTerminal, 100); return; }

  // Ctrl+1-8 → page nav
  if (e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '1' && e.key <= '9') {
    const pages = ['dashboard', 'assistant', 'terminal', 'nova', 'code', 'files', 'notebooks', 'agents'];
    const idx = parseInt(e.key) - 1;
    if (pages[idx]) { e.preventDefault(); go(pages[idx]); }
    return;
  }

  // Ctrl+Shift+B → backups
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'b') { e.preventDefault(); go('backups'); return; }
  // ? → shortcuts reference (when not in an input)
  if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const tag = document.activeElement?.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !document.activeElement?.isContentEditable) {
      e.preventDefault(); go('shortcuts'); return;
    }
  }

  // Ctrl+Enter → trigger primary action on current page
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    const primaryActions = {
      regex: () => document.querySelector('[onclick*="_rxTest"]')?.click(),
      jwt: () => document.querySelector('[onclick*="_jwtDecode"]')?.click(),
      diff: () => document.querySelector('[onclick*="_diffCompare"]')?.click(),
      base64: () => document.querySelector('[onclick*="_b64Encode"]')?.click(),
      hashgen: () => document.querySelector('[onclick*="_hshGenerate"]')?.click(),
      uuidgen: () => document.querySelector('[onclick*="_uidGen"]')?.click(),
      jsontools: () => document.querySelector('[onclick*="_jsfFormat"]')?.click(),
      yamltools: () => document.querySelector('[onclick*="_ymlToJson"]')?.click(),
      loremgen: () => document.querySelector('[onclick*="_lorGen"]')?.click(),
      colors: () => document.querySelector('[onclick*="_clrConvert"]')?.click(),
    };
    primaryActions[page]?.();
    return;
  }
}

function matchKeybinding(e, binding) {
  if (!binding) return false;
  if (binding.meta && !(e.metaKey || e.ctrlKey)) return false;
  if (binding.ctrl && !e.ctrlKey) return false;
  if (binding.shift && !e.shiftKey) return false;
  if (binding.alt && !e.altKey) return false;
  return e.key.toLowerCase() === binding.key.toLowerCase();
}

function toggleLauncher() {
  _launcherOpen ? closeLauncher() : openLauncher();
}

async function openLauncher() {
  _launcherOpen = true;
  _launcherIdx = 0;

  // Fetch recent commands
  let recent = [];
  try { recent = await api('/api/assistant/recent'); } catch {}

  const overlay = document.createElement('div');
  overlay.id = 'launcherOverlay';
  overlay.className = 'launcher-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeLauncher(); };
  overlay.innerHTML = `
    <div class="launcher-box">
      <input class="launcher-input" id="launcherInput" placeholder="Search commands, pages, actions..." autofocus>
      <div class="launcher-results" id="launcherResults"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Store data for filtering
  window._launcherRecent = recent;
  window._launcherItems = buildLauncherItems(recent, '');

  renderLauncherResults();
  document.getElementById('launcherInput').addEventListener('input', (e) => {
    window._launcherItems = buildLauncherItems(window._launcherRecent, e.target.value);
    _launcherIdx = 0;
    renderLauncherResults();
  });
}

// Fuzzy match scoring: returns score (0 = no match, higher = better)
function _fuzzyScore(query, text) {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  // Exact substring match scores highest
  if (t.includes(q)) return 100 + (q.length / t.length * 50);
  // Prefix match
  if (t.startsWith(q)) return 150;
  // Fuzzy: every query char must appear in order
  let qi = 0, score = 0, lastMatchIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      if (ti === lastMatchIdx + 1) score += 5; // consecutive bonus
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-') score += 8; // word boundary bonus
      lastMatchIdx = ti;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

function buildLauncherItems(recent, query) {
  const q = query.toLowerCase().trim();
  let items = [];

  // Pages — fuzzy scored and sorted
  const scoredPages = LAUNCHER_PAGES.map(p => {
    const score = Math.max(_fuzzyScore(q, p.label), _fuzzyScore(q, p.desc));
    return { ...p, type: 'page', _score: score };
  }).filter(p => p._score > 0).sort((a, b) => b._score - a._score);
  if (scoredPages.length) items.push({ section: 'Pages' }, ...scoredPages);

  // Actions — fuzzy scored
  const scoredActions = LAUNCHER_ACTIONS.map(a => {
    const score = Math.max(_fuzzyScore(q, a.label), _fuzzyScore(q, a.desc));
    return { ...a, type: 'action', _score: score };
  }).filter(a => a._score > 0).sort((a, b) => b._score - a._score);
  if (scoredActions.length) items.push({ section: 'Actions' }, ...scoredActions);

  // Recent commands — fuzzy scored
  if (recent.length) {
    const filtered = recent.map(r => ({ text: r, score: _fuzzyScore(q, r) })).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
    if (filtered.length) {
      items.push({ section: 'Recent Commands' });
      items.push(...filtered.slice(0, 5).map(r => ({ label: r.text, desc: '', icon: '⏱️', type: 'recent', action: () => { go('assistant'); setTimeout(() => assistantRun(r.text), 100); } })));
    }
  }

  return items;
}

function renderLauncherResults() {
  const el = document.getElementById('launcherResults');
  if (!el) return;
  const items = window._launcherItems || [];
  let idx = 0;
  el.innerHTML = items.map(item => {
    if (item.section) return `<div class="launcher-section">${esc(item.section)}</div>`;
    const active = idx === _launcherIdx ? ' active' : '';
    const html = `<div class="launcher-item${active}" data-lidx="${idx}" onclick="executeLauncherAt(${idx})" onmouseenter="_launcherIdx=${idx};renderLauncherResults()">
      <span class="li-icon">${item.icon || ''}</span>
      <span class="li-label">${esc(item.label)}</span>
      ${item.desc ? `<span class="li-desc">${esc(item.desc)}</span>` : ''}
      ${item.shortcut ? `<span class="li-shortcut">${item.shortcut}</span>` : ''}
    </div>`;
    idx++;
    return html;
  }).join('');
}

function moveLauncherIdx(delta) {
  const actionItems = (window._launcherItems || []).filter(i => !i.section);
  if (!actionItems.length) return;
  _launcherIdx = (_launcherIdx + delta + actionItems.length) % actionItems.length;
  renderLauncherResults();
  // Scroll active into view
  const active = document.querySelector('.launcher-item.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function executeLauncherItem() {
  const actionItems = (window._launcherItems || []).filter(i => !i.section);
  const item = actionItems[_launcherIdx];
  if (item?.action) { closeLauncher(); item.action(); }
}

function executeLauncherAt(idx) {
  const actionItems = (window._launcherItems || []).filter(i => !i.section);
  const item = actionItems[idx];
  if (item?.action) { closeLauncher(); item.action(); }
}

function closeLauncher() {
  _launcherOpen = false;
  document.getElementById('launcherOverlay')?.remove();
}

// ═══ NOTIFICATION CENTER ═══
function startNotifPoll() {
  pollNotifCount();
  _notifPollTimer = setInterval(pollNotifCount, 30000);
}

async function pollNotifCount() {
  try {
    const { count } = await api('/api/notifications/unread-count');
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? '' : 'none';
    }
  } catch {}
}

function toggleNotifPanel() {
  _notifPanelOpen ? closeNotifPanel() : openNotifPanel();
}

async function openNotifPanel() {
  _notifPanelOpen = true;
  const existing = document.getElementById('notifPanel');
  if (existing) existing.remove();
  const existingOverlay = document.getElementById('notifOverlay');
  if (existingOverlay) existingOverlay.remove();

  let notifs = [];
  try { notifs = await api('/api/notifications'); } catch {}

  const overlay = document.createElement('div');
  overlay.id = 'notifOverlay';
  overlay.className = 'notif-panel-overlay';
  overlay.onclick = () => closeNotifPanel();
  document.body.appendChild(overlay);

  const panel = document.createElement('div');
  panel.id = 'notifPanel';
  panel.className = 'notif-panel';
  panel.innerHTML = `
    <div class="notif-panel-head">
      <h3>Notifications</h3>
      <div style="display:flex;gap:4px">
        <button class="btn btn-sm" onclick="markAllNotifRead()">Mark All Read</button>
        <button class="btn btn-red btn-sm" onclick="clearAllNotifs()">Clear</button>
        <button class="btn btn-sm" onclick="closeNotifPanel()">✕</button>
      </div>
    </div>
    <div class="notif-list" id="notifList">
      ${notifs.length ? notifs.map(n => renderNotifItem(n)).join('') : '<div style="padding:40px;text-align:center;color:var(--text3)">No notifications</div>'}
    </div>
  `;
  document.body.appendChild(panel);
  // Animate open
  requestAnimationFrame(() => panel.classList.add('open'));
}

function renderNotifItem(n) {
  const timeAgo = formatTimeAgo(n.created_at);
  return `<div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${esc(n.id)}', this)">
    <div style="display:flex;align-items:center;gap:6px">
      <span class="ni-level ${esc(n.level)}">${esc(n.level)}</span>
      <span class="ni-title">${esc(n.title)}</span>
    </div>
    ${n.message ? `<div class="ni-msg">${esc(n.message)}</div>` : ''}
    <div class="ni-meta"><span>${esc(n.source)}</span><span>${timeAgo}</span></div>
  </div>`;
}

function formatTimeAgo(dateStr) {
  const d = new Date(dateStr + (dateStr.includes('Z') ? '' : 'Z'));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function markNotifRead(id, el) {
  try { await api(`/api/notifications/${id}/read`, 'PUT'); } catch {}
  if (el) el.classList.remove('unread');
  pollNotifCount();
}

async function markAllNotifRead() {
  await api('/api/notifications/read-all', 'PUT');
  document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
  pollNotifCount();
}

async function clearAllNotifs() {
  await api('/api/notifications/clear', 'DELETE');
  const list = document.getElementById('notifList');
  if (list) list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">No notifications</div>';
  pollNotifCount();
}

function closeNotifPanel() {
  _notifPanelOpen = false;
  const panel = document.getElementById('notifPanel');
  if (panel) { panel.classList.remove('open'); setTimeout(() => panel.remove(), 200); }
  document.getElementById('notifOverlay')?.remove();
}

// ═══ SYSTEM MONITOR — Canvas Charts ═══
function drawSparkChart(canvasId, data, color, maxVal) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data.length) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const max = maxVal || Math.max(...data, 1);
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1 || 1)) * w,
    y: h - (v / max) * (h - 4) - 2,
  }));

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color + '33');
  grad.addColorStop(1, color + '05');
  ctx.beginPath();
  ctx.moveTo(points[0].x, h);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Smooth line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cx, (prev.y + curr.y) / 2);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function refreshSystemCharts() {
  const cpuData = _sysHistory.map(s => s.cpuPercent || 0);
  const memData = _sysHistory.map(s => s.memPercent || 0);
  const netData = _sysHistory.map(s => (s.netBytesIn || 0) + (s.netBytesOut || 0));
  const battData = _sysHistory.map(s => s.battery?.percent || 0);

  drawSparkChart('chartCpu', cpuData, '#67D1E8', 100);
  drawSparkChart('chartMem', memData, '#DA7756', 100);
  drawSparkChart('chartNet', netData, '#A78BFA');
  if (battData.some(v => v > 0)) drawSparkChart('chartBatt', battData, '#ffaa22', 100);
}

let _procSortCol = 'mem';
let _procSortDir = -1;

// Override loadSystem to include charts
const _origLoadSystem = loadSystem;
loadSystem = async function() {
  const main = document.getElementById('main');
  const [info, runtimes, disks, procs] = await Promise.all([
    api('/api/system/info'), api('/api/system/runtimes'),
    api('/api/system/disk'), api('/api/system/processes'),
  ]);

  // Get battery
  let battery = null;
  try { battery = await api('/api/system/battery'); } catch {}

  main.innerHTML = `
    <div class="page">
      <div class="page-header"><span class="page-title">System</span></div>
      <div class="page-pad">
        <div class="sys-chart-grid">
          <div class="sys-chart-card">
            <div class="chart-head"><span class="chart-label">CPU</span><span class="chart-value" id="sysCpuVal">${_sysHistory.length ? _sysHistory[_sysHistory.length - 1].cpuPercent || 0 : 0}%</span></div>
            <canvas id="chartCpu" height="80"></canvas>
            <div class="sys-sub" style="margin-top:4px">${info.cpuCount} cores — ${esc(info.cpuModel || '')}</div>
          </div>
          <div class="sys-chart-card">
            <div class="chart-head"><span class="chart-label">Memory</span><span class="chart-value" id="sysMemVal">${info.memPercent}%</span></div>
            <canvas id="chartMem" height="80"></canvas>
            <div class="sys-sub" style="margin-top:4px">${formatSize(info.totalMem - info.freeMem)} / ${formatSize(info.totalMem)}</div>
          </div>
          <div class="sys-chart-card">
            <div class="chart-head"><span class="chart-label">Network</span><span class="chart-value" id="sysNetVal">${_sysHistory.length ? formatSize((_sysHistory[_sysHistory.length - 1].netBytesIn || 0) + (_sysHistory[_sysHistory.length - 1].netBytesOut || 0)) + '/s' : '0'}</span></div>
            <canvas id="chartNet" height="80"></canvas>
          </div>
          <div class="sys-chart-card">
            <div class="chart-head"><span class="chart-label">Battery</span><span class="chart-value" id="sysBattVal">${battery?.available ? battery.percent + '%' : 'N/A'}</span></div>
            <canvas id="chartBatt" height="80"></canvas>
            <div class="sys-sub" style="margin-top:4px">${battery?.available ? (battery.charging ? 'Charging' : (battery.remaining || 'On Battery')) : 'No battery'}</div>
          </div>
        </div>

        <div class="sys-grid" style="margin-bottom:16px">
          <div class="sys-card"><div class="sys-label">Hostname</div><div class="sys-value" style="font-size:16px">${esc(info.hostname)}</div><div class="sys-sub">${esc(info.platform)} ${esc(info.arch)}</div></div>
          <div class="sys-card"><div class="sys-label">Uptime</div><div class="sys-value" style="font-size:16px">${formatUptime(info.uptime)}</div><div class="sys-sub">Node ${esc(info.nodeVersion)}</div></div>
        </div>

        <h3 style="margin:20px 0 10px;font:600 13px var(--sans);color:var(--text3);text-transform:uppercase;letter-spacing:1px">Installed Runtimes</h3>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:20px">
          ${(runtimes || []).map(r => `<span class="runtime-badge ${r.installed ? 'installed' : ''}">${esc(r.name)} ${r.installed ? esc((r.version || '').split(' ').pop()?.slice(0,12) || 'OK') : 'N/A'}</span>`).join('')}
        </div>

        <h3 style="margin:20px 0 10px;font:600 13px var(--sans);color:var(--text3);text-transform:uppercase;letter-spacing:1px">Disk</h3>
        <div style="overflow-x:auto;margin-bottom:20px">
          <table class="proc-table">
            <thead><tr><th>Filesystem</th><th>Size</th><th>Used</th><th>Avail</th><th>Use%</th><th>Mount</th></tr></thead>
            <tbody>${(disks || []).map(d => `<tr><td>${esc(d.filesystem)}</td><td>${esc(d.size)}</td><td>${esc(d.used)}</td><td>${esc(d.available)}</td><td style="color:${parseInt(d.usePercent)>80?'var(--red)':'var(--text2)'}">${esc(d.usePercent)}</td><td>${esc(d.mountpoint)}</td></tr>`).join('')}</tbody>
          </table>
        </div>

        <h3 style="margin:20px 0 10px;font:600 13px var(--sans);color:var(--text3);text-transform:uppercase;letter-spacing:1px">Top Processes</h3>
        <div style="overflow-x:auto">
          <table class="proc-table" id="procTable">
            <thead><tr>
              <th class="sortable ${_procSortCol === 'pid' ? 'sorted' : ''}" onclick="sortProcs('pid')">PID</th>
              <th>User</th>
              <th class="sortable ${_procSortCol === 'cpu' ? 'sorted' : ''}" onclick="sortProcs('cpu')">CPU%</th>
              <th class="sortable ${_procSortCol === 'mem' ? 'sorted' : ''}" onclick="sortProcs('mem')">MEM%</th>
              <th class="sortable ${_procSortCol === 'command' ? 'sorted' : ''}" onclick="sortProcs('command')">Command</th>
              <th></th>
            </tr></thead>
            <tbody id="procBody">${renderProcRows(procs.processes || [])}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  window._procData = procs.processes || [];
  setTimeout(refreshSystemCharts, 50);
};

function renderProcRows(procs) {
  const sorted = [...procs].sort((a, b) => {
    const av = a[_procSortCol], bv = b[_procSortCol];
    if (typeof av === 'string') return _procSortDir * av.localeCompare(bv);
    return _procSortDir * ((av || 0) - (bv || 0));
  });
  return sorted.slice(0, 30).map(p => `<tr>
    <td>${p.pid}</td><td>${esc(p.user)}</td>
    <td style="color:${p.cpu>50?'var(--red)':p.cpu>10?'var(--amber)':'var(--text2)'}">${p.cpu}</td>
    <td style="color:${p.mem>50?'var(--red)':p.mem>10?'var(--amber)':'var(--text2)'}">${p.mem}</td>
    <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.command)}</td>
    <td><button class="btn btn-red btn-sm" onclick="killProc(${p.pid})">Kill</button></td>
  </tr>`).join('');
}

function sortProcs(col) {
  if (_procSortCol === col) _procSortDir *= -1;
  else { _procSortCol = col; _procSortDir = -1; }
  const body = document.getElementById('procBody');
  if (body && window._procData) body.innerHTML = renderProcRows(window._procData);
  // Update header styles
  document.querySelectorAll('.proc-table th.sortable').forEach(th => th.classList.remove('sorted'));
  const idx = { pid: 0, cpu: 2, mem: 3, command: 4 }[col];
  document.querySelectorAll('.proc-table th.sortable')[Object.keys({ pid: 0, cpu: 2, mem: 3, command: 4 }).indexOf(col)]?.classList.add('sorted');
}

// Enhanced updateSystemLive with charts
const _origUpdateSystem = updateSystemLive;
updateSystemLive = function(data) {
  // Update chart values
  const cpuVal = document.getElementById('sysCpuVal');
  const memVal = document.getElementById('sysMemVal');
  const netVal = document.getElementById('sysNetVal');
  const battVal = document.getElementById('sysBattVal');

  if (cpuVal) cpuVal.textContent = (data.cpuPercent || 0) + '%';
  if (memVal) memVal.textContent = data.memPercent + '%';
  if (netVal) netVal.textContent = formatSize((data.netBytesIn || 0) + (data.netBytesOut || 0)) + '/s';
  if (battVal && data.battery) battVal.textContent = data.battery.percent != null ? data.battery.percent + '%' : 'N/A';

  refreshSystemCharts();
};

// ═══ FILE MANAGER UPGRADES ═══

// Override browseDir for grid/list + context menu + drag-drop + search
const _origBrowseDir = browseDir;
browseDir = async function(dir) {
  const showHidden = false;
  const data = await api(`/api/files/list?path=${encodeURIComponent(dir)}&showHidden=${showHidden}`);
  fileCurrentPath = data.path;

  // Path bar with view toggle + search
  const parts = data.path.split('/').filter(Boolean);
  document.getElementById('filePathBar').innerHTML =
    `<span class="path-seg" onclick="browseDir('/')">/</span>` +
    parts.map((p, i) => {
      const full = '/' + parts.slice(0, i + 1).join('/');
      return `<span class="path-seg" onclick="browseDir('${esc(full)}')">${esc(p)}</span><span style="color:var(--text3)">/</span>`;
    }).join('') +
    `<span style="margin-left:auto;display:flex;gap:4px;align-items:center">
      <input class="file-search-input" id="fileSearchInput" placeholder="Search..." oninput="filterFileList(this.value)">
      <div class="file-view-toggle">
        <button class="${_fileViewMode === 'list' ? 'active' : ''}" onclick="setFileView('list')">☰</button>
        <button class="${_fileViewMode === 'grid' ? 'active' : ''}" onclick="setFileView('grid')">⊞</button>
      </div>
      <button class="btn btn-sm" onclick="uploadFile()">Upload</button>
      <button class="btn btn-sm" onclick="createNewFile()">+ File</button>
      <button class="btn btn-sm" onclick="createNewDir()">+ Dir</button>
    </span>`;

  // Store items for filtering
  window._fileItems = data.items;
  window._fileParent = data.parent !== data.path ? data.parent : null;

  renderFileList(data.items, data.parent !== data.path ? data.parent : null);
  setupFileDragDrop();
};

function setFileView(mode) {
  _fileViewMode = mode;
  document.querySelectorAll('.file-view-toggle button').forEach(b => b.classList.toggle('active', b.textContent === (mode === 'list' ? '☰' : '⊞')));
  if (window._fileItems) renderFileList(window._fileItems, window._fileParent);
}

function filterFileList(query) {
  if (!window._fileItems) return;
  const q = query.toLowerCase();
  const filtered = q ? window._fileItems.filter(f => f.name.toLowerCase().includes(q)) : window._fileItems;
  renderFileList(filtered, !q ? window._fileParent : null);
}

function renderFileList(items, parentDir) {
  const tree = document.getElementById('fileTree');
  if (!tree) return;

  if (_fileViewMode === 'grid') {
    tree.innerHTML = (parentDir ? `<div class="file-grid-item dir" onclick="browseDir('${esc(parentDir)}')" oncontextmenu="event.preventDefault()"><div class="fgi-icon">📂</div><div class="fgi-name">.. (up)</div></div>` : '') +
      items.map(f => {
        const icon = f.isDirectory ? '📁' : getFileIcon(f.name).replace(/&#x([^;]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
        return `<div class="file-grid-item ${f.isDirectory ? 'dir' : ''}"
          onclick="${f.isDirectory ? `browseDir('${esc(f.path)}')` : `previewFile('${esc(f.path)}')`}"
          oncontextmenu="showFileContextMenu(event, ${JSON.stringify(f).replace(/"/g, '&quot;')})">
          <div class="fgi-icon">${icon}</div>
          <div class="fgi-name">${esc(f.name)}</div>
          ${f.isFile ? `<div class="fgi-size">${formatSize(f.size)}</div>` : ''}
        </div>`;
      }).join('');
    tree.className = 'file-grid';
  } else {
    tree.className = 'file-tree';
    tree.innerHTML = (parentDir ? `<div class="file-item dir" onclick="browseDir('${esc(parentDir)}')">.. (up)</div>` : '') +
      items.map(f => {
        const icon = f.isDirectory ? '&#x1F4C1;' : getFileIcon(f.name);
        const size = f.isFile ? formatSize(f.size) : '';
        const modified = f.modified ? new Date(f.modified).toLocaleDateString() : '';
        return `<div class="file-item ${f.isDirectory ? 'dir' : ''}"
          onclick="${f.isDirectory ? `browseDir('${esc(f.path)}')` : `previewFile('${esc(f.path)}')`}"
          oncontextmenu="showFileContextMenu(event, ${JSON.stringify(f).replace(/"/g, '&quot;')})">
          <span>${icon}</span> <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.name)}</span>
          <span style="font:10px var(--mono);color:var(--text3);margin-right:8px">${modified}</span>
          <span class="size">${size}</span>
        </div>`;
      }).join('');
  }
}

// Context menu
function showFileContextMenu(e, file) {
  e.preventDefault();
  closeFileContextMenu();
  const menu = document.createElement('div');
  menu.id = 'fileCtxMenu';
  menu.className = 'file-ctx-menu';
  menu.style.left = e.clientX + 'px';
  menu.style.top = e.clientY + 'px';

  let items = '';
  if (!file.isDirectory) {
    items += `<div class="file-ctx-item" onclick="previewFile('${esc(file.path)}');closeFileContextMenu()">Open</div>`;
    items += `<div class="file-ctx-item" onclick="renameFilePrompt('${esc(file.path)}','${esc(file.name)}')">Rename</div>`;
    items += `<div class="file-ctx-item"><a href="/api/files/download?path=${encodeURIComponent(file.path)}" style="color:inherit;text-decoration:none" onclick="closeFileContextMenu()">Download</a></div>`;
    items += `<div class="file-ctx-item danger" onclick="deleteFile('${esc(file.path)}');closeFileContextMenu()">Delete</div>`;
  } else {
    items += `<div class="file-ctx-item" onclick="browseDir('${esc(file.path)}');closeFileContextMenu()">Open</div>`;
    items += `<div class="file-ctx-item" onclick="renameFilePrompt('${esc(file.path)}','${esc(file.name)}')">Rename</div>`;
    items += `<div class="file-ctx-item danger" onclick="deleteFile('${esc(file.path)}');closeFileContextMenu()">Delete</div>`;
  }
  menu.innerHTML = items;
  document.body.appendChild(menu);

  // Close on click elsewhere
  setTimeout(() => document.addEventListener('click', closeFileContextMenu, { once: true }), 10);
}

function closeFileContextMenu() {
  document.getElementById('fileCtxMenu')?.remove();
}

async function renameFilePrompt(oldPath, oldName) {
  closeFileContextMenu();
  const newName = await showPromptModal('Rename to:', oldName);
  if (!newName || newName === oldName) return;
  const dir = oldPath.substring(0, oldPath.length - oldName.length);
  try {
    // Read old, write new, delete old
    const data = await api(`/api/files/read?path=${encodeURIComponent(oldPath)}`);
    await api('/api/files/write', 'POST', { path: dir + newName, content: data.content || '' });
    await api(`/api/files/delete?path=${encodeURIComponent(oldPath)}`, 'DELETE');
    browseDir(fileCurrentPath);
    showToast(`Renamed to ${newName}`);
  } catch (err) {
    showToast('Rename failed: ' + err.message);
  }
}

// Drag-and-drop upload
function setupFileDragDrop() {
  const tree = document.getElementById('fileTree');
  if (!tree) return;
  tree.style.position = 'relative';

  tree.ondragover = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!tree.querySelector('.file-dropzone')) {
      const dz = document.createElement('div');
      dz.className = 'file-dropzone';
      dz.textContent = 'Drop files to upload';
      tree.appendChild(dz);
    }
  };

  tree.ondragleave = (e) => {
    if (!tree.contains(e.relatedTarget)) tree.querySelector('.file-dropzone')?.remove();
  };

  tree.ondrop = async (e) => {
    e.preventDefault();
    tree.querySelector('.file-dropzone')?.remove();
    const files = e.dataTransfer.files;
    if (!files.length) return;
    const form = new FormData();
    for (const f of files) form.append('files', f);
    form.append('path', fileCurrentPath);
    await fetch('/api/files/upload', { method: 'POST', body: form, headers: { 'X-Session-Id': _sessionId } });
    browseDir(fileCurrentPath);
    showToast(`${files.length} file(s) uploaded`);
  };
}

// Image preview + syntax highlighting in previewFile
const _origPreviewFile = previewFile;
previewFile = async function(filePath) {
  const preview = document.getElementById('filePreview');
  try {
    // Check if image
    const ext = filePath.split('.').pop()?.toLowerCase();
    const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];
    if (imgExts.includes(ext)) {
      preview.innerHTML = `
        <div style="padding:12px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
          <span style="font:12px var(--mono);color:var(--text2);flex:1">${esc(filePath)}</span>
          <a class="btn btn-sm" href="/api/files/download?path=${encodeURIComponent(filePath)}">Download</a>
          <button class="btn btn-red btn-sm" onclick="deleteFile('${esc(filePath)}')">Delete</button>
        </div>
        <div style="padding:16px;text-align:center;overflow:auto;flex:1">
          <img class="img-preview" src="/api/files/download?path=${encodeURIComponent(filePath)}" alt="${esc(filePath.split('/').pop())}">
        </div>
      `;
      return;
    }

    const data = await api(`/api/files/read?path=${encodeURIComponent(filePath)}`);
    if (data.isBinary) {
      preview.innerHTML = `<div style="padding:20px;color:var(--text3)">Binary file (${formatSize(data.size)}). <a href="/api/files/download?path=${encodeURIComponent(filePath)}" style="color:var(--cyan)">Download</a></div>`;
      return;
    }

    editingFile = filePath;
    const highlighted = highlightCode(data.content || '', data.language || ext);
    preview.innerHTML = `
      <div style="padding:6px 12px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
        <span style="font:12px var(--mono);color:var(--text2);flex:1">${esc(filePath)} (${data.lines} lines, ${formatSize(data.size)})</span>
        <button class="btn btn-sm" id="fileEditToggle" onclick="toggleFileEdit()">Edit</button>
        <button class="btn btn-green btn-sm" id="fileSaveBtn" style="display:none" onclick="saveFile()">Save</button>
        <button class="btn btn-sm" onclick="runFile('${esc(filePath)}','${esc(data.language)}')">Run</button>
        <a class="btn btn-sm" href="/api/files/download?path=${encodeURIComponent(filePath)}">Download</a>
        <button class="btn btn-red btn-sm" onclick="deleteFile('${esc(filePath)}')">Delete</button>
      </div>
      <div class="file-content" id="fileHighlighted" style="display:block">${highlighted}</div>
      <textarea class="file-content editing" id="fileEditor" spellcheck="false" style="display:none">${esc(data.content)}</textarea>
    `;
  } catch (err) {
    preview.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
};

function toggleFileEdit() {
  const hl = document.getElementById('fileHighlighted');
  const ed = document.getElementById('fileEditor');
  const btn = document.getElementById('fileEditToggle');
  const saveBtn = document.getElementById('fileSaveBtn');
  if (!hl || !ed) return;
  const editing = ed.style.display !== 'none';
  hl.style.display = editing ? 'block' : 'none';
  ed.style.display = editing ? 'none' : 'block';
  btn.textContent = editing ? 'Edit' : 'View';
  saveBtn.style.display = editing ? 'none' : '';
  if (!editing) ed.focus();
}

// Syntax highlighting — regex-based token coloring
function highlightCode(code, lang) {
  if (!code) return '';
  const escaped = esc(code);

  // Language keywords
  const kwMap = {
    js: 'const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|new|this|import|export|from|default|async|await|try|catch|throw|finally|typeof|instanceof|in|of|null|undefined|true|false|yield|delete|void',
    javascript: 'const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|new|this|import|export|from|default|async|await|try|catch|throw|finally|typeof|instanceof|in|of|null|undefined|true|false|yield|delete|void',
    ts: 'const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|new|this|import|export|from|default|async|await|try|catch|throw|finally|typeof|instanceof|in|of|null|undefined|true|false|interface|type|enum|implements|extends|abstract|public|private|protected|readonly|as|is|keyof',
    py: 'def|return|if|elif|else|for|while|class|import|from|as|try|except|finally|raise|with|yield|lambda|and|or|not|in|is|True|False|None|pass|break|continue|global|nonlocal|del|assert|async|await',
    python: 'def|return|if|elif|else|for|while|class|import|from|as|try|except|finally|raise|with|yield|lambda|and|or|not|in|is|True|False|None|pass|break|continue|global|nonlocal|del|assert|async|await',
    go: 'func|return|if|else|for|range|switch|case|break|continue|type|struct|interface|package|import|var|const|map|chan|go|defer|select|default|nil|true|false|make|new|append|len|cap',
    rust: 'fn|return|if|else|for|while|loop|match|let|mut|const|struct|enum|impl|trait|use|mod|pub|self|super|crate|where|async|await|move|ref|type|true|false|None|Some|Ok|Err|unsafe|extern|as|in|dyn|box|static',
    c: 'int|float|double|char|void|return|if|else|for|while|do|switch|case|break|continue|struct|typedef|enum|union|extern|static|const|sizeof|NULL|true|false|unsigned|signed|long|short|register|volatile|auto|goto|include|define|ifdef|ifndef|endif',
    cpp: 'int|float|double|char|void|return|if|else|for|while|do|switch|case|break|continue|struct|typedef|enum|union|extern|static|const|sizeof|NULL|true|false|unsigned|signed|long|short|class|public|private|protected|virtual|override|namespace|using|template|typename|new|delete|try|catch|throw|auto|nullptr|constexpr|decltype|noexcept|include|define',
    rb: 'def|end|return|if|elsif|else|unless|for|while|until|do|class|module|require|include|attr_accessor|attr_reader|attr_writer|self|nil|true|false|and|or|not|begin|rescue|ensure|raise|yield|block_given|lambda|proc|puts|print',
    ruby: 'def|end|return|if|elsif|else|unless|for|while|until|do|class|module|require|include|attr_accessor|attr_reader|attr_writer|self|nil|true|false|and|or|not|begin|rescue|ensure|raise|yield|block_given|lambda|proc|puts|print',
    sh: 'if|then|else|elif|fi|for|while|do|done|case|esac|function|return|echo|exit|export|source|local|readonly|shift|set|unset|trap|eval|exec|test|true|false|in',
    bash: 'if|then|else|elif|fi|for|while|do|done|case|esac|function|return|echo|exit|export|source|local|readonly|shift|set|unset|trap|eval|exec|test|true|false|in',
  };

  const kw = kwMap[lang] || kwMap.js;

  let result = escaped
    // Strings (double and single quotes)
    .replace(/((?:&quot;|&#39;|`)(?:(?!(?:&quot;|&#39;|`))[\s\S])*?(?:&quot;|&#39;|`))/g, '<span class="hl-str">$1</span>')
    // Comments (// and #)
    .replace(/(\/\/[^\n]*)/g, '<span class="hl-cmt">$1</span>')
    .replace(/(#[^\n]*)/g, (m) => {
      // Don't highlight #include as comment
      if (m.startsWith('#include') || m.startsWith('#define') || m.startsWith('#ifdef') || m.startsWith('#ifndef') || m.startsWith('#endif')) return m;
      return `<span class="hl-cmt">${m}</span>`;
    })
    // Numbers
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-num">$1</span>');

  // Keywords (word boundary)
  if (kw) {
    const kwRe = new RegExp(`\\b(${kw})\\b`, 'g');
    result = result.replace(kwRe, (m) => {
      // Don't highlight inside already-highlighted spans
      return `<span class="hl-kw">${m}</span>`;
    });
  }

  return result;
}

// ═══ TERMINAL POLISH ═══
const TERM_THEMES = {
  hyperion: { background: '#1C1917', foreground: '#F5EFE6', cursor: '#DA7756', selectionBackground: 'rgba(218,119,86,0.2)', black: '#1C1917', red: '#EF5350', green: '#DA7756', yellow: '#F59E0B', blue: '#5B9CF6', magenta: '#A78BFA', cyan: '#67D1E8', white: '#F5EFE6' },
  monokai: { background: '#272822', foreground: '#f8f8f2', cursor: '#f8f8f0', selectionBackground: 'rgba(73,72,62,0.5)', black: '#272822', red: '#f92672', green: '#a6e22e', yellow: '#e6db74', blue: '#66d9ef', magenta: '#ae81ff', cyan: '#a1efe4', white: '#f8f8f2' },
  dracula: { background: '#282a36', foreground: '#f8f8f2', cursor: '#f8f8f2', selectionBackground: 'rgba(68,71,90,0.5)', black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c', blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2' },
  light: { background: '#fafafa', foreground: '#383a42', cursor: '#526eff', selectionBackground: 'rgba(56,58,66,0.1)', black: '#383a42', red: '#e45649', green: '#50a14f', yellow: '#c18401', blue: '#4078f2', magenta: '#a626a4', cyan: '#0184bc', white: '#fafafa' },
};

function applyTermTheme(name) {
  _termTheme = name;
  const theme = TERM_THEMES[name] || TERM_THEMES.hyperion;
  terminals.forEach(t => t.term.options.theme = theme);
}

// Override loadTerminal for enhanced tab bar
const _origLoadTerminal = loadTerminal;
loadTerminal = function() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page" style="padding:0;display:flex;flex-direction:column">
      <div class="terminal-tabs" id="termTabs"></div>
      <div id="termContainers" style="flex:1;position:relative;display:flex;${_termLayout === 'vsplit' ? 'flex-direction:column' : ''}"></div>
    </div>
  `;
  if (!terminals.length) addTerminal();
  else renderTermTabs();
};

// Override addTerminal for themes
const _origAddTerminal = addTerminal;
addTerminal = function() {
  const idx = terminals.length;
  const container = document.createElement('div');
  container.className = 'terminal-wrap';
  container.style.display = 'none';

  const theme = TERM_THEMES[_termTheme] || TERM_THEMES.hyperion;
  const term = new Terminal({
    cursorBlink: true, fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Menlo', monospace",
    theme,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon.WebLinksAddon());

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws/terminal?cols=${term.cols}&rows=${term.rows}&sid=${encodeURIComponent(_sessionId)}`);

  ws.onopen = () => {
    term.onData(data => {
      ws.send(JSON.stringify({ type: 'input', data }));
      // Broadcast input to all other terminals
      if (_broadcastInput) {
        terminals.forEach((t, i) => {
          if (i !== idx && t.ws.readyState === WebSocket.OPEN) {
            t.ws.send(JSON.stringify({ type: 'input', data }));
          }
        });
      }
    });
    term.onResize(({ cols, rows }) => ws.send(JSON.stringify({ type: 'resize', cols, rows })));
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'output') term.write(msg.data);
      else if (msg.type === 'exit') term.write(`\r\n[Process exited with code ${msg.code}]\r\n`);
    } catch {}
  };

  terminals.push({ term, fit, ws, container });
  activeTermIdx = idx;
  renderTermTabs();

  const containers = document.getElementById('termContainers');
  if (containers) {
    containers.appendChild(container);
    container.style.display = '';
    term.open(container);
    setTimeout(() => fit.fit(), 50);
  }

  window.addEventListener('resize', () => { if (page === 'terminal') terminals.forEach(t => t.fit.fit()); });
};

// Override renderTermTabs for enhanced toolbar
const _origRenderTermTabs = renderTermTabs;
renderTermTabs = function() {
  const tabs = document.getElementById('termTabs');
  if (!tabs) return;
  tabs.innerHTML = terminals.map((_, i) =>
    `<button class="term-tab ${i === activeTermIdx ? 'active' : ''}" onclick="switchTerm(${i})">Terminal ${i + 1}<span class="term-close" onclick="event.stopPropagation();closeTermTab(${i})">&times;</span></button>`
  ).join('') +
  `<button class="term-add" onclick="addTerminal()">+</button>` +
  `<div class="term-toolbar">
    <select onchange="applyTermTheme(this.value)" title="Theme">
      <option value="hyperion" ${_termTheme === 'hyperion' ? 'selected' : ''}>Hyperion</option>
      <option value="monokai" ${_termTheme === 'monokai' ? 'selected' : ''}>Monokai</option>
      <option value="dracula" ${_termTheme === 'dracula' ? 'selected' : ''}>Dracula</option>
      <option value="light" ${_termTheme === 'light' ? 'selected' : ''}>Light</option>
    </select>
    <button onclick="splitTerminal('hsplit')" title="Split Horizontal">⬜⬜</button>
    <button onclick="splitTerminal('vsplit')" title="Split Vertical">⬛⬜</button>
    <button onclick="splitTerminal('single')" title="Single Pane">⬜</button>
    <button class="${_broadcastInput ? 'active' : ''}" onclick="toggleBroadcast()" title="Broadcast Input">📡</button>
    ${_broadcastInput ? '<span class="term-broadcast-badge">BROADCAST</span>' : ''}
  </div>`;

  terminals.forEach((t, i) => {
    if (_termLayout === 'single') {
      t.container.style.display = i === activeTermIdx ? '' : 'none';
    } else {
      // Show first 2 terminals in split
      t.container.style.display = i < 2 ? '' : 'none';
    }
    const containers = document.getElementById('termContainers');
    if (containers && !containers.contains(t.container)) {
      containers.appendChild(t.container);
      t.term.open(t.container);
      setTimeout(() => t.fit.fit(), 50);
    }
  });
};

function splitTerminal(layout) {
  _termLayout = layout;
  const containers = document.getElementById('termContainers');
  if (!containers) return;

  containers.style.flexDirection = layout === 'vsplit' ? 'column' : 'row';

  if (layout !== 'single' && terminals.length < 2) {
    addTerminal();
  }

  terminals.forEach((t, i) => {
    if (layout === 'single') {
      t.container.style.display = i === activeTermIdx ? '' : 'none';
    } else {
      t.container.style.display = i < 2 ? '' : 'none';
    }
  });

  renderTermTabs();
  setTimeout(() => terminals.forEach(t => t.fit.fit()), 50);
}

function toggleBroadcast() {
  _broadcastInput = !_broadcastInput;
  renderTermTabs();
  showToast(_broadcastInput ? 'Broadcast ON — input sent to all terminals' : 'Broadcast OFF');
}

// ═══ AI FALLBACK — Approval Flow ═══
// Override renderAssistantEntry to handle AI-generated entries
const _origRenderEntry = renderAssistantEntry;
renderAssistantEntry = function(entry) {
  if (entry.status === 'thinking') return _origRenderEntry(entry);

  const d = entry.data || {};

  // AI-generated command needing approval
  if (d.aiGenerated && d.needsApproval && !entry.approved && !entry.dismissed) {
    const entryId = 'ai-' + Math.random().toString(36).slice(2, 8);
    return `<div class="assistant-entry" id="${entryId}">
      <div class="ae-user"><span class="ae-you">YOU</span> ${esc(entry.query)}</div>
      <div class="ae-bot">
        <div class="ae-command-bar">
          <span class="ae-ai-badge">AI</span>
          <span class="ae-cmd-label">SUGGESTED</span>
          <span class="ae-cmd">${esc(d.command)}</span>
        </div>
        ${d.description ? `<div class="ae-desc">${esc(d.description)}</div>` : ''}
        <div class="ae-approve-btns">
          <button class="ae-approve-btn" onclick="executeAICommand('${entryId}', ${JSON.stringify(d.command).replace(/'/g, "\\'")}, ${assistantHistory.indexOf(entry)})">Execute</button>
          <button class="ae-dismiss-btn" onclick="dismissAICommand('${entryId}', ${assistantHistory.indexOf(entry)})">Dismiss</button>
        </div>
      </div>
    </div>`;
  }

  // AI command that was executed
  if (d.aiGenerated && entry.approved) {
    const exitClass = (entry.execResult?.exitCode || 0) === 0 ? 'ok' : 'err';
    const outputClass = (entry.execResult?.exitCode || 0) === 0 ? '' : ' error';
    return `<div class="assistant-entry">
      <div class="ae-user"><span class="ae-you">YOU</span> ${esc(entry.query)}</div>
      <div class="ae-bot">
        <div class="ae-command-bar">
          <span class="ae-ai-badge">AI</span>
          <span class="ae-cmd-label">CMD</span>
          <span class="ae-cmd">${esc(d.command)}</span>
          <span class="ae-exit ${exitClass}">exit ${entry.execResult?.exitCode ?? '?'}</span>
          ${entry.execResult?.duration ? `<span class="ae-duration">${entry.execResult.duration}ms</span>` : ''}
        </div>
        ${d.description ? `<div class="ae-desc">${esc(d.description)}</div>` : ''}
        <div class="ae-output-wrap"><pre class="ae-output${outputClass}">${esc(entry.execResult?.stdout || entry.execResult?.stderr || '(no output)')}</pre></div>
      </div>
    </div>`;
  }

  // Dismissed AI command
  if (d.aiGenerated && entry.dismissed) {
    return `<div class="assistant-entry">
      <div class="ae-user"><span class="ae-you">YOU</span> ${esc(entry.query)}</div>
      <div class="ae-bot" style="opacity:0.5">
        <div class="ae-command-bar">
          <span class="ae-ai-badge">AI</span>
          <span class="ae-cmd-label">DISMISSED</span>
          <span class="ae-cmd" style="text-decoration:line-through">${esc(d.command)}</span>
        </div>
      </div>
    </div>`;
  }

  // Default rendering
  return _origRenderEntry(entry);
};

async function executeAICommand(entryId, command, histIdx) {
  const entry = assistantHistory[histIdx];
  if (!entry) return;

  const el = document.getElementById(entryId);
  if (el) {
    const btns = el.querySelector('.ae-approve-btns');
    if (btns) btns.innerHTML = '<span style="color:var(--text3);font:12px var(--sans)">Executing...</span>';
  }

  try {
    const result = await api('/api/assistant/execute-approved', 'POST', { command });
    entry.approved = true;
    entry.execResult = result;
  } catch (err) {
    entry.approved = true;
    entry.execResult = { stdout: '', stderr: err.message, exitCode: 1 };
  }

  if (el) el.outerHTML = renderAssistantEntry(entry);
}

function dismissAICommand(entryId, histIdx) {
  const entry = assistantHistory[histIdx];
  if (!entry) return;
  entry.dismissed = true;
  const el = document.getElementById(entryId);
  if (el) el.outerHTML = renderAssistantEntry(entry);
}

// ═══════════════════════════════════════════════════
// WAVE 3 — Settings, Dashboard, Search, SSH, Plugins,
//           Collab Notebooks, Tests, Accessibility, Mobile
// ═══════════════════════════════════════════════════

// ═══ SETTINGS PAGE ═══
async function loadUserSettings() {
  try {
    _userSettings = await api('/api/settings');
    // Apply saved theme
    if (_userSettings.theme === 'system') {
      _applySystemTheme();
      window._systemThemeListener = () => _applySystemTheme();
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', window._systemThemeListener);
    } else if (_userSettings.theme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.remove('theme-light');
    }
    // Apply sidebar collapsed state
    if (_userSettings.sidebarCollapsed) {
      _sidebarCollapsed = true;
      document.getElementById('sidebar')?.classList.add('collapsed');
    }
    // Apply terminal theme
    if (_userSettings.terminalTheme) {
      _termTheme = _userSettings.terminalTheme;
      applyTermTheme(_termTheme);
    }
    // Load advanced theme from theme manager
    _loadSavedTheme();
  } catch {}
}

let _settingsTab = 'profile';

async function loadSettings() {
  const main = document.getElementById('main');
  const settings = await api('/api/settings').catch(() => ({}));
  _userSettings = settings;

  main.innerHTML = `
    <div class="page">
      <div class="page-header"><span class="page-title">Settings</span></div>
      <div style="display:flex;flex:1;min-height:0">
        <div class="settings-tabs" role="tablist">
          <button class="settings-tab ${_settingsTab === 'profile' ? 'active' : ''}" onclick="switchSettingsTab('profile')" role="tab">Profile</button>
          <button class="settings-tab ${_settingsTab === 'llm' ? 'active' : ''}" onclick="switchSettingsTab('llm')" role="tab">LLM Config</button>
          <button class="settings-tab ${_settingsTab === 'theme' ? 'active' : ''}" onclick="switchSettingsTab('theme')" role="tab">Theme</button>
          <button class="settings-tab ${_settingsTab === 'termDefaults' ? 'active' : ''}" onclick="switchSettingsTab('termDefaults')" role="tab">Terminal</button>
          <button class="settings-tab ${_settingsTab === 'keybindings' ? 'active' : ''}" onclick="switchSettingsTab('keybindings')" role="tab">Keybindings</button>
          <button class="settings-tab ${_settingsTab === 'data' ? 'active' : ''}" onclick="switchSettingsTab('data')" role="tab">Data</button>
          <button class="settings-tab ${_settingsTab === 'security' ? 'active' : ''}" onclick="switchSettingsTab('security')" role="tab">Security</button>
          <button class="settings-tab ${_settingsTab === 'apikeys' ? 'active' : ''}" onclick="switchSettingsTab('apikeys')" role="tab">API Keys</button>
          <button class="settings-tab ${_settingsTab === 'notifprefs' ? 'active' : ''}" onclick="switchSettingsTab('notifprefs')" role="tab">Notifications</button>
          <button class="settings-tab ${_settingsTab === 'appearance' ? 'active' : ''}" onclick="switchSettingsTab('appearance')" role="tab">Appearance</button>
          <button class="settings-tab ${_settingsTab === 'importexport' ? 'active' : ''}" onclick="switchSettingsTab('importexport')" role="tab">Import/Export</button>
          <button class="settings-tab ${_settingsTab === 'roles' ? 'active' : ''}" onclick="switchSettingsTab('roles')" role="tab">Roles</button>
          <button class="settings-tab ${_settingsTab === 'users' ? 'active' : ''}" onclick="switchSettingsTab('users')" role="tab">Users</button>
        </div>
        <div class="settings-content page-pad" id="settingsContent"></div>
      </div>
    </div>
  `;
  renderSettingsTab();
}

function switchSettingsTab(tab) {
  _settingsTab = tab;
  document.querySelectorAll('.settings-tab').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase().replace(' ', '') === tab || b.textContent === { profile: 'Profile', llm: 'LLM Config', theme: 'Theme', termDefaults: 'Terminal', keybindings: 'Keybindings' }[tab]));
  renderSettingsTab();
}

function renderSettingsTab() {
  const el = document.getElementById('settingsContent');
  if (!el) return;

  switch (_settingsTab) {
    case 'profile':
      el.innerHTML = `
        <h3 style="font:600 15px var(--sans);margin-bottom:16px">Profile</h3>
        <div class="form-group"><label>Username</label><input id="setUsername" value="${esc(_userSettings.username || '')}" disabled style="opacity:0.6"></div>
        <h4 style="font:600 13px var(--sans);margin:20px 0 10px;color:var(--text2)">Change Password</h4>
        <div class="form-group"><label>Current Password</label><input id="setCurPass" type="password"></div>
        <div class="form-group"><label>New Password</label><input id="setNewPass" type="password"></div>
        <div class="form-group"><label>Confirm New Password</label><input id="setNewPass2" type="password"></div>
        <button class="btn btn-green" onclick="changePassword()">Update Password</button>
        <div id="setPassMsg" style="margin-top:8px;font:12px var(--sans)"></div>
      `;
      break;

    case 'llm':
      el.innerHTML = `
        <h3 style="font:600 15px var(--sans);margin-bottom:16px">LLM Configuration</h3>
        <p style="font:12px var(--sans);color:var(--text3);margin-bottom:16px">Connect any AI provider — enter your API key and select a model. Multiple providers can be configured for automatic failover.</p>
        <div class="form-group"><label>Provider</label>
          <select id="setLlmProvider" onchange="llmProviderChanged()">
            <option value="ollama" ${_userSettings.llm_provider === 'ollama' ? 'selected' : ''}>Ollama (Local)</option>
            <option value="openai" ${_userSettings.llm_provider === 'openai' ? 'selected' : ''}>OpenAI</option>
            <option value="gemini" ${_userSettings.llm_provider === 'gemini' ? 'selected' : ''}>Google Gemini</option>
            <option value="anthropic" ${_userSettings.llm_provider === 'anthropic' ? 'selected' : ''}>Anthropic (Claude)</option>
            <option value="xai" ${_userSettings.llm_provider === 'xai' ? 'selected' : ''}>xAI (Grok)</option>
          </select>
        </div>
        <div class="form-group"><label>Model</label><input id="setLlmModel" value="${esc(_userSettings.llm_model || '')}"></div>
        <div class="form-group"><label>API Key</label><input id="setLlmKey" type="password" value="${_userSettings.llm_apikey ? '••••••••' : ''}" placeholder="Enter API key"></div>
        <div class="form-group"><label>Base URL <span style="color:var(--text3)">(Ollama / custom endpoint)</span></label><input id="setLlmUrl" value="${esc(_userSettings.llm_base_url || 'http://localhost:11434')}"></div>
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <button class="btn btn-green" onclick="saveLlmSettings()">Save</button>
          <button class="btn" onclick="testLlmSettings()">Test Connection</button>
        </div>
        <div id="setLlmMsg" style="margin-top:8px;font:12px var(--sans)"></div>
        <div id="llmProviderStatus" style="margin-top:20px"></div>
      `;
      _loadLlmProviderStatus();
      break;

    case 'theme':
      _renderAppearanceTab(el);
      break;

    case 'termDefaults':
      el.innerHTML = `
        <h3 style="font:600 15px var(--sans);margin-bottom:16px">Terminal Defaults</h3>
        <div class="form-group"><label>Default Shell</label>
          <select id="setTermShell">
            <option value="/bin/zsh" ${_userSettings.term_shell === '/bin/zsh' ? 'selected' : ''}>zsh</option>
            <option value="/bin/bash" ${_userSettings.term_shell === '/bin/bash' ? 'selected' : ''}>bash</option>
            <option value="/bin/sh" ${_userSettings.term_shell === '/bin/sh' ? 'selected' : ''}>sh</option>
          </select>
        </div>
        <div class="form-group"><label>Font Size: <span id="termFontVal">${_userSettings.term_font_size || 13}</span>px</label>
          <input type="range" min="10" max="22" value="${_userSettings.term_font_size || 13}" id="setTermFont" oninput="document.getElementById('termFontVal').textContent=this.value" style="width:100%">
        </div>
        <div class="form-group"><label>Default Theme</label>
          <select id="setTermTheme">
            <option value="hyperion" ${(_userSettings.terminalTheme || 'hyperion') === 'hyperion' ? 'selected' : ''}>Hyperion</option>
            <option value="monokai" ${_userSettings.terminalTheme === 'monokai' ? 'selected' : ''}>Monokai</option>
            <option value="dracula" ${_userSettings.terminalTheme === 'dracula' ? 'selected' : ''}>Dracula</option>
            <option value="light" ${_userSettings.terminalTheme === 'light' ? 'selected' : ''}>Light</option>
          </select>
        </div>
        <button class="btn btn-green" onclick="saveTermSettings()">Save</button>
      `;
      break;

    case 'keybindings':
      const kb = getKeybindings();
      el.innerHTML = `
        <h3 style="font:600 15px var(--sans);margin-bottom:16px">Keybindings</h3>
        <table class="proc-table" style="width:100%">
          <thead><tr><th>Action</th><th>Shortcut</th><th></th></tr></thead>
          <tbody>
            ${Object.entries(kb).map(([action, b]) => `
              <tr>
                <td style="font:500 13px var(--sans)">${esc(b.desc || action)}</td>
                <td><kbd class="kb-key" id="kb-${esc(action)}">${formatKeybinding(b)}</kbd></td>
                <td><button class="btn btn-sm" onclick="recordKeybinding('${esc(action)}')">Record</button>
                  ${_userSettings['keybinding_' + action] ? `<button class="btn btn-sm btn-red" onclick="resetKeybinding('${esc(action)}')">Reset</button>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;

    case 'data':
      el.innerHTML = `
        <h3 style="font:600 15px var(--sans);margin-bottom:16px">Export / Import Settings</h3>
        <p style="font:13px var(--sans);color:var(--text2);margin-bottom:16px">Export your settings to a JSON file or import settings from a previous export.</p>
        <div style="display:flex;gap:12px">
          <button class="btn btn-green" onclick="_exportSettings()">Export Settings</button>
          <button class="btn" onclick="_importSettings()">Import Settings</button>
        </div>
        <h4 style="font:600 13px var(--sans);margin:24px 0 10px;color:var(--text2)">Theme</h4>
        <div style="display:flex;gap:8px">
          <button class="btn ${(_userSettings.theme || 'dark') === 'dark' ? 'btn-green' : ''}" onclick="setTheme('dark')">Dark</button>
          <button class="btn ${_userSettings.theme === 'light' ? 'btn-green' : ''}" onclick="setTheme('light')">Light</button>
          <button class="btn ${_userSettings.theme === 'system' ? 'btn-green' : ''}" onclick="setTheme('system')">System</button>
        </div>
      `;
      break;

    case 'security':
      el.innerHTML = `
        <h3 style="font:600 15px var(--sans);margin-bottom:16px">Two-Factor Authentication</h3>
        <div id="totpSection"><p style="color:var(--text3);font:13px var(--sans)">Loading...</p></div>
        <h3 style="font:600 15px var(--sans);margin:24px 0 12px">Active Sessions</h3>
        <div id="activeSessionsList"><p style="color:var(--text3);font:13px var(--sans)">Loading...</p></div>
        <h3 style="font:600 15px var(--sans);margin:24px 0 12px">Login History</h3>
        <div id="loginHistoryList"><p style="color:var(--text3);font:13px var(--sans)">Loading...</p></div>
      `;
      _loadTotpStatus();
      _loadActiveSessions();
      _loadLoginHistory();
      break;

    case 'apikeys':
      el.innerHTML = `
        <h3 style="font:600 15px var(--sans);margin-bottom:16px">API Keys</h3>
        <p style="font:13px var(--sans);color:var(--text2);margin-bottom:12px">Create API keys to access Hyperion programmatically via the X-API-Key header.</p>
        <button class="btn btn-green" onclick="_createApiKey()" style="margin-bottom:16px">Create API Key</button>
        <div id="apiKeysModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:none;align-items:center;justify-content:center"></div>
        <div id="apiKeysList"><p style="color:var(--text3);font:13px var(--sans)">Loading...</p></div>
      `;
      _loadApiKeys();
      break;

    case 'notifprefs':
      el.innerHTML = `
        <h3 style="font:600 15px var(--sans);margin-bottom:16px">Notification Preferences</h3>
        <p style="font:13px var(--sans);color:var(--text2);margin-bottom:16px">Choose which notifications you want to receive.</p>
        <div id="notifPrefsList"><p style="color:var(--text3);font:13px var(--sans)">Loading...</p></div>
      `;
      _loadNotifPrefs();
      break;

    case 'appearance':
      _renderAppearanceTab(el);
      break;

    case 'importexport':
      el.innerHTML = `
        <h3 style="font:600 15px var(--sans);margin-bottom:16px">Import / Export Configuration</h3>
        <p style="font:13px var(--sans);color:var(--text2);margin-bottom:16px">Export your configuration to JSON or import from a previous export. Sensitive fields are automatically redacted.</p>
        <h4 style="font:600 13px var(--sans);margin-bottom:8px;color:var(--text2)">Export</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          <button class="btn btn-green" onclick="_exportConfigJson()">Export All (JSON)</button>
          <button class="btn" onclick="_exportConfigJson(['settings','snippets'])">Export Settings + Snippets</button>
        </div>
        <h4 style="font:600 13px var(--sans);margin:16px 0 8px;color:var(--text2)">Import</h4>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
          <input type="file" id="configImportFile" accept=".json" style="font:13px var(--sans)">
          <select id="configImportMode" style="font:13px var(--mono);padding:6px 10px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px">
            <option value="merge">Merge (skip existing)</option>
            <option value="overwrite">Overwrite</option>
          </select>
          <button class="btn btn-green" onclick="_importConfigJson()">Import</button>
        </div>
        <div id="importResult" style="font:12px var(--sans);color:var(--text2)"></div>
        <h4 style="font:600 13px var(--sans);margin:20px 0 8px;color:var(--text2)">CSV Export</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${['settings','snippets','bookmarks','workflow_profiles','cron_presets'].map(t =>
            `<button class="btn" onclick="_exportCsv('${t}')">${t}</button>`
          ).join('')}
        </div>
      `;
      break;

    case 'roles':
      el.innerHTML = `
        <h3 style="font:600 15px var(--sans);margin-bottom:16px">Role Management (RBAC)</h3>
        <button class="btn btn-green" onclick="_createRole()" style="margin-bottom:16px">Create Role</button>
        <div id="rolesList"><p style="color:var(--text3);font:13px var(--sans)">Loading...</p></div>
      `;
      _loadRoles();
      break;

    case 'users':
      el.innerHTML = `
        <h3 style="font:600 15px var(--sans);margin-bottom:16px">User Management</h3>
        <button class="btn btn-green" onclick="_createUser()" style="margin-bottom:16px">Create User</button>
        <div id="usersList"><p style="color:var(--text3);font:13px var(--sans)">Loading...</p></div>
      `;
      _loadUsers();
      break;
  }
}

function formatKeybinding(b) {
  const parts = [];
  if (b.meta) parts.push(navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl');
  if (b.ctrl) parts.push('Ctrl');
  if (b.shift) parts.push('Shift');
  if (b.alt) parts.push('Alt');
  parts.push(b.key.toUpperCase());
  return parts.join('+');
}

async function changePassword() {
  const msg = document.getElementById('setPassMsg');
  const cur = document.getElementById('setCurPass').value;
  const newP = document.getElementById('setNewPass').value;
  const newP2 = document.getElementById('setNewPass2').value;
  if (newP !== newP2) { msg.style.color = 'var(--red)'; msg.textContent = 'Passwords do not match'; return; }
  try {
    await api('/api/settings/change-password', 'POST', { currentPassword: cur, newPassword: newP });
    msg.style.color = 'var(--green)'; msg.textContent = 'Password updated';
  } catch (e) { msg.style.color = 'var(--red)'; msg.textContent = e.message; }
}

async function saveLlmSettings() {
  const msg = document.getElementById('setLlmMsg');
  const data = { llm_provider: document.getElementById('setLlmProvider').value, llm_model: document.getElementById('setLlmModel').value, llm_base_url: document.getElementById('setLlmUrl').value };
  const keyVal = document.getElementById('setLlmKey').value;
  if (keyVal && !keyVal.startsWith('••')) data.llm_apikey = keyVal;
  try {
    await api('/api/settings', 'PUT', data);
    _userSettings = { ..._userSettings, ...data };
    msg.style.color = 'var(--green)'; msg.textContent = 'Saved';
  } catch (e) { msg.style.color = 'var(--red)'; msg.textContent = e.message; }
}

async function testLlmSettings() {
  const msg = document.getElementById('setLlmMsg');
  msg.style.color = 'var(--text2)'; msg.textContent = 'Testing...';
  try {
    await api('/api/assistant/ask', 'POST', { input: 'echo hello' });
    msg.style.color = 'var(--green)'; msg.textContent = 'Connection OK';
  } catch (e) { msg.style.color = 'var(--red)'; msg.textContent = 'Failed: ' + e.message; }
}

function llmProviderChanged() {
  const provider = document.getElementById('setLlmProvider').value;
  const models = { ollama: 'llama3', openai: 'gpt-4o-mini', gemini: 'gemini-2.0-flash', anthropic: 'claude-sonnet-4-20250514', xai: 'grok-3-mini' };
  document.getElementById('setLlmModel').value = models[provider] || '';
}

async function _loadLlmProviderStatus() {
  const el = document.getElementById('llmProviderStatus');
  if (!el) return;
  try {
    const providers = await api('/api/llm/providers');
    if (!providers?.length) return;
    el.innerHTML = '<h4 style="font:600 13px var(--sans);margin-bottom:10px;color:var(--text2)">Provider Status</h4>' +
      providers.map(p => {
        const dot = p.configured ? (p.health.circuitOpen ? '&#x1F7E1;' : '&#x1F7E2;') : '&#x1F534;';
        const status = p.configured ? (p.health.circuitOpen ? 'Circuit Open' : (p.health.lastSuccess ? `OK (${p.health.latency}ms)` : 'Ready')) : 'Not Configured';
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font:12px var(--sans)">
          <span>${dot}</span>
          <span style="color:var(--text);font-weight:600;min-width:80px">${esc(p.name)}</span>
          <span style="color:var(--text3)">${esc(p.model)}</span>
          <span style="margin-left:auto;color:var(--text2)">${status}</span>
        </div>`;
      }).join('');
  } catch {}
}

// ═══ 2FA / TOTP ═══
async function _loadTotpStatus() {
  const el = document.getElementById('totpSection');
  if (!el) return;
  try {
    const status = await api('/api/auth/totp/status');
    if (status.enabled) {
      el.innerHTML = `
        <div style="padding:12px;background:rgba(16,185,129,0.1);border:1px solid var(--green);border-radius:8px;margin-bottom:16px">
          <span style="color:var(--green);font:600 13px var(--sans)">&#10003; 2FA is enabled</span>
        </div>
        <button class="btn btn-red" onclick="_disable2FA()">Disable 2FA</button>
      `;
    } else {
      el.innerHTML = `
        <p style="font:13px var(--sans);color:var(--text2);margin-bottom:12px">Add an extra layer of security to your account with TOTP-based two-factor authentication.</p>
        <button class="btn btn-green" onclick="_setup2FA()">Enable 2FA</button>
      `;
    }
  } catch { el.innerHTML = '<p style="color:var(--red)">Failed to load 2FA status</p>'; }
}

async function _setup2FA() {
  const el = document.getElementById('totpSection');
  try {
    const data = await api('/api/auth/totp/setup', 'POST');
    el.innerHTML = `
      <p style="font:13px var(--sans);color:var(--text2);margin-bottom:8px">Scan the QR URI below with your authenticator app (Google Authenticator, Authy, etc):</p>
      <div style="padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin-bottom:12px;word-break:break-all;font:12px var(--mono)">${esc(data.qrUri)}</div>
      <p style="font:13px var(--sans);color:var(--text2);margin-bottom:4px">Secret: <code style="background:var(--bg);padding:2px 6px;border-radius:4px">${esc(data.secret)}</code></p>
      <p style="font:13px var(--sans);color:var(--text2);margin:12px 0 4px">Backup codes (save these!):</p>
      <div style="padding:8px 12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;font:12px var(--mono);margin-bottom:16px">${data.backupCodes.join('  ')}</div>
      <div class="form-group"><label>Enter code from your app to verify</label><input id="totpVerifyCode" maxlength="6" placeholder="000000" onkeydown="if(event.key==='Enter')_verify2FA()"></div>
      <button class="btn btn-green" onclick="_verify2FA()">Verify & Enable</button>
      <div id="totpMsg" style="margin-top:8px;font:12px var(--sans)"></div>
    `;
  } catch (e) { el.innerHTML = `<p style="color:var(--red)">${esc(e.message)}</p>`; }
}

async function _verify2FA() {
  const msg = document.getElementById('totpMsg');
  const token = document.getElementById('totpVerifyCode').value.trim();
  try {
    await api('/api/auth/totp/verify', 'POST', { token });
    msg.style.color = 'var(--green)'; msg.textContent = '2FA enabled successfully!';
    setTimeout(() => _loadTotpStatus(), 1500);
  } catch (e) { msg.style.color = 'var(--red)'; msg.textContent = e.message; }
}

async function _disable2FA() {
  const password = prompt('Enter your password to disable 2FA:');
  if (!password) return;
  try {
    await api('/api/auth/totp/disable', 'POST', { password });
    _loadTotpStatus();
  } catch (e) { alert(e.message); }
}

// ═══ API KEYS ═══
async function _loadApiKeys() {
  const el = document.getElementById('apiKeysList');
  if (!el) return;
  try {
    const keys = await api('/api/settings/api-keys');
    if (!keys.length) { el.innerHTML = '<p style="color:var(--text3);font:13px var(--sans)">No API keys yet.</p>'; return; }
    el.innerHTML = `
      <table class="proc-table" style="width:100%">
        <thead><tr><th>Name</th><th>Prefix</th><th>Last Used</th><th>Expires</th><th></th></tr></thead>
        <tbody>${keys.map(k => `
          <tr>
            <td style="font:500 13px var(--sans)">${esc(k.name)}</td>
            <td><code>${esc(k.prefix)}...</code></td>
            <td style="font:12px var(--sans);color:var(--text3)">${k.last_used || 'Never'}</td>
            <td style="font:12px var(--sans);color:var(--text3)">${k.expires_at || 'Never'}</td>
            <td><button class="btn btn-sm btn-red" onclick="_revokeApiKey('${esc(k.id)}')">Revoke</button></td>
          </tr>
        `).join('')}</tbody>
      </table>`;
  } catch { el.innerHTML = '<p style="color:var(--red)">Failed to load API keys</p>'; }
}

async function _createApiKey() {
  const name = prompt('API Key Name:');
  if (!name) return;
  try {
    const result = await api('/api/settings/api-keys', 'POST', { name });
    const modal = document.getElementById('apiKeysModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.innerHTML = `
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:24px;max-width:500px;width:90%">
          <h3 style="font:600 15px var(--sans);margin-bottom:12px">API Key Created</h3>
          <p style="font:13px var(--sans);color:var(--text2);margin-bottom:8px">Copy this key now — it won't be shown again:</p>
          <div style="padding:12px;background:var(--bg);border:1px solid var(--green);border-radius:8px;font:12px var(--mono);word-break:break-all;margin-bottom:16px;user-select:all">${esc(result.key)}</div>
          <button class="btn btn-green" onclick="navigator.clipboard.writeText('${esc(result.key)}');this.textContent='Copied!'" style="margin-right:8px">Copy</button>
          <button class="btn" onclick="document.getElementById('apiKeysModal').style.display='none';_loadApiKeys()">Close</button>
        </div>`;
    }
  } catch (e) { alert(e.message); }
}

async function _revokeApiKey(id) {
  if (!confirm('Revoke this API key?')) return;
  try { await api('/api/settings/api-keys/' + id, 'DELETE'); _loadApiKeys(); } catch (e) { alert(e.message); }
}

// ═══ NOTIFICATION PREFERENCES ═══
const _NOTIF_CATEGORIES = { agent_complete: 'Agent Complete', workflow_complete: 'Workflow Complete', backup_complete: 'Backup Complete', system_alert: 'System Alerts', security_alert: 'Security Alerts' };

async function _loadNotifPrefs() {
  const el = document.getElementById('notifPrefsList');
  if (!el) return;
  try {
    const prefs = await api('/api/settings/notifications');
    el.innerHTML = Object.entries(_NOTIF_CATEGORIES).map(([cat, label]) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font:13px var(--sans)">${label}</span>
        <label class="toggle-switch" style="position:relative;width:40px;height:22px">
          <input type="checkbox" ${prefs[cat] ? 'checked' : ''} onchange="_updateNotifPref('${cat}', this.checked)" style="opacity:0;width:0;height:0">
          <span style="position:absolute;cursor:pointer;inset:0;background:${prefs[cat] ? 'var(--green)' : 'var(--border)'};border-radius:11px;transition:.3s"></span>
        </label>
      </div>
    `).join('');
  } catch { el.innerHTML = '<p style="color:var(--red)">Failed to load preferences</p>'; }
}

async function _updateNotifPref(cat, enabled) {
  try { await api('/api/settings/notifications', 'PUT', { [cat]: enabled }); } catch (e) { alert(e.message); }
}

// ═══ USER MANAGEMENT ═══
async function _loadUsers() {
  const el = document.getElementById('usersList');
  if (!el) return;
  try {
    const users = await api('/api/admin/users');
    el.innerHTML = `
      <table class="proc-table" style="width:100%">
        <thead><tr><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${users.map(u => `
          <tr>
            <td style="font:500 13px var(--sans)">${esc(u.username)}</td>
            <td><span style="font:12px var(--mono);padding:2px 6px;border-radius:4px;background:${u.role === 'admin' ? 'rgba(16,185,129,0.15);color:var(--green)' : 'rgba(255,255,255,0.05);color:var(--text3)'}">${esc(u.role)}</span></td>
            <td style="font:12px var(--sans);color:var(--text3)">${u.created_at || ''}</td>
            <td>
              <button class="btn btn-sm" onclick="_changeUserRole('${esc(u.id)}','${esc(u.role)}')">Role</button>
              <button class="btn btn-sm" onclick="_resetUserPass('${esc(u.id)}')">Reset PW</button>
              <button class="btn btn-sm btn-red" onclick="_deleteUser('${esc(u.id)}')">Delete</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>`;
  } catch { el.innerHTML = '<p style="color:var(--text3);font:13px var(--sans)">Admin access required.</p>'; }
}

async function _createUser() {
  const username = prompt('Username:');
  if (!username) return;
  const password = prompt('Password (min 6 chars):');
  if (!password) return;
  const role = prompt('Role (admin/viewer):', 'viewer');
  try { await api('/api/admin/users', 'POST', { username, password, role }); _loadUsers(); } catch (e) { alert(e.message); }
}

async function _changeUserRole(id, currentRole) {
  const role = prompt('New role (admin/viewer):', currentRole === 'admin' ? 'viewer' : 'admin');
  if (!role) return;
  try { await api('/api/admin/users/' + id + '/role', 'PUT', { role }); _loadUsers(); } catch (e) { alert(e.message); }
}

async function _resetUserPass(id) {
  const pw = prompt('New password (min 6 chars):');
  if (!pw) return;
  try { await api('/api/admin/users/' + id + '/reset-password', 'POST', { newPassword: pw }); alert('Password reset'); } catch (e) { alert(e.message); }
}

async function _deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  try { await api('/api/admin/users/' + id, 'DELETE'); _loadUsers(); } catch (e) { alert(e.message); }
}

async function setTheme(theme) {
  if (window._systemThemeListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', window._systemThemeListener);
    window._systemThemeListener = null;
  }
  if (theme === 'system') {
    _applySystemTheme();
    window._systemThemeListener = () => _applySystemTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', window._systemThemeListener);
  } else if (theme === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }
  await api('/api/settings', 'PUT', { theme });
  _userSettings.theme = theme;
  renderSettingsTab();
}

function _applySystemTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('theme-light', !prefersDark);
}

async function saveTermSettings() {
  const data = {
    term_shell: document.getElementById('setTermShell').value,
    term_font_size: parseInt(document.getElementById('setTermFont').value),
    terminalTheme: document.getElementById('setTermTheme').value,
  };
  await api('/api/settings', 'PUT', data);
  Object.assign(_userSettings, data);
  applyTermTheme(data.terminalTheme);
  showToast('Terminal settings saved');
}

function recordKeybinding(action) {
  const el = document.getElementById(`kb-${action}`);
  if (!el) return;
  el.textContent = 'Press keys...';
  el.style.color = 'var(--amber)';

  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') { document.removeEventListener('keydown', handler, true); renderSettingsTab(); return; }
    if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return;

    const binding = { key: e.key, meta: e.metaKey || e.ctrlKey, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey, desc: DEFAULT_KEYBINDINGS[action]?.desc || action };
    document.removeEventListener('keydown', handler, true);

    api('/api/settings', 'PUT', { [`keybinding_${action}`]: binding }).then(() => {
      _userSettings[`keybinding_${action}`] = binding;
      renderSettingsTab();
      showToast(`Keybinding updated for ${action}`);
    });
  };
  document.addEventListener('keydown', handler, true);
}

async function resetKeybinding(action) {
  await api(`/api/settings/keybinding_${action}`, 'DELETE');
  delete _userSettings[`keybinding_${action}`];
  renderSettingsTab();
  showToast(`Keybinding reset for ${action}`);
}

// ═══ SIDEBAR COLLAPSE ═══
function toggleSidebar() {
  _sidebarCollapsed = !_sidebarCollapsed;
  document.getElementById('sidebar')?.classList.toggle('collapsed', _sidebarCollapsed);
  api('/api/settings', 'PUT', { sidebarCollapsed: _sidebarCollapsed }).catch(() => {});
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  const isOpen = sidebar?.classList.toggle('mobile-open');
  if (overlay) {
    if (isOpen) {
      overlay.style.display = 'block';
      requestAnimationFrame(() => overlay.classList.add('visible'));
    } else {
      overlay.classList.remove('visible');
      setTimeout(() => { overlay.style.display = 'none'; }, 200);
    }
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  if (sidebar?.classList.contains('mobile-open')) {
    sidebar.classList.remove('mobile-open');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => { overlay.style.display = 'none'; }, 200);
    }
  }
}

// ═══ DASHBOARD ═══
async function loadDashboard() {
  const main = document.getElementById('main');
  const [recent, agents, stats, activity] = await Promise.all([
    api('/api/assistant/recent').catch(() => []),
    api('/api/agents').catch(() => []),
    api('/api/dashboard/stats').catch(() => ({})),
    api('/api/dashboard/activity').catch(() => ({ items: [] })),
  ]);

  const runningAgents = (agents || []).filter(a => a.status === 'running');
  const totalAgents = (agents || []).length;
  const lastSys = _sysHistory.length ? _sysHistory[_sysHistory.length - 1] : null;
  const uptime = lastSys ? _fmtUptime(lastSys.uptime) : '--';
  const activityItems = (activity.items || []).slice(0, 10);
  const activityIcons = { command: '>', agent_log: 'A', notebook: 'N', clipboard: '📋', bookmark: '🔖', pomodoro: '🍅' };

  // Quick launch tracking
  const qlVisits = JSON.parse(localStorage.getItem('hyperion_ql') || '{}');
  const topPages = Object.entries(qlVisits).sort((a,b) => b[1] - a[1]).slice(0, 8);

  const cpuPct = lastSys ? lastSys.cpuPercent : 0;
  const memPct = lastSys ? lastSys.memPercent : 0;

  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <span class="page-title">Dashboard</span>
        <span style="margin-left:auto;font:400 13px var(--sans);color:var(--text3)">Welcome back</span>
      </div>
      <div class="page-pad">

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;transition:border-color 0.2s">
            <div style="font:500 10px var(--sans);text-transform:uppercase;letter-spacing:1.2px;color:var(--text3);margin-bottom:10px">Snippets</div>
            <div style="font:700 28px var(--mono);color:var(--cyan)">${stats.snippets || 0}</div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;transition:border-color 0.2s">
            <div style="font:500 10px var(--sans);text-transform:uppercase;letter-spacing:1.2px;color:var(--text3);margin-bottom:10px">Agents</div>
            <div style="display:flex;align-items:baseline;gap:6px">
              <span style="font:700 28px var(--mono);color:var(--green)">${runningAgents.length}</span>
              <span style="font:400 14px var(--sans);color:var(--text3)">/ ${totalAgents}</span>
            </div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;transition:border-color 0.2s">
            <div style="font:500 10px var(--sans);text-transform:uppercase;letter-spacing:1.2px;color:var(--text3);margin-bottom:10px">Notebooks</div>
            <div style="font:700 28px var(--mono);color:var(--purple)">${stats.notebooks || 0}</div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;transition:border-color 0.2s">
            <div style="font:500 10px var(--sans);text-transform:uppercase;letter-spacing:1.2px;color:var(--text3);margin-bottom:10px">Notes</div>
            <div style="font:700 28px var(--mono);color:var(--amber)">${stats.notes || 0}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px">
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="font:500 10px var(--sans);text-transform:uppercase;letter-spacing:1.2px;color:var(--text3)">CPU</span>
              <span style="font:600 13px var(--mono);color:var(--cyan)">${lastSys ? cpuPct + '%' : '--'}</span>
            </div>
            <div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden"><div style="height:100%;width:${cpuPct}%;background:var(--cyan);border-radius:3px;transition:width 0.4s ease"></div></div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="font:500 10px var(--sans);text-transform:uppercase;letter-spacing:1.2px;color:var(--text3)">Memory</span>
              <span style="font:600 13px var(--mono);color:var(--green)">${lastSys ? memPct + '%' : '--'}</span>
            </div>
            <div style="height:6px;background:var(--bg4);border-radius:3px;overflow:hidden"><div style="height:100%;width:${memPct}%;background:var(--green);border-radius:3px;transition:width 0.4s ease"></div></div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px">
            <div style="font:500 10px var(--sans);text-transform:uppercase;letter-spacing:1.2px;color:var(--text3);margin-bottom:12px">Uptime</div>
            <div style="font:600 16px var(--mono);color:var(--text)">${uptime}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px;margin-bottom:24px">
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;overflow:hidden">
            <div style="padding:14px 18px;font:600 10px var(--sans);text-transform:uppercase;letter-spacing:1.2px;color:var(--text3);border-bottom:1px solid var(--border)">Activity Feed</div>
            <div style="padding:6px 10px;max-height:240px;overflow-y:auto">
              ${activityItems.length ? activityItems.map(a => `<div style="display:flex;gap:10px;align-items:center;padding:9px 8px;border-bottom:1px solid var(--border);font:13px var(--sans);color:var(--text2);transition:color 0.1s;cursor:pointer" onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text2)'"><span style="color:var(--text3);width:18px;text-align:center;flex-shrink:0;font:12px var(--mono)">${activityIcons[a.type] || '·'}</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.title?.slice(0,80) || '')}</span><span style="color:var(--text3);font:10px var(--mono);white-space:nowrap;flex-shrink:0">${_timeAgo(a.timestamp)}</span></div>`).join('') : '<div style="color:var(--text3);font:13px var(--sans);padding:16px 8px">No recent activity</div>'}
            </div>
          </div>
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;overflow:hidden">
            <div style="padding:14px 18px;font:600 10px var(--sans);text-transform:uppercase;letter-spacing:1.2px;color:var(--text3);border-bottom:1px solid var(--border)">Quick Launch</div>
            <div style="padding:14px 18px">
              ${topPages.length ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${topPages.map(([pg,cnt]) => `<button class="btn" style="font:12px var(--sans);justify-content:flex-start;width:100%" onclick="go('${esc(pg)}')">${esc(pg)} <span style="color:var(--text3);margin-left:auto;font:11px var(--mono)">${cnt}</span></button>`).join('')}</div>` : '<div style="color:var(--text3);font:13px var(--sans)">Visit pages to build your quick launch</div>'}
            </div>
          </div>
        </div>

        <div style="margin-top:4px">
          <div style="font:600 10px var(--sans);text-transform:uppercase;letter-spacing:1.2px;color:var(--text3);margin-bottom:12px">Quick Actions</div>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            <button class="btn" onclick="go('terminal');setTimeout(addTerminal,100)">New Terminal</button>
            <button class="btn" onclick="go('files');setTimeout(uploadFile,200)">Upload File</button>
            <button class="btn" onclick="go('notebooks');setTimeout(createNotebook,200)">New Notebook</button>
            <button class="btn" onclick="go('agents');setTimeout(createAgentModal,200)">New Agent</button>
            <button class="btn" onclick="go('workflows');setTimeout(createWorkflowModal,200)">New Workflow</button>
            <button class="btn" onclick="go('settings')">Settings</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Track page visit for quick launch
  _trackPageVisit('dashboard');
}

function _fmtUptime(secs) {
  const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function _timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

function _trackPageVisit(pg) {
  try {
    const visits = JSON.parse(localStorage.getItem('hyperion_ql') || '{}');
    visits[pg] = (visits[pg] || 0) + 1;
    localStorage.setItem('hyperion_ql', JSON.stringify(visits));
  } catch {}
}

// ═══ SEARCH EVERYWHERE ═══
let _searchDebounce = null;
let _searchResults = [];

function openSearchEverywhere() {
  _searchOpen = true;
  _searchIdx = 0;
  _searchResults = [];

  const overlay = document.createElement('div');
  overlay.id = 'searchOverlay';
  overlay.className = 'search-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closeSearchEverywhere(); };
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Search Everywhere');
  overlay.innerHTML = `
    <div class="search-box">
      <input class="search-input" id="searchInput" placeholder="Search everywhere..." autofocus aria-label="Search">
      <div class="search-results" id="searchResults">
        <div style="padding:20px;text-align:center;color:var(--text3);font:12px var(--sans)">Type to search across files, commands, notebooks, agents...</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(_searchDebounce);
    _searchDebounce = setTimeout(() => performSearch(e.target.value), 200);
  });
}

async function performSearch(query) {
  if (!query || query.length < 2) {
    document.getElementById('searchResults').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);font:12px var(--sans)">Type at least 2 characters...</div>';
    _searchResults = [];
    return;
  }

  try {
    // Try FTS first, then fall back to LIKE
    let ftsResults = [];
    try {
      const ftsData = await api(`/api/search/fts?q=${encodeURIComponent(query)}`);
      ftsResults = ftsData.results || [];
    } catch {}

    const { results } = await api(`/api/search?q=${encodeURIComponent(query)}`);
    _searchResults = [];
    let html = '';

    // Show FTS results first if any
    if (ftsResults.length) {
      const typeMap = { note: 'notes', snippet: 'code', bookmark: 'bookmarks', clipboard: 'clipboard' };
      html += '<div class="search-section">Full-Text Matches</div>';
      ftsResults.forEach(item => {
        const active = _searchResults.length === _searchIdx ? ' active' : '';
        const icon = { note: 'N', snippet: '#', bookmark: 'B', clipboard: 'C' }[item.type] || '?';
        const target = typeMap[item.type] || 'notes';
        _searchResults.push({ ...item, _action: () => go(target), _item: item });
        html += `<div class="search-item${active}" data-sidx="${_searchResults.length - 1}" onclick="executeSearchAt(${_searchResults.length - 1})" onmouseenter="_searchIdx=${_searchResults.length - 1};highlightSearchItem()">
          <span class="search-icon">${icon}</span>
          <span class="search-label">${item.title || item.type}</span>
          <span class="search-desc">${item.snippet || ''}</span>
        </div>`;
      });
    }

    const groupMap = {
      commands: { label: 'Commands', icon: '>', action: (r) => { go('assistant'); setTimeout(() => assistantRun(r.command), 100); } },
      snippets: { label: 'Snippets', icon: '#', action: (r) => { go('code'); } },
      notebooks: { label: 'Notebooks', icon: 'N', action: (r) => { go('notebooks'); setTimeout(() => openNotebook(r.id), 100); } },
      agents: { label: 'Agents', icon: 'A', action: (r) => go('agents') },
      workflows: { label: 'Workflows', icon: 'W', action: (r) => go('workflows') },
      notifications: { label: 'Notifications', icon: '!', action: () => toggleNotifPanel() },
    };

    for (const [group, items] of Object.entries(results)) {
      const g = groupMap[group];
      if (!g || !items.length) continue;
      html += `<div class="search-section">${esc(g.label)}</div>`;
      items.forEach(item => {
        const active = _searchResults.length === _searchIdx ? ' active' : '';
        const label = item.name || item.command || item.title || '';
        const desc = item.description || item.language || item.message || '';
        _searchResults.push({ ...item, _action: g.action, _item: item });
        html += `<div class="search-item${active}" data-sidx="${_searchResults.length - 1}" onclick="executeSearchAt(${_searchResults.length - 1})" onmouseenter="_searchIdx=${_searchResults.length - 1};highlightSearchItem()">
          <span class="search-icon">${g.icon}</span>
          <span class="search-label">${esc(label)}</span>
          <span class="search-desc">${esc(desc)}</span>
        </div>`;
      });
    }

    if (!html) html = '<div style="padding:20px;text-align:center;color:var(--text3);font:12px var(--sans)">No results</div>';
    document.getElementById('searchResults').innerHTML = html;
  } catch {}
}

function moveSearchIdx(delta) {
  if (!_searchResults.length) return;
  _searchIdx = (_searchIdx + delta + _searchResults.length) % _searchResults.length;
  highlightSearchItem();
}

function highlightSearchItem() {
  document.querySelectorAll('.search-item').forEach((el, i) => el.classList.toggle('active', i === _searchIdx));
  document.querySelector('.search-item.active')?.scrollIntoView({ block: 'nearest' });
}

function executeSearchItem() {
  executeSearchAt(_searchIdx);
}

function executeSearchAt(idx) {
  const item = _searchResults[idx];
  if (!item) return;
  closeSearchEverywhere();
  item._action(item._item);
}

function closeSearchEverywhere() {
  _searchOpen = false;
  document.getElementById('searchOverlay')?.remove();
}

// ═══ SSH TERMINALS ═══
async function openSSHConnectModal() {
  let saved = [];
  try { saved = await api('/api/ssh'); } catch {}

  showModal('SSH Connect', `
    <div style="margin-bottom:12px">
      ${saved.length ? `
        <div style="font:600 11px var(--sans);text-transform:uppercase;color:var(--text3);margin-bottom:6px">Saved Connections</div>
        ${saved.map(s => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="flex:1;font:13px var(--sans);cursor:pointer" onclick="connectSSH('${esc(s.host)}','${esc(s.username)}',${s.port},'${esc(s.auth_type)}','${esc(s.key_path || '')}');closeModal()">${esc(s.name)} <span style="color:var(--text3)">${esc(s.username)}@${esc(s.host)}</span></span>
            <button class="btn btn-red btn-sm" onclick="deleteSSH('${esc(s.id)}')">Del</button>
          </div>
        `).join('')}
      ` : ''}
    </div>
    <div style="font:600 11px var(--sans);text-transform:uppercase;color:var(--text3);margin-bottom:6px">New Connection</div>
    <div class="form-group"><label>Name</label><input id="sshName" placeholder="My Server"></div>
    <div class="form-group"><label>Host</label><input id="sshHost" placeholder="192.168.1.1"></div>
    <div class="form-group"><label>Port</label><input id="sshPort" value="22" type="number"></div>
    <div class="form-group"><label>Username</label><input id="sshUser" placeholder="root"></div>
    <div class="form-group"><label>Auth Type</label>
      <select id="sshAuth" onchange="document.getElementById('sshKeyRow').style.display=this.value==='key'?'':'none'">
        <option value="password">Password</option>
        <option value="key">SSH Key</option>
      </select>
    </div>
    <div class="form-group" id="sshKeyRow" style="display:none"><label>Key Path</label><input id="sshKeyPath" placeholder="~/.ssh/id_rsa"></div>
  `, async () => {
    const data = {
      name: document.getElementById('sshName').value || document.getElementById('sshHost').value,
      host: document.getElementById('sshHost').value,
      port: parseInt(document.getElementById('sshPort').value) || 22,
      username: document.getElementById('sshUser').value,
      auth_type: document.getElementById('sshAuth').value,
      key_path: document.getElementById('sshKeyPath').value || undefined,
    };
    if (!data.host || !data.username) return showToast('Host and username required');
    // Save connection
    await api('/api/ssh', 'POST', data);
    closeModal();
    connectSSH(data.host, data.username, data.port, data.auth_type, data.key_path || '');
  });
}

function connectSSH(host, user, port, authType, keyPath) {
  const idx = terminals.length;
  const container = document.createElement('div');
  container.className = 'terminal-wrap';
  container.style.display = 'none';

  const theme = TERM_THEMES[_termTheme] || TERM_THEMES.hyperion;
  const term = new Terminal({ cursorBlink: true, fontSize: 13, fontFamily: "'JetBrains Mono', 'Menlo', monospace", theme });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon.WebLinksAddon());

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  let wsUrl = `${proto}://${location.host}/ws/terminal?ssh=true&host=${encodeURIComponent(host)}&user=${encodeURIComponent(user)}&port=${port}&cols=${term.cols}&rows=${term.rows}&sid=${encodeURIComponent(_sessionId)}`;
  if (authType === 'key' && keyPath) wsUrl += `&keyPath=${encodeURIComponent(keyPath)}`;

  const ws = new WebSocket(wsUrl);
  ws.onopen = () => {
    term.onData(data => ws.send(JSON.stringify({ type: 'input', data })));
    term.onResize(({ cols, rows }) => ws.send(JSON.stringify({ type: 'resize', cols, rows })));
  };
  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'output') term.write(msg.data);
      else if (msg.type === 'exit') term.write(`\r\n[SSH session ended]\r\n`);
    } catch {}
  };

  terminals.push({ term, fit, ws, container, ssh: true, sshLabel: `${user}@${host}` });
  activeTermIdx = idx;
  if (page === 'terminal') {
    renderTermTabs();
    const containers = document.getElementById('termContainers');
    if (containers) { containers.appendChild(container); container.style.display = ''; term.open(container); setTimeout(() => fit.fit(), 50); }
  } else {
    go('terminal');
  }
}

async function deleteSSH(id) {
  await api(`/api/ssh/${id}`, 'DELETE');
  showToast('Connection deleted');
  openSSHConnectModal(); // Refresh
}

// ═══ PLUGIN MARKETPLACE PAGE ═══
async function loadPluginsPage() {
  const main = document.getElementById('main');
  const plugins = await api('/api/plugins').catch(() => []);

  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <span class="page-title">Plugins</span>
        <button class="btn btn-green" onclick="createPluginWizard()">+ Create Plugin</button>
        <button class="btn" onclick="reloadPlugins()">Reload All</button>
      </div>
      <div class="page-pad">
        ${(plugins || []).length ? `<div class="plugin-grid">
          ${plugins.map(p => `
            <div class="plugin-card">
              <div style="display:flex;justify-content:space-between;align-items:start">
                <div>
                  <strong style="font:600 14px var(--sans)">${esc(p.name)}</strong>
                  <span style="font:11px var(--mono);color:var(--text3);margin-left:6px">v${esc(p.version || '1.0')}</span>
                </div>
              </div>
              ${p.description ? `<div style="font:12px var(--sans);color:var(--text2);margin-top:4px">${esc(p.description)}</div>` : ''}
              <div style="display:flex;gap:8px;margin-top:8px;font:11px var(--mono);color:var(--text3)">
                <span>${p.patterns || 0} patterns</span>
                <span>${p.quickActions || 0} actions</span>
                <span>${p.novaKeywords || 0} keywords</span>
              </div>
              <div style="display:flex;gap:4px;margin-top:8px">
                <button class="btn btn-sm" onclick="viewPluginReadme('${esc(p.id)}')">Readme</button>
                <button class="btn btn-red btn-sm" onclick="deletePlugin('${esc(p.id)}')">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>` : '<div style="color:var(--text3);padding:40px;text-align:center">No plugins installed. Create one or place a plugin in ~/.hyperion/plugins/</div>'}
      </div>
    </div>
  `;
}

async function reloadPlugins() {
  const res = await api('/api/plugins/reload', 'POST');
  showToast(`Reloaded ${res.loaded} plugin(s)`);
  loadPluginsPage();
}

async function deletePlugin(id) {
  const confirmed = await showConfirmModal(`Delete plugin "${id}"?`);
  if (!confirmed) return;
  await api(`/api/plugins/${id}`, 'DELETE');
  showToast('Plugin deleted');
  loadPluginsPage();
}

async function viewPluginReadme(id) {
  const { readme } = await api(`/api/plugins/${id}/readme`);
  showModal(`Plugin: ${id}`, `<pre style="font:12px/1.5 var(--mono);color:var(--text2);white-space:pre-wrap">${esc(readme)}</pre>`);
}

function createPluginWizard() {
  showModal('Create Plugin', `
    <div class="form-group"><label>Plugin Name</label><input id="plgName" placeholder="my-plugin"></div>
    <div class="form-group"><label>Description</label><input id="plgDesc" placeholder="What does this plugin do?"></div>
    <div class="form-group"><label>Capabilities</label>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font:12px var(--sans);color:var(--text2)"><input type="checkbox" id="plgPatterns" checked> Command Patterns</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font:12px var(--sans);color:var(--text2)"><input type="checkbox" id="plgActions"> Quick Actions</label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font:12px var(--sans);color:var(--text2)"><input type="checkbox" id="plgNova"> NOVA Keywords</label>
      </div>
    </div>
  `, async () => {
    const capabilities = [];
    if (document.getElementById('plgPatterns').checked) capabilities.push('patterns');
    if (document.getElementById('plgActions').checked) capabilities.push('actions');
    if (document.getElementById('plgNova').checked) capabilities.push('nova');
    await api('/api/plugins/create', 'POST', {
      name: document.getElementById('plgName').value,
      description: document.getElementById('plgDesc').value,
      capabilities,
    });
    closeModal();
    await api('/api/plugins/reload', 'POST');
    loadPluginsPage();
    showToast('Plugin created');
  });
}

// ═══ COLLABORATIVE NOTEBOOKS ═══
// Enhance openNotebook to establish WS collab
const _origOpenNotebook = openNotebook;
openNotebook = async function(id) {
  // Close any existing notebook WS
  if (_notebookWs) { try { _notebookWs.close(); } catch {} _notebookWs = null; }
  _notebookLiveCount = 0;

  const nb = await api(`/api/notebooks/${id}`);
  currentNotebook = nb;
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <button class="btn btn-sm" onclick="closeNotebookWs();loadNotebooks()">&larr; Back</button>
        <span class="page-title">${esc(nb.name)}</span>
        <span style="font:11px var(--mono);color:var(--text3)">${esc(nb.language)}</span>
        <span class="nb-live-badge" id="nbLiveBadge" style="display:none">LIVE <span id="nbLiveCount">0</span></span>
        <div style="margin-left:auto;display:flex;gap:4px">
          <button class="btn btn-green" onclick="runAllCells()">&#9654; Run All</button>
          <button class="btn" onclick="addCell()">+ Cell</button>
          <button class="btn" onclick="saveNotebook()">Save</button>
        </div>
      </div>
      <div class="page-pad" id="nbCells">
        ${nb.cells.map((cell, i) => renderCell(cell, i)).join('')}
      </div>
    </div>
  `;

  // Establish WebSocket for collaboration
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  _notebookWs = new WebSocket(`${proto}://${location.host}/ws/notebook/${id}?sid=${encodeURIComponent(_sessionId)}`);

  _notebookWs.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'presence') {
        _notebookLiveCount = msg.count;
        const badge = document.getElementById('nbLiveBadge');
        const countEl = document.getElementById('nbLiveCount');
        if (badge) badge.style.display = msg.count > 0 ? '' : 'none';
        if (countEl) countEl.textContent = msg.count;
      } else if (msg.type === 'cell_edit') {
        // Remote edit — update cell if not currently focused
        const input = document.getElementById(`input-${msg.cellId}`);
        if (input && document.activeElement !== input) {
          input.value = msg.content;
          // Show remote editing indicator
          const cellEl = document.getElementById(`cell-${msg.cellId}`);
          if (cellEl) { cellEl.classList.add('nb-remote-editing'); setTimeout(() => cellEl.classList.remove('nb-remote-editing'), 1500); }
        }
      } else if (msg.type === 'cursor') {
        const cellEl = document.getElementById(`cell-${msg.cellId}`);
        if (cellEl) { cellEl.classList.add('nb-remote-editing'); setTimeout(() => cellEl.classList.remove('nb-remote-editing'), 2000); }
      }
    } catch {}
  };

  // Debounced cell edit broadcasting
  document.getElementById('nbCells')?.addEventListener('input', (e) => {
    if (!e.target.classList.contains('nb-cell-input') || !_notebookWs || _notebookWs.readyState !== 1) return;
    const cellId = e.target.id.replace('input-', '');
    clearTimeout(e.target._broadcastTimer);
    e.target._broadcastTimer = setTimeout(() => {
      _notebookWs.send(JSON.stringify({ type: 'cell_edit', cellId, content: e.target.value }));
    }, 300);
  });

  // Send cursor position on focus
  document.getElementById('nbCells')?.addEventListener('focusin', (e) => {
    if (!e.target.classList.contains('nb-cell-input') || !_notebookWs || _notebookWs.readyState !== 1) return;
    const cellId = e.target.id.replace('input-', '');
    _notebookWs.send(JSON.stringify({ type: 'cursor', cellId }));
  });
};

function closeNotebookWs() {
  if (_notebookWs) { try { _notebookWs.close(); } catch {} _notebookWs = null; }
  _notebookLiveCount = 0;
}

// ═══ KEYBOARD ACCESSIBILITY ═══
function trapFocus(el) {
  const focusable = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];

  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

// Enhance showModal with focus trap and ARIA
const _origShowModal = showModal;
showModal = function(title, bodyHtml, onSave) {
  _origShowModal(title, bodyHtml, onSave);
  const modal = document.getElementById('hyperionModal');
  if (modal) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title);
    trapFocus(modal);
    // Focus first input or button
    setTimeout(() => {
      const first = modal.querySelector('input:not([disabled]), select, textarea, button');
      if (first) first.focus();
    }, 50);
  }
};

// Enhance showToast with aria-live
const _origShowToast = showToast;
showToast = function(msg) {
  const t = document.createElement('div');
  t.setAttribute('role', 'alert');
  t.setAttribute('aria-live', 'polite');
  t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--bg4);border:1px solid var(--green);color:var(--green);padding:8px 16px;border-radius:6px;font:12px var(--sans);z-index:200;animation:fadeIn .2s';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
};

// ═══ MOBILE: Bottom Nav + Swipe Gestures ═══
function renderBottomNav() {
  if (window.innerWidth > 480) { document.getElementById('mobileBottomNav')?.remove(); return; }
  let nav = document.getElementById('mobileBottomNav');
  if (!nav) {
    nav = document.createElement('div');
    nav.id = 'mobileBottomNav';
    nav.className = 'mobile-bottom-nav';
    document.body.appendChild(nav);
  }
  const items = [
    { page: 'dashboard', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>', label: 'Home' },
    { page: 'terminal', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4,17 10,11 4,5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>', label: 'Term' },
    { page: 'files', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>', label: 'Files' },
    { page: 'assistant', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>', label: 'AI' },
    { page: 'more', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>', label: 'More' },
  ];
  nav.innerHTML = items.map(i => `
    <button class="mobile-nav-btn ${page === i.page ? 'active' : ''}" onclick="${i.page === 'more' ? 'toggleMobileMore()' : `go('${i.page}')`}" aria-label="${i.label}">
      ${i.icon}<span>${i.label}</span>
    </button>
  `).join('');
}

let _mobileMoreOpen = false;
function toggleMobileMore() {
  _mobileMoreOpen = !_mobileMoreOpen;
  let popup = document.getElementById('mobileMorePopup');
  if (_mobileMoreOpen) {
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'mobileMorePopup';
      popup.className = 'mobile-more-popup';
      document.body.appendChild(popup);
    }
    const pages = ['nova', 'code', 'notebooks', 'agents', 'workflows', 'plugins', 'system', 'settings'];
    popup.innerHTML = pages.map(p => `<button class="mobile-more-item" onclick="go('${p}');toggleMobileMore()">${p.charAt(0).toUpperCase() + p.slice(1)}</button>`).join('');
    setTimeout(() => document.addEventListener('click', closeMobileMore, { once: true }), 10);
  } else {
    popup?.remove();
  }
}

function closeMobileMore() { _mobileMoreOpen = false; document.getElementById('mobileMorePopup')?.remove(); }

function initSwipeGestures() {
  let touchStartX = 0;
  let touchStartY = 0;
  document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dy) > Math.abs(dx)) return; // Vertical swipe
    if (Math.abs(dx) < 60) return; // Too short

    if (dx > 0 && touchStartX < 30) {
      // Swipe right from edge — open sidebar
      const sidebar = document.getElementById('sidebar');
      if (sidebar) { sidebar.classList.remove('collapsed'); _sidebarCollapsed = false; }
    } else if (dx < 0 && _notifPanelOpen) {
      // Swipe left — close notif panel
      closeNotifPanel();
    }
  }, { passive: true });
}

// ═══ WAVE 4: SKILLS PAGE ═══
async function loadSkillsPage() {
  const main = document.getElementById('main');
  const skills = await api('/api/assistant/actions').catch(() => []);
  let skillList = [];
  try {
    const res = await fetch('/api/llm/prompts', { headers: { 'X-Session-Id': _sessionId } });
    skillList = await res.json().catch(() => ({}));
  } catch {}

  // Fetch actual skills from backend
  let actualSkills = [];
  try {
    // Skills are loaded from ~/.hyperion/skills/ directory
    actualSkills = skills; // placeholder
  } catch {}

  main.innerHTML = `
    <div style="padding:24px;max-width:900px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h2 style="margin:0;color:var(--text)">Skills</h2>
        <button class="btn-green" onclick="showCreateSkillModal()">+ New Skill</button>
      </div>
      <p style="color:var(--text2);margin-bottom:20px">Skills are prompt-injected instructions triggered by keywords. Stored in <code>~/.hyperion/skills/</code></p>
      <div id="skillsList" style="display:grid;gap:12px"></div>
      <h3 style="margin-top:32px;color:var(--text)">System Prompts</h3>
      <p style="color:var(--text2);margin-bottom:12px">BOOT.md, SOUL.md, AGENTS.md — injected into every LLM call</p>
      <div style="display:grid;gap:12px">
        ${['boot', 'soul', 'agents'].map(name => `
          <div class="card" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <strong style="color:var(--green)">${name.toUpperCase()}.md</strong>
              <button class="btn-sm" onclick="savePromptFile('${name}')">Save</button>
            </div>
            <textarea id="prompt_${name}" style="width:100%;height:120px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:8px;font:13px var(--mono);resize:vertical">${esc(skillList[name] || '')}</textarea>
          </div>
        `).join('')}
      </div>
    </div>`;
  loadSkillCards();
}

async function loadSkillCards() {
  const container = document.getElementById('skillsList');
  if (!container) return;
  try {
    // Read skills from settings/plugins endpoint
    const res = await fetch('/api/plugins', { headers: { 'X-Session-Id': _sessionId } });
    const data = await res.json();
    const skills = data.skills || [];
    if (!skills.length) {
      container.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center">No skills installed. Create one or add a SKILL.md to ~/.hyperion/skills/</div>';
      return;
    }
    container.innerHTML = skills.map(s => `
      <div class="card skill-card" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
        <div style="display:flex;justify-content:space-between"><strong style="color:var(--text)">${esc(s.name)}</strong><span style="color:var(--text3)">${(s.triggers || []).join(', ')}</span></div>
        <p style="color:var(--text2);margin:4px 0">${esc(s.description || '')}</p>
      </div>
    `).join('');
  } catch {
    container.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center">No skills found</div>';
  }
}

function showCreateSkillModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="max-width:600px">
      <h3 style="margin-bottom:16px;color:var(--text)">Create Skill</h3>
      <div class="form-group"><label>Name (slug)</label><input id="skillName" placeholder="git-helper" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px"></div>
      <div class="form-group"><label>Triggers (comma-separated)</label><input id="skillTriggers" placeholder="commit, push, branch, merge, git" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px"></div>
      <div class="form-group"><label>Description</label><input id="skillDesc" placeholder="Helps with git operations" style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px"></div>
      <div class="form-group"><label>Instructions</label><textarea id="skillBody" rows="8" placeholder="When the user asks about git..." style="width:100%;padding:8px;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;font:13px var(--mono)"></textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn-sm" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="btn-green" onclick="createSkill()">Create</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

async function createSkill() {
  const name = document.getElementById('skillName').value.trim();
  const triggers = document.getElementById('skillTriggers').value;
  const desc = document.getElementById('skillDesc').value;
  const body = document.getElementById('skillBody').value;
  if (!name) return;

  const content = `---\nname: ${name}\ntriggers: [${triggers.split(',').map(t => `"${t.trim()}"`).join(', ')}]\ndescription: ${desc}\n---\n${body}`;

  try {
    await api('/api/plugins/skill', 'POST', { id: name, content });
    document.querySelector('.modal-overlay')?.remove();
    showToast('Skill created');
    loadSkillsPage();
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

async function savePromptFile(name) {
  const content = document.getElementById('prompt_' + name).value;
  await api('/api/llm/prompts', 'PUT', { name, content });
  showToast(`${name.toUpperCase()}.md saved`);
}

// ═══ WAVE 4: CANVAS PAGE ═══
let _canvasDragging = null;
let _canvasOffset = { x: 0, y: 0 };

async function loadCanvasPage() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div style="padding:16px;display:flex;gap:8px;border-bottom:1px solid var(--border);align-items:center">
      <h3 style="margin:0;color:var(--text)">Canvas</h3>
      <button class="btn-sm" onclick="addCanvasItem('note')">+ Note</button>
      <button class="btn-sm" onclick="addCanvasItem('code')">+ Code</button>
      <button class="btn-sm" onclick="addCanvasItem('terminal')">+ Terminal</button>
      <button class="btn-sm" onclick="browseForCanvas()">+ Browse</button>
    </div>
    <div id="canvasWorkspace" class="canvas-workspace" oncontextmenu="return false"></div>`;
  await renderCanvasItems();
}

async function renderCanvasItems() {
  const workspace = document.getElementById('canvasWorkspace');
  if (!workspace) return;
  let items;
  try { items = await api('/api/canvas'); } catch { items = []; }
  workspace.innerHTML = '';

  for (const item of items) {
    const el = document.createElement('div');
    el.className = `canvas-item canvas-item-${item.type}`;
    el.dataset.id = item.id;
    el.style.cssText = `left:${item.x}px;top:${item.y}px;width:${item.width}px;height:${item.height}px;`;

    let content = '';
    switch (item.type) {
      case 'note':
        content = `<div class="canvas-item-header"><span>Note</span><button onclick="deleteCanvasItem('${item.id}')">&times;</button></div><div class="canvas-item-body" contenteditable="true" onblur="updateCanvasContent('${item.id}', this.innerText)">${esc(item.content || 'New note...')}</div>`;
        break;
      case 'code':
        content = `<div class="canvas-item-header"><span>Code</span><button onclick="deleteCanvasItem('${item.id}')">&times;</button></div><pre class="canvas-item-body" style="font:12px var(--mono);overflow:auto">${esc(item.content || '// code here')}</pre>`;
        break;
      case 'terminal':
        content = `<div class="canvas-item-header"><span>Terminal</span><button onclick="deleteCanvasItem('${item.id}')">&times;</button></div><pre class="canvas-item-body" style="font:12px var(--mono);color:var(--green)">${esc(item.content || '$ ')}</pre>`;
        break;
      case 'screenshot':
        content = `<div class="canvas-item-header"><span>${esc(item.title || 'Screenshot')}</span><button onclick="deleteCanvasItem('${item.id}')">&times;</button></div><div class="canvas-item-body"><img src="data:image/png;base64,${item.content}" style="max-width:100%;height:auto"></div>`;
        break;
    }

    el.innerHTML = content;

    // Dragging
    const header = el.querySelector('.canvas-item-header');
    if (header) {
      header.style.cursor = 'grab';
      header.onmousedown = (e) => {
        e.preventDefault();
        _canvasDragging = { el, id: item.id, startX: e.clientX - item.x, startY: e.clientY - item.y };
      };
    }

    workspace.appendChild(el);
  }

  document.onmousemove = (e) => {
    if (!_canvasDragging) return;
    const x = e.clientX - _canvasDragging.startX;
    const y = e.clientY - _canvasDragging.startY;
    _canvasDragging.el.style.left = x + 'px';
    _canvasDragging.el.style.top = y + 'px';
  };

  document.onmouseup = () => {
    if (_canvasDragging) {
      const x = parseInt(_canvasDragging.el.style.left);
      const y = parseInt(_canvasDragging.el.style.top);
      api('/api/canvas/' + _canvasDragging.id, 'PUT', { x, y }).catch(() => {});
      _canvasDragging = null;
    }
  };
}

async function addCanvasItem(type) {
  await api('/api/canvas', 'POST', {
    type,
    title: type.charAt(0).toUpperCase() + type.slice(1),
    content: type === 'note' ? 'New note...' : type === 'code' ? '// code here' : '$ ',
    x: 50 + Math.random() * 200,
    y: 50 + Math.random() * 200,
  });
  renderCanvasItems();
}

async function deleteCanvasItem(id) {
  await api('/api/canvas/' + id, 'DELETE');
  renderCanvasItems();
}

async function updateCanvasContent(id, content) {
  await api('/api/canvas/' + id, 'PUT', { content });
}

async function browseForCanvas() {
  try {
    await api('/api/browser/launch', 'POST');
    const url = prompt('Enter URL to browse:');
    if (!url) return;
    await api('/api/browser/navigate', 'POST', { url });
    const result = await api('/api/browser/screenshot', 'POST');
    if (result.image) {
      await api('/api/canvas', 'POST', {
        type: 'screenshot',
        title: url,
        content: result.image,
        x: 100, y: 100, width: 400, height: 300,
      });
      renderCanvasItems();
    }
    await api('/api/browser/close', 'POST');
  } catch (err) {
    showToast('Browser: ' + err.message);
  }
}

// ═══ WAVE 4: DOCTOR PAGE ═══
async function loadDoctorPage() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div style="padding:24px;max-width:800px;margin:0 auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <h2 style="margin:0;color:var(--text)">Doctor</h2>
        <button class="btn-green" onclick="runDoctor()" id="doctorRunBtn">Run Diagnostics</button>
      </div>
      <div id="doctorResults" style="color:var(--text2)">Click "Run Diagnostics" to check system health.</div>
    </div>`;
}

async function runDoctor() {
  const btn = document.getElementById('doctorRunBtn');
  const container = document.getElementById('doctorResults');
  btn.disabled = true;
  btn.textContent = 'Running...';
  container.innerHTML = '<div style="color:var(--text3)">Running diagnostics...</div>';

  try {
    const report = await api('/api/doctor');

    const statusIcon = { pass: '<span style="color:var(--green)">PASS</span>', warn: '<span style="color:var(--amber)">WARN</span>', fail: '<span style="color:var(--red)">FAIL</span>' };
    const scoreColor = report.score >= 80 ? 'var(--green)' : report.score >= 60 ? 'var(--amber)' : 'var(--red)';

    container.innerHTML = `
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:48px;font-weight:700;color:${scoreColor}">${report.score}%</div>
        <div style="color:var(--text2)">${report.summary.passed} passed / ${report.summary.warned} warnings / ${report.summary.failed} failures</div>
      </div>
      <div style="display:grid;gap:8px">
        ${report.checks.map(c => `
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
            <div style="width:50px;text-align:center">${statusIcon[c.status]}</div>
            <div style="flex:1">
              <div style="color:var(--text);font-weight:500">${esc(c.name)}</div>
              <div style="color:var(--text3);font-size:12px">${esc(c.detail)}</div>
            </div>
            <div style="color:var(--text2);font-size:12px">${esc(c.value)}</div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:16px;padding:12px;background:var(--bg2);border-radius:8px;font-size:12px;color:var(--text3)">
        ${report.system.hostname} | ${report.system.platform} | Node ${report.system.nodeVersion} | ${report.system.cpuCount} CPUs | ${report.system.totalMemory}
      </div>`;
  } catch (err) {
    container.innerHTML = `<div style="color:var(--red)">Error: ${esc(err.message)}</div>`;
  }

  btn.disabled = false;
  btn.textContent = 'Run Diagnostics';
}

// ═══ WAVE 4: MEMORY PAGE ═══
async function loadMemoryPage() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div style="padding:24px;max-width:800px;margin:0 auto">
      <h2 style="margin:0 0 16px;color:var(--text)">Memory</h2>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <input id="memorySearch" placeholder="Search conversations..." style="flex:1;padding:8px;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:4px">
        <button class="btn-green" onclick="searchMemory()">Search</button>
      </div>
      <div id="memoryStats" style="margin-bottom:16px"></div>
      <div id="memoryResults"></div>
    </div>`;
  loadMemoryStats();
  loadRecentMemory();
}

async function loadMemoryStats() {
  try {
    const stats = await api('/api/memory/stats');
    document.getElementById('memoryStats').innerHTML = `
      <div style="display:flex;gap:16px;color:var(--text2);font-size:13px">
        <span>Total: ${stats.total}</span>
        <span>With embeddings: ${stats.withEmbeddings}</span>
        ${stats.oldestDate ? `<span>Since: ${new Date(stats.oldestDate).toLocaleDateString()}</span>` : ''}
      </div>`;
  } catch {}
}

async function loadRecentMemory() {
  const container = document.getElementById('memoryResults');
  try {
    const recent = await api('/api/memory/recent?limit=20');
    renderMemoryList(container, recent);
  } catch {}
}

async function searchMemory() {
  const q = document.getElementById('memorySearch').value.trim();
  if (!q) return loadRecentMemory();
  const container = document.getElementById('memoryResults');
  container.innerHTML = '<div style="color:var(--text3)">Searching...</div>';
  try {
    const results = await api('/api/memory/search?q=' + encodeURIComponent(q));
    renderMemoryList(container, results, true);
  } catch (err) {
    container.innerHTML = `<div style="color:var(--red)">Error: ${esc(err.message)}</div>`;
  }
}

function renderMemoryList(container, items, showSimilarity = false) {
  if (!items.length) {
    container.innerHTML = '<div style="color:var(--text3);text-align:center;padding:20px">No memories found</div>';
    return;
  }
  container.innerHTML = items.map(m => `
    <div style="padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="color:var(--text3);font-size:11px">${new Date(m.created_at).toLocaleString()}</span>
        <div>
          ${showSimilarity && m.similarity ? `<span style="color:var(--cyan);font-size:11px">${(m.similarity * 100).toFixed(1)}% match</span>` : ''}
          <button style="background:none;border:none;color:var(--red);cursor:pointer;font-size:11px" onclick="forgetMemory('${m.id}')">delete</button>
        </div>
      </div>
      <div style="color:var(--text);font-size:13px;white-space:pre-wrap">${esc(m.content?.slice(0, 300) || '')}</div>
    </div>
  `).join('');
}

async function forgetMemory(id) {
  await api('/api/memory/' + id, 'DELETE');
  showToast('Memory deleted');
  if (document.getElementById('memorySearch')?.value) searchMemory();
  else loadRecentMemory();
}

// ═══ WAVE 4: CHANNELS PAGE ═══
async function loadChannelsPage() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div style="padding:24px;max-width:800px;margin:0 auto">
      <h2 style="margin:0 0 16px;color:var(--text)">Channels & Integrations</h2>
      <div style="display:grid;gap:16px">
        <div class="card" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong style="color:var(--text)">Telegram</strong><div id="telegramStatus" style="color:var(--text3);font-size:12px">Checking...</div></div>
            <div style="display:flex;gap:8px">
              <button class="btn-sm" onclick="startChannel('telegram')">Start</button>
              <button class="btn-sm" onclick="stopChannel('telegram')">Stop</button>
            </div>
          </div>
        </div>
        <div class="card" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong style="color:var(--text)">Discord</strong><div id="discordStatus" style="color:var(--text3);font-size:12px">Checking...</div></div>
            <div style="display:flex;gap:8px">
              <button class="btn-sm" onclick="startChannel('discord')">Start</button>
              <button class="btn-sm" onclick="stopChannel('discord')">Stop</button>
            </div>
          </div>
        </div>
        <div class="card" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong style="color:var(--text)">MCP Server</strong><div id="mcpStatus" style="color:var(--text3);font-size:12px">Checking...</div></div>
            <div style="display:flex;gap:8px">
              <button class="btn-sm" onclick="toggleMCP(true)">Enable</button>
              <button class="btn-sm" onclick="toggleMCP(false)">Disable</button>
            </div>
          </div>
        </div>
        <div class="card" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong style="color:var(--text)">Discovery</strong><div id="discoveryStatus" style="color:var(--text3);font-size:12px">Checking...</div></div>
            <div><button class="btn-sm" onclick="scanDiscovery()">Scan</button></div>
          </div>
          <div id="discoveryNodes" style="margin-top:8px"></div>
        </div>
      </div>
    </div>`;
  refreshChannelStatuses();
}

async function refreshChannelStatuses() {
  try {
    const tg = await api('/api/channels/telegram/status').catch(() => ({}));
    document.getElementById('telegramStatus').innerHTML = tg.running ? '<span style="color:var(--green)">Running</span>' : tg.configured ? 'Stopped (configured)' : 'Not configured (set TELEGRAM_BOT_TOKEN)';
  } catch {}
  try {
    const dc = await api('/api/channels/discord/status').catch(() => ({}));
    document.getElementById('discordStatus').innerHTML = dc.running ? '<span style="color:var(--green)">Connected</span>' : dc.configured ? 'Stopped (configured)' : 'Not configured (set DISCORD_BOT_TOKEN)';
  } catch {}
  try {
    const mcp = await api('/api/mcp/status').catch(() => ({}));
    document.getElementById('mcpStatus').innerHTML = mcp.running ? `<span style="color:var(--green)">Running</span> (${mcp.tools?.length || 0} tools)` : 'Disabled';
  } catch {}
  try {
    const disc = await api('/api/discovery/status').catch(() => ({}));
    document.getElementById('discoveryStatus').innerHTML = disc.running ? `<span style="color:var(--green)">Active</span> (${disc.nodes} nodes)` : 'Disabled';
  } catch {}
}

async function startChannel(type) {
  try {
    await api('/api/channels/' + type + '/start', 'POST');
    showToast(type + ' started');
    refreshChannelStatuses();
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

async function stopChannel(type) {
  try {
    await api('/api/channels/' + type + '/stop', 'POST');
    showToast(type + ' stopped');
    refreshChannelStatuses();
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

async function toggleMCP(enabled) {
  try {
    await api('/api/mcp/config', 'PUT', { enabled });
    showToast('MCP ' + (enabled ? 'enabled' : 'disabled'));
    refreshChannelStatuses();
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

async function scanDiscovery() {
  try {
    const result = await api('/api/discovery/scan', 'POST');
    const container = document.getElementById('discoveryNodes');
    if (!result.nodes?.length) {
      container.innerHTML = '<div style="color:var(--text3);font-size:12px">No other Hyperion instances found</div>';
      return;
    }
    container.innerHTML = result.nodes.map(n => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border-radius:4px;margin-top:4px">
        <span class="pulse-dot"></span>
        <span style="color:var(--text)">${esc(n.name)}</span>
        <span style="color:var(--text3);font-size:11px">${esc(n.host)}:${n.port}</span>
        <span style="color:var(--text3);font-size:11px">${esc(n.os || '')}</span>
      </div>
    `).join('');
  } catch (err) {
    showToast('Scan error: ' + err.message);
  }
}

// ═══ WAVE 4: LLM Providers in Settings ═══
async function loadLLMSettings() {
  try {
    const providers = await api('/api/llm/providers');
    return providers;
  } catch { return []; }
}

// ═══ VAULT ═══
let _vaultSecrets = [];
let _vaultFilter = '';
let _vaultCategory = '';

async function loadVault() {
  const main = document.getElementById('main');
  let status = {};
  try { status = await api('/api/vault/status'); } catch {}

  if (!status.initialized) {
    // First time — set master password
    main.innerHTML = `
      <div class="page vault-page">
        <div class="vault-unlock">
          <div class="vault-unlock-box">
            <span class="vault-lock-icon">&#128272;</span>
            <h2>Create Vault</h2>
            <p>Set a master password to encrypt your secrets</p>
            <input type="password" id="vaultNewPass" placeholder="Master password (6+ chars)" onkeydown="if(event.key==='Enter')_vaultSetup()">
            <input type="password" id="vaultConfirmPass" placeholder="Confirm password" onkeydown="if(event.key==='Enter')_vaultSetup()">
            <button class="btn-green" onclick="_vaultSetup()" style="width:100%;margin-top:4px">Create Vault</button>
          </div>
        </div>
      </div>`;
    return;
  }

  if (!status.unlocked) {
    // Locked — show unlock screen
    main.innerHTML = `
      <div class="page vault-page">
        <div class="vault-unlock">
          <div class="vault-unlock-box">
            <span class="vault-lock-icon">&#128274;</span>
            <h2>Vault Locked</h2>
            <p>Enter your master password to unlock</p>
            <input type="password" id="vaultPassword" placeholder="Master password" onkeydown="if(event.key==='Enter')_vaultUnlock()">
            <button class="btn-green" onclick="_vaultUnlock()" style="width:100%;margin-top:4px">Unlock</button>
          </div>
        </div>
      </div>`;
    setTimeout(() => document.getElementById('vaultPassword')?.focus(), 100);
    return;
  }

  // Unlocked — show secrets
  await _vaultLoadSecrets();
  let categories = [];
  try { categories = await api('/api/vault/categories'); } catch {}

  main.innerHTML = `
    <div class="page vault-page">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2 style="margin:0;color:var(--text);font:600 18px var(--sans)">&#128274; Vault</h2>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" onclick="_vaultShowGenerator()">Generate</button>
          <button class="btn-sm" onclick="_vaultImportEnv()">Import .env</button>
          <button class="btn-sm" onclick="_vaultExportEnv()">Export .env</button>
          <button class="btn-sm" onclick="_vaultLock()" style="color:var(--red)">Lock</button>
        </div>
      </div>

      <div class="vault-toolbar">
        <input id="vaultSearch" placeholder="Search secrets..." oninput="_vaultFilterSecrets()" value="${esc(_vaultFilter)}">
        <select id="vaultCatFilter" onchange="_vaultCategory=this.value;_vaultFilterSecrets()">
          <option value="">All Categories</option>
          ${categories.map(c => `<option value="${c}" ${_vaultCategory===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <button class="btn-green" onclick="_vaultShowAdd()">+ Add Secret</button>
      </div>

      <div class="vault-list" id="vaultList"></div>
      <div style="margin-top:12px;font:400 11px var(--sans);color:var(--dim)" id="vaultCount"></div>
    </div>`;

  _vaultRenderList();
}

async function _vaultSetup() {
  const pass = document.getElementById('vaultNewPass')?.value;
  const confirm = document.getElementById('vaultConfirmPass')?.value;
  if (!pass || pass.length < 6) { showToast('Password must be 6+ characters'); return; }
  if (pass !== confirm) { showToast('Passwords do not match'); return; }
  try {
    await api('/api/vault/setup', 'POST', { password: pass });
    showToast('Vault created');
    loadVault();
  } catch (err) { showToast('Error: ' + err.message); }
}

async function _vaultUnlock() {
  const pass = document.getElementById('vaultPassword')?.value;
  if (!pass) { showToast('Enter password'); return; }
  try {
    await api('/api/vault/unlock', 'POST', { password: pass });
    loadVault();
  } catch (err) { showToast(err.message || 'Wrong password'); }
}

async function _vaultLock() {
  await api('/api/vault/lock', 'POST');
  showToast('Vault locked');
  loadVault();
}

async function _vaultLoadSecrets() {
  try { _vaultSecrets = await api('/api/vault/secrets'); } catch { _vaultSecrets = []; }
}

function _vaultFilterSecrets() {
  _vaultFilter = document.getElementById('vaultSearch')?.value?.toLowerCase() || '';
  _vaultRenderList();
}

function _vaultRenderList() {
  const list = document.getElementById('vaultList');
  const count = document.getElementById('vaultCount');
  if (!list) return;

  let filtered = _vaultSecrets;
  if (_vaultFilter) {
    filtered = filtered.filter(s => s.name.toLowerCase().includes(_vaultFilter) || s.category.toLowerCase().includes(_vaultFilter));
  }
  if (_vaultCategory) {
    filtered = filtered.filter(s => s.category === _vaultCategory);
  }

  if (!filtered.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--dim);font:400 13px var(--sans)">' +
      (_vaultSecrets.length ? 'No matching secrets' : 'No secrets yet — click "+ Add Secret" to get started') + '</div>';
    if (count) count.textContent = '';
    return;
  }

  list.innerHTML = filtered.map(s => {
    const catClass = ['api', 'env', 'ssh', 'password'].includes(s.category) ? s.category : '';
    return `<div class="vault-item" onclick="_vaultShowDetail('${s.id}')">
      <span class="vault-item-cat ${catClass}">${esc(s.category)}</span>
      <div>
        <div class="vault-item-name">${esc(s.name)}</div>
        <div class="vault-item-date">${s.updated_at || s.created_at || ''}</div>
      </div>
      <div class="vault-item-actions" onclick="event.stopPropagation()">
        <button onclick="_vaultCopy('${s.id}')" title="Copy value">Copy</button>
        <button onclick="_vaultDelete('${s.id}')" title="Delete" style="color:var(--red)">&times;</button>
      </div>
    </div>`;
  }).join('');

  if (count) count.textContent = `${filtered.length} secret(s)` + (_vaultFilter ? ` matching "${_vaultFilter}"` : '');
}

async function _vaultShowDetail(id) {
  try {
    const s = await api('/api/vault/secrets/' + id);
    const modal = document.createElement('div');
    modal.className = 'vault-modal';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="vault-modal-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0">${esc(s.name)}</h3>
          <button onclick="this.closest('.vault-modal').remove()" style="background:none;border:none;color:var(--dim);font-size:20px;cursor:pointer">&times;</button>
        </div>
        <div class="vault-field">
          <label>Value</label>
          <div class="vault-secret-value vault-masked" id="vaultDetailValue">${esc(s.value)}</div>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:12px">
          <button class="btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('vaultDetailValue').textContent);showToast('Copied')">Copy</button>
          <button class="btn-sm" onclick="document.getElementById('vaultDetailValue').classList.toggle('vault-masked')">Toggle Mask</button>
        </div>
        ${s.notes ? `<div class="vault-field"><label>Notes</label><div style="font:400 12px var(--sans);color:var(--dim);padding:8px">${esc(s.notes)}</div></div>` : ''}
        <div style="display:flex;gap:12px;font:400 11px var(--mono);color:var(--dim)">
          <span>Category: ${esc(s.category)}</span>
          <span>Updated: ${s.updated_at || '--'}</span>
        </div>
        <hr style="border-color:var(--border);margin:16px 0">
        <button class="btn-sm" onclick="_vaultEdit('${s.id}');this.closest('.vault-modal').remove()">Edit</button>
      </div>`;
    document.body.appendChild(modal);
  } catch (err) { showToast('Error: ' + err.message); }
}

async function _vaultCopy(id) {
  try {
    const s = await api('/api/vault/secrets/' + id);
    await navigator.clipboard.writeText(s.value);
    showToast('Copied to clipboard');
  } catch (err) { showToast('Error: ' + err.message); }
}

function _vaultShowAdd() {
  const modal = document.createElement('div');
  modal.className = 'vault-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="vault-modal-box">
      <h3>Add Secret</h3>
      <div class="vault-field"><label>Name</label><input id="vaultAddName" placeholder="e.g. STRIPE_API_KEY"></div>
      <div class="vault-field"><label>Value</label><textarea id="vaultAddValue" placeholder="sk_live_..." rows="3"></textarea></div>
      <div class="vault-field"><label>Category</label>
        <select id="vaultAddCat">
          <option value="general">General</option>
          <option value="api">API Key</option>
          <option value="password">Password</option>
          <option value="env">Environment</option>
          <option value="ssh">SSH</option>
          <option value="token">Token</option>
          <option value="database">Database</option>
        </select>
      </div>
      <div class="vault-field"><label>Notes (optional)</label><textarea id="vaultAddNotes" placeholder="Optional notes..." rows="2"></textarea></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
        <button class="btn-sm" onclick="this.closest('.vault-modal').remove()">Cancel</button>
        <button class="btn-green" onclick="_vaultAdd()">Save</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('vaultAddName')?.focus(), 100);
}

async function _vaultAdd() {
  const name = document.getElementById('vaultAddName')?.value?.trim();
  const value = document.getElementById('vaultAddValue')?.value;
  const category = document.getElementById('vaultAddCat')?.value || 'general';
  const notes = document.getElementById('vaultAddNotes')?.value?.trim();

  if (!name || !value) { showToast('Name and value required'); return; }

  try {
    await api('/api/vault/secrets', 'POST', { name, value, category, notes });
    document.querySelector('.vault-modal')?.remove();
    showToast('Secret added');
    await _vaultLoadSecrets();
    _vaultRenderList();
  } catch (err) { showToast('Error: ' + err.message); }
}

async function _vaultEdit(id) {
  try {
    const s = await api('/api/vault/secrets/' + id);
    const modal = document.createElement('div');
    modal.className = 'vault-modal';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="vault-modal-box">
        <h3>Edit Secret</h3>
        <div class="vault-field"><label>Name</label><input id="vaultEditName" value="${esc(s.name)}"></div>
        <div class="vault-field"><label>Value</label><textarea id="vaultEditValue" rows="3">${esc(s.value)}</textarea></div>
        <div class="vault-field"><label>Category</label>
          <select id="vaultEditCat">
            ${['general','api','password','env','ssh','token','database'].map(c => `<option value="${c}" ${s.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="vault-field"><label>Notes</label><textarea id="vaultEditNotes" rows="2">${esc(s.notes || '')}</textarea></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn-sm" onclick="this.closest('.vault-modal').remove()">Cancel</button>
          <button class="btn-green" onclick="_vaultSaveEdit('${id}')">Save</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  } catch (err) { showToast('Error: ' + err.message); }
}

async function _vaultSaveEdit(id) {
  const name = document.getElementById('vaultEditName')?.value?.trim();
  const value = document.getElementById('vaultEditValue')?.value;
  const category = document.getElementById('vaultEditCat')?.value;
  const notes = document.getElementById('vaultEditNotes')?.value?.trim();
  try {
    await api('/api/vault/secrets/' + id, 'PUT', { name, value, category, notes });
    document.querySelector('.vault-modal')?.remove();
    showToast('Updated');
    await _vaultLoadSecrets();
    _vaultRenderList();
  } catch (err) { showToast('Error: ' + err.message); }
}

async function _vaultDelete(id) {
  if (!confirm('Delete this secret permanently?')) return;
  try {
    await api('/api/vault/secrets/' + id, 'DELETE');
    showToast('Deleted');
    await _vaultLoadSecrets();
    _vaultRenderList();
  } catch (err) { showToast('Error: ' + err.message); }
}

// ── Generator ──
function _vaultShowGenerator() {
  const modal = document.createElement('div');
  modal.className = 'vault-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `
    <div class="vault-modal-box">
      <h3>Generator</h3>
      <div class="vault-field"><label>Type</label>
        <select id="vaultGenType" onchange="_vaultGenerate()">
          <option value="password">Password</option>
          <option value="token-hex">Token (Hex)</option>
          <option value="token-b64">Token (Base64)</option>
          <option value="uuid">UUID</option>
        </select>
      </div>
      <div class="vault-field"><label>Length</label><input id="vaultGenLen" type="number" value="32" min="8" max="128" onchange="_vaultGenerate()"></div>
      <div class="vault-gen-output" id="vaultGenOutput">--</div>
      <div style="display:flex;gap:6px;justify-content:center">
        <button class="btn-sm" onclick="_vaultGenerate()">Regenerate</button>
        <button class="btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('vaultGenOutput').textContent);showToast('Copied')">Copy</button>
        <button class="btn-sm" onclick="this.closest('.vault-modal').remove()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  _vaultGenerate();
}

async function _vaultGenerate() {
  const type = document.getElementById('vaultGenType')?.value || 'password';
  const length = parseInt(document.getElementById('vaultGenLen')?.value) || 32;
  const out = document.getElementById('vaultGenOutput');
  if (!out) return;

  try {
    if (type === 'password') {
      const r = await api('/api/vault/generate/password', 'POST', { length });
      out.textContent = r.password;
    } else if (type === 'token-hex') {
      const r = await api('/api/vault/generate/token', 'POST', { length, encoding: 'hex' });
      out.textContent = r.token;
    } else if (type === 'token-b64') {
      const r = await api('/api/vault/generate/token', 'POST', { length, encoding: 'base64' });
      out.textContent = r.token;
    } else if (type === 'uuid') {
      const r = await api('/api/vault/generate/uuid');
      out.textContent = r.uuid;
    }
  } catch (err) { out.textContent = 'Error: ' + err.message; }
}

// ── .env Import/Export ──
async function _vaultImportEnv() {
  const content = prompt('Paste .env content:\n(Format: KEY=value, one per line)');
  if (!content) return;
  const category = prompt('Category for imported secrets:', 'env') || 'env';
  try {
    const result = await api('/api/vault/import/env', 'POST', { content, category });
    showToast(`Imported ${result.count} secret(s)`);
    await _vaultLoadSecrets();
    _vaultRenderList();
  } catch (err) { showToast('Error: ' + err.message); }
}

async function _vaultExportEnv() {
  try {
    const result = await api('/api/vault/export/env?category=' + encodeURIComponent(_vaultCategory));
    prompt('.env export (Cmd+C to copy):', result.content);
  } catch (err) { showToast('Error: ' + err.message); }
}

// ═══ HTTP CLIENT ═══
let _httpResponse = null;
let _httpSidebarTab = 'history';
let _httpReqTab = 'headers';
let _httpResTab = 'body';
let _httpEnvId = '';
let _httpHistory = [];
let _httpCollections = [];
let _httpEnvs = [];

async function loadHttpClient() {
  const main = document.getElementById('main');

  // Load sidebar data
  try { [_httpHistory, _httpCollections, _httpEnvs] = await Promise.all([
    api('/api/http/history'), api('/api/http/collections'), api('/api/http/environments'),
  ]); } catch {}

  main.innerHTML = `
    <div class="page http-page">
      <div class="http-layout">
        <!-- Sidebar: History + Collections -->
        <div class="http-sidebar">
          <div class="http-sidebar-header">
            <h3>HTTP</h3>
            <div style="display:flex;gap:4px">
              <select class="http-env-select" id="httpEnvSelect" onchange="_httpEnvId=this.value">
                <option value="">No Env</option>
                ${_httpEnvs.map(e => `<option value="${e.id}" ${_httpEnvId===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}
              </select>
              <button class="btn-sm" onclick="_httpManageEnvs()" title="Manage Environments" style="padding:4px 6px">&#9881;</button>
            </div>
          </div>
          <div class="http-sidebar-tabs">
            <button class="http-sidebar-tab ${_httpSidebarTab==='history'?'active':''}" onclick="_httpSwitchSidebar('history')">History</button>
            <button class="http-sidebar-tab ${_httpSidebarTab==='collections'?'active':''}" onclick="_httpSwitchSidebar('collections')">Collections</button>
          </div>
          <div class="http-sidebar-list" id="httpSidebarList"></div>
          <div style="padding:8px;border-top:1px solid var(--border);display:flex;gap:4px">
            <button class="btn-sm" onclick="_httpImportCurl()" style="flex:1;font-size:10px">Import cURL</button>
            <button class="btn-sm" onclick="_httpExportCurl()" style="flex:1;font-size:10px">Export cURL</button>
          </div>
        </div>

        <!-- Main: Request + Response -->
        <div class="http-main">
          <!-- Request Bar -->
          <div class="http-request-bar">
            <select class="http-method-select" id="httpMethod">
              <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option><option>HEAD</option><option>OPTIONS</option>
            </select>
            <input class="http-url-input" id="httpUrl" placeholder="https://api.example.com/endpoint" onkeydown="if(event.key==='Enter')_httpSend()">
            <button class="http-send-btn" id="httpSendBtn" onclick="_httpSend()">Send</button>
          </div>

          <div class="http-split">
            <!-- Request Section -->
            <div class="http-req-section" style="border-bottom:1px solid var(--border)">
              <div class="http-section-tabs">
                <button class="http-section-tab ${_httpReqTab==='headers'?'active':''}" onclick="_httpSwitchReqTab('headers')">Headers</button>
                <button class="http-section-tab ${_httpReqTab==='body'?'active':''}" onclick="_httpSwitchReqTab('body')">Body</button>
                <button class="http-section-tab ${_httpReqTab==='auth'?'active':''}" onclick="_httpSwitchReqTab('auth')">Auth</button>
                <span style="flex:1"></span>
                <button class="btn-sm" onclick="_httpSaveToCollection()" style="margin:4px;font-size:10px">Save</button>
              </div>
              <div class="http-section-content" id="httpReqContent">
                <textarea class="http-textarea" id="httpHeaders" placeholder="Content-Type: application/json&#10;Authorization: Bearer {{token}}" rows="4"></textarea>
              </div>
            </div>

            <!-- Response Section -->
            <div class="http-res-section">
              <div id="httpResponseMeta" class="http-response-meta" style="display:none"></div>
              <div class="http-section-tabs">
                <button class="http-section-tab active" onclick="_httpSwitchResTab('body')">Body</button>
                <button class="http-section-tab" onclick="_httpSwitchResTab('headers')">Headers</button>
              </div>
              <div class="http-section-content" id="httpResContent">
                <div style="color:var(--dim);font:400 12px var(--sans);text-align:center;padding:40px">
                  Send a request to see the response
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  _httpRenderSidebar();
}

async function _httpSend() {
  const method = document.getElementById('httpMethod')?.value || 'GET';
  const url = document.getElementById('httpUrl')?.value?.trim();
  if (!url) { showToast('Enter a URL'); return; }

  const headerStr = document.getElementById('httpHeaders')?.value || '';
  const bodyStr = document.getElementById('httpBody')?.value || '';
  const headers = {};

  // Parse header textarea
  for (const line of headerStr.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const idx = t.indexOf(':');
    if (idx > 0) headers[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  }

  const btn = document.getElementById('httpSendBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  try {
    _httpResponse = await api('/api/http/send', 'POST', {
      method, url, headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : bodyStr || undefined,
      envId: _httpEnvId,
    });

    _httpRenderResponse();

    // Refresh history
    _httpHistory = await api('/api/http/history');
    if (_httpSidebarTab === 'history') _httpRenderSidebar();
  } catch (err) {
    _httpResponse = { status: 0, statusText: 'Error', body: err.message, time: 0, size: 0, headers: {} };
    _httpRenderResponse();
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
}

function _httpRenderResponse() {
  const r = _httpResponse;
  if (!r) return;

  // Meta bar
  const meta = document.getElementById('httpResponseMeta');
  if (meta) {
    const statusClass = r.status >= 500 ? 'status-5xx' : r.status >= 400 ? 'status-4xx' : r.status >= 300 ? 'status-3xx' : 'status-2xx';
    meta.style.display = 'flex';
    meta.innerHTML = `
      <span><span class="meta-label">Status: </span><span class="${statusClass}">${r.status} ${r.statusText || ''}</span></span>
      <span><span class="meta-label">Time: </span><span class="meta-value">${r.time}ms</span></span>
      <span><span class="meta-label">Size: </span><span class="meta-value">${_httpFormatSize(r.size)}</span></span>
    `;
  }

  _httpSwitchResTab(_httpResTab);
}

function _httpSwitchResTab(tab) {
  _httpResTab = tab;
  document.querySelectorAll('.http-res-section .http-section-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'body') || (i === 1 && tab === 'headers'));
  });

  const content = document.getElementById('httpResContent');
  if (!content || !_httpResponse) return;

  if (tab === 'body') {
    const body = _httpResponse.body;
    if (typeof body === 'object' && body !== null) {
      content.innerHTML = `<pre class="http-response-body">${_httpSyntaxHighlight(JSON.stringify(body, null, 2))}</pre>`;
    } else {
      content.innerHTML = `<pre class="http-response-body">${esc(String(body || ''))}</pre>`;
    }
  } else {
    const headers = _httpResponse.headers || {};
    content.innerHTML = `<pre class="http-response-body">${Object.entries(headers).map(([k, v]) =>
      `<span class="json-key">${esc(k)}</span>: ${esc(v)}`
    ).join('\n')}</pre>`;
  }
}

function _httpSwitchReqTab(tab) {
  _httpReqTab = tab;
  document.querySelectorAll('.http-req-section .http-section-tab').forEach(t => {
    t.classList.toggle('active', t.textContent.toLowerCase() === tab);
  });

  const content = document.getElementById('httpReqContent');
  if (!content) return;

  if (tab === 'headers') {
    const current = document.getElementById('httpHeaders')?.value || '';
    content.innerHTML = `<textarea class="http-textarea" id="httpHeaders" placeholder="Content-Type: application/json&#10;Authorization: Bearer {{token}}" rows="4">${esc(current)}</textarea>`;
  } else if (tab === 'body') {
    const current = document.getElementById('httpBody')?.value || '';
    content.innerHTML = `<textarea class="http-textarea" id="httpBody" placeholder='{"key": "value"}' rows="8" style="min-height:120px">${esc(current)}</textarea>`;
  } else if (tab === 'auth') {
    content.innerHTML = `
      <div style="display:grid;gap:8px;max-width:400px">
        <label style="font:500 12px var(--sans);color:var(--dim)">Auth Type</label>
        <select class="http-env-select" id="httpAuthType" onchange="_httpApplyAuth()" style="width:100%">
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apikey">API Key</option>
        </select>
        <div id="httpAuthFields"></div>
      </div>
    `;
  }
}

function _httpApplyAuth() {
  const type = document.getElementById('httpAuthType')?.value;
  const fields = document.getElementById('httpAuthFields');
  if (!fields) return;

  if (type === 'bearer') {
    fields.innerHTML = `<input class="http-textarea" id="httpAuthToken" placeholder="Token" style="min-height:auto;padding:8px" oninput="_httpSetAuthHeader()">`;
  } else if (type === 'basic') {
    fields.innerHTML = `
      <input class="http-textarea" id="httpAuthUser" placeholder="Username" style="min-height:auto;padding:8px;margin-bottom:4px">
      <input class="http-textarea" id="httpAuthPass" placeholder="Password" type="password" style="min-height:auto;padding:8px" oninput="_httpSetAuthHeader()">
    `;
  } else if (type === 'apikey') {
    fields.innerHTML = `
      <input class="http-textarea" id="httpAuthKeyName" placeholder="Header name (e.g. X-API-Key)" style="min-height:auto;padding:8px;margin-bottom:4px">
      <input class="http-textarea" id="httpAuthKeyVal" placeholder="API key value" style="min-height:auto;padding:8px" oninput="_httpSetAuthHeader()">
    `;
  } else {
    fields.innerHTML = '';
  }
}

function _httpSetAuthHeader() {
  const type = document.getElementById('httpAuthType')?.value;
  const headersEl = document.getElementById('httpHeaders');
  let headers = headersEl?.value || '';

  // Remove existing auth header
  headers = headers.split('\n').filter(l => !l.trim().toLowerCase().startsWith('authorization:') && !l.trim().toLowerCase().startsWith('x-api-key:')).join('\n');

  if (type === 'bearer') {
    const token = document.getElementById('httpAuthToken')?.value || '';
    if (token) headers += (headers.trim() ? '\n' : '') + `Authorization: Bearer ${token}`;
  } else if (type === 'basic') {
    const user = document.getElementById('httpAuthUser')?.value || '';
    const pass = document.getElementById('httpAuthPass')?.value || '';
    if (user) headers += (headers.trim() ? '\n' : '') + `Authorization: Basic ${btoa(user + ':' + pass)}`;
  } else if (type === 'apikey') {
    const name = document.getElementById('httpAuthKeyName')?.value || 'X-API-Key';
    const val = document.getElementById('httpAuthKeyVal')?.value || '';
    if (val) headers += (headers.trim() ? '\n' : '') + `${name}: ${val}`;
  }

  if (headersEl) headersEl.value = headers.trim();
}

// ── Sidebar ──
function _httpSwitchSidebar(tab) {
  _httpSidebarTab = tab;
  document.querySelectorAll('.http-sidebar-tab').forEach(t => t.classList.toggle('active', t.textContent.toLowerCase() === tab));
  _httpRenderSidebar();
}

function _httpRenderSidebar() {
  const list = document.getElementById('httpSidebarList');
  if (!list) return;

  if (_httpSidebarTab === 'history') {
    if (!_httpHistory.length) {
      list.innerHTML = '<div style="color:var(--dim);font:400 11px var(--sans);padding:12px;text-align:center">No history yet</div>';
      return;
    }
    list.innerHTML = _httpHistory.map(h => `
      <div class="http-sidebar-item" onclick="_httpLoadHistoryItem('${h.id}')">
        <span class="method-badge method-${h.method}">${h.method}</span>
        <span class="item-url">${esc(_httpShortUrl(h.url))}</span>
        <span style="font:400 10px var(--mono);color:${h.status < 400 ? 'var(--green)' : 'var(--red)'}">${h.status}</span>
      </div>
    `).join('');
  } else {
    let html = `<button class="btn-sm" onclick="_httpCreateCollection()" style="width:100%;margin-bottom:8px">+ New Collection</button>`;
    if (!_httpCollections.length) {
      html += '<div style="color:var(--dim);font:400 11px var(--sans);padding:12px;text-align:center">No collections</div>';
    } else {
      for (const c of _httpCollections) {
        html += `<div style="padding:6px 8px;margin-bottom:4px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong style="color:var(--text);font:500 12px var(--sans)">${esc(c.name)}</strong>
            <button class="btn-sm" onclick="_httpDeleteCollection('${c.id}')" style="color:var(--red);padding:2px 6px;font-size:10px">&times;</button>
          </div>`;
        for (const r of (c.requests || [])) {
          html += `<div class="http-sidebar-item" onclick="_httpLoadCollectionReq(${JSON.stringify(r).replace(/"/g, '&quot;')})">
            <span class="method-badge method-${r.method || 'GET'}">${r.method || 'GET'}</span>
            <span class="item-url">${esc(r.name || _httpShortUrl(r.url || ''))}</span>
          </div>`;
        }
        html += '</div>';
      }
    }
    list.innerHTML = html;
  }
}

async function _httpLoadHistoryItem(id) {
  try {
    const entry = await api('/api/http/history/' + id);
    if (entry?.request_data) {
      const r = entry.request_data;
      const methodEl = document.getElementById('httpMethod');
      const urlEl = document.getElementById('httpUrl');
      const headersEl = document.getElementById('httpHeaders');
      if (methodEl) methodEl.value = r.method || 'GET';
      if (urlEl) urlEl.value = r.url || '';
      if (headersEl && r.headers) {
        headersEl.value = Object.entries(r.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
      }
      if (r.body) {
        _httpSwitchReqTab('body');
        setTimeout(() => {
          const bodyEl = document.getElementById('httpBody');
          if (bodyEl) bodyEl.value = typeof r.body === 'string' ? r.body : JSON.stringify(r.body, null, 2);
        }, 50);
      }
    }
  } catch {}
}

function _httpLoadCollectionReq(req) {
  const methodEl = document.getElementById('httpMethod');
  const urlEl = document.getElementById('httpUrl');
  const headersEl = document.getElementById('httpHeaders');
  if (methodEl) methodEl.value = req.method || 'GET';
  if (urlEl) urlEl.value = req.url || '';
  if (headersEl && req.headers) {
    headersEl.value = typeof req.headers === 'string' ? req.headers : Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
  }
  if (req.body) {
    _httpSwitchReqTab('body');
    setTimeout(() => {
      const bodyEl = document.getElementById('httpBody');
      if (bodyEl) bodyEl.value = req.body;
    }, 50);
  }
}

// ── Collections CRUD ──
async function _httpCreateCollection() {
  const name = prompt('Collection name:');
  if (!name) return;
  try {
    await api('/api/http/collections', 'POST', { name });
    _httpCollections = await api('/api/http/collections');
    _httpRenderSidebar();
  } catch (err) { showToast('Error: ' + err.message); }
}

async function _httpDeleteCollection(id) {
  if (!confirm('Delete this collection?')) return;
  try {
    await api('/api/http/collections/' + id, 'DELETE');
    _httpCollections = await api('/api/http/collections');
    _httpRenderSidebar();
  } catch (err) { showToast('Error: ' + err.message); }
}

async function _httpSaveToCollection() {
  if (!_httpCollections.length) {
    showToast('Create a collection first');
    _httpSwitchSidebar('collections');
    return;
  }
  const method = document.getElementById('httpMethod')?.value || 'GET';
  const url = document.getElementById('httpUrl')?.value || '';
  const name = prompt('Request name:', `${method} ${_httpShortUrl(url)}`);
  if (!name) return;

  // Use first collection for simplicity
  const collId = _httpCollections[0].id;
  const headersStr = document.getElementById('httpHeaders')?.value || '';
  const body = document.getElementById('httpBody')?.value || '';

  try {
    await api(`/api/http/collections/${collId}/requests`, 'POST', { name, method, url, headers: headersStr, body });
    _httpCollections = await api('/api/http/collections');
    showToast('Saved to ' + _httpCollections[0].name);
    _httpRenderSidebar();
  } catch (err) { showToast('Error: ' + err.message); }
}

// ── cURL Import/Export ──
async function _httpImportCurl() {
  const curl = prompt('Paste cURL command:');
  if (!curl) return;
  try {
    const parsed = await api('/api/http/curl/parse', 'POST', { curl });
    const methodEl = document.getElementById('httpMethod');
    const urlEl = document.getElementById('httpUrl');
    const headersEl = document.getElementById('httpHeaders');
    if (methodEl) methodEl.value = parsed.method;
    if (urlEl) urlEl.value = parsed.url;
    if (headersEl) headersEl.value = Object.entries(parsed.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
    if (parsed.body) {
      _httpSwitchReqTab('body');
      setTimeout(() => {
        const bodyEl = document.getElementById('httpBody');
        if (bodyEl) bodyEl.value = parsed.body;
      }, 50);
    }
    showToast('cURL imported');
  } catch (err) { showToast('Parse error: ' + err.message); }
}

async function _httpExportCurl() {
  const method = document.getElementById('httpMethod')?.value || 'GET';
  const url = document.getElementById('httpUrl')?.value || '';
  if (!url) { showToast('Enter a URL first'); return; }

  const headersStr = document.getElementById('httpHeaders')?.value || '';
  const headers = {};
  for (const line of headersStr.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const idx = t.indexOf(':');
    if (idx > 0) headers[t.slice(0, idx).trim()] = t.slice(idx + 1).trim();
  }
  const body = document.getElementById('httpBody')?.value || '';

  try {
    const result = await api('/api/http/curl/export', 'POST', { method, url, headers, body: body || undefined });
    prompt('cURL command (Cmd+C to copy):', result.curl);
  } catch (err) { showToast('Error: ' + err.message); }
}

// ── Environment Manager ──
async function _httpManageEnvs() {
  const action = prompt('Manage Environments:\n1. Create new\n2. Delete existing\n\nEnter 1 or 2:');
  if (action === '1') {
    const name = prompt('Environment name:');
    if (!name) return;
    const vars = prompt('Variables as JSON (e.g. {"base":"https://api.com","token":"abc"}):', '{}');
    try {
      await api('/api/http/environments', 'POST', { name, variables: JSON.parse(vars || '{}') });
      _httpEnvs = await api('/api/http/environments');
      showToast('Environment created');
      loadHttpClient();
    } catch (err) { showToast('Error: ' + err.message); }
  } else if (action === '2') {
    if (!_httpEnvs.length) { showToast('No environments'); return; }
    const idx = prompt('Environments:\n' + _httpEnvs.map((e, i) => `${i + 1}. ${e.name}`).join('\n') + '\n\nEnter number to delete:');
    const env = _httpEnvs[parseInt(idx) - 1];
    if (env) {
      await api('/api/http/environments/' + env.id, 'DELETE');
      _httpEnvs = await api('/api/http/environments');
      showToast('Deleted');
      loadHttpClient();
    }
  }
}

// ── Helpers ──
function _httpShortUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url.length > 40 ? url.slice(0, 40) + '...' : url;
  }
}

function _httpFormatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function _httpSyntaxHighlight(json) {
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? 'json-key' : 'json-string';
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
}

// ═══ MONITOR ═══
let _monitorWs = null;
let _monitorTab = 'processes';
let _monitorSortCol = 'cpu';
let _monitorSortDir = -1; // -1 = desc
let _monitorProcesses = [];
let _monitorSnapshot = null;

async function loadMonitor() {
  const main = document.getElementById('main');

  main.innerHTML = `
    <div class="page mon-page">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2 style="margin:0;color:var(--text);font:600 18px var(--sans)">
          <span class="mon-live-dot" id="monLiveDot"></span>Monitor
        </h2>
        <div style="display:flex;gap:8px;align-items:center">
          <span style="font:400 11px var(--mono);color:var(--dim)" id="monUptime">--</span>
          <button class="btn-sm" onclick="_monRefresh()">Refresh</button>
        </div>
      </div>

      <div class="mon-kpis" id="monKpis"></div>

      <div class="mon-tabs">
        <button class="mon-tab active" data-tab="processes" onclick="_monSwitchTab('processes')">Processes</button>
        <button class="mon-tab" data-tab="network" onclick="_monSwitchTab('network')">Network</button>
        <button class="mon-tab" data-tab="disk" onclick="_monSwitchTab('disk')">Disk</button>
        <button class="mon-tab" data-tab="ports" onclick="_monSwitchTab('ports')">Ports</button>
        <button class="mon-tab" data-tab="alerts" onclick="_monSwitchTab('alerts')">Alerts</button>
      </div>

      <!-- Processes Panel -->
      <div class="mon-panel active" id="monPanelProcesses">
        <div class="mon-search">
          <input id="monProcSearch" placeholder="Search processes (name, PID, user)..." oninput="_monFilterProcesses()">
        </div>
        <div class="mon-table-wrap">
          <table class="mon-table">
            <thead><tr>
              <th onclick="_monSort('pid')" style="width:60px">PID</th>
              <th onclick="_monSort('name')">Name</th>
              <th onclick="_monSort('user')" style="width:80px">User</th>
              <th onclick="_monSort('cpu')" style="width:100px">CPU %</th>
              <th onclick="_monSort('rssMB')" style="width:100px">Memory</th>
              <th style="width:60px"></th>
            </tr></thead>
            <tbody id="monProcBody"></tbody>
          </table>
        </div>
        <div style="margin-top:8px;font:400 11px var(--sans);color:var(--dim)" id="monProcCount">-- processes</div>
      </div>

      <!-- Network Panel -->
      <div class="mon-panel" id="monPanelNetwork">
        <div class="mon-kpis" id="monNetKpis" style="margin-bottom:12px"></div>
        <h4 style="color:var(--text);font:600 13px var(--sans);margin:0 0 8px">Active Connections</h4>
        <div class="mon-table-wrap">
          <table class="mon-table">
            <thead><tr>
              <th>Process</th>
              <th>PID</th>
              <th>User</th>
              <th>Local</th>
              <th>Remote</th>
              <th>State</th>
            </tr></thead>
            <tbody id="monNetBody"></tbody>
          </table>
        </div>
      </div>

      <!-- Disk Panel -->
      <div class="mon-panel" id="monPanelDisk">
        <h4 style="color:var(--text);font:600 13px var(--sans);margin:0 0 8px">Filesystems</h4>
        <div id="monDiskList" style="margin-bottom:16px"></div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input id="monDiskPath" placeholder="Directory path (default: home)" style="flex:1;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font:400 12px var(--mono)">
          <button class="btn-sm" onclick="_monAnalyzeDir()">Analyze</button>
          <button class="btn-sm" onclick="_monLargestFiles()">Largest Files</button>
        </div>
        <div id="monDiskUsage"></div>
      </div>

      <!-- Ports Panel -->
      <div class="mon-panel" id="monPanelPorts">
        <h4 style="color:var(--text);font:600 13px var(--sans);margin:0 0 8px">Listening Ports</h4>
        <div id="monListeningPorts" style="margin-bottom:16px"></div>
        <hr style="border-color:var(--border);margin:16px 0">
        <h4 style="color:var(--text);font:600 13px var(--sans);margin:0 0 8px">Port Scanner</h4>
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <input id="monScanHost" placeholder="Host (e.g. 127.0.0.1)" value="127.0.0.1" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font:400 12px var(--mono);width:160px">
          <input id="monScanRange" placeholder="Port range (e.g. 1-1024)" value="1-1024" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font:400 12px var(--mono);width:140px">
          <button class="btn-green" onclick="_monScanPorts()" id="monScanBtn">Scan</button>
        </div>
        <div id="monScanResults"></div>
      </div>

      <!-- Alerts Panel -->
      <div class="mon-panel" id="monPanelAlerts">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <button class="btn-sm" onclick="_monCheckAlerts()">Check Now</button>
          <button class="btn-sm" onclick="_monClearAlerts()" style="color:var(--red)">Clear History</button>
        </div>
        <div id="monAlertList"></div>
      </div>
    </div>
  `;

  // Start WebSocket for live updates
  _monConnectWs();

  // Load initial data
  _monRefresh();
}

function _monConnectWs() {
  if (_monitorWs && _monitorWs.readyState <= 1) return;

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  _monitorWs = new WebSocket(`${proto}://${location.host}/ws/monitor?sid=${encodeURIComponent(_sessionId)}`);

  _monitorWs.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'monitor_snapshot') {
        _monitorSnapshot = msg.data;
        _monUpdateKpis(msg.data);
      }
    } catch {}
  };

  _monitorWs.onclose = () => {
    const dot = document.getElementById('monLiveDot');
    if (dot) dot.style.background = 'var(--red)';
  };
}

function _monUpdateKpis(snap) {
  const el = document.getElementById('monKpis');
  if (!el || !snap) return;

  const ut = document.getElementById('monUptime');
  if (ut) ut.textContent = snap.uptimeFormatted;

  el.innerHTML = `
    <div class="mon-kpi">
      <div class="mon-kpi-label">CPU Load</div>
      <div class="mon-kpi-value">${snap.loadAvg[0].toFixed(1)}</div>
      <div class="mon-kpi-sub">${snap.cpuCount} cores</div>
    </div>
    <div class="mon-kpi">
      <div class="mon-kpi-label">Memory</div>
      <div class="mon-kpi-value">${snap.memPercent}%</div>
      <div class="mon-kpi-sub">${(snap.usedMemMB / 1024).toFixed(1)} / ${(snap.totalMemMB / 1024).toFixed(1)} GB</div>
    </div>
    <div class="mon-kpi">
      <div class="mon-kpi-label">Processes</div>
      <div class="mon-kpi-value">${snap.processes.total}</div>
      <div class="mon-kpi-sub">CPU: ${snap.processes.totalCpu}%</div>
    </div>
    <div class="mon-kpi">
      <div class="mon-kpi-label">Disk</div>
      <div class="mon-kpi-value">${snap.disks[0]?.usePercent || '--'}%</div>
      <div class="mon-kpi-sub">${snap.disks[0]?.available || '--'} free</div>
    </div>
  `;
}

function _monSwitchTab(tab) {
  _monitorTab = tab;
  document.querySelectorAll('.mon-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.mon-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('monPanel' + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (panel) panel.classList.add('active');

  // Load tab-specific data
  if (tab === 'processes') _monLoadProcesses();
  else if (tab === 'network') _monLoadNetwork();
  else if (tab === 'disk') _monLoadDisk();
  else if (tab === 'ports') _monLoadPorts();
  else if (tab === 'alerts') _monLoadAlerts();
}

async function _monRefresh() {
  try {
    const snap = await api('/api/monitor/snapshot');
    _monitorSnapshot = snap;
    _monUpdateKpis(snap);
  } catch {}
  _monSwitchTab(_monitorTab);
}

// ── Processes Tab ──
async function _monLoadProcesses() {
  try {
    const procs = await api('/api/monitor/processes');
    _monitorProcesses = procs;
    _monRenderProcesses(procs);
  } catch {}
}

function _monRenderProcesses(procs) {
  const body = document.getElementById('monProcBody');
  const count = document.getElementById('monProcCount');
  if (!body) return;

  body.innerHTML = procs.slice(0, 100).map(p => {
    const cpuWidth = Math.min(100, p.cpu);
    const cpuColor = p.cpu > 80 ? 'var(--red)' : p.cpu > 40 ? 'var(--amber)' : 'var(--cyan)';
    return `<tr>
      <td style="color:var(--dim)">${p.pid}</td>
      <td title="${esc(p.command)}">${esc(p.name)}</td>
      <td style="color:var(--dim)">${esc(p.user)}</td>
      <td>${p.cpu.toFixed(1)}<span class="cpu-bar" style="width:${cpuWidth}px;background:${cpuColor}"></span></td>
      <td>${p.rssMB} MB<span class="mem-bar" style="width:${Math.min(100, p.rssMB / 10)}px"></span></td>
      <td><button class="mon-kill-btn" onclick="_monKill(${p.pid},'${esc(p.name)}')">Kill</button></td>
    </tr>`;
  }).join('');

  if (count) count.textContent = `${procs.length} processes (showing top 100)`;
}

function _monFilterProcesses() {
  const q = document.getElementById('monProcSearch')?.value?.toLowerCase() || '';
  if (!q) { _monRenderProcesses(_monitorProcesses); return; }
  const filtered = _monitorProcesses.filter(p =>
    p.name.toLowerCase().includes(q) || p.command.toLowerCase().includes(q) ||
    p.user.toLowerCase().includes(q) || String(p.pid).includes(q)
  );
  _monRenderProcesses(filtered);
}

function _monSort(col) {
  if (_monitorSortCol === col) _monitorSortDir *= -1;
  else { _monitorSortCol = col; _monitorSortDir = col === 'name' || col === 'user' ? 1 : -1; }

  _monitorProcesses.sort((a, b) => {
    const av = a[col], bv = b[col];
    if (typeof av === 'string') return av.localeCompare(bv) * _monitorSortDir;
    return (av - bv) * _monitorSortDir;
  });
  _monFilterProcesses();
}

async function _monKill(pid, name) {
  if (!confirm(`Kill process "${name}" (PID ${pid})?`)) return;
  try {
    await api(`/api/monitor/processes/${pid}/kill`, 'POST', { signal: 'SIGTERM' });
    showToast(`Sent SIGTERM to ${name} (${pid})`);
    setTimeout(_monLoadProcesses, 500);
  } catch (err) {
    showToast('Kill failed: ' + err.message);
  }
}

// ── Network Tab ──
async function _monLoadNetwork() {
  try {
    const [summary, conns] = await Promise.all([
      api('/api/monitor/network/summary'),
      api('/api/monitor/network'),
    ]);

    const kpis = document.getElementById('monNetKpis');
    if (kpis) {
      kpis.innerHTML = `
        <div class="mon-kpi"><div class="mon-kpi-label">Total</div><div class="mon-kpi-value">${summary.total}</div></div>
        <div class="mon-kpi"><div class="mon-kpi-label">Listening</div><div class="mon-kpi-value">${summary.listening}</div></div>
        <div class="mon-kpi"><div class="mon-kpi-label">Established</div><div class="mon-kpi-value">${summary.established}</div></div>
        <div class="mon-kpi"><div class="mon-kpi-label">Remote Hosts</div><div class="mon-kpi-value">${Object.keys(summary.byRemote).length}</div></div>
      `;
    }

    const body = document.getElementById('monNetBody');
    if (body) {
      body.innerHTML = conns.slice(0, 100).map(c => {
        const stateColor = c.state === 'ESTABLISHED' ? 'var(--green)' : c.state === 'LISTEN' ? 'var(--cyan)' : 'var(--dim)';
        return `<tr>
          <td>${esc(c.command)}</td>
          <td style="color:var(--dim)">${c.pid}</td>
          <td style="color:var(--dim)">${esc(c.user)}</td>
          <td style="font-size:11px">${esc(c.local)}</td>
          <td style="font-size:11px">${esc(c.remote || '--')}</td>
          <td style="color:${stateColor}">${c.state || '--'}</td>
        </tr>`;
      }).join('');
    }
  } catch {}
}

// ── Disk Tab ──
async function _monLoadDisk() {
  try {
    const disks = await api('/api/monitor/disk');
    const el = document.getElementById('monDiskList');
    if (el) {
      el.innerHTML = disks.map(d => {
        const color = d.usePercent > 90 ? 'var(--red)' : d.usePercent > 75 ? 'var(--amber)' : 'var(--green)';
        return `<div style="padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:6px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font:400 12px var(--mono);color:var(--text)">
            <span>${esc(d.mountpoint)}</span>
            <span>${d.used} / ${d.size} (${d.usePercent}%)</span>
          </div>
          <div class="mon-disk-bar"><div class="mon-disk-fill" style="width:${d.usePercent}%;background:${color}"></div></div>
          <div style="font:400 11px var(--sans);color:var(--dim);margin-top:4px">${esc(d.filesystem)} — ${d.available} free</div>
        </div>`;
      }).join('');
    }
  } catch {}
}

async function _monAnalyzeDir() {
  const dir = document.getElementById('monDiskPath')?.value || '';
  const el = document.getElementById('monDiskUsage');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--dim);font:400 12px var(--sans)">Analyzing...</div>';
  try {
    const result = await api('/api/monitor/disk/usage?path=' + encodeURIComponent(dir) + '&depth=1');
    el.innerHTML = `<h4 style="color:var(--text);font:600 13px var(--sans);margin:0 0 8px">Usage: ${esc(result.basePath)}</h4>` +
      result.entries.map(e => `<div style="display:flex;justify-content:space-between;padding:4px 8px;font:400 12px var(--mono);border-bottom:1px solid rgba(255,255,255,0.03)">
        <span style="color:var(--text)">${esc(e.path)}</span><span style="color:var(--dim)">${e.size}</span>
      </div>`).join('');
  } catch (err) {
    el.innerHTML = `<div style="color:var(--red)">${esc(err.message)}</div>`;
  }
}

async function _monLargestFiles() {
  const dir = document.getElementById('monDiskPath')?.value || '';
  const el = document.getElementById('monDiskUsage');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--dim);font:400 12px var(--sans)">Finding largest files...</div>';
  try {
    const files = await api('/api/monitor/disk/largest?path=' + encodeURIComponent(dir));
    el.innerHTML = '<h4 style="color:var(--text);font:600 13px var(--sans);margin:0 0 8px">Largest Files</h4>' +
      files.map(f => `<div style="display:flex;justify-content:space-between;padding:4px 8px;font:400 12px var(--mono);border-bottom:1px solid rgba(255,255,255,0.03)">
        <span style="color:var(--text)" title="${esc(f.path)}">${esc(f.name)}</span><span style="color:var(--dim)">${f.size}</span>
      </div>`).join('');
  } catch (err) {
    el.innerHTML = `<div style="color:var(--red)">${esc(err.message)}</div>`;
  }
}

// ── Ports Tab ──
async function _monLoadPorts() {
  try {
    const ports = await api('/api/monitor/ports');
    const el = document.getElementById('monListeningPorts');
    if (el) {
      if (!ports.length) {
        el.innerHTML = '<div style="color:var(--dim);font:400 12px var(--sans)">No listening ports detected</div>';
        return;
      }
      el.innerHTML = `<div class="mon-table-wrap"><table class="mon-table">
        <thead><tr><th>Port</th><th>Process</th><th>PID</th><th>Host</th></tr></thead>
        <tbody>${ports.map(p => `<tr>
          <td><span class="mon-port-open">${p.port}</span> <span style="color:var(--dim);font-size:10px">${p.protocol}</span></td>
          <td>${esc(p.command)}</td>
          <td style="color:var(--dim)">${p.pid}</td>
          <td style="color:var(--dim);font-size:11px">${esc(p.host)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`;
    }
  } catch {}
}

async function _monScanPorts() {
  const host = document.getElementById('monScanHost')?.value || '127.0.0.1';
  const range = document.getElementById('monScanRange')?.value || '1-1024';
  const btn = document.getElementById('monScanBtn');
  const el = document.getElementById('monScanResults');
  if (!el) return;

  if (btn) { btn.disabled = true; btn.textContent = 'Scanning...'; }
  el.innerHTML = '<div style="color:var(--dim);font:400 12px var(--sans)">Scanning ports...</div>';

  try {
    const result = await api('/api/monitor/ports/scan', 'POST', { host, range });
    let html = `<div style="font:400 11px var(--sans);color:var(--dim);margin-bottom:8px">Scanned ${result.scanned} ports on ${esc(result.host)}</div>`;

    if (!result.openPorts.length) {
      html += '<div style="color:var(--dim);font:400 12px var(--sans)">No open ports found</div>';
    } else {
      html += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
      html += result.openPorts.map(p =>
        `<span class="mon-port-open">${p.port}${p.service ? ' (' + p.service + ')' : ''}</span>`
      ).join('');
      html += '</div>';
    }
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<div style="color:var(--red)">${esc(err.message)}</div>`;
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Scan'; }
}

// ── Alerts Tab ──
async function _monLoadAlerts() {
  try {
    const alerts = await api('/api/monitor/alerts');
    const el = document.getElementById('monAlertList');
    if (!el) return;

    if (!alerts.length) {
      el.innerHTML = '<div style="color:var(--dim);font:400 12px var(--sans);padding:20px;text-align:center">No alerts recorded</div>';
      return;
    }

    el.innerHTML = alerts.map(a => {
      const catColors = { cpu: 'var(--cyan)', memory: 'var(--purple)', disk: 'var(--amber)' };
      return `<div class="mon-alert ${a.level}">
        <span class="mon-alert-time">${a.created_at}</span>
        <span class="mon-alert-cat" style="color:${catColors[a.category] || 'var(--dim)'}">${a.category}</span>
        <span class="mon-alert-msg">${esc(a.message)}</span>
      </div>`;
    }).join('');
  } catch {}
}

async function _monCheckAlerts() {
  try {
    const alerts = await api('/api/monitor/alerts/check', 'POST');
    showToast(`Found ${alerts.length} alert(s)`);
    _monLoadAlerts();
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

async function _monClearAlerts() {
  if (!confirm('Clear all alert history?')) return;
  try {
    await api('/api/monitor/alerts', 'DELETE');
    _monLoadAlerts();
  } catch {}
}

// ═══ REMOTE DESKTOP ═══
let _remoteWs = null;
let _remoteCanvas = null;
let _remoteCtx = null;
let _remoteConnected = false;
let _remoteConfig = { fps: 10, quality: 60, scale: 0.5 };
let _remoteFullscreen = false;
let _remoteTouchState = { lastTap: 0, longPressTimer: null, pinchDist: 0, canvasScale: 1, panX: 0, panY: 0 };
let _remoteConfigOpen = false;

async function loadRemote() {
  const main = document.getElementById('main');
  let status = {};
  try { status = await api('/api/remote/status'); } catch {}

  const permWarn = (status.permissions && (!status.permissions.screenRecording || !status.permissions.accessibility));

  main.innerHTML = `
    <div class="page" style="padding:0;display:flex;flex-direction:column;height:100%">
      ${permWarn ? `
        <div class="remote-perm-warn">
          <strong>Permissions Required</strong> — Remote desktop needs Screen Recording and Accessibility access.
          Open <strong>System Settings &gt; Privacy &amp; Security</strong> and enable both for Terminal/Node.
        </div>
      ` : ''}
      <div class="remote-toolbar" id="remoteToolbar">
        <div class="rt-group">
          <span class="rt-label">Status</span>
          <span class="rt-badge ${status.capturing ? '' : 'off'}" id="rtStatus">${status.capturing ? 'LIVE' : 'OFF'}</span>
          <span style="font:400 11px var(--mono);color:var(--dim)" id="rtClients">${status.clients || 0} client(s)</span>
        </div>
        <div class="rt-group">
          <span class="rt-label">Preset</span>
          <select id="rtPreset" onchange="_rmApplyPreset(this.value)">
            <option value="low">Low (5 FPS)</option>
            <option value="medium" selected>Medium (10 FPS)</option>
            <option value="high">High (20 FPS)</option>
            <option value="max">Max (30 FPS)</option>
          </select>
        </div>
        <div class="rt-group">
          <span class="rt-label">Quality</span>
          <input type="range" id="rtQuality" min="20" max="95" value="${_remoteConfig.quality}" oninput="_rmSetQuality(this.value)">
          <span style="font:400 11px var(--mono);color:var(--dim)" id="rtQualityVal">${_remoteConfig.quality}%</span>
        </div>
        <span class="rt-spacer"></span>
        <div class="rt-group">
          <button onclick="_rmToggleConfig()" title="Settings">&#9881;</button>
          <button onclick="_rmToggleWol()" title="Wake-on-LAN">WoL</button>
          <button onclick="_rmTogglePin()" title="PIN Security">&#128274;</button>
          <button onclick="_rmToggleFullscreen()" title="Fullscreen" id="rtFullscreenBtn">&#9974;</button>
          <button onclick="_rmConnect()" id="rtConnectBtn" class="${_remoteConnected ? 'active' : ''}">${_remoteConnected ? 'Disconnect' : 'Connect'}</button>
        </div>
      </div>
      <div class="remote-viewport" id="remoteViewport">
        <canvas class="remote-canvas" id="remoteCanvas"></canvas>
        <div class="remote-config-panel" id="remoteConfigPanel">
          <h4>Configuration</h4>
          <div class="remote-config-row"><label>FPS</label><input type="number" id="rcFps" value="${_remoteConfig.fps}" min="1" max="30" onchange="_rmUpdateConfig()"></div>
          <div class="remote-config-row"><label>Quality %</label><input type="number" id="rcQuality" value="${_remoteConfig.quality}" min="20" max="95" onchange="_rmUpdateConfig()"></div>
          <div class="remote-config-row"><label>Scale</label><select id="rcScale" onchange="_rmUpdateConfig()">
            <option value="0.25" ${_remoteConfig.scale===0.25?'selected':''}>25%</option>
            <option value="0.5" ${_remoteConfig.scale===0.5?'selected':''}>50%</option>
            <option value="0.75" ${_remoteConfig.scale===0.75?'selected':''}>75%</option>
            <option value="1" ${_remoteConfig.scale===1?'selected':''}>100%</option>
          </select></div>
          <hr style="border-color:var(--border);margin:12px 0">
          <h4>Network Access</h4>
          <div id="rcNetwork" style="font:400 12px var(--mono);color:var(--dim)">Loading...</div>
          <hr style="border-color:var(--border);margin:12px 0">
          <div class="remote-config-row"><label>Screen</label><span style="font:400 11px var(--mono);color:var(--dim)" id="rcScreen">--</span></div>
        </div>
        <div class="remote-float-bar" id="remoteFloatBar" style="display:none">
          <button onclick="_rmToggleFullscreen()" title="Fullscreen">&#9974;</button>
          <button onclick="_rmShowVirtualKeyboard()" title="Keyboard">&#9000;</button>
          <button onclick="_rmToggleConfig()" title="Settings">&#9881;</button>
        </div>
        <button class="remote-vkb-btn" id="remoteVkbBtn" style="display:none" onclick="_rmShowVirtualKeyboard()" title="Virtual Keyboard">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="8" y1="16" x2="16" y2="16"/></svg>
        </button>
      </div>
      <!-- WoL Modal -->
      <div id="remoteWolModal" style="display:none;position:fixed;inset:0;background:rgba(10,10,15,0.85);z-index:1000;display:none;align-items:center;justify-content:center">
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:24px;max-width:400px;width:90%">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:var(--text)">Wake-on-LAN</h3>
            <button onclick="document.getElementById('remoteWolModal').style.display='none'" style="background:none;border:none;color:var(--dim);font-size:20px;cursor:pointer">&times;</button>
          </div>
          <div id="wolDeviceList" class="remote-wol-panel"></div>
          <hr style="border-color:var(--border);margin:12px 0">
          <div style="display:grid;gap:8px">
            <input id="wolNewName" placeholder="Device name" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px 10px;font:400 12px var(--sans)">
            <input id="wolNewMac" placeholder="MAC address (AA:BB:CC:DD:EE:FF)" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:6px 10px;font:400 12px var(--mono)">
            <button class="btn-green" onclick="_rmAddWolDevice()">Add Device</button>
          </div>
        </div>
      </div>
    </div>
  `;

  _remoteCanvas = document.getElementById('remoteCanvas');
  _remoteCtx = _remoteCanvas.getContext('2d');

  // Setup canvas interaction handlers
  _rmSetupCanvasEvents();

  // Show floating bar + virtual keyboard button on touch devices
  if ('ontouchstart' in window) {
    const fb = document.getElementById('remoteFloatBar');
    const vkb = document.getElementById('remoteVkbBtn');
    if (fb) fb.style.display = 'flex';
    if (vkb) vkb.style.display = 'flex';
  }

  // Load network info
  try {
    const net = await api('/api/remote/network');
    const el = document.getElementById('rcNetwork');
    if (el) {
      el.innerHTML = net.addresses.map(a => `${a.name}: <strong>${a.address}</strong>`).join('<br>') +
        (net.hasTunnel ? '<br><span style="color:var(--green)">Cloudflare Tunnel available</span>' : '');
    }
  } catch {}

  // Show screen size
  if (status.screenSize) {
    const el = document.getElementById('rcScreen');
    if (el) el.textContent = `${status.screenSize.width} x ${status.screenSize.height}`;
  }

  // Auto-connect if was connected
  if (_remoteConnected && _remoteWs) {
    // Already connected
  }
}

function _rmConnect() {
  if (_remoteConnected) {
    _rmDisconnect();
    return;
  }

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  _remoteWs = new WebSocket(`${proto}://${location.host}/ws/remote?sid=${encodeURIComponent(_sessionId)}`);
  _remoteWs.binaryType = 'arraybuffer';

  _remoteWs.onopen = () => {
    _remoteConnected = true;
    const btn = document.getElementById('rtConnectBtn');
    if (btn) { btn.textContent = 'Disconnect'; btn.classList.add('active'); }
    const badge = document.getElementById('rtStatus');
    if (badge) { badge.textContent = 'LIVE'; badge.classList.remove('off'); }
  };

  _remoteWs.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      // Binary frame: JPEG screenshot
      const blob = new Blob([event.data], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        if (!_remoteCanvas) return;
        if (_remoteCanvas.width !== img.width || _remoteCanvas.height !== img.height) {
          _remoteCanvas.width = img.width;
          _remoteCanvas.height = img.height;
        }
        _remoteCtx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else {
      // JSON text message
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'remote_status') {
          _remoteConfig = msg.config || _remoteConfig;
          const clients = document.getElementById('rtClients');
          if (clients) clients.textContent = `${msg.clientCount} client(s)`;
        } else if (msg.type === 'config_updated') {
          _remoteConfig = msg.config || _remoteConfig;
        } else if (msg.type === 'error') {
          showToast('Remote: ' + msg.message);
        }
      } catch {}
    }
  };

  _remoteWs.onclose = () => {
    _remoteConnected = false;
    const btn = document.getElementById('rtConnectBtn');
    if (btn) { btn.textContent = 'Connect'; btn.classList.remove('active'); }
    const badge = document.getElementById('rtStatus');
    if (badge) { badge.textContent = 'OFF'; badge.classList.add('off'); }
  };

  _remoteWs.onerror = () => {
    showToast('Remote connection error');
  };
}

function _rmDisconnect() {
  if (_remoteWs) {
    _remoteWs.close();
    _remoteWs = null;
  }
  _remoteConnected = false;
}

function _rmSend(msg) {
  if (_remoteWs && _remoteWs.readyState === 1) {
    _remoteWs.send(JSON.stringify(msg));
  }
}

// ── Canvas Event Handlers ──
function _rmSetupCanvasEvents() {
  const viewport = document.getElementById('remoteViewport');
  const canvas = document.getElementById('remoteCanvas');
  if (!viewport || !canvas) return;

  // Mouse events
  canvas.addEventListener('click', (e) => {
    e.preventDefault();
    const pos = _rmGetNormalizedPos(e);
    _rmSend({ type: 'mouse', action: 'click', x: pos.x, y: pos.y, button: 'left' });
  });

  canvas.addEventListener('dblclick', (e) => {
    e.preventDefault();
    const pos = _rmGetNormalizedPos(e);
    _rmSend({ type: 'mouse', action: 'doubleclick', x: pos.x, y: pos.y, button: 'left' });
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const pos = _rmGetNormalizedPos(e);
    _rmSend({ type: 'mouse', action: 'rightclick', x: pos.x, y: pos.y, button: 'right' });
  });

  canvas.addEventListener('mousemove', (e) => {
    if (e.buttons > 0) {
      const pos = _rmGetNormalizedPos(e);
      _rmSend({ type: 'mouse', action: 'move', x: pos.x, y: pos.y });
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      const pos = _rmGetNormalizedPos(e);
      _rmSend({ type: 'mouse', action: 'mousedown', x: pos.x, y: pos.y, button: 'left' });
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      const pos = _rmGetNormalizedPos(e);
      _rmSend({ type: 'mouse', action: 'mouseup', x: pos.x, y: pos.y, button: 'left' });
    }
  });

  // Scroll
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const pos = _rmGetNormalizedPos(e);
    _rmSend({ type: 'scroll', x: pos.x, y: pos.y, deltaX: e.deltaX, deltaY: e.deltaY });
  }, { passive: false });

  // Keyboard
  viewport.setAttribute('tabindex', '0');
  viewport.addEventListener('keydown', (e) => {
    if (!_remoteConnected) return;
    e.preventDefault();
    _rmSend({
      type: 'key', action: 'keydown', key: e.key,
      modifiers: { shift: e.shiftKey, control: e.ctrlKey, option: e.altKey, command: e.metaKey }
    });
  });

  viewport.addEventListener('keyup', (e) => {
    if (!_remoteConnected) return;
    e.preventDefault();
    _rmSend({
      type: 'key', action: 'keyup', key: e.key,
      modifiers: { shift: e.shiftKey, control: e.ctrlKey, option: e.altKey, command: e.metaKey }
    });
  });

  // Focus viewport on click for keyboard capture
  viewport.addEventListener('click', () => viewport.focus());

  // ── Touch Events (Mobile) ──
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touches = e.touches;

    if (touches.length === 1) {
      // Single touch — start long press timer for right-click
      const pos = _rmGetNormalizedTouchPos(touches[0]);
      _remoteTouchState.longPressTimer = setTimeout(() => {
        _rmSend({ type: 'mouse', action: 'rightclick', x: pos.x, y: pos.y, button: 'right' });
        _remoteTouchState.longPressTimer = null;
      }, 600);
    } else if (touches.length === 2) {
      // Two-finger: start pinch tracking
      clearTimeout(_remoteTouchState.longPressTimer);
      _remoteTouchState.pinchDist = Math.hypot(
        touches[1].clientX - touches[0].clientX,
        touches[1].clientY - touches[0].clientY
      );
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (_remoteTouchState.longPressTimer) {
      // Was a tap (not long press)
      clearTimeout(_remoteTouchState.longPressTimer);
      _remoteTouchState.longPressTimer = null;

      if (e.changedTouches.length === 1) {
        const now = Date.now();
        const pos = _rmGetNormalizedTouchPos(e.changedTouches[0]);

        if (now - _remoteTouchState.lastTap < 300) {
          _rmSend({ type: 'mouse', action: 'doubleclick', x: pos.x, y: pos.y, button: 'left' });
        } else {
          _rmSend({ type: 'mouse', action: 'click', x: pos.x, y: pos.y, button: 'left' });
        }
        _remoteTouchState.lastTap = now;
      }
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touches = e.touches;

    if (touches.length === 1 && !_remoteTouchState.longPressTimer) {
      const pos = _rmGetNormalizedTouchPos(touches[0]);
      _rmSend({ type: 'mouse', action: 'move', x: pos.x, y: pos.y });
    } else if (touches.length === 2) {
      clearTimeout(_remoteTouchState.longPressTimer);
      const newDist = Math.hypot(
        touches[1].clientX - touches[0].clientX,
        touches[1].clientY - touches[0].clientY
      );
      if (_remoteTouchState.pinchDist > 0) {
        const scale = newDist / _remoteTouchState.pinchDist;
        _remoteTouchState.canvasScale = Math.max(0.5, Math.min(3, _remoteTouchState.canvasScale * scale));
        canvas.style.transform = `scale(${_remoteTouchState.canvasScale})`;
      }
      _remoteTouchState.pinchDist = newDist;
    }
  }, { passive: false });
}

function _rmGetNormalizedPos(e) {
  const rect = _remoteCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
  };
}

function _rmGetNormalizedTouchPos(touch) {
  const rect = _remoteCanvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height)),
  };
}

// ── Presets ──
function _rmApplyPreset(preset) {
  const presets = {
    low: { fps: 5, quality: 40, scale: 0.5 },
    medium: { fps: 10, quality: 60, scale: 0.5 },
    high: { fps: 20, quality: 80, scale: 0.75 },
    max: { fps: 30, quality: 90, scale: 1 },
  };
  const p = presets[preset] || presets.medium;
  _remoteConfig = { ...p };
  _rmSend({ type: 'configure', ...p });

  // Update UI controls
  const q = document.getElementById('rtQuality');
  const qv = document.getElementById('rtQualityVal');
  if (q) q.value = p.quality;
  if (qv) qv.textContent = p.quality + '%';
  const fp = document.getElementById('rcFps');
  const rq = document.getElementById('rcQuality');
  const rs = document.getElementById('rcScale');
  if (fp) fp.value = p.fps;
  if (rq) rq.value = p.quality;
  if (rs) rs.value = p.scale;
}

function _rmSetQuality(val) {
  const qv = document.getElementById('rtQualityVal');
  if (qv) qv.textContent = val + '%';
  _remoteConfig.quality = parseInt(val);
  _rmSend({ type: 'configure', quality: parseInt(val) });
}

function _rmUpdateConfig() {
  const fps = parseInt(document.getElementById('rcFps')?.value) || _remoteConfig.fps;
  const quality = parseInt(document.getElementById('rcQuality')?.value) || _remoteConfig.quality;
  const scale = parseFloat(document.getElementById('rcScale')?.value) || _remoteConfig.scale;
  _remoteConfig = { fps, quality, scale };
  _rmSend({ type: 'configure', fps, quality, scale });
}

// ── Config Panel ──
function _rmToggleConfig() {
  const panel = document.getElementById('remoteConfigPanel');
  if (!panel) return;
  _remoteConfigOpen = !_remoteConfigOpen;
  panel.classList.toggle('open', _remoteConfigOpen);
}

// ── Fullscreen ──
function _rmToggleFullscreen() {
  const viewport = document.getElementById('remoteViewport');
  if (!viewport) return;

  if (!document.fullscreenElement) {
    viewport.requestFullscreen().catch(() => {
      // Fallback: CSS fullscreen
      viewport.classList.toggle('fullscreen');
    });
  } else {
    document.exitFullscreen();
  }
}

// ── Virtual Keyboard ──
function _rmShowVirtualKeyboard() {
  // Create a hidden input, focus it to trigger mobile keyboard
  let input = document.getElementById('_rmVkbInput');
  if (!input) {
    input = document.createElement('input');
    input.id = '_rmVkbInput';
    input.type = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.style.cssText = 'position:fixed;bottom:-100px;left:0;opacity:0;width:1px;height:1px;';
    document.body.appendChild(input);

    input.addEventListener('input', (e) => {
      const char = e.data;
      if (char) {
        _rmSend({ type: 'key', action: 'keydown', key: char, modifiers: {} });
      }
      input.value = '';
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' || e.key === 'Enter') {
        _rmSend({ type: 'key', action: 'keydown', key: e.key, modifiers: {} });
      }
    });
  }
  input.focus();
}

// ── Wake-on-LAN UI ──
function _rmToggleWol() {
  const modal = document.getElementById('remoteWolModal');
  if (!modal) return;
  modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
  if (modal.style.display === 'flex') _rmLoadWolDevices();
}

async function _rmLoadWolDevices() {
  const list = document.getElementById('wolDeviceList');
  if (!list) return;
  try {
    const devices = await api('/api/remote/wol/devices');
    if (!devices.length) {
      list.innerHTML = '<div style="color:var(--dim);font-size:12px;padding:8px">No saved devices</div>';
      return;
    }
    list.innerHTML = devices.map(d => `
      <div class="remote-wol-device">
        <div>
          <div class="wol-name">${esc(d.name)}</div>
          <div class="wol-mac">${esc(d.mac)}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-sm" onclick="_rmWakeDevice('${esc(d.mac)}')">Wake</button>
          <button class="btn-sm" onclick="_rmDeleteWolDevice('${esc(d.id)}')" style="color:var(--red)">&times;</button>
        </div>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<div style="color:var(--red);font-size:12px;padding:8px">Failed to load devices</div>';
  }
}

async function _rmAddWolDevice() {
  const name = document.getElementById('wolNewName')?.value?.trim();
  const mac = document.getElementById('wolNewMac')?.value?.trim();
  if (!name || !mac) { showToast('Name and MAC required'); return; }
  try {
    await api('/api/remote/wol/devices', 'POST', { name, mac });
    showToast('Device added');
    document.getElementById('wolNewName').value = '';
    document.getElementById('wolNewMac').value = '';
    _rmLoadWolDevices();
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

async function _rmWakeDevice(mac) {
  try {
    await api('/api/remote/wol', 'POST', { mac });
    showToast('Wake packet sent to ' + mac);
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

async function _rmDeleteWolDevice(id) {
  try {
    await api('/api/remote/wol/devices/' + id, 'DELETE');
    _rmLoadWolDevices();
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

// ── PIN UI ──
async function _rmTogglePin() {
  try {
    const status = await api('/api/remote/status');
    if (status.pinSet) {
      if (confirm('Clear the remote access PIN?')) {
        await api('/api/remote/pin', 'DELETE');
        showToast('PIN cleared');
      }
    } else {
      const pin = prompt('Set a 4-6 digit PIN for remote access:');
      if (pin) {
        await api('/api/remote/pin', 'POST', { pin });
        showToast('PIN set');
      }
    }
  } catch (err) {
    showToast('Error: ' + err.message);
  }
}

// Initialize mobile features
window.addEventListener('resize', renderBottomNav);
document.addEventListener('DOMContentLoaded', () => { renderBottomNav(); initSwipeGestures(); });

// Override renderTermTabs to add SSH button
const _wave3RenderTermTabs = renderTermTabs;
renderTermTabs = function() {
  _wave3RenderTermTabs();
  const tabs = document.getElementById('termTabs');
  if (!tabs) return;
  // Insert SSH button before the toolbar
  const toolbar = tabs.querySelector('.term-toolbar');
  if (toolbar && !tabs.querySelector('.ssh-btn')) {
    const sshBtn = document.createElement('button');
    sshBtn.className = 'term-add ssh-btn';
    sshBtn.title = 'SSH Connect';
    sshBtn.textContent = 'SSH';
    sshBtn.style.cssText = 'color:var(--cyan);font:600 10px var(--mono)';
    sshBtn.onclick = () => openSSHConnectModal();
    toolbar.parentNode.insertBefore(sshBtn, toolbar);
  }
  // Add SSH labels to tabs
  terminals.forEach((t, i) => {
    if (t.ssh && t.sshLabel) {
      const tabBtns = tabs.querySelectorAll('.term-tab');
      if (tabBtns[i]) tabBtns[i].innerHTML = `SSH: ${esc(t.sshLabel)}<span class="term-close" onclick="event.stopPropagation();closeTermTab(${i})">&times;</span>`;
    }
  });
};

// ═══════════════════════════════════════════════════════════════
// DB EXPLORER
// ═══════════════════════════════════════════════════════════════

let _dbeConnId = null;
let _dbeTab = 'tables';

async function loadDbExplorer() {
  const m = document.getElementById('main');
  m.innerHTML = `
    <div class="dbe-page">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
          <h1 style="font:700 22px var(--sans);margin:0">DB Explorer</h1>
          <p style="font:400 12px var(--sans);color:var(--dim);margin:4px 0 0">Browse SQLite databases, run queries, inspect schemas</p>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm" onclick="_dbeConnectHyperion()" style="background:var(--green2);color:var(--green);border:1px solid rgba(218,119,86,0.2);border-radius:10px;padding:6px 12px;font:500 12px var(--sans);cursor:pointer">Hyperion DB</button>
          <button class="btn btn-sm" onclick="_dbeConnectFile()" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font:500 12px var(--sans);cursor:pointer">Open File...</button>
        </div>
      </div>

      <div class="dbe-conn-bar" id="dbeConnBar" style="display:none">
        <select id="dbeConnSelect" onchange="_dbeSelectConn(this.value)" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font:400 12px var(--mono);min-width:200px"></select>
        <button onclick="_dbeDisconnect()" style="background:none;border:1px solid var(--border);color:var(--red);border-radius:6px;padding:6px 10px;font:400 11px var(--sans);cursor:pointer">Disconnect</button>
      </div>

      <div class="dbe-tabs" style="display:flex;gap:2px;margin:12px 0;border-bottom:1px solid var(--border);padding-bottom:0">
        <button class="dbe-tab active" data-tab="tables" onclick="_dbeSetTab('tables')">Tables</button>
        <button class="dbe-tab" data-tab="query" onclick="_dbeSetTab('query')">Query</button>
        <button class="dbe-tab" data-tab="saved" onclick="_dbeSetTab('saved')">Saved</button>
        <button class="dbe-tab" data-tab="history" onclick="_dbeSetTab('history')">History</button>
      </div>

      <div id="dbeContent" class="dbe-content">
        <div style="text-align:center;padding:60px 20px;color:var(--dim)">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:0.4"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          <p style="font:500 14px var(--sans);margin:0 0 4px">No database connected</p>
          <p style="font:400 12px var(--sans)">Click <strong>Hyperion DB</strong> to explore Hyperion's own database, or <strong>Open File</strong> to browse any SQLite file.</p>
        </div>
      </div>
    </div>`;
  _dbeRefreshConnections();
}

async function _dbeRefreshConnections() {
  try {
    const res = await api('/api/db/connections');
    const sel = document.getElementById('dbeConnSelect');
    const bar = document.getElementById('dbeConnBar');
    if (!sel || !bar) return;
    if (res.length === 0) {
      bar.style.display = 'none';
      _dbeConnId = null;
      return;
    }
    bar.style.display = 'flex';
    bar.style.gap = '8px';
    bar.style.alignItems = 'center';
    bar.style.marginBottom = '8px';
    sel.innerHTML = res.map(c => `<option value="${c.id}" ${c.id === _dbeConnId ? 'selected' : ''}>${esc(c.name)} (${esc(c.path)})</option>`).join('');
    if (!_dbeConnId || !res.find(c => c.id === _dbeConnId)) {
      _dbeConnId = res[0].id;
      sel.value = _dbeConnId;
    }
    _dbeLoadTab();
  } catch {}
}

async function _dbeConnectHyperion() {
  try {
    const res = await api('/api/db/connect/hyperion', { method: 'POST' });
    _dbeConnId = res.id;
    _dbeRefreshConnections();
  } catch (err) {
    notify(err.message, 'error');
  }
}

function _dbeConnectFile() {
  const path = prompt('Enter full path to SQLite database file:');
  if (!path) return;
  const name = prompt('Connection name (optional):', '');
  api('/api/db/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, name }) })
    .then(res => { _dbeConnId = res.id; _dbeRefreshConnections(); })
    .catch(err => notify(err.message || 'Failed to connect', 'error'));
}

function _dbeSelectConn(id) {
  _dbeConnId = id;
  _dbeLoadTab();
}

async function _dbeDisconnect() {
  if (!_dbeConnId) return;
  try {
    await api(`/api/db/connections/${_dbeConnId}`, { method: 'DELETE' });
    _dbeConnId = null;
    _dbeRefreshConnections();
    document.getElementById('dbeContent').innerHTML = '<div style="text-align:center;padding:60px;color:var(--dim)">Disconnected</div>';
  } catch {}
}

function _dbeSetTab(tab) {
  _dbeTab = tab;
  document.querySelectorAll('.dbe-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  _dbeLoadTab();
}

async function _dbeLoadTab() {
  if (!_dbeConnId) return;
  const c = document.getElementById('dbeContent');
  if (!c) return;
  if (_dbeTab === 'tables') await _dbeLoadTables(c);
  else if (_dbeTab === 'query') _dbeLoadQueryEditor(c);
  else if (_dbeTab === 'saved') await _dbeLoadSaved(c);
  else if (_dbeTab === 'history') await _dbeLoadHistory(c);
}

async function _dbeLoadTables(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading tables...</div>';
  try {
    const tables = await api(`/api/db/${_dbeConnId}/tables`);
    if (tables.length === 0) {
      c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No tables found</div>';
      return;
    }
    c.innerHTML = `
      <div class="dbe-table-list">
        ${tables.map(t => `
          <div class="dbe-table-item" onclick="_dbeInspectTable('${esc(t.name)}')">
            <span class="dbe-table-type ${t.type === 'view' ? 'view' : ''}">${t.type === 'view' ? 'VIEW' : 'TBL'}</span>
            <span class="dbe-table-name">${esc(t.name)}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.3"><polyline points="9,18 15,12 9,6"/></svg>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

async function _dbeInspectTable(tableName) {
  const c = document.getElementById('dbeContent');
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading schema...</div>';
  try {
    const [schema, data] = await Promise.all([
      api(`/api/db/${_dbeConnId}/schema/${tableName}`),
      api(`/api/db/${_dbeConnId}/data/${tableName}?limit=50`),
    ]);
    c.innerHTML = `
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <button onclick="_dbeLoadTab()" style="background:none;border:none;color:var(--dim);cursor:pointer;font:500 12px var(--sans)">&larr; Back</button>
          <h2 style="font:600 16px var(--mono);color:var(--green);margin:0">${esc(schema.name)}</h2>
          <span style="font:400 11px var(--sans);color:var(--dim)">${schema.rowCount.toLocaleString()} rows</span>
        </div>

        <div class="dbe-schema-section">
          <h3 style="font:600 12px var(--sans);color:var(--text);margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px">Columns</h3>
          <div class="dbe-results-wrap">
            <table class="dbe-results">
              <thead><tr><th>Name</th><th>Type</th><th>PK</th><th>Not Null</th><th>Default</th></tr></thead>
              <tbody>
                ${schema.columns.map(col => `
                  <tr>
                    <td style="color:var(--green)">${esc(col.name)}</td>
                    <td style="color:var(--cyan)">${esc(col.type || 'ANY')}</td>
                    <td>${col.primaryKey ? '<span style="color:var(--amber)">PK</span>' : ''}</td>
                    <td>${col.notNull ? 'YES' : ''}</td>
                    <td style="color:var(--dim)">${col.defaultValue !== null ? esc(String(col.defaultValue)) : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${schema.indexes.length ? `
        <div class="dbe-schema-section" style="margin-top:12px">
          <h3 style="font:600 12px var(--sans);color:var(--text);margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px">Indexes</h3>
          <div class="dbe-results-wrap">
            <table class="dbe-results">
              <thead><tr><th>Name</th><th>Unique</th><th>Columns</th></tr></thead>
              <tbody>
                ${schema.indexes.map(idx => `
                  <tr>
                    <td>${esc(idx.name)}</td>
                    <td>${idx.unique ? '<span style="color:var(--amber)">UNIQUE</span>' : ''}</td>
                    <td style="color:var(--cyan)">${idx.columns.map(c => esc(c)).join(', ')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}

        ${schema.foreignKeys.length ? `
        <div class="dbe-schema-section" style="margin-top:12px">
          <h3 style="font:600 12px var(--sans);color:var(--text);margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px">Foreign Keys</h3>
          <div class="dbe-results-wrap">
            <table class="dbe-results">
              <thead><tr><th>Column</th><th>References</th><th>On Delete</th></tr></thead>
              <tbody>
                ${schema.foreignKeys.map(fk => `
                  <tr>
                    <td style="color:var(--green)">${esc(fk.from)}</td>
                    <td>${esc(fk.table)}.${esc(fk.to)}</td>
                    <td style="color:var(--dim)">${esc(fk.onDelete || 'NO ACTION')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}

        ${schema.createSql ? `
        <div class="dbe-schema-section" style="margin-top:12px">
          <h3 style="font:600 12px var(--sans);color:var(--text);margin:0 0 8px;text-transform:uppercase;letter-spacing:0.5px">CREATE Statement</h3>
          <pre class="dbe-sql-preview">${esc(schema.createSql)}</pre>
        </div>` : ''}

        <div style="margin-top:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <h3 style="font:600 12px var(--sans);color:var(--text);margin:0;text-transform:uppercase;letter-spacing:0.5px">Data Preview (first 50 rows)</h3>
            <div style="display:flex;gap:6px">
              <button onclick="_dbeExportTable('${esc(tableName)}','csv')" style="background:var(--bg3);border:1px solid var(--border);color:var(--dim);border-radius:4px;padding:4px 8px;font:400 11px var(--sans);cursor:pointer">CSV</button>
              <button onclick="_dbeExportTable('${esc(tableName)}','json')" style="background:var(--bg3);border:1px solid var(--border);color:var(--dim);border-radius:4px;padding:4px 8px;font:400 11px var(--sans);cursor:pointer">JSON</button>
            </div>
          </div>
          ${_dbeRenderResults(data.columns, data.rows)}
        </div>
      </div>`;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

function _dbeRenderResults(columns, rows) {
  if (!columns || columns.length === 0) return '<div style="padding:12px;color:var(--dim)">No data</div>';
  return `
    <div class="dbe-results-wrap">
      <table class="dbe-results">
        <thead><tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(row => `<tr>${columns.map(c => {
            const val = row[c];
            if (val === null) return '<td class="dbe-null">NULL</td>';
            const str = String(val);
            return `<td title="${esc(str)}">${esc(str.length > 100 ? str.slice(0, 100) + '...' : str)}</td>`;
          }).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function _dbeLoadQueryEditor(c) {
  c.innerHTML = `
    <div class="dbe-query-editor">
      <textarea id="dbeQueryInput" class="dbe-sql-input" placeholder="SELECT * FROM users LIMIT 10;" spellcheck="false"></textarea>
      <div style="display:flex;gap:8px;margin:8px 0;align-items:center;flex-wrap:wrap">
        <button onclick="_dbeRunQuery()" style="background:var(--green);color:#000;border:none;border-radius:6px;padding:8px 16px;font:600 12px var(--sans);cursor:pointer">Run Query</button>
        <button onclick="_dbeSaveCurrentQuery()" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font:400 12px var(--sans);cursor:pointer">Save</button>
        <span id="dbeQueryStatus" style="font:400 11px var(--mono);color:var(--dim)"></span>
        <div style="flex:1"></div>
        <button onclick="_dbeExportResults('csv')" style="background:var(--bg3);border:1px solid var(--border);color:var(--dim);border-radius:4px;padding:4px 8px;font:400 11px var(--sans);cursor:pointer">Export CSV</button>
        <button onclick="_dbeExportResults('json')" style="background:var(--bg3);border:1px solid var(--border);color:var(--dim);border-radius:4px;padding:4px 8px;font:400 11px var(--sans);cursor:pointer">Export JSON</button>
      </div>
      <div id="dbeQueryResults"></div>
    </div>`;

  const input = document.getElementById('dbeQueryInput');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        _dbeRunQuery();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = input.selectionStart;
        input.value = input.value.substring(0, start) + '  ' + input.value.substring(input.selectionEnd);
        input.selectionStart = input.selectionEnd = start + 2;
      }
    });
  }
}

let _dbeLastResults = null;

async function _dbeRunQuery() {
  const input = document.getElementById('dbeQueryInput');
  const status = document.getElementById('dbeQueryStatus');
  const results = document.getElementById('dbeQueryResults');
  if (!input || !_dbeConnId) return;
  const sql = input.value.trim();
  if (!sql) return;

  status.textContent = 'Running...';
  status.style.color = 'var(--amber)';
  try {
    const res = await api(`/api/db/${_dbeConnId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    _dbeLastResults = res;
    if (res.type === 'select') {
      status.textContent = `${res.rowCount} row${res.rowCount !== 1 ? 's' : ''} in ${res.time}ms`;
      status.style.color = 'var(--green)';
      results.innerHTML = _dbeRenderResults(res.columns, res.rows);
    } else {
      status.textContent = `${res.changes} row${res.changes !== 1 ? 's' : ''} affected in ${res.time}ms`;
      status.style.color = 'var(--cyan)';
      if (res.lastInsertRowid) {
        results.innerHTML = `<div style="padding:12px;color:var(--dim);font:400 12px var(--mono)">Last insert rowid: ${res.lastInsertRowid}</div>`;
      } else {
        results.innerHTML = '';
      }
    }
  } catch (err) {
    status.textContent = 'Error';
    status.style.color = 'var(--red)';
    results.innerHTML = `<div style="padding:12px;color:var(--red);font:400 12px var(--mono)">${esc(err.message)}</div>`;
  }
}

function _dbeSaveCurrentQuery() {
  const input = document.getElementById('dbeQueryInput');
  if (!input || !input.value.trim()) return;
  const name = prompt('Query name:');
  if (!name) return;
  api('/api/db/saved', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, sql: input.value.trim(), connId: _dbeConnId }),
  }).then(() => notify('Query saved')).catch(err => notify(err.message, 'error'));
}

function _dbeExportResults(format) {
  if (!_dbeLastResults || _dbeLastResults.type !== 'select') return;
  if (format === 'csv') {
    const csv = _dbeLastResults.columns.map(c => `"${c}"`).join(',') + '\n' +
      _dbeLastResults.rows.map(row => _dbeLastResults.columns.map(c => {
        const v = row[c];
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(',')).join('\n');
    _dbeDownload(csv, 'query-results.csv', 'text/csv');
  } else {
    _dbeDownload(JSON.stringify(_dbeLastResults.rows, null, 2), 'query-results.json', 'application/json');
  }
}

async function _dbeExportTable(tableName, format) {
  try {
    const data = await api(`/api/db/${_dbeConnId}/data/${tableName}?limit=10000`);
    if (format === 'csv') {
      const csv = data.columns.map(c => `"${c}"`).join(',') + '\n' +
        data.rows.map(row => data.columns.map(c => {
          const v = row[c];
          if (v === null || v === undefined) return '';
          const s = String(v);
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')).join('\n');
      _dbeDownload(csv, `${tableName}.csv`, 'text/csv');
    } else {
      _dbeDownload(JSON.stringify(data.rows, null, 2), `${tableName}.json`, 'application/json');
    }
  } catch (err) {
    notify(err.message, 'error');
  }
}

function _dbeDownload(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function _dbeLoadSaved(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading saved queries...</div>';
  try {
    const saved = await api('/api/db/saved');
    if (saved.length === 0) {
      c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No saved queries. Run a query and click Save.</div>';
      return;
    }
    c.innerHTML = `<div class="dbe-table-list">${saved.map(q => `
      <div class="dbe-table-item" onclick="_dbeLoadSavedQuery(\`${q.sql.replace(/`/g, '\\`')}\`)">
        <span class="dbe-table-type" style="background:rgba(68,136,255,0.1);color:var(--blue)">SQL</span>
        <div style="flex:1;min-width:0">
          <div class="dbe-table-name">${esc(q.name)}</div>
          <div style="font:400 11px var(--mono);color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(q.sql)}</div>
        </div>
        <button onclick="event.stopPropagation();_dbeDeleteSaved('${q.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font:400 14px var(--sans);opacity:0.5;padding:4px">&times;</button>
      </div>
    `).join('')}</div>`;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

function _dbeLoadSavedQuery(sql) {
  _dbeSetTab('query');
  setTimeout(() => {
    const input = document.getElementById('dbeQueryInput');
    if (input) input.value = sql;
  }, 50);
}

async function _dbeDeleteSaved(id) {
  try {
    await api(`/api/db/saved/${id}`, { method: 'DELETE' });
    _dbeLoadTab();
  } catch {}
}

async function _dbeLoadHistory(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading history...</div>';
  try {
    const history = await api('/api/db/history?limit=50');
    if (history.length === 0) {
      c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No query history yet</div>';
      return;
    }
    c.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <button onclick="_dbeClearHistory()" style="background:none;border:1px solid var(--border);color:var(--red);border-radius:4px;padding:4px 8px;font:400 11px var(--sans);cursor:pointer">Clear History</button>
      </div>
      <div class="dbe-table-list">${history.map(h => `
        <div class="dbe-table-item" onclick="_dbeLoadSavedQuery(\`${h.sql.replace(/`/g, '\\`')}\`)">
          <span class="dbe-table-type" style="background:${h.error ? 'rgba(239,83,80,0.1);color:var(--red)' : 'rgba(218,119,86,0.1);color:var(--green)'}">${h.error ? 'ERR' : 'OK'}</span>
          <div style="flex:1;min-width:0">
            <div style="font:400 12px var(--mono);color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.sql)}</div>
            <div style="font:400 10px var(--sans);color:var(--dim);margin-top:2px">${h.error ? esc(h.error) : `${h.row_count} rows, ${h.time_ms}ms`} &middot; ${h.created_at || ''}</div>
          </div>
        </div>
      `).join('')}</div>`;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

async function _dbeClearHistory() {
  try {
    await api('/api/db/history', { method: 'DELETE' });
    _dbeLoadTab();
  } catch {}
}

// ═══════════════════════════════════════════════════════════════
// DOCKER MANAGER
// ═══════════════════════════════════════════════════════════════

let _dockTab = 'containers';

async function loadDocker() {
  const m = document.getElementById('main');
  m.innerHTML = `
    <div class="dock-page">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
          <h1 style="font:700 22px var(--sans);margin:0">Docker</h1>
          <p style="font:400 12px var(--sans);color:var(--dim);margin:4px 0 0" id="dockStatus">Checking Docker...</p>
        </div>
        <div style="display:flex;gap:8px" id="dockActions"></div>
      </div>

      <div id="dockSummary" style="display:none;margin-bottom:16px"></div>

      <div class="dock-tabs" style="display:flex;gap:2px;border-bottom:1px solid var(--border);padding-bottom:0">
        <button class="dock-tab active" data-tab="containers" onclick="_dockSetTab('containers')">Containers</button>
        <button class="dock-tab" data-tab="images" onclick="_dockSetTab('images')">Images</button>
        <button class="dock-tab" data-tab="volumes" onclick="_dockSetTab('volumes')">Volumes</button>
        <button class="dock-tab" data-tab="networks" onclick="_dockSetTab('networks')">Networks</button>
      </div>

      <div id="dockContent" class="dock-content" style="margin-top:8px"></div>
    </div>`;

  // Check Docker status
  try {
    const status = await api('/api/docker/status');
    const statusEl = document.getElementById('dockStatus');
    if (!status.available) {
      statusEl.innerHTML = '<span style="color:var(--red)">Docker not available</span> — install Docker Desktop or start the daemon';
      document.getElementById('dockContent').innerHTML = '<div style="text-align:center;padding:60px;color:var(--dim)"><p style="font:500 14px var(--sans)">Docker is not running</p><p style="font:400 12px var(--sans);margin-top:8px">Start Docker Desktop or run <code style="color:var(--green)">sudo systemctl start docker</code></p></div>';
      return;
    }
    statusEl.innerHTML = `<span style="color:var(--green)">Docker ${esc(status.version?.server || '')}</span> &middot; ${status.info?.os || ''} ${status.info?.arch || ''}`;

    // Summary cards
    if (status.info) {
      const i = status.info;
      document.getElementById('dockSummary').style.display = 'grid';
      document.getElementById('dockSummary').style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:16px';
      document.getElementById('dockSummary').innerHTML = `
        <div class="dock-stat"><span class="dock-stat-val" style="color:var(--green)">${i.containersRunning}</span><span class="dock-stat-label">Running</span></div>
        <div class="dock-stat"><span class="dock-stat-val" style="color:var(--red)">${i.containersStopped}</span><span class="dock-stat-label">Stopped</span></div>
        <div class="dock-stat"><span class="dock-stat-val" style="color:var(--amber)">${i.containersPaused}</span><span class="dock-stat-label">Paused</span></div>
        <div class="dock-stat"><span class="dock-stat-val" style="color:var(--cyan)">${i.images}</span><span class="dock-stat-label">Images</span></div>`;
    }

    _dockLoadTab();
  } catch (err) {
    document.getElementById('dockStatus').innerHTML = `<span style="color:var(--red)">Error: ${esc(err.message)}</span>`;
  }
}

function _dockSetTab(tab) {
  _dockTab = tab;
  document.querySelectorAll('.dock-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  _dockLoadTab();
}

async function _dockLoadTab() {
  const c = document.getElementById('dockContent');
  if (!c) return;
  if (_dockTab === 'containers') await _dockLoadContainers(c);
  else if (_dockTab === 'images') await _dockLoadImages(c);
  else if (_dockTab === 'volumes') await _dockLoadVolumes(c);
  else if (_dockTab === 'networks') await _dockLoadNetworks(c);
}

function _dockStateColor(state) {
  if (!state) return 'var(--dim)';
  const s = state.toLowerCase();
  if (s === 'running') return 'var(--green)';
  if (s === 'exited' || s === 'dead') return 'var(--red)';
  if (s === 'paused') return 'var(--amber)';
  if (s === 'restarting' || s === 'created') return 'var(--cyan)';
  return 'var(--dim)';
}

async function _dockLoadContainers(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading containers...</div>';
  try {
    const containers = await api('/api/docker/containers');
    if (containers.length === 0) {
      c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No containers found</div>';
      return;
    }
    c.innerHTML = `
      <div class="dock-list">
        ${containers.map(ct => `
          <div class="dock-item">
            <div class="dock-item-header">
              <span class="dock-state-dot" style="background:${_dockStateColor(ct.state)}"></span>
              <span class="dock-item-name">${esc(ct.name)}</span>
              <span class="dock-item-id">${esc((ct.id || '').slice(0, 12))}</span>
              <span class="dock-item-image">${esc(ct.image)}</span>
              <span class="dock-item-status">${esc(ct.status)}</span>
              <div class="dock-item-actions">
                ${ct.state === 'running' ? `
                  <button onclick="_dockAction('stop','${esc(ct.id)}')" title="Stop" style="color:var(--red)">Stop</button>
                  <button onclick="_dockAction('restart','${esc(ct.id)}')" title="Restart" style="color:var(--amber)">Restart</button>
                  <button onclick="_dockAction('pause','${esc(ct.id)}')" title="Pause" style="color:var(--amber)">Pause</button>
                ` : ct.state === 'paused' ? `
                  <button onclick="_dockAction('unpause','${esc(ct.id)}')" title="Unpause" style="color:var(--green)">Unpause</button>
                ` : `
                  <button onclick="_dockAction('start','${esc(ct.id)}')" title="Start" style="color:var(--green)">Start</button>
                `}
                <button onclick="_dockViewLogs('${esc(ct.id)}','${esc(ct.name)}')" title="Logs" style="color:var(--cyan)">Logs</button>
                <button onclick="_dockInspect('${esc(ct.id)}')" title="Inspect" style="color:var(--blue)">Inspect</button>
                <button onclick="_dockRemoveContainer('${esc(ct.id)}')" title="Remove" style="color:var(--red)">Rm</button>
              </div>
            </div>
            ${ct.ports && ct.ports.length ? `<div class="dock-item-ports">${ct.ports.map(p => p.hostPort ? `<span class="dock-port">${p.host || ''}:${p.hostPort} -> ${p.containerPort}/${p.protocol}</span>` : p.containerPort ? `<span class="dock-port">${p.containerPort}/${p.protocol}</span>` : '').join('')}</div>` : ''}
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

async function _dockAction(action, id) {
  try {
    await api(`/api/docker/containers/${id}/${action}`, { method: 'POST' });
    notify(`Container ${action}ed`);
    _dockLoadTab();
  } catch (err) {
    notify(err.message, 'error');
  }
}

async function _dockRemoveContainer(id) {
  if (!confirm('Remove this container?')) return;
  try {
    await api(`/api/docker/containers/${id}?force=true`, { method: 'DELETE' });
    notify('Container removed');
    _dockLoadTab();
    // Refresh summary
    loadDocker();
  } catch (err) {
    notify(err.message, 'error');
  }
}

async function _dockViewLogs(id, name) {
  const c = document.getElementById('dockContent');
  c.innerHTML = `
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <button onclick="_dockLoadTab()" style="background:none;border:none;color:var(--dim);cursor:pointer;font:500 12px var(--sans)">&larr; Back</button>
        <h2 style="font:600 14px var(--mono);color:var(--green);margin:0">${esc(name)} — Logs</h2>
        <div style="flex:1"></div>
        <select id="dockLogTail" onchange="_dockRefreshLogs('${esc(id)}','${esc(name)}')" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font:400 11px var(--mono)">
          <option value="100">Last 100</option>
          <option value="200" selected>Last 200</option>
          <option value="500">Last 500</option>
          <option value="1000">Last 1000</option>
        </select>
      </div>
      <pre id="dockLogOutput" class="dock-log-output">Loading...</pre>
    </div>`;
  _dockRefreshLogs(id, name);
}

async function _dockRefreshLogs(id) {
  const tailEl = document.getElementById('dockLogTail');
  const tail = tailEl ? tailEl.value : 200;
  try {
    const res = await api(`/api/docker/containers/${id}/logs?tail=${tail}&timestamps=true`);
    const output = document.getElementById('dockLogOutput');
    if (output) {
      output.textContent = res.logs || '(empty)';
      output.scrollTop = output.scrollHeight;
    }
  } catch (err) {
    const output = document.getElementById('dockLogOutput');
    if (output) output.textContent = `Error: ${err.message}`;
  }
}

async function _dockInspect(id) {
  const c = document.getElementById('dockContent');
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Inspecting...</div>';
  try {
    const info = await api(`/api/docker/containers/${id}`);
    c.innerHTML = `
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <button onclick="_dockLoadTab()" style="background:none;border:none;color:var(--dim);cursor:pointer;font:500 12px var(--sans)">&larr; Back</button>
          <h2 style="font:600 14px var(--mono);color:var(--green);margin:0">${esc(info.name)}</h2>
          <span class="dock-state-dot" style="background:${_dockStateColor(info.state?.status)};width:8px;height:8px;border-radius:50%;display:inline-block"></span>
          <span style="font:400 11px var(--sans);color:var(--dim)">${esc(info.state?.status || '')}</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px">
          <div class="dock-detail-card">
            <h4>Container</h4>
            <div class="dock-detail-row"><span>ID</span><span style="color:var(--mono)">${esc((info.id || '').slice(0, 12))}</span></div>
            <div class="dock-detail-row"><span>Image</span><span>${esc(info.image)}</span></div>
            <div class="dock-detail-row"><span>Created</span><span>${esc(info.created || '')}</span></div>
            <div class="dock-detail-row"><span>Restart</span><span>${esc(info.restartPolicy)}</span></div>
            <div class="dock-detail-row"><span>PID</span><span>${info.state?.pid || '-'}</span></div>
          </div>

          ${info.mounts?.length ? `
          <div class="dock-detail-card">
            <h4>Mounts</h4>
            ${info.mounts.map(m => `<div class="dock-detail-row"><span>${esc(m.destination)}</span><span style="color:var(--dim);font-size:10px">${esc(m.source || '')}</span></div>`).join('')}
          </div>` : ''}

          ${info.env?.length ? `
          <div class="dock-detail-card">
            <h4>Environment</h4>
            <div style="max-height:200px;overflow-y:auto">
              ${info.env.slice(0, 30).map(e => {
                const [k, ...v] = e.split('=');
                return `<div class="dock-detail-row"><span style="color:var(--cyan)">${esc(k)}</span><span style="color:var(--dim);word-break:break-all">${esc(v.join('='))}</span></div>`;
              }).join('')}
              ${info.env.length > 30 ? `<div style="color:var(--dim);font:400 11px var(--sans);padding:4px 0">...and ${info.env.length - 30} more</div>` : ''}
            </div>
          </div>` : ''}

          ${info.network?.length ? `
          <div class="dock-detail-card">
            <h4>Networks</h4>
            ${info.network.map(n => `<div class="dock-detail-row"><span>${esc(n)}</span></div>`).join('')}
          </div>` : ''}
        </div>
      </div>`;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

async function _dockLoadImages(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading images...</div>';
  try {
    const images = await api('/api/docker/images');
    if (images.length === 0) {
      c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No images found</div>';
      return;
    }
    c.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;justify-content:flex-end">
        <button onclick="_dockPullImage()" style="background:var(--green2);color:var(--green);border:1px solid rgba(218,119,86,0.2);border-radius:10px;padding:6px 12px;font:500 12px var(--sans);cursor:pointer">Pull Image</button>
        <button onclick="_dockPruneImages()" style="background:var(--bg3);color:var(--dim);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font:400 12px var(--sans);cursor:pointer">Prune</button>
      </div>
      <div class="dock-list">
        ${images.map(img => `
          <div class="dock-item">
            <div class="dock-item-header">
              <span class="dock-item-name">${esc(img.repository || '<none>')}</span>
              <span style="font:500 11px var(--mono);color:var(--cyan);background:rgba(34,221,255,0.08);padding:2px 6px;border-radius:3px">${esc(img.tag || 'latest')}</span>
              <span class="dock-item-id">${esc((img.id || '').replace('sha256:', '').slice(0, 12))}</span>
              <span style="font:400 11px var(--sans);color:var(--dim)">${esc(img.size || '')}</span>
              <span style="font:400 10px var(--sans);color:var(--dim)">${esc(img.created || '')}</span>
              <div class="dock-item-actions">
                <button onclick="_dockRemoveImage('${esc(img.id)}')" title="Remove" style="color:var(--red)">Rm</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

async function _dockPullImage() {
  const image = prompt('Image to pull (e.g. nginx:latest):');
  if (!image) return;
  notify('Pulling image...');
  try {
    await api('/api/docker/images/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }) });
    notify('Image pulled successfully');
    _dockLoadTab();
  } catch (err) {
    notify(err.message, 'error');
  }
}

async function _dockRemoveImage(id) {
  if (!confirm('Remove this image?')) return;
  try {
    await api(`/api/docker/images/${encodeURIComponent(id)}?force=true`, { method: 'DELETE' });
    notify('Image removed');
    _dockLoadTab();
  } catch (err) {
    notify(err.message, 'error');
  }
}

async function _dockPruneImages() {
  if (!confirm('Remove all dangling images?')) return;
  try {
    await api('/api/docker/images/prune', { method: 'POST' });
    notify('Images pruned');
    _dockLoadTab();
  } catch (err) {
    notify(err.message, 'error');
  }
}

async function _dockLoadVolumes(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading volumes...</div>';
  try {
    const volumes = await api('/api/docker/volumes');
    if (volumes.length === 0) {
      c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No volumes found</div>';
      return;
    }
    c.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;justify-content:flex-end">
        <button onclick="_dockPruneVolumes()" style="background:var(--bg3);color:var(--dim);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font:400 12px var(--sans);cursor:pointer">Prune Unused</button>
      </div>
      <div class="dock-list">
        ${volumes.map(v => `
          <div class="dock-item">
            <div class="dock-item-header">
              <span class="dock-item-name">${esc(v.name)}</span>
              <span style="font:400 11px var(--sans);color:var(--dim)">${esc(v.driver)}</span>
              <div class="dock-item-actions">
                <button onclick="_dockRemoveVolume('${esc(v.name)}')" title="Remove" style="color:var(--red)">Rm</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

async function _dockRemoveVolume(name) {
  if (!confirm('Remove this volume? Data will be lost.')) return;
  try {
    await api(`/api/docker/volumes/${name}?force=true`, { method: 'DELETE' });
    notify('Volume removed');
    _dockLoadTab();
  } catch (err) {
    notify(err.message, 'error');
  }
}

async function _dockPruneVolumes() {
  if (!confirm('Remove all unused volumes? Data will be lost.')) return;
  try {
    await api('/api/docker/volumes/prune', { method: 'POST' });
    notify('Volumes pruned');
    _dockLoadTab();
  } catch (err) {
    notify(err.message, 'error');
  }
}

async function _dockLoadNetworks(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading networks...</div>';
  try {
    const networks = await api('/api/docker/networks');
    if (networks.length === 0) {
      c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No networks found</div>';
      return;
    }
    c.innerHTML = `
      <div class="dock-list">
        ${networks.map(n => `
          <div class="dock-item">
            <div class="dock-item-header">
              <span class="dock-item-name">${esc(n.name)}</span>
              <span style="font:500 11px var(--mono);color:var(--purple);background:rgba(170,102,255,0.08);padding:2px 6px;border-radius:3px">${esc(n.driver)}</span>
              <span style="font:400 11px var(--sans);color:var(--dim)">${esc(n.scope)}</span>
              <span class="dock-item-id">${esc((n.id || '').slice(0, 12))}</span>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════════
// GIT CLIENT
// ═══════════════════════════════════════════════════════════════

let _gitCwd = '';
let _gitTab = 'status';

async function loadGitClient() {
  _gitCwd = _gitCwd || '/';
  const m = document.getElementById('main');
  m.innerHTML = `
    <div class="git-page">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
          <h1 style="font:700 22px var(--sans);margin:0">Git</h1>
          <p style="font:400 12px var(--sans);color:var(--dim);margin:4px 0 0" id="gitRepoInfo">Loading...</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="gitCwdInput" type="text" value="${esc(_gitCwd)}" placeholder="/path/to/repo" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font:400 12px var(--mono);width:280px" onkeydown="if(event.key==='Enter')_gitSetCwd()">
          <button onclick="_gitSetCwd()" style="background:var(--green2);color:var(--green);border:1px solid rgba(218,119,86,0.2);border-radius:10px;padding:6px 12px;font:500 12px var(--sans);cursor:pointer">Open</button>
        </div>
      </div>

      <div class="git-tabs" style="display:flex;gap:2px;border-bottom:1px solid var(--border);padding-bottom:0;flex-wrap:wrap">
        <button class="git-tab active" data-tab="status" onclick="_gitSetTab('status')">Status</button>
        <button class="git-tab" data-tab="log" onclick="_gitSetTab('log')">Log</button>
        <button class="git-tab" data-tab="branches" onclick="_gitSetTab('branches')">Branches</button>
        <button class="git-tab" data-tab="stash" onclick="_gitSetTab('stash')">Stash</button>
        <button class="git-tab" data-tab="remotes" onclick="_gitSetTab('remotes')">Remotes</button>
        <button class="git-tab" data-tab="tags" onclick="_gitSetTab('tags')">Tags</button>
      </div>

      <div id="gitContent" class="git-content" style="margin-top:8px"></div>
    </div>`;

  _gitRefresh();
}

function _gitSetCwd() {
  const input = document.getElementById('gitCwdInput');
  if (input) { _gitCwd = input.value.trim(); _gitRefresh(); }
}

function _gitSetTab(tab) {
  _gitTab = tab;
  document.querySelectorAll('.git-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  _gitLoadTab();
}

async function _gitRefresh() {
  try {
    const res = await api(`/api/git/status?cwd=${encodeURIComponent(_gitCwd)}`);
    const info = document.getElementById('gitRepoInfo');
    if (!res.isRepo) {
      info.innerHTML = '<span style="color:var(--red)">Not a git repository</span>';
      document.getElementById('gitContent').innerHTML = '<div style="text-align:center;padding:60px;color:var(--dim)"><p>Not a git repository. Enter a path to a git project above.</p></div>';
      return;
    }
    let infoHtml = `<span style="color:var(--green)">${esc(res.branch)}</span>`;
    if (res.upstream) infoHtml += ` &rarr; ${esc(res.upstream)}`;
    if (res.ahead > 0) infoHtml += ` <span style="color:var(--cyan)">&uarr;${res.ahead}</span>`;
    if (res.behind > 0) infoHtml += ` <span style="color:var(--amber)">&darr;${res.behind}</span>`;
    const total = (res.staged?.length || 0) + (res.unstaged?.length || 0) + (res.untracked?.length || 0);
    if (total > 0) infoHtml += ` &middot; <span style="color:var(--amber)">${total} changes</span>`;
    info.innerHTML = infoHtml;
    _gitLoadTab();
  } catch (err) {
    document.getElementById('gitRepoInfo').innerHTML = `<span style="color:var(--red)">${esc(err.message)}</span>`;
  }
}

async function _gitLoadTab() {
  const c = document.getElementById('gitContent');
  if (!c) return;
  if (_gitTab === 'status') await _gitLoadStatus(c);
  else if (_gitTab === 'log') await _gitLoadLog(c);
  else if (_gitTab === 'branches') await _gitLoadBranches(c);
  else if (_gitTab === 'stash') await _gitLoadStash(c);
  else if (_gitTab === 'remotes') await _gitLoadRemotes(c);
  else if (_gitTab === 'tags') await _gitLoadTags(c);
}

function _gitStatusIcon(status) {
  if (status === 'modified') return '<span style="color:var(--amber)">M</span>';
  if (status === 'added') return '<span style="color:var(--green)">A</span>';
  if (status === 'deleted') return '<span style="color:var(--red)">D</span>';
  if (status === 'renamed') return '<span style="color:var(--blue)">R</span>';
  if (status === 'untracked') return '<span style="color:var(--dim)">?</span>';
  return '<span style="color:var(--dim)">?</span>';
}

async function _gitLoadStatus(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading...</div>';
  try {
    const res = await api(`/api/git/status?cwd=${encodeURIComponent(_gitCwd)}`);
    if (!res.isRepo) { c.innerHTML = '<div style="padding:20px;color:var(--dim)">Not a git repo</div>'; return; }

    const hasStagedFiles = res.staged && res.staged.length > 0;
    c.innerHTML = `
      <div class="git-status">
        ${hasStagedFiles ? `
        <div class="git-section">
          <div class="git-section-header">
            <h3>Staged Changes (${res.staged.length})</h3>
            <button onclick="_gitUnstageAll()" style="background:none;border:1px solid var(--border);color:var(--dim);border-radius:4px;padding:3px 8px;font:400 10px var(--sans);cursor:pointer">Unstage All</button>
          </div>
          <div class="git-file-list">${res.staged.map(f => `
            <div class="git-file-item">
              ${_gitStatusIcon(f.status)}
              <span class="git-file-name">${esc(f.file)}</span>
              <div class="git-file-actions">
                <button onclick="_gitUnstage('${esc(f.file)}')" title="Unstage">-</button>
                <button onclick="_gitViewDiff('${esc(f.file)}',true)" title="Diff">D</button>
              </div>
            </div>`).join('')}</div>
        </div>` : ''}

        ${res.unstaged && res.unstaged.length ? `
        <div class="git-section">
          <div class="git-section-header">
            <h3>Modified (${res.unstaged.length})</h3>
            <button onclick="_gitStageAll()" style="background:none;border:1px solid var(--border);color:var(--dim);border-radius:4px;padding:3px 8px;font:400 10px var(--sans);cursor:pointer">Stage All</button>
          </div>
          <div class="git-file-list">${res.unstaged.map(f => `
            <div class="git-file-item">
              ${_gitStatusIcon(f.status)}
              <span class="git-file-name">${esc(f.file)}</span>
              <div class="git-file-actions">
                <button onclick="_gitStage('${esc(f.file)}')" title="Stage">+</button>
                <button onclick="_gitViewDiff('${esc(f.file)}',false)" title="Diff">D</button>
                <button onclick="_gitDiscard('${esc(f.file)}')" title="Discard" style="color:var(--red)">X</button>
              </div>
            </div>`).join('')}</div>
        </div>` : ''}

        ${res.untracked && res.untracked.length ? `
        <div class="git-section">
          <div class="git-section-header"><h3>Untracked (${res.untracked.length})</h3></div>
          <div class="git-file-list">${res.untracked.map(f => `
            <div class="git-file-item">
              ${_gitStatusIcon('untracked')}
              <span class="git-file-name">${esc(f.file)}</span>
              <div class="git-file-actions">
                <button onclick="_gitStage('${esc(f.file)}')" title="Stage">+</button>
              </div>
            </div>`).join('')}</div>
        </div>` : ''}

        ${!hasStagedFiles && !res.unstaged?.length && !res.untracked?.length ?
          '<div style="text-align:center;padding:40px;color:var(--dim)">Working tree clean</div>' : ''}

        ${hasStagedFiles ? `
        <div class="git-commit-box">
          <textarea id="gitCommitMsg" placeholder="Commit message..." style="width:100%;min-height:60px;resize:vertical;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font:400 13px var(--mono);outline:none;box-sizing:border-box"></textarea>
          <button onclick="_gitCommit()" style="background:var(--green);color:#000;border:none;border-radius:6px;padding:8px 16px;font:600 12px var(--sans);cursor:pointer;margin-top:8px">Commit</button>
        </div>` : ''}
      </div>

      <div id="gitDiffView" style="display:none;margin-top:16px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <button onclick="document.getElementById('gitDiffView').style.display='none'" style="background:none;border:none;color:var(--dim);cursor:pointer;font:500 12px var(--sans)">&times; Close diff</button>
          <span id="gitDiffFile" style="font:500 12px var(--mono);color:var(--green)"></span>
        </div>
        <pre id="gitDiffContent" class="git-diff-pre"></pre>
      </div>`;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

async function _gitStage(file) {
  try { await api('/api/git/stage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd, file }) }); _gitRefresh(); } catch (err) { notify(err.message, 'error'); }
}
async function _gitStageAll() {
  try { await api('/api/git/stage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd }) }); _gitRefresh(); } catch (err) { notify(err.message, 'error'); }
}
async function _gitUnstage(file) {
  try { await api('/api/git/unstage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd, file }) }); _gitRefresh(); } catch (err) { notify(err.message, 'error'); }
}
async function _gitUnstageAll() {
  try { await api('/api/git/unstage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd }) }); _gitRefresh(); } catch (err) { notify(err.message, 'error'); }
}
async function _gitDiscard(file) {
  if (!confirm(`Discard changes to ${file}? This cannot be undone.`)) return;
  try { await api('/api/git/discard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd, file }) }); _gitRefresh(); } catch (err) { notify(err.message, 'error'); }
}

async function _gitViewDiff(file, staged) {
  try {
    const res = await api(`/api/git/diff?cwd=${encodeURIComponent(_gitCwd)}&file=${encodeURIComponent(file)}&staged=${staged}`);
    const view = document.getElementById('gitDiffView');
    const content = document.getElementById('gitDiffContent');
    const fname = document.getElementById('gitDiffFile');
    if (view && content) {
      view.style.display = 'block';
      fname.textContent = file;
      content.innerHTML = _gitColorDiff(res.diff || '(no diff)');
    }
  } catch (err) { notify(err.message, 'error'); }
}

function _gitColorDiff(diff) {
  return diff.split('\n').map(line => {
    if (line.startsWith('+') && !line.startsWith('+++')) return `<span style="color:var(--green)">${esc(line)}</span>`;
    if (line.startsWith('-') && !line.startsWith('---')) return `<span style="color:var(--red)">${esc(line)}</span>`;
    if (line.startsWith('@@')) return `<span style="color:var(--cyan)">${esc(line)}</span>`;
    if (line.startsWith('diff ') || line.startsWith('index ')) return `<span style="color:var(--dim)">${esc(line)}</span>`;
    return esc(line);
  }).join('\n');
}

async function _gitCommit() {
  const msg = document.getElementById('gitCommitMsg');
  if (!msg || !msg.value.trim()) return notify('Commit message required', 'error');
  try {
    await api('/api/git/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd, message: msg.value.trim() }) });
    notify('Committed successfully');
    _gitRefresh();
  } catch (err) { notify(err.message, 'error'); }
}

async function _gitLoadLog(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading log...</div>';
  try {
    const log = await api(`/api/git/log?cwd=${encodeURIComponent(_gitCwd)}&limit=50`);
    if (log.length === 0) { c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No commits</div>'; return; }
    c.innerHTML = `
      <div class="git-log-list">
        ${log.map(entry => `
          <div class="git-log-entry" onclick="_gitShowCommit('${esc(entry.hash)}')">
            <div class="git-log-graph">
              <span class="git-log-dot" style="background:${entry.refs.length ? 'var(--green)' : 'var(--dim)'}"></span>
            </div>
            <div class="git-log-info">
              <div class="git-log-subject">${esc(entry.subject)}</div>
              <div class="git-log-meta">
                <span style="color:var(--cyan)">${esc(entry.short)}</span>
                <span>${esc(entry.author)}</span>
                <span>${esc((entry.date || '').slice(0, 10))}</span>
                ${entry.refs.map(r => `<span class="git-ref-badge">${esc(r)}</span>`).join('')}
              </div>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (err) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`; }
}

async function _gitShowCommit(hash) {
  const c = document.getElementById('gitContent');
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading commit...</div>';
  try {
    const [detail, diffRes] = await Promise.all([
      api(`/api/git/commit/${hash}?cwd=${encodeURIComponent(_gitCwd)}`),
      api(`/api/git/diff?cwd=${encodeURIComponent(_gitCwd)}&commit=${hash}`),
    ]);
    c.innerHTML = `
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <button onclick="_gitSetTab('log')" style="background:none;border:none;color:var(--dim);cursor:pointer;font:500 12px var(--sans)">&larr; Back</button>
          <span style="font:600 13px var(--mono);color:var(--cyan)">${esc(detail.short)}</span>
        </div>
        <div style="margin-bottom:12px">
          <div style="font:600 15px var(--sans);color:var(--text);margin-bottom:4px">${esc(detail.subject)}</div>
          ${detail.body ? `<div style="font:400 12px var(--sans);color:var(--dim);margin-bottom:8px;white-space:pre-wrap">${esc(detail.body)}</div>` : ''}
          <div style="font:400 11px var(--sans);color:var(--dim)">${esc(detail.author)} &lt;${esc(detail.authorEmail)}&gt; &middot; ${esc(detail.authorDate || '')}</div>
          ${detail.stats.length ? `<div style="font:400 11px var(--mono);color:var(--dim);margin-top:8px">${detail.stats.map(s => esc(s)).join('<br>')}</div>` : ''}
        </div>
        <pre class="git-diff-pre">${_gitColorDiff(diffRes.diff || '(no diff)')}</pre>
      </div>`;
  } catch (err) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`; }
}

async function _gitLoadBranches(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading branches...</div>';
  try {
    const branches = await api(`/api/git/branches?cwd=${encodeURIComponent(_gitCwd)}`);
    const local = branches.filter(b => !b.remote);
    const remote = branches.filter(b => b.remote);
    c.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;justify-content:flex-end">
        <button onclick="_gitCreateBranch()" style="background:var(--green2);color:var(--green);border:1px solid rgba(218,119,86,0.2);border-radius:10px;padding:6px 12px;font:500 12px var(--sans);cursor:pointer">New Branch</button>
      </div>
      <div class="git-section"><div class="git-section-header"><h3>Local (${local.length})</h3></div>
        <div class="git-file-list">${local.map(b => `
          <div class="git-file-item">
            <span style="color:${b.current ? 'var(--green)' : 'var(--text)'};font:500 12px var(--mono)">${b.current ? '* ' : ''}${esc(b.name)}</span>
            <span style="font:400 10px var(--mono);color:var(--dim)">${esc(b.hash)}</span>
            ${b.upstream ? `<span style="font:400 10px var(--sans);color:var(--dim)">&rarr; ${esc(b.upstream)}</span>` : ''}
            <div class="git-file-actions">
              ${!b.current ? `<button onclick="_gitCheckout('${esc(b.name)}')" style="color:var(--green)">Checkout</button>` : ''}
              ${!b.current ? `<button onclick="_gitMerge('${esc(b.name)}')" style="color:var(--cyan)">Merge</button>` : ''}
              ${!b.current ? `<button onclick="_gitDeleteBranch('${esc(b.name)}')" style="color:var(--red)">Del</button>` : ''}
            </div>
          </div>`).join('')}</div>
      </div>
      ${remote.length ? `
      <div class="git-section" style="margin-top:12px"><div class="git-section-header"><h3>Remote (${remote.length})</h3></div>
        <div class="git-file-list">${remote.map(b => `
          <div class="git-file-item">
            <span style="font:400 12px var(--mono);color:var(--dim)">${esc(b.name)}</span>
            <span style="font:400 10px var(--mono);color:var(--dim)">${esc(b.hash)}</span>
          </div>`).join('')}</div>
      </div>` : ''}`;
  } catch (err) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`; }
}

async function _gitCreateBranch() {
  const name = prompt('Branch name:');
  if (!name) return;
  try { await api('/api/git/branches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd, name }) }); notify('Branch created'); _gitLoadTab(); } catch (err) { notify(err.message, 'error'); }
}
async function _gitCheckout(name) {
  try { await api('/api/git/branches/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd, name }) }); notify(`Checked out ${name}`); _gitRefresh(); } catch (err) { notify(err.message, 'error'); }
}
async function _gitMerge(name) {
  if (!confirm(`Merge ${name} into current branch?`)) return;
  try { const r = await api('/api/git/branches/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd, name }) }); notify('Merged'); _gitRefresh(); } catch (err) { notify(err.message, 'error'); }
}
async function _gitDeleteBranch(name) {
  if (!confirm(`Delete branch ${name}?`)) return;
  try { await api(`/api/git/branches/${encodeURIComponent(name)}?cwd=${encodeURIComponent(_gitCwd)}`, { method: 'DELETE' }); notify('Branch deleted'); _gitLoadTab(); } catch (err) { notify(err.message, 'error'); }
}

async function _gitLoadStash(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading stashes...</div>';
  try {
    const stashes = await api(`/api/git/stash?cwd=${encodeURIComponent(_gitCwd)}`);
    c.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;justify-content:flex-end">
        <button onclick="_gitStashPush()" style="background:var(--green2);color:var(--green);border:1px solid rgba(218,119,86,0.2);border-radius:10px;padding:6px 12px;font:500 12px var(--sans);cursor:pointer">Stash Changes</button>
      </div>
      ${stashes.length === 0 ? '<div style="padding:40px;text-align:center;color:var(--dim)">No stashes</div>' : `
      <div class="dock-list">${stashes.map((s, i) => `
        <div class="dock-item">
          <div class="dock-item-header">
            <span style="font:500 12px var(--mono);color:var(--amber)">${esc(s.ref)}</span>
            <span style="font:400 12px var(--sans);color:var(--text);flex:1">${esc(s.message)}</span>
            <span style="font:400 10px var(--sans);color:var(--dim)">${esc((s.date || '').slice(0, 10))}</span>
            <div class="dock-item-actions">
              <button onclick="_gitStashPop(${i})" style="color:var(--green)">Pop</button>
              <button onclick="_gitStashDrop(${i})" style="color:var(--red)">Drop</button>
            </div>
          </div>
        </div>`).join('')}</div>`}`;
  } catch (err) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`; }
}

async function _gitStashPush() {
  const msg = prompt('Stash message (optional):');
  try { await api('/api/git/stash/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd, message: msg || '' }) }); notify('Changes stashed'); _gitRefresh(); } catch (err) { notify(err.message, 'error'); }
}
async function _gitStashPop(index) {
  try { await api('/api/git/stash/pop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd, index }) }); notify('Stash popped'); _gitRefresh(); } catch (err) { notify(err.message, 'error'); }
}
async function _gitStashDrop(index) {
  if (!confirm('Drop this stash?')) return;
  try { await api(`/api/git/stash/${index}?cwd=${encodeURIComponent(_gitCwd)}`, { method: 'DELETE' }); notify('Stash dropped'); _gitLoadTab(); } catch (err) { notify(err.message, 'error'); }
}

async function _gitLoadRemotes(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading remotes...</div>';
  try {
    const remotes = await api(`/api/git/remotes?cwd=${encodeURIComponent(_gitCwd)}`);
    c.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px;justify-content:flex-end">
        <button onclick="_gitFetch()" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font:400 12px var(--sans);cursor:pointer">Fetch</button>
        <button onclick="_gitPull()" style="background:var(--blue);color:#fff;border:none;border-radius:6px;padding:6px 12px;font:500 12px var(--sans);cursor:pointer">Pull</button>
        <button onclick="_gitPush()" style="background:var(--green);color:#000;border:none;border-radius:6px;padding:6px 12px;font:500 12px var(--sans);cursor:pointer">Push</button>
      </div>
      ${remotes.length === 0 ? '<div style="padding:40px;text-align:center;color:var(--dim)">No remotes configured</div>' : `
      <div class="dock-list">${remotes.map(r => `
        <div class="dock-item">
          <div class="dock-item-header">
            <span class="dock-item-name">${esc(r.name)}</span>
            <span style="font:400 11px var(--mono);color:var(--dim);flex:1;overflow:hidden;text-overflow:ellipsis">${esc(r.fetchUrl)}</span>
          </div>
        </div>`).join('')}</div>`}`;
  } catch (err) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`; }
}

async function _gitFetch() { try { await api('/api/git/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd }) }); notify('Fetched'); } catch (err) { notify(err.message, 'error'); } }
async function _gitPull() { try { await api('/api/git/pull', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd }) }); notify('Pulled'); _gitRefresh(); } catch (err) { notify(err.message, 'error'); } }
async function _gitPush() { try { await api('/api/git/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cwd: _gitCwd }) }); notify('Pushed'); _gitRefresh(); } catch (err) { notify(err.message, 'error'); } }

async function _gitLoadTags(c) {
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading tags...</div>';
  try {
    const tags = await api(`/api/git/tags?cwd=${encodeURIComponent(_gitCwd)}`);
    if (tags.length === 0) { c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No tags</div>'; return; }
    c.innerHTML = `<div class="dock-list">${tags.map(t => `
      <div class="dock-item">
        <div class="dock-item-header">
          <span style="font:600 12px var(--mono);color:var(--amber)">${esc(t.name)}</span>
          <span style="font:400 10px var(--mono);color:var(--dim)">${esc(t.hash)}</span>
          <span style="font:400 10px var(--sans);color:var(--dim)">${esc((t.date || '').slice(0, 10))}</span>
        </div>
      </div>`).join('')}</div>`;
  } catch (err) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`; }
}

// ═══════════════════════════════════════════════════════════════
// LOG VIEWER
// ═══════════════════════════════════════════════════════════════

let _logCurrentFile = '';

async function loadLogViewer() {
  const m = document.getElementById('main');
  m.innerHTML = `
    <div class="log-page">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
          <h1 style="font:700 22px var(--sans);margin:0">Log Viewer</h1>
          <p style="font:400 12px var(--sans);color:var(--dim);margin:4px 0 0">Tail, search, and filter log files in real-time</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="logFileInput" type="text" value="${esc(_logCurrentFile)}" placeholder="/var/log/system.log" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font:400 12px var(--mono);width:300px" onkeydown="if(event.key==='Enter')_logOpenFile()">
          <button onclick="_logOpenFile()" style="background:var(--green2);color:var(--green);border:1px solid rgba(218,119,86,0.2);border-radius:10px;padding:6px 12px;font:500 12px var(--sans);cursor:pointer">Open</button>
          <button onclick="_logDiscover()" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 12px;font:400 12px var(--sans);cursor:pointer">Discover...</button>
        </div>
      </div>

      <div id="logToolbar" style="display:none;display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap">
        <input id="logSearch" type="text" placeholder="Search..." style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font:400 12px var(--mono);width:200px" onkeydown="if(event.key==='Enter')_logReload()">
        <select id="logLevel" onchange="_logReload()" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font:400 11px var(--sans)">
          <option value="">All Levels</option>
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
        <select id="logLines" onchange="_logReload()" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font:400 11px var(--sans)">
          <option value="100">100 lines</option>
          <option value="200" selected>200 lines</option>
          <option value="500">500 lines</option>
          <option value="1000">1000 lines</option>
        </select>
        <span id="logInfo" style="font:400 11px var(--mono);color:var(--dim);margin-left:auto"></span>
      </div>

      <div id="logContent">
        <div style="text-align:center;padding:60px 20px;color:var(--dim)">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:0.4"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
          <p style="font:500 14px var(--sans)">Open a log file or discover log files</p>
          <p style="font:400 12px var(--sans);margin-top:4px">Enter a file path above, or click Discover to find log files.</p>
        </div>
      </div>
    </div>`;
}

function _logOpenFile() {
  const input = document.getElementById('logFileInput');
  if (!input || !input.value.trim()) return;
  _logCurrentFile = input.value.trim();
  _logReload();
}

async function _logReload() {
  if (!_logCurrentFile) return;
  const c = document.getElementById('logContent');
  const toolbar = document.getElementById('logToolbar');
  toolbar.style.display = 'flex';

  const search = document.getElementById('logSearch')?.value || '';
  const level = document.getElementById('logLevel')?.value || '';
  const lines = document.getElementById('logLines')?.value || '200';

  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading...</div>';
  try {
    let url = `/api/logs/read?path=${encodeURIComponent(_logCurrentFile)}&lines=${lines}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (level) url += `&level=${encodeURIComponent(level)}`;

    const res = await api(url);
    const info = document.getElementById('logInfo');
    if (info) info.textContent = `${res.returnedLines} lines | ${_logFormatSize(res.size)} | ${new Date(res.modified).toLocaleString()}`;

    c.innerHTML = `<pre class="log-output" id="logOutput">${res.lines.map(l =>
      `<span class="log-line log-${l.level}">${esc(l.text)}</span>`
    ).join('\n')}</pre>`;

    // Auto-scroll to bottom
    const output = document.getElementById('logOutput');
    if (output) output.scrollTop = output.scrollHeight;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

function _logFormatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${units[i]}`;
}

async function _logDiscover() {
  const dir = prompt('Directory to search:', '/var/log');
  if (!dir) return;
  const c = document.getElementById('logContent');
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Searching for log files...</div>';
  try {
    const files = await api(`/api/logs/discover?dir=${encodeURIComponent(dir)}`);
    if (files.length === 0) {
      c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No log files found</div>';
      return;
    }
    c.innerHTML = `<div class="dock-list">${files.map(f => `
      <div class="dock-item" onclick="_logSelectFile('${esc(f.path)}')" style="cursor:pointer">
        <div class="dock-item-header">
          <span class="dock-item-name">${esc(f.name)}</span>
          <span style="font:400 10px var(--mono);color:var(--dim)">${_logFormatSize(f.size)}</span>
          <span style="font:400 10px var(--sans);color:var(--dim)">${new Date(f.modified).toLocaleString()}</span>
        </div>
        <div style="font:400 10px var(--mono);color:var(--dim);margin-top:2px">${esc(f.path)}</div>
      </div>
    `).join('')}</div>`;
  } catch (err) {
    c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(err.message)}</div>`;
  }
}

function _logSelectFile(filePath) {
  _logCurrentFile = filePath;
  const input = document.getElementById('logFileInput');
  if (input) input.value = filePath;
  _logReload();
}

// ═══════════════════════════════════════════════════════════════
// DEV TOOLKIT
// ═══════════════════════════════════════════════════════════════

let _tkCurrentTool = 'json';

function loadToolkit() {
  const tools = [
    { id: 'json', icon: '{ }', label: 'JSON' },
    { id: 'regex', icon: '.*', label: 'Regex' },
    { id: 'hash', icon: '#', label: 'Hash' },
    { id: 'base64', icon: 'B64', label: 'Base64' },
    { id: 'url', icon: '%', label: 'URL Encode' },
    { id: 'diff', icon: '±', label: 'Diff' },
    { id: 'jwt', icon: 'JWT', label: 'JWT' },
    { id: 'timestamp', icon: '⏱', label: 'Timestamp' },
    { id: 'uuid', icon: 'ID', label: 'UUID' },
    { id: 'color', icon: '◉', label: 'Color' },
  ];
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="tk-page">
      <div class="tk-toolbar">
        ${tools.map(t => `<button class="tk-tool-btn${t.id === _tkCurrentTool ? ' active' : ''}" data-tool="${t.id}" onclick="_tkSet('${t.id}')">
          <span class="tk-tool-icon">${t.icon}</span><span class="tk-tool-label">${t.label}</span>
        </button>`).join('')}
      </div>
      <div id="tkContent" class="tk-content"></div>
    </div>`;
  _tkLoad();
}

function _tkSet(tool) {
  _tkCurrentTool = tool;
  document.querySelectorAll('.tk-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  _tkLoad();
}

function _tkLoad() {
  const loaderMap = {
    json: _tkJson, regex: _tkRegex, hash: _tkHash, base64: _tkBase64,
    url: _tkUrl, diff: _tkDiff, jwt: _tkJwt, timestamp: _tkTimestamp,
    uuid: _tkUuid, color: _tkColor,
  };
  (loaderMap[_tkCurrentTool] || _tkJson)();
}

function _tkJson() {
  const c = document.getElementById('tkContent');
  c.innerHTML = `
    <div class="tk-panel">
      <div class="tk-panel-title">JSON Formatter / Validator</div>
      <textarea id="tkJsonIn" class="tk-input" rows="10" placeholder="Paste JSON here..."></textarea>
      <div class="tk-actions">
        <button class="tk-btn" onclick="_tkJsonFormat()">Format</button>
        <button class="tk-btn" onclick="_tkJsonMinify()">Minify</button>
        <button class="tk-btn" onclick="_tkJsonValidate()">Validate</button>
      </div>
      <pre id="tkJsonOut" class="tk-output"></pre>
    </div>`;
}

async function _tkJsonFormat() {
  const input = document.getElementById('tkJsonIn').value;
  try {
    const r = await api('/api/toolkit/json/format', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ input }) });
    document.getElementById('tkJsonOut').textContent = r.result;
  } catch (e) { document.getElementById('tkJsonOut').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
}

async function _tkJsonMinify() {
  const input = document.getElementById('tkJsonIn').value;
  try {
    const r = await api('/api/toolkit/json/minify', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ input }) });
    document.getElementById('tkJsonOut').textContent = r.result;
  } catch (e) { document.getElementById('tkJsonOut').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
}

async function _tkJsonValidate() {
  const input = document.getElementById('tkJsonIn').value;
  const r = await api('/api/toolkit/json/validate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ input }) });
  const out = document.getElementById('tkJsonOut');
  out.innerHTML = r.valid
    ? '<span style="color:var(--green)">✓ Valid JSON</span>'
    : `<span style="color:var(--red)">✗ Invalid — ${esc(r.error)}</span>`;
}

function _tkRegex() {
  const c = document.getElementById('tkContent');
  c.innerHTML = `
    <div class="tk-panel">
      <div class="tk-panel-title">Regex Tester</div>
      <div class="tk-row">
        <input id="tkRegexPattern" class="tk-field" placeholder="Pattern (e.g. \\d+)" style="flex:1">
        <input id="tkRegexFlags" class="tk-field" placeholder="Flags" value="g" style="width:60px">
      </div>
      <textarea id="tkRegexInput" class="tk-input" rows="4" placeholder="Test string..."></textarea>
      <button class="tk-btn" onclick="_tkRegexTest()">Test</button>
      <pre id="tkRegexOut" class="tk-output"></pre>
    </div>`;
}

async function _tkRegexTest() {
  const pattern = document.getElementById('tkRegexPattern').value;
  const flags = document.getElementById('tkRegexFlags').value;
  const testString = document.getElementById('tkRegexInput').value;
  const r = await api('/api/toolkit/regex', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ pattern, flags, testString }) });
  const out = document.getElementById('tkRegexOut');
  if (!r.valid) { out.innerHTML = `<span style="color:var(--red)">Error: ${esc(r.error)}</span>`; return; }
  if (r.matchCount === 0) { out.innerHTML = '<span style="color:var(--dim)">No matches</span>'; return; }
  out.innerHTML = `<span style="color:var(--green)">${r.matchCount} match${r.matchCount > 1 ? 'es' : ''}</span>\n` +
    r.matches.map((m, i) => `  [${i}] "${esc(m.match)}" at index ${m.index}${m.groups.length ? ` groups: [${m.groups.map(g => `"${esc(g)}"`).join(', ')}]` : ''}`).join('\n');
}

function _tkHash() {
  const c = document.getElementById('tkContent');
  c.innerHTML = `
    <div class="tk-panel">
      <div class="tk-panel-title">Hash Generator</div>
      <textarea id="tkHashIn" class="tk-input" rows="4" placeholder="Text to hash..."></textarea>
      <div class="tk-actions">
        <button class="tk-btn" onclick="_tkHashGen('md5')">MD5</button>
        <button class="tk-btn" onclick="_tkHashGen('sha1')">SHA1</button>
        <button class="tk-btn" onclick="_tkHashGen('sha256')">SHA256</button>
        <button class="tk-btn" onclick="_tkHashGen('sha512')">SHA512</button>
        <button class="tk-btn" onclick="_tkHashGen('all')">All</button>
      </div>
      <pre id="tkHashOut" class="tk-output"></pre>
    </div>`;
}

async function _tkHashGen(algo) {
  const input = document.getElementById('tkHashIn').value;
  const r = await api('/api/toolkit/hash', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ input, algorithm: algo }) });
  const out = document.getElementById('tkHashOut');
  if (algo === 'all') {
    out.textContent = Object.entries(r).map(([k, v]) => `${k.toUpperCase().padEnd(7)} ${v}`).join('\n');
  } else {
    out.textContent = r.hash;
  }
}

function _tkBase64() {
  const c = document.getElementById('tkContent');
  c.innerHTML = `
    <div class="tk-panel">
      <div class="tk-panel-title">Base64 Encoder / Decoder</div>
      <textarea id="tkB64In" class="tk-input" rows="4" placeholder="Text or Base64 string..."></textarea>
      <div class="tk-actions">
        <button class="tk-btn" onclick="_tkB64('encode')">Encode</button>
        <button class="tk-btn" onclick="_tkB64('decode')">Decode</button>
      </div>
      <pre id="tkB64Out" class="tk-output"></pre>
    </div>`;
}

async function _tkB64(mode) {
  const input = document.getElementById('tkB64In').value;
  try {
    const r = await api(`/api/toolkit/base64/${mode}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ input }) });
    document.getElementById('tkB64Out').textContent = r.result;
  } catch (e) { document.getElementById('tkB64Out').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
}

function _tkUrl() {
  const c = document.getElementById('tkContent');
  c.innerHTML = `
    <div class="tk-panel">
      <div class="tk-panel-title">URL Encoder / Decoder</div>
      <textarea id="tkUrlIn" class="tk-input" rows="4" placeholder="URL or encoded string..."></textarea>
      <div class="tk-actions">
        <button class="tk-btn" onclick="_tkUrlConvert('encode')">Encode</button>
        <button class="tk-btn" onclick="_tkUrlConvert('decode')">Decode</button>
      </div>
      <pre id="tkUrlOut" class="tk-output"></pre>
    </div>`;
}

async function _tkUrlConvert(mode) {
  const input = document.getElementById('tkUrlIn').value;
  try {
    const r = await api(`/api/toolkit/url/${mode}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ input }) });
    document.getElementById('tkUrlOut').textContent = r.result;
  } catch (e) { document.getElementById('tkUrlOut').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
}

function _tkDiff() {
  const c = document.getElementById('tkContent');
  c.innerHTML = `
    <div class="tk-panel">
      <div class="tk-panel-title">Text Diff</div>
      <div class="tk-row" style="gap:12px">
        <textarea id="tkDiff1" class="tk-input" rows="8" placeholder="Original text..." style="flex:1"></textarea>
        <textarea id="tkDiff2" class="tk-input" rows="8" placeholder="Modified text..." style="flex:1"></textarea>
      </div>
      <button class="tk-btn" onclick="_tkDiffRun()">Compare</button>
      <div id="tkDiffOut" class="tk-output" style="white-space:pre-wrap"></div>
    </div>`;
}

async function _tkDiffRun() {
  const text1 = document.getElementById('tkDiff1').value;
  const text2 = document.getElementById('tkDiff2').value;
  const r = await api('/api/toolkit/diff', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text1, text2 }) });
  const out = document.getElementById('tkDiffOut');
  const lines = r.diff.map(d => {
    const prefix = d.type === 'add' ? '+' : d.type === 'remove' ? '-' : ' ';
    const color = d.type === 'add' ? 'var(--green)' : d.type === 'remove' ? 'var(--red)' : 'var(--dim)';
    return `<span style="color:${color}">${prefix} ${esc(d.line)}</span>`;
  }).join('\n');
  out.innerHTML = `<div style="margin-bottom:8px;color:var(--text)">+${r.stats.added} added, -${r.stats.removed} removed, ${r.stats.unchanged} unchanged</div>${lines}`;
}

function _tkJwt() {
  const c = document.getElementById('tkContent');
  c.innerHTML = `
    <div class="tk-panel">
      <div class="tk-panel-title">JWT Decoder</div>
      <textarea id="tkJwtIn" class="tk-input" rows="4" placeholder="Paste JWT token..."></textarea>
      <button class="tk-btn" onclick="_tkJwtDecode()">Decode</button>
      <pre id="tkJwtOut" class="tk-output"></pre>
    </div>`;
}

async function _tkJwtDecode() {
  const token = document.getElementById('tkJwtIn').value;
  try {
    const r = await api('/api/toolkit/jwt/decode', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ token }) });
    document.getElementById('tkJwtOut').textContent = `Header:\n${JSON.stringify(r.header, null, 2)}\n\nPayload:\n${JSON.stringify(r.payload, null, 2)}\n\nSignature:\n${r.signature}`;
  } catch (e) { document.getElementById('tkJwtOut').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
}

function _tkTimestamp() {
  const c = document.getElementById('tkContent');
  c.innerHTML = `
    <div class="tk-panel">
      <div class="tk-panel-title">Timestamp Converter</div>
      <div class="tk-row">
        <input id="tkTsIn" class="tk-field" placeholder="Unix timestamp or date string" style="flex:1">
        <button class="tk-btn" onclick="_tkTsConvert()">Convert</button>
        <button class="tk-btn" onclick="_tkTsNow()">Now</button>
      </div>
      <pre id="tkTsOut" class="tk-output"></pre>
    </div>`;
}

async function _tkTsConvert() {
  const val = document.getElementById('tkTsIn').value.trim();
  const body = /^\d+$/.test(val) ? { timestamp: val } : { dateStr: val };
  try {
    const r = await api('/api/toolkit/timestamp', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    document.getElementById('tkTsOut').textContent = Object.entries(r).map(([k, v]) => `${k.padEnd(8)} ${v}`).join('\n');
  } catch (e) { document.getElementById('tkTsOut').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
}

async function _tkTsNow() {
  const r = await api('/api/toolkit/timestamp', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({}) });
  document.getElementById('tkTsOut').textContent = Object.entries(r).map(([k, v]) => `${k.padEnd(8)} ${v}`).join('\n');
}

function _tkUuid() {
  const c = document.getElementById('tkContent');
  c.innerHTML = `
    <div class="tk-panel">
      <div class="tk-panel-title">UUID Generator</div>
      <div class="tk-actions">
        <button class="tk-btn" onclick="_tkUuidGen(1)">Generate 1</button>
        <button class="tk-btn" onclick="_tkUuidGen(5)">Generate 5</button>
        <button class="tk-btn" onclick="_tkUuidGen(10)">Generate 10</button>
      </div>
      <pre id="tkUuidOut" class="tk-output"></pre>
    </div>`;
}

async function _tkUuidGen(count) {
  const uuids = [];
  for (let i = 0; i < count; i++) {
    const r = await api('/api/toolkit/uuid');
    uuids.push(r.uuid);
  }
  document.getElementById('tkUuidOut').textContent = uuids.join('\n');
}

function _tkColor() {
  const c = document.getElementById('tkContent');
  c.innerHTML = `
    <div class="tk-panel">
      <div class="tk-panel-title">Color Converter</div>
      <div class="tk-row">
        <input id="tkColorHex" class="tk-field" placeholder="#ff0000" style="flex:1">
        <button class="tk-btn" onclick="_tkColorFromHex()">Hex → RGB</button>
      </div>
      <div class="tk-row" style="margin-top:8px">
        <input id="tkColorR" class="tk-field" placeholder="R" style="width:60px" type="number" min="0" max="255">
        <input id="tkColorG" class="tk-field" placeholder="G" style="width:60px" type="number" min="0" max="255">
        <input id="tkColorB" class="tk-field" placeholder="B" style="width:60px" type="number" min="0" max="255">
        <button class="tk-btn" onclick="_tkColorFromRgb()">RGB → Hex</button>
      </div>
      <div id="tkColorOut" class="tk-output" style="display:flex;align-items:center;gap:16px">
        <div id="tkColorSwatch" style="width:48px;height:48px;border-radius:8px;border:1px solid var(--border)"></div>
        <pre id="tkColorText" style="margin:0"></pre>
      </div>
    </div>`;
}

async function _tkColorFromHex() {
  const hex = document.getElementById('tkColorHex').value;
  try {
    const r = await api('/api/toolkit/color', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ hex }) });
    document.getElementById('tkColorSwatch').style.background = r.css;
    document.getElementById('tkColorText').textContent = `R: ${r.r}  G: ${r.g}  B: ${r.b}\n${r.css}`;
  } catch (e) { document.getElementById('tkColorText').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
}

async function _tkColorFromRgb() {
  const r = document.getElementById('tkColorR').value;
  const g = document.getElementById('tkColorG').value;
  const b = document.getElementById('tkColorB').value;
  try {
    const res = await api('/api/toolkit/color', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ r, g, b }) });
    document.getElementById('tkColorSwatch').style.background = `rgb(${r},${g},${b})`;
    document.getElementById('tkColorText').textContent = `Hex: ${res.hex}\nrgb(${r}, ${g}, ${b})`;
  } catch (e) { document.getElementById('tkColorText').innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
}

// ═══════════════════════════════════════════════════════════════
// SNIPPET MANAGER
// ═══════════════════════════════════════════════════════════════

let _snipData = [];

async function loadSnippets() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="snip-page">
      <div class="snip-header">
        <h2 style="margin:0;font:600 18px var(--sans);color:var(--text)">Snippets</h2>
        <div class="snip-actions">
          <input id="snipSearch" class="snip-field" placeholder="Search..." oninput="_snipReload()">
          <button class="snip-btn snip-btn-primary" onclick="_snipNew()">+ New</button>
        </div>
      </div>
      <div id="snipList" class="snip-list"><div style="padding:40px;text-align:center;color:var(--dim)">Loading...</div></div>
      <div id="snipEditor" class="snip-editor" style="display:none"></div>
    </div>`;
  _snipReload();
}

async function _snipReload() {
  const search = document.getElementById('snipSearch')?.value || '';
  const list = document.getElementById('snipList');
  try { _snipData = await api(`/api/snippets?search=${encodeURIComponent(search)}`); } catch (e) { _snipData = []; if (list) list.innerHTML = `<div style="padding:40px;text-align:center;color:var(--red)">${esc(e.message)}</div>`; return; }
  if (_snipData.length === 0) {
    list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No snippets yet. Click "+ New" to create one.</div>';
    return;
  }
  list.innerHTML = _snipData.map(s => `
    <div class="snip-item" onclick="_snipEdit('${s.id}')">
      <div class="snip-item-header">
        <span class="snip-item-name">${esc(s.name)}</span>
        <span class="snip-lang-badge">${esc(s.language)}</span>
      </div>
      <div class="snip-item-tags">${(s.tags || []).map(t => `<span class="snip-tag">${esc(t)}</span>`).join('')}</div>
      <pre class="snip-preview">${esc((s.code || '').slice(0, 200))}</pre>
    </div>
  `).join('');
}

function _snipNew() {
  _snipShowEditor({ id: null, name: '', code: '', language: 'javascript', tags: [] });
}

function _snipEdit(id) {
  const s = _snipData.find(x => x.id === id);
  if (s) _snipShowEditor(s);
}

function _snipShowEditor(s) {
  const editor = document.getElementById('snipEditor');
  editor.style.display = 'block';
  editor.innerHTML = `
    <div class="snip-editor-header">
      <input id="snipName" class="snip-field" value="${esc(s.name)}" placeholder="Snippet name...">
      <select id="snipLang" class="snip-field" style="width:140px">
        ${['javascript','typescript','python','go','rust','java','bash','sql','html','css','json','yaml','text'].map(l =>
          `<option value="${l}"${s.language === l ? ' selected' : ''}>${l}</option>`).join('')}
      </select>
      <input id="snipTags" class="snip-field" value="${(s.tags || []).join(', ')}" placeholder="Tags (comma-separated)">
    </div>
    <textarea id="snipCode" class="snip-code-input" rows="15">${esc(s.code || '')}</textarea>
    <div class="snip-editor-actions">
      <button class="snip-btn snip-btn-primary" onclick="_snipSave('${s.id || ''}')">Save</button>
      ${s.id ? `<button class="snip-btn" onclick="_snipCopy('${s.id}')">Copy</button><button class="snip-btn snip-btn-danger" onclick="_snipDelete('${s.id}')">Delete</button>` : ''}
      <button class="snip-btn" onclick="document.getElementById('snipEditor').style.display='none'">Cancel</button>
    </div>`;
}

async function _snipSave(id) {
  const body = {
    name: document.getElementById('snipName').value,
    code: document.getElementById('snipCode').value,
    language: document.getElementById('snipLang').value,
    tags: document.getElementById('snipTags').value.split(',').map(t => t.trim()).filter(Boolean),
  };
  const opts = { method: id ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) };
  await api(id ? `/api/snippets/${id}` : '/api/snippets', opts);
  document.getElementById('snipEditor').style.display = 'none';
  _snipReload();
}

async function _snipDelete(id) {
  if (!confirm('Delete this snippet?')) return;
  await api(`/api/snippets/${id}`, { method: 'DELETE' });
  document.getElementById('snipEditor').style.display = 'none';
  _snipReload();
}

function _snipCopy(id) {
  const s = _snipData.find(x => x.id === id);
  if (s) navigator.clipboard.writeText(s.code);
}

// ═══════════════════════════════════════════════════════════════
// ENV MANAGER
// ═══════════════════════════════════════════════════════════════

let _envCurrentFile = '';

function loadEnvManager() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="env-page">
      <div class="env-header">
        <h2 style="margin:0;font:600 18px var(--sans);color:var(--text)">Env Manager</h2>
        <div class="env-actions">
          <input id="envFilePath" class="env-field" value="${esc(_envCurrentFile)}" placeholder=".env file path..." style="width:300px">
          <button class="env-btn" onclick="_envLoad()">Load</button>
          <button class="env-btn" onclick="_envDiscover()">Discover</button>
          <button class="env-btn" onclick="_envCompare()">Compare</button>
        </div>
      </div>
      <div id="envContent" class="env-content">
        <div style="padding:40px;text-align:center;color:var(--dim)">Enter a .env file path and click Load, or click Discover to find .env files</div>
      </div>
    </div>`;
}

async function _envLoad() {
  const filePath = document.getElementById('envFilePath').value.trim();
  if (!filePath) return;
  _envCurrentFile = filePath;
  const c = document.getElementById('envContent');
  try {
    const entries = await api('/api/env/read', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: filePath, maskSensitive: true }) });
    const vars = entries.filter(e => e.type === 'variable');
    c.innerHTML = `
      <div style="margin-bottom:12px;color:var(--dim);font:400 11px var(--sans)">${vars.length} variables in ${esc(filePath)}</div>
      <div class="env-table">
        ${vars.map(v => `
          <div class="env-row">
            <span class="env-key">${esc(v.key)}</span>
            <span class="env-val${v.isSensitive ? ' env-sensitive' : ''}">${esc(v.displayValue || v.value || '')}</span>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:12px">
        <button class="env-btn" onclick="_envValidate()">Validate</button>
        <button class="env-btn" onclick="_envAddVar()">+ Add Variable</button>
      </div>`;
  } catch (e) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(e.message)}</div>`; }
}

async function _envDiscover() {
  const dir = prompt('Directory to search:', '.');
  if (!dir) return;
  const c = document.getElementById('envContent');
  try {
    const files = await api('/api/env/discover', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ dir }) });
    if (files.length === 0) { c.innerHTML = '<div style="padding:20px;color:var(--dim)">No .env files found</div>'; return; }
    c.innerHTML = `<div class="dock-list">${files.map(f => `
      <div class="dock-item" onclick="document.getElementById('envFilePath').value='${esc(f.path)}';_envLoad()" style="cursor:pointer">
        <div class="dock-item-header"><span class="dock-item-name">${esc(f.name)}</span></div>
        <div style="font:400 10px var(--mono);color:var(--dim)">${esc(f.path)}</div>
      </div>
    `).join('')}</div>`;
  } catch (e) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(e.message)}</div>`; }
}

async function _envCompare() {
  const file1 = prompt('First .env file:', _envCurrentFile);
  if (!file1) return;
  const file2 = prompt('Second .env file:');
  if (!file2) return;
  const c = document.getElementById('envContent');
  try {
    const result = await api('/api/env/compare', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ file1, file2 }) });
    const s = result.stats;
    c.innerHTML = `
      <div style="margin-bottom:12px;font:500 13px var(--sans);color:var(--text)">
        <span style="color:var(--green)">${s.same} same</span> · <span style="color:var(--amber)">${s.different} different</span> · <span style="color:var(--red)">${s.onlyFirst} only in first</span> · <span style="color:var(--blue,#60a5fa)">${s.onlySecond} only in second</span>
      </div>
      <div class="env-table">
        ${result.results.map(r => `
          <div class="env-row env-${r.status}">
            <span class="env-key">${esc(r.key)}</span>
            <span class="env-val">${esc(r.value1 || '—')}</span>
            <span class="env-val">${esc(r.value2 || '—')}</span>
          </div>
        `).join('')}
      </div>`;
  } catch (e) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(e.message)}</div>`; }
}

async function _envValidate() {
  const result = await api('/api/env/validate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: _envCurrentFile }) });
  alert(result.valid ? `Valid! ${result.entryCount} variables, no errors.` : `Issues found:\n${result.issues.map(i => `Line ${i.line}: ${i.message}`).join('\n')}`);
}

async function _envAddVar() {
  const key = prompt('Variable name:');
  if (!key) return;
  const value = prompt('Value:');
  await api('/api/env/set', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ path: _envCurrentFile, key, value: value || '' }) });
  _envLoad();
}

// ═══════════════════════════════════════════════════════════════
// CRON MANAGER
// ═══════════════════════════════════════════════════════════════

function loadCronManager() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="cron-page">
      <div class="cron-header">
        <h2 style="margin:0;font:600 18px var(--sans);color:var(--text)">Cron Manager</h2>
        <div style="display:flex;gap:8px">
          <button class="cron-btn" onclick="_cronRefresh()">Refresh</button>
          <button class="cron-btn cron-btn-primary" onclick="_cronShowBuilder()">+ New Job</button>
        </div>
      </div>
      <div id="cronBuilder" style="display:none"></div>
      <div id="cronList"><div style="padding:40px;text-align:center;color:var(--dim)">Loading crontab...</div></div>
      <div id="cronPreview" class="cron-preview" style="margin-top:16px"></div>
    </div>`;
  _cronRefresh();
}

async function _cronRefresh() {
  let jobs;
  const list = document.getElementById('cronList');
  try { jobs = await api('/api/cron/list'); } catch (e) { if (list) list.innerHTML = `<div style="padding:40px;text-align:center;color:var(--red)">${esc(e.message)}</div>`; return; }
  if (jobs.length === 0) {
    list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--dim)">No cron jobs found</div>';
    return;
  }
  list.innerHTML = `<div class="cron-table">
    ${jobs.filter(j => j.type === 'job').map(j => `
      <div class="cron-row">
        <span class="cron-schedule">${esc(j.schedule)}</span>
        <span class="cron-command">${esc(j.command)}</span>
        <span class="cron-desc">${esc(j.description)}</span>
        <button class="cron-btn cron-btn-sm" onclick="_cronDelete(${j.index})">×</button>
      </div>
    `).join('')}
  </div>`;
}

function _cronShowBuilder() {
  const builder = document.getElementById('cronBuilder');
  builder.style.display = 'block';
  builder.innerHTML = `
    <div class="cron-builder">
      <div class="cron-builder-title">New Cron Job</div>
      <div class="cron-builder-row">
        <div class="cron-field-group">
          <label>Minute</label><input id="cronMin" class="cron-field" value="*" style="width:60px">
        </div>
        <div class="cron-field-group">
          <label>Hour</label><input id="cronHour" class="cron-field" value="*" style="width:60px">
        </div>
        <div class="cron-field-group">
          <label>Day</label><input id="cronDay" class="cron-field" value="*" style="width:60px">
        </div>
        <div class="cron-field-group">
          <label>Month</label><input id="cronMonth" class="cron-field" value="*" style="width:60px">
        </div>
        <div class="cron-field-group">
          <label>Weekday</label><input id="cronWeek" class="cron-field" value="*" style="width:60px">
        </div>
      </div>
      <input id="cronCmd" class="cron-field" placeholder="Command to run..." style="width:100%;margin:8px 0">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <span style="color:var(--dim);font:400 11px var(--sans)">Presets:</span>
        <button class="cron-btn cron-btn-sm" onclick="_cronPreset('*/5','*','*','*','*')">5min</button>
        <button class="cron-btn cron-btn-sm" onclick="_cronPreset('0','*','*','*','*')">Hourly</button>
        <button class="cron-btn cron-btn-sm" onclick="_cronPreset('0','0','*','*','*')">Daily</button>
        <button class="cron-btn cron-btn-sm" onclick="_cronPreset('0','0','*','*','1')">Weekly</button>
        <button class="cron-btn cron-btn-sm" onclick="_cronPreset('0','0','1','*','*')">Monthly</button>
      </div>
      <div id="cronDescPreview" style="color:var(--green);font:400 12px var(--sans);margin-bottom:8px"></div>
      <div style="display:flex;gap:8px">
        <button class="cron-btn cron-btn-primary" onclick="_cronAdd()">Add Job</button>
        <button class="cron-btn" onclick="document.getElementById('cronBuilder').style.display='none'">Cancel</button>
        <button class="cron-btn" onclick="_cronDescribe()">Preview</button>
      </div>
    </div>`;
}

function _cronPreset(m,h,d,mo,w) {
  document.getElementById('cronMin').value = m;
  document.getElementById('cronHour').value = h;
  document.getElementById('cronDay').value = d;
  document.getElementById('cronMonth').value = mo;
  document.getElementById('cronWeek').value = w;
  _cronDescribe();
}

async function _cronDescribe() {
  const expr = `${document.getElementById('cronMin').value} ${document.getElementById('cronHour').value} ${document.getElementById('cronDay').value} ${document.getElementById('cronMonth').value} ${document.getElementById('cronWeek').value} cmd`;
  const r = await api('/api/cron/describe', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ expression: expr }) });
  document.getElementById('cronDescPreview').textContent = r.description;
}

async function _cronAdd() {
  const schedule = `${document.getElementById('cronMin').value} ${document.getElementById('cronHour').value} ${document.getElementById('cronDay').value} ${document.getElementById('cronMonth').value} ${document.getElementById('cronWeek').value}`;
  const command = document.getElementById('cronCmd').value;
  if (!command) return alert('Enter a command');
  try {
    await api('/api/cron/add', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ schedule, command }) });
    document.getElementById('cronBuilder').style.display = 'none';
    _cronRefresh();
  } catch (e) { alert(e.message); }
}

async function _cronDelete(index) {
  if (!confirm('Remove this cron job?')) return;
  await api(`/api/cron/${index}`, { method: 'DELETE' });
  _cronRefresh();
}

// ═══════════════════════════════════════════════════════════════
// PROCESS & PORT MANAGER
// ═══════════════════════════════════════════════════════════════

let _procTab = 'processes';

function loadProcessManager() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="proc-page">
      <div class="proc-tabs">
        <button class="proc-tab active" data-tab="processes" onclick="_procSwitchTab('processes')">Processes</button>
        <button class="proc-tab" data-tab="ports" onclick="_procSwitchTab('ports')">Ports</button>
        <button class="proc-tab" data-tab="resources" onclick="_procSwitchTab('resources')">Resources</button>
      </div>
      <div id="procContent"></div>
    </div>`;
  _procSwitchTab('processes');
}

function _procSwitchTab(tab) {
  _procTab = tab;
  document.querySelectorAll('.proc-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'processes') _procLoadProcesses();
  else if (tab === 'ports') _procLoadPorts();
  else _procLoadResources();
}

async function _procLoadProcesses() {
  const c = document.getElementById('procContent');
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading processes...</div>';
  try {
    const procs = await api('/api/processes/list?sort=cpu');
    c.innerHTML = `
      <div style="margin:12px 0;display:flex;gap:8px">
        <input id="procSearch" class="proc-field" placeholder="Search processes..." onkeydown="if(event.key==='Enter')_procSearch()">
        <button class="proc-btn" onclick="_procSearch()">Search</button>
      </div>
      <div class="proc-table">
        <div class="proc-header-row">
          <span style="width:60px">PID</span><span style="width:60px">CPU%</span><span style="width:60px">MEM%</span><span style="width:60px">USER</span><span style="flex:1">COMMAND</span><span style="width:40px"></span>
        </div>
        ${procs.slice(0, 30).map(p => `
          <div class="proc-row">
            <span style="width:60px">${p.pid}</span>
            <span style="width:60px;color:${p.cpu > 50 ? 'var(--red)' : p.cpu > 20 ? 'var(--amber)' : 'var(--text)'}">${p.cpu.toFixed(1)}</span>
            <span style="width:60px">${p.mem.toFixed(1)}</span>
            <span style="width:60px;color:var(--dim)">${esc(p.user)}</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.command)}</span>
            <span style="width:40px"><button class="proc-btn proc-btn-sm" onclick="_procKill(${p.pid})">×</button></span>
          </div>
        `).join('')}
      </div>`;
  } catch (e) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(e.message)}</div>`; }
}

async function _procSearch() {
  const q = document.getElementById('procSearch').value;
  if (!q) return _procLoadProcesses();
  const procs = await api(`/api/processes/search?q=${encodeURIComponent(q)}`);
  const c = document.getElementById('procContent');
  c.innerHTML = `
    <div style="margin:12px 0;display:flex;gap:8px">
      <input id="procSearch" class="proc-field" value="${esc(q)}" placeholder="Search..." onkeydown="if(event.key==='Enter')_procSearch()">
      <button class="proc-btn" onclick="_procSearch()">Search</button>
      <button class="proc-btn" onclick="_procLoadProcesses()">Clear</button>
    </div>
    <div class="proc-table">
      ${procs.map(p => `<div class="proc-row"><span style="width:60px">${p.pid}</span><span style="width:60px">${p.cpu.toFixed(1)}</span><span style="width:60px">${p.mem.toFixed(1)}</span><span style="flex:1">${esc(p.command)}</span><span style="width:40px"><button class="proc-btn proc-btn-sm" onclick="_procKill(${p.pid})">×</button></span></div>`).join('')}
    </div>`;
}

async function _procKill(pid) {
  if (!confirm(`Kill process ${pid}?`)) return;
  try {
    await api('/api/processes/kill', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ pid }) });
    _procLoadProcesses();
  } catch (e) { alert(e.message); }
}

async function _procLoadPorts() {
  const c = document.getElementById('procContent');
  c.innerHTML = '<div style="padding:20px;color:var(--dim)">Loading ports...</div>';
  try {
    const ports = await api('/api/processes/ports');
    c.innerHTML = `
      <div style="margin:12px 0;display:flex;gap:8px;align-items:center">
        <input id="procPortCheck" class="proc-field" placeholder="Port number..." type="number" style="width:120px">
        <button class="proc-btn" onclick="_procKillPort()">Kill Port</button>
      </div>
      <div class="proc-table">
        <div class="proc-header-row">
          <span style="width:80px">PORT</span><span style="width:80px">PID</span><span style="width:80px">PROTO</span><span style="width:100px">USER</span><span style="flex:1">COMMAND</span>
        </div>
        ${ports.map(p => `
          <div class="proc-row">
            <span style="width:80px;color:var(--green)">${p.port}</span>
            <span style="width:80px">${p.pid}</span>
            <span style="width:80px;color:var(--dim)">${p.protocol}</span>
            <span style="width:100px;color:var(--dim)">${esc(p.user)}</span>
            <span style="flex:1">${esc(p.command)}</span>
          </div>
        `).join('')}
      </div>`;
  } catch (e) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(e.message)}</div>`; }
}

async function _procKillPort() {
  const port = document.getElementById('procPortCheck').value;
  if (!port) return;
  if (!confirm(`Kill process on port ${port}?`)) return;
  try {
    await api('/api/processes/kill-port', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ port: parseInt(port) }) });
    _procLoadPorts();
  } catch (e) { alert(e.message); }
}

async function _procLoadResources() {
  const c = document.getElementById('procContent');
  try {
    const r = await api('/api/processes/resources');
    c.innerHTML = `
      <div class="proc-resources">
        <div class="proc-resource-card">
          <div class="proc-resource-label">CPU</div>
          <div class="proc-resource-value">${r.cpu.cores} cores</div>
          <div class="proc-resource-detail">${r.cpu.model}</div>
          <div class="proc-resource-detail">User: ${r.cpu.usage.user}% Sys: ${r.cpu.usage.sys}%</div>
        </div>
        <div class="proc-resource-card">
          <div class="proc-resource-label">Memory</div>
          <div class="proc-resource-value">${r.memory.usedPercent}% used</div>
          <div class="proc-resource-detail">${(r.memory.used / 1073741824).toFixed(1)} / ${(r.memory.total / 1073741824).toFixed(1)} GB</div>
        </div>
        <div class="proc-resource-card">
          <div class="proc-resource-label">Load Average</div>
          <div class="proc-resource-value">${r.loadAvg.map(l => l.toFixed(2)).join(' · ')}</div>
          <div class="proc-resource-detail">1m · 5m · 15m</div>
        </div>
        <div class="proc-resource-card">
          <div class="proc-resource-label">Uptime</div>
          <div class="proc-resource-value">${Math.floor(r.uptime / 86400)}d ${Math.floor((r.uptime % 86400) / 3600)}h</div>
          <div class="proc-resource-detail">${r.hostname} (${r.platform})</div>
        </div>
      </div>`;
  } catch (e) { c.innerHTML = `<div style="padding:20px;color:var(--red)">${esc(e.message)}</div>`; }
}

// ═══════════════════════════════════════════════════════════════
// NETWORK TOOLS
// ═══════════════════════════════════════════════════════════════

let _netCurrentTool = 'ping';

function loadNetTools() {
  const tools = [
    { id: 'ping', label: 'Ping' },
    { id: 'dns', label: 'DNS' },
    { id: 'ssl', label: 'SSL Cert' },
    { id: 'whois', label: 'Whois' },
    { id: 'port', label: 'Port Check' },
    { id: 'headers', label: 'HTTP Headers' },
    { id: 'traceroute', label: 'Traceroute' },
  ];
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="net-page">
      <div class="net-toolbar">
        ${tools.map(t => `<button class="net-tool-btn${t.id === _netCurrentTool ? ' active' : ''}" data-tool="${t.id}" onclick="_netSet('${t.id}')">${t.label}</button>`).join('')}
      </div>
      <div id="netContent" class="net-content"></div>
    </div>`;
  _netLoadTool();
}

function _netSet(tool) {
  _netCurrentTool = tool;
  document.querySelectorAll('.net-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
  _netLoadTool();
}

function _netLoadTool() {
  const c = document.getElementById('netContent');
  c.innerHTML = `
    <div class="net-panel">
      <div class="net-input-row">
        <input id="netHost" class="net-field" placeholder="${_netCurrentTool === 'headers' ? 'URL (e.g. https://example.com)' : 'Hostname or IP...'}" style="flex:1">
        ${_netCurrentTool === 'port' ? '<input id="netPort" class="net-field" placeholder="Port" type="number" style="width:80px">' : ''}
        <button class="net-btn" onclick="_netRun()">Run</button>
      </div>
      <pre id="netOutput" class="net-output"></pre>
    </div>`;
}

async function _netRun() {
  const host = document.getElementById('netHost').value.trim();
  if (!host) return;
  const out = document.getElementById('netOutput');
  out.textContent = 'Running...';

  const endpoint = {
    ping: '/api/net/ping',
    dns: '/api/net/dns',
    ssl: '/api/net/ssl',
    whois: '/api/net/whois',
    port: '/api/net/port-check',
    headers: '/api/net/headers',
    traceroute: '/api/net/traceroute',
  }[_netCurrentTool];

  const bodyKey = {
    ping: 'host', dns: 'hostname', ssl: 'host',
    whois: 'domain', port: 'host', headers: 'url', traceroute: 'host',
  }[_netCurrentTool];

  const body = { [bodyKey]: host };
  if (_netCurrentTool === 'port') body.port = parseInt(document.getElementById('netPort')?.value || 80);

  try {
    const r = await api(endpoint, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });

    if (_netCurrentTool === 'ping') {
      out.innerHTML = `Host: ${esc(r.host)}\nPackets: ${r.sent} sent, ${r.received} received, ${r.loss} loss\nRTT: min=${r.rtt.min}ms avg=${r.rtt.avg}ms max=${r.rtt.max}ms\n\n${r.replies.map(rp => `  time=${rp.time}ms ttl=${rp.ttl}`).join('\n')}`;
    } else if (_netCurrentTool === 'dns') {
      out.textContent = Object.entries(r).map(([type, records]) => `${type}:\n  ${Array.isArray(records) ? records.map(rec => typeof rec === 'object' ? JSON.stringify(rec) : rec).join('\n  ') : records}`).join('\n\n');
    } else if (_netCurrentTool === 'ssl') {
      if (r.error) { out.innerHTML = `<span style="color:var(--red)">Error: ${esc(r.error)}</span>`; return; }
      const color = r.daysLeft > 30 ? 'var(--green)' : r.daysLeft > 7 ? 'var(--amber)' : 'var(--red)';
      out.innerHTML = `Subject: ${JSON.stringify(r.subject)}\nIssuer: ${JSON.stringify(r.issuer)}\nValid: ${r.validFrom} → ${r.validTo}\n<span style="color:${color}">Days left: ${r.daysLeft}</span>\nProtocol: ${r.protocol}\nFingerprint: ${r.fingerprint256 || r.fingerprint}\nAlt Names: ${(r.altNames || []).join(', ')}`;
    } else if (_netCurrentTool === 'whois') {
      out.textContent = r.raw || JSON.stringify(r.fields, null, 2);
    } else if (_netCurrentTool === 'port') {
      out.innerHTML = r.open ? `<span style="color:var(--green)">Port ${r.port} is OPEN</span> (${r.latency}ms)` : `<span style="color:var(--red)">Port ${r.port} is CLOSED</span>`;
    } else if (_netCurrentTool === 'headers') {
      out.textContent = `Status: ${r.statusCode} ${r.statusMessage}\nHTTP/${r.httpVersion}\n\n${Object.entries(r.headers).map(([k,v]) => `${k}: ${v}`).join('\n')}`;
    } else if (_netCurrentTool === 'traceroute') {
      out.textContent = r.hops.map(h => `${String(h.hop).padStart(2)} ${h.detail}`).join('\n') || r.raw || 'No data';
    } else {
      out.textContent = JSON.stringify(r, null, 2);
    }
  } catch (e) { out.innerHTML = `<span style="color:var(--red)">${esc(e.message)}</span>`; }
}

// ═══ WAVE 7: WEBSOCKET TESTER ═══
let _wsSocket = null;
let _wsMessages = [];
let _wsMsgCount = { sent: 0, recv: 0 };

async function loadWsTester() {
  const main = document.getElementById('main');
  const conns = await api('/api/ws/connections').catch(() => []);
  const stats = await api('/api/ws/stats').catch(() => ({}));
  _wsMsgCount = { sent: 0, recv: 0 };
  main.innerHTML = `
    <div class="page ws-page">
      <div class="ws-topbar">
        <div class="ws-status-orb" id="wsOrb"></div>
        <span class="ws-status-text" id="wsStatusText">DISCONNECTED</span>
        <input class="ws-url-input" id="wsUrl" placeholder="ws://localhost:8080/path" spellcheck="false">
        <button class="ws-btn-connect" id="wsConnBtn" onclick="_wsConnect()">CONNECT</button>
        <button class="ws-btn-save" onclick="_wsSaveConn()">SAVE</button>
      </div>
      <div class="ws-saved-strip">${conns.map(c => `<button class="ws-saved-chip" onclick="document.getElementById('wsUrl').value='${esc(c.url)}'">${esc(c.name)}</button>`).join('')}</div>
      <div class="ws-body">
        <div class="ws-send-pane">
          <div class="ws-pane-header"><span class="ws-arrow">&uarr;</span> OUTBOUND</div>
          <textarea class="ws-send-area" id="wsSendArea" placeholder="Type message payload..." spellcheck="false"></textarea>
          <div class="ws-send-bar">
            <button class="ws-send-btn" onclick="_wsSend()">SEND</button>
            <button class="ws-clear-btn" onclick="document.getElementById('wsSendArea').value=''">CLEAR</button>
          </div>
        </div>
        <div class="ws-recv-pane">
          <div class="ws-pane-header"><span class="ws-arrow">&darr;</span> MESSAGE LOG</div>
          <div class="ws-messages" id="wsMessages"></div>
        </div>
      </div>
      <div class="ws-stat-bar">
        <span><span class="ws-stat-dot ws-dot-up"></span> Sent: <strong id="wsSentCount">0</strong></span>
        <span><span class="ws-stat-dot ws-dot-down"></span> Received: <strong id="wsRecvCount">0</strong></span>
        <span>Saved: ${stats.totalConnections || 0}</span>
        <span>Total messages: ${stats.totalMessages || 0}</span>
      </div>
    </div>`;
}

function _wsConnect() {
  const url = document.getElementById('wsUrl').value.trim();
  if (!url) return;
  const orb = document.getElementById('wsOrb');
  const statusText = document.getElementById('wsStatusText');
  const connBtn = document.getElementById('wsConnBtn');
  if (_wsSocket) { _wsSocket.close(); _wsSocket = null; return; }
  _wsMessages = []; _wsMsgCount = { sent: 0, recv: 0 };
  _wsRenderMessages();
  let wsUrl = url;
  if (!/^wss?:\/\//i.test(wsUrl)) wsUrl = 'ws://' + wsUrl;
  try {
    _wsSocket = new WebSocket(wsUrl);
    orb.className = 'ws-status-orb ws-orb-connecting';
    statusText.textContent = 'CONNECTING';
    _wsSocket.onopen = () => {
      orb.className = 'ws-status-orb ws-orb-connected';
      statusText.textContent = 'CONNECTED';
      connBtn.textContent = 'DISCONNECT';
      connBtn.classList.add('ws-active-conn');
    };
    _wsSocket.onclose = () => {
      orb.className = 'ws-status-orb';
      statusText.textContent = 'DISCONNECTED';
      connBtn.textContent = 'CONNECT';
      connBtn.classList.remove('ws-active-conn');
      _wsSocket = null;
    };
    _wsSocket.onmessage = (e) => {
      _wsMessages.push({ dir: 'recv', data: e.data, time: new Date().toLocaleTimeString() });
      _wsMsgCount.recv++;
      const el = document.getElementById('wsRecvCount');
      if (el) el.textContent = _wsMsgCount.recv;
      _wsRenderMessages();
    };
    _wsSocket.onerror = () => {
      orb.className = 'ws-status-orb ws-orb-error';
      statusText.textContent = 'ERROR';
    };
  } catch { orb.className = 'ws-status-orb ws-orb-error'; statusText.textContent = 'ERROR'; }
}

function _wsSend() {
  if (!_wsSocket || _wsSocket.readyState !== 1) return;
  const area = document.getElementById('wsSendArea');
  const msg = area.value; if (!msg) return;
  _wsSocket.send(msg);
  _wsMessages.push({ dir: 'sent', data: msg, time: new Date().toLocaleTimeString() });
  _wsMsgCount.sent++;
  const el = document.getElementById('wsSentCount');
  if (el) el.textContent = _wsMsgCount.sent;
  _wsRenderMessages();
}

function _wsRenderMessages() {
  const el = document.getElementById('wsMessages');
  if (!el) return;
  el.innerHTML = _wsMessages.map(m => `<div class="ws-msg ws-msg-${m.dir}"><span class="ws-msg-dir">${m.dir === 'sent' ? '\u2191' : '\u2193'}</span><span class="ws-msg-time">${m.time}</span><pre class="ws-msg-data">${esc(m.data)}</pre></div>`).join('');
  el.scrollTop = el.scrollHeight;
}

async function _wsSaveConn() {
  const url = document.getElementById('wsUrl').value.trim();
  if (!url) return;
  try {
    await api('/api/ws/connections', { method: 'POST', body: JSON.stringify({ url, name: url }) });
    loadWsTester();
  } catch (e) { alert(e.message); }
}

// ═══ WAVE 7: MARKDOWN EDITOR ═══
let _mdCurrentId = null;

async function loadMarkdown() {
  const main = document.getElementById('main');
  const notes = await api('/api/md/notes').catch(() => []);
  main.innerHTML = `
    <div class="page md-page">
      <div class="md-sidebar">
        <div class="md-sidebar-header">
          <span class="md-sidebar-title">NOTES</span>
          <button class="md-new-btn" onclick="_mdNew()" title="New note">+</button>
        </div>
        <input class="md-search" placeholder="Search..." oninput="_mdSearch(this.value)">
        <div class="md-note-list" id="mdNoteList">${notes.map(n => `
          <div class="md-note-item ${n.id === _mdCurrentId ? 'active' : ''}" onclick="_mdLoad('${n.id}',this)">
            <div class="md-note-item-title">${esc(n.title || 'Untitled')}</div>
            <div class="md-note-date">${new Date(n.updated_at).toLocaleDateString()}</div>
          </div>
        `).join('')}</div>
      </div>
      <div class="md-editor-wrap">
        <div class="md-editor-toolbar">
          <input class="md-title-input" id="mdTitle" placeholder="Untitled note" spellcheck="false" onchange="_mdAutoSave()">
          <button class="md-toolbar-btn" onclick="_mdInsert('**','**')" title="Bold">B</button>
          <button class="md-toolbar-btn" onclick="_mdInsert('*','*')" title="Italic" style="font-style:italic">I</button>
          <button class="md-toolbar-btn" onclick="_mdInsert('\`','\`')" title="Code">&lt;/&gt;</button>
        </div>
        <textarea class="md-editor" id="mdEditor" placeholder="Start writing..." spellcheck="false" oninput="_mdPreview(); _mdAutoSave()"></textarea>
        <div class="md-status-bar">
          <span id="mdStats">0 words</span>
          <span id="mdSaveStatus" style="margin-left:auto"></span>
        </div>
      </div>
      <div class="md-preview-pane">
        <div class="md-preview-bar">
          <span class="md-preview-label">PREVIEW</span>
          <button class="md-export-btn" onclick="_mdExportHtml()">EXPORT HTML</button>
        </div>
        <div class="md-preview" id="mdPreview"></div>
      </div>
    </div>`;
}

function _mdPreview() {
  const content = document.getElementById('mdEditor').value;
  const preview = document.getElementById('mdPreview');
  if (preview) {
    api('/api/md/stats', { method: 'POST', body: JSON.stringify({ content }) }).then(s => {
      const el = document.getElementById('mdStats');
      if (el) el.textContent = `${s.words} words \u00b7 ${s.readTime}m read \u00b7 ${s.lines} lines`;
    }).catch(() => {});
    let html = content;
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code class="language-${lang || 'text'}">${code.replace(/</g,'&lt;').replace(/>/g,'&gt;').trim()}</code></pre>`);
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^---+$/gm, '<hr>');
    html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
    html = html.replace(/\n/g, '<br>');
    preview.innerHTML = html;
  }
}

function _mdInsert(before, after) {
  const editor = document.getElementById('mdEditor');
  if (!editor) return;
  const start = editor.selectionStart, end = editor.selectionEnd;
  const selected = editor.value.substring(start, end);
  editor.value = editor.value.substring(0, start) + before + selected + after + editor.value.substring(end);
  editor.selectionStart = start + before.length;
  editor.selectionEnd = start + before.length + selected.length;
  editor.focus();
  _mdPreview(); _mdAutoSave();
}

async function _mdNew() {
  try {
    const result = await api('/api/md/notes', { method: 'POST', body: JSON.stringify({ title: 'New Note', content: '' }) });
    _mdCurrentId = result.id;
    loadMarkdown();
  } catch (e) { alert(e.message); }
}

async function _mdLoad(id, el) {
  try {
    _mdCurrentId = id;
    const notes = await api('/api/md/notes');
    const note = notes.find(n => n.id === id);
    if (note) {
      document.getElementById('mdTitle').value = note.title || '';
      document.getElementById('mdEditor').value = note.content || '';
      _mdPreview();
      document.querySelectorAll('.md-note-item').forEach(e => e.classList.remove('active'));
      if (el) el.classList.add('active');
    }
  } catch (e) { alert(e.message); }
}

let _mdSaveTimer = null;
function _mdAutoSave() {
  if (!_mdCurrentId) return;
  clearTimeout(_mdSaveTimer);
  const statusEl = document.getElementById('mdSaveStatus');
  if (statusEl) statusEl.textContent = 'Saving...';
  _mdSaveTimer = setTimeout(async () => {
    const title = document.getElementById('mdTitle').value;
    const content = document.getElementById('mdEditor').value;
    await api(`/api/md/notes/${_mdCurrentId}`, { method: 'PUT', body: JSON.stringify({ title, content }) }).catch(() => {});
    if (statusEl) { statusEl.textContent = 'Saved'; setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000); }
  }, 800);
}

async function _mdSearch(q) {
  const notes = q ? await api(`/api/md/search?q=${encodeURIComponent(q)}`).catch(() => []) : await api('/api/md/notes').catch(() => []);
  const list = document.getElementById('mdNoteList');
  if (list) list.innerHTML = notes.map(n => `<div class="md-note-item ${n.id === _mdCurrentId ? 'active' : ''}" onclick="_mdLoad('${n.id}',this)"><div class="md-note-item-title">${esc(n.title || 'Untitled')}</div><div class="md-note-date">${new Date(n.updated_at).toLocaleDateString()}</div></div>`).join('');
}

async function _mdExportHtml() {
  const content = document.getElementById('mdEditor')?.value || '';
  const title = document.getElementById('mdTitle')?.value || '';
  try {
    const res = await fetch('/api/md/export/html', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Id': _sessionId }, body: JSON.stringify({ content, title }) });
    const html = await res.text();
    const w = window.open(); w.document.write(html); w.document.close();
  } catch (e) { alert(e.message); }
}

// ═══ WAVE 7: MOCK API SERVER ═══
async function loadMockApi() {
  const main = document.getElementById('main');
  const [endpoints, status] = await Promise.all([
    api('/api/mock/endpoints').catch(() => []),
    api('/api/mock/status').catch(() => ({ running: false, port: 0 })),
  ]);
  main.innerHTML = `
    <div class="page mock-page">
      <div class="page-header"><h1 class="page-title">API Mock Server</h1></div>
      <div class="page-pad">
        <div class="mock-controls">
          <div class="mock-status-indicator">
            <div class="mock-status-orb ${status.running ? 'mock-live' : ''}"></div>
            <span class="mock-status-label">${status.running ? `<strong>LIVE</strong> on :${status.port}` : 'STOPPED'}</span>
          </div>
          ${status.running
            ? `<button class="mock-btn mock-btn-stop" onclick="_mockStop()">STOP SERVER</button>`
            : `<input id="mockPort" type="number" value="9999" class="mock-port-input" placeholder="Port">
               <button class="mock-btn mock-btn-start" onclick="_mockStart()">START</button>`
          }
          <button class="mock-btn-add" onclick="_mockAddEndpoint()">+ ADD ENDPOINT</button>
        </div>
        <div class="mock-endpoints w7-stagger" id="mockEndpoints">
          ${endpoints.length ? endpoints.map(ep => `
            <div class="mock-ep-card">
              <div class="mock-ep-header">
                <span class="mock-method mock-method-${ep.method.toLowerCase()}">${ep.method}</span>
                <span class="mock-path">${esc(ep.path)}</span>
                <div class="mock-ep-meta">
                  <span class="mock-ep-status-code">${ep.status}</span>
                  ${ep.delay_ms > 0 ? `<span class="mock-ep-delay">+${ep.delay_ms}ms</span>` : ''}
                  <button class="mock-ep-del" onclick="_mockDeleteEndpoint('${ep.id}')">&times;</button>
                </div>
              </div>
              ${ep.body ? `<pre class="mock-body">${esc(ep.body)}</pre>` : ''}
            </div>
          `).join('') : '<div class="mock-empty"><div class="mock-empty-icon">\u2699</div>No mock endpoints defined yet.<br>Click <strong>+ ADD ENDPOINT</strong> to create one.</div>'}
        </div>
        ${status.running ? `
          <div class="mock-log-section">
            <div class="w7-section-label">REQUEST LOG <button class="ws-clear-btn" style="margin-left:8px;font-size:9px" onclick="_mockRefreshLog()">REFRESH</button></div>
            <div id="mockLog" class="mock-log"></div>
          </div>
        ` : ''}
      </div>
    </div>`;
  if (status.running) _mockRefreshLog();
}

async function _mockStart() {
  const port = document.getElementById('mockPort')?.value || 9999;
  try { await api('/api/mock/start', { method: 'POST', body: JSON.stringify({ port: parseInt(port) }) }); loadMockApi(); } catch (e) { alert(e.message); }
}

async function _mockStop() {
  try { await api('/api/mock/stop', { method: 'POST' }); loadMockApi(); } catch (e) { alert(e.message); }
}

async function _mockAddEndpoint() {
  const path = prompt('Endpoint path (e.g. /api/users/:id):', '/api/test');
  if (!path) return;
  const method = prompt('HTTP method:', 'GET') || 'GET';
  const status = parseInt(prompt('Status code:', '200')) || 200;
  const body = prompt('Response body:', '{"ok":true}') || '';
  try {
    await api('/api/mock/endpoints', { method: 'POST', body: JSON.stringify({ path, method, status, body }) });
    loadMockApi();
  } catch (e) { alert(e.message); }
}

async function _mockDeleteEndpoint(id) {
  try { await api(`/api/mock/endpoints/${id}`, { method: 'DELETE' }); loadMockApi(); } catch (e) { alert(e.message); }
}

async function _mockRefreshLog() {
  const log = await api('/api/mock/log').catch(() => []);
  const el = document.getElementById('mockLog');
  if (el) el.innerHTML = log.length ? log.map(l => `<div class="mock-log-entry"><span class="mock-method mock-method-${l.method.toLowerCase()}">${l.method}</span><span>${esc(l.path)}</span>${l.matched ? '' : '<span class="mock-log-miss">404</span>'}<span class="mock-log-time">${new Date(l.timestamp).toLocaleTimeString()}</span></div>`).join('') : '<div style="color:var(--text3);padding:20px;text-align:center;font:400 12px var(--mono)">No requests captured yet</div>';
}

// ═══ WAVE 7: DEPENDENCY AUDITOR ═══
async function loadDeps() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page dep-page">
      <div class="page-header"><h1 class="page-title">Dependency Auditor</h1></div>
      <div class="page-pad">
        <div class="dep-toolbar">
          <input class="dep-dir-input" id="depDir" value="." placeholder="/path/to/project" spellcheck="false">
          <button class="dep-action-btn" onclick="_depScan()">SCAN</button>
          <button class="dep-action-btn" onclick="_depAudit()">SECURITY</button>
          <button class="dep-action-btn" onclick="_depOutdated()">OUTDATED</button>
          <button class="dep-action-btn" onclick="_depLicenses()">LICENSES</button>
        </div>
        <div id="depResults" class="dep-results"></div>
      </div>
    </div>`;
}

function _depShowLoading(msg) {
  const el = document.getElementById('depResults');
  el.innerHTML = `<div class="dep-loading"><div class="dep-loading-dots"><span></span><span></span><span></span></div>${msg || 'Analyzing...'}</div>`;
}

async function _depScan() {
  const dir = document.getElementById('depDir')?.value || '.';
  _depShowLoading('Scanning package.json...');
  try {
    const r = await api('/api/deps/scan', { method: 'POST', body: JSON.stringify({ dir }) });
    const el = document.getElementById('depResults');
    el.innerHTML = `<div class="dep-card">
      <div class="dep-card-title">${esc(r.name)} <span style="color:var(--text3);font-weight:400">v${r.version}</span></div>
      <div class="dep-grid">
        <div class="dep-stat"><div class="dep-stat-val">${r.deps.length}</div><div class="dep-stat-label">PROD</div></div>
        <div class="dep-stat"><div class="dep-stat-val">${r.devDeps.length}</div><div class="dep-stat-label">DEV</div></div>
        <div class="dep-stat"><div class="dep-stat-val" style="color:var(--green)">${r.total}</div><div class="dep-stat-label">TOTAL</div></div>
      </div>
      <table class="dep-table"><tr><th>Package</th><th>Version</th><th>Type</th></tr>
      ${[...r.deps, ...r.devDeps].map(d => `<tr><td>${esc(d.name)}</td><td style="color:var(--cyan)">${esc(d.version)}</td><td><span class="dep-type-badge dep-type-${d.type}">${d.type}</span></td></tr>`).join('')}</table>
    </div>`;
  } catch (e) { document.getElementById('depResults').innerHTML = `<div class="dep-card" style="border-color:rgba(239,83,80,0.2)"><div class="dep-card-title" style="color:var(--red)">${esc(e.message)}</div></div>`; }
}

async function _depAudit() {
  const dir = document.getElementById('depDir')?.value || '.';
  _depShowLoading('Running npm audit...');
  try {
    const r = await api('/api/deps/audit', { method: 'POST', body: JSON.stringify({ dir }) });
    const s = r.severities;
    const scoreColor = r.score >= 80 ? '#DA7756' : r.score >= 50 ? '#F59E0B' : '#EF5350';
    const pct = r.score / 100;
    const dashOffset = 283 - (283 * pct);
    const el = document.getElementById('depResults');
    el.innerHTML = `<div class="dep-card" style="text-align:center">
      <div class="dep-score-ring">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle class="dep-ring-bg" cx="50" cy="50" r="45"/>
          <circle class="dep-ring-fill" cx="50" cy="50" r="45" stroke="${scoreColor}" stroke-dasharray="283" stroke-dashoffset="${dashOffset}"/>
        </svg>
        <div class="dep-score-val" style="color:${scoreColor}">${r.score}</div>
      </div>
      <div class="dep-card-title">Security Score</div>
      <div class="dep-grid" style="max-width:500px;margin:16px auto 0">
        <div class="dep-stat dep-critical"><div class="dep-stat-val">${s.critical}</div><div class="dep-stat-label">CRITICAL</div></div>
        <div class="dep-stat dep-high"><div class="dep-stat-val">${s.high}</div><div class="dep-stat-label">HIGH</div></div>
        <div class="dep-stat dep-moderate"><div class="dep-stat-val">${s.moderate}</div><div class="dep-stat-label">MODERATE</div></div>
        <div class="dep-stat dep-low"><div class="dep-stat-val">${s.low}</div><div class="dep-stat-label">LOW</div></div>
      </div>
    </div>`;
  } catch (e) { document.getElementById('depResults').innerHTML = `<div class="dep-card" style="border-color:rgba(239,83,80,0.2)"><div class="dep-card-title" style="color:var(--red)">${esc(e.message)}</div></div>`; }
}

async function _depOutdated() {
  const dir = document.getElementById('depDir')?.value || '.';
  _depShowLoading('Checking outdated packages...');
  try {
    const r = await api('/api/deps/outdated', { method: 'POST', body: JSON.stringify({ dir }) });
    const entries = Object.entries(r);
    const el = document.getElementById('depResults');
    el.innerHTML = entries.length ? `<div class="dep-card">
      <div class="dep-card-title">${entries.length} Outdated Package${entries.length > 1 ? 's' : ''}</div>
      <table class="dep-table"><tr><th>Package</th><th>Current</th><th>Wanted</th><th>Latest</th></tr>
      ${entries.map(([name, info]) => `<tr><td>${esc(name)}</td><td style="color:var(--red)">${esc(info.current || '-')}</td><td style="color:var(--amber)">${esc(info.wanted || '-')}</td><td style="color:var(--green)">${esc(info.latest || '-')}</td></tr>`).join('')}</table>
    </div>` : `<div class="dep-card" style="text-align:center;border-color:rgba(218,119,86,0.15)"><div class="dep-card-title" style="color:var(--green)">All packages are up to date</div></div>`;
  } catch (e) { document.getElementById('depResults').innerHTML = `<div class="dep-card" style="border-color:rgba(239,83,80,0.2)"><div class="dep-card-title" style="color:var(--red)">${esc(e.message)}</div></div>`; }
}

async function _depLicenses() {
  const dir = document.getElementById('depDir')?.value || '.';
  _depShowLoading('Extracting licenses...');
  try {
    const r = await api('/api/deps/licenses', { method: 'POST', body: JSON.stringify({ dir }) });
    const el = document.getElementById('depResults');
    el.innerHTML = r.length ? `<div class="dep-card">
      <div class="dep-card-title">${r.length} Package Licenses</div>
      <table class="dep-table"><tr><th>Package</th><th>Version</th><th>License</th></tr>
      ${r.map(l => `<tr><td>${esc(l.name)}</td><td style="color:var(--cyan)">${esc(l.version)}</td><td><span class="w7-pill">${esc(l.license)}</span></td></tr>`).join('')}</table>
    </div>` : `<div class="dep-card"><div class="dep-card-title">No license information available</div></div>`;
  } catch (e) { document.getElementById('depResults').innerHTML = `<div class="dep-card" style="border-color:rgba(239,83,80,0.2)"><div class="dep-card-title" style="color:var(--red)">${esc(e.message)}</div></div>`; }
}

// ═══ WAVE 7: QUICK NOTES ═══
function _noteRenderCard(n) {
  return `<div class="note-card note-card-${n.color || 'default'}">
    <div class="note-card-header">
      ${n.pinned ? '<span class="note-pin-icon">PIN</span>' : ''}
      <span class="note-card-title">${esc(n.title || 'Untitled')}</span>
      <div class="note-card-actions">
        <button class="note-card-act-btn" onclick="_notePin('${n.id}')" title="Toggle pin">\u{1F4CC}</button>
        <button class="note-card-act-btn" onclick="_noteDelete('${n.id}')" title="Delete">&times;</button>
      </div>
    </div>
    <div class="note-card-body" onclick="_noteEdit('${n.id}')">${esc((n.content || '').substring(0, 250))}</div>
    <div class="note-card-footer">
      <span>${new Date(n.updated_at).toLocaleDateString()}</span>
      <span style="color:var(--text3)">${(n.content || '').length} chars</span>
    </div>
  </div>`;
}

async function loadNotes() {
  const main = document.getElementById('main');
  const notes = await api('/api/notes').catch(() => []);
  main.innerHTML = `
    <div class="page note-page">
      <div class="page-header"><h1 class="page-title">Quick Notes</h1></div>
      <div class="page-pad">
        <div class="note-toolbar">
          <input class="note-search" id="noteSearch" placeholder="Search notes..." oninput="_noteSearch(this.value)">
          <button class="note-add-btn" onclick="_noteNew()">+ NEW NOTE</button>
        </div>
        <div class="note-grid w7-stagger" id="noteGrid">
          ${notes.length ? notes.map(n => _noteRenderCard(n)).join('') : `
            <div class="note-empty">
              <div class="note-empty-icon">\u{1F4DD}</div>
              <div class="note-empty-text">No notes yet. Click <strong>+ NEW NOTE</strong> to create one.</div>
            </div>`}
        </div>
      </div>
    </div>`;
}

async function _noteNew() {
  const title = prompt('Note title:');
  if (title === null) return;
  try {
    await api('/api/notes', { method: 'POST', body: JSON.stringify({ title: title || 'Untitled', content: '' }) });
    loadNotes();
  } catch (e) { alert(e.message); }
}

async function _noteEdit(id) {
  try {
    const notes = await api('/api/notes');
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const content = prompt('Edit content:', note.content || '');
    if (content === null) return;
    await api(`/api/notes/${id}`, { method: 'PUT', body: JSON.stringify({ content }) });
    loadNotes();
  } catch (e) { alert(e.message); }
}

async function _notePin(id) {
  try { await api(`/api/notes/${id}/pin`, { method: 'PUT' }); loadNotes(); } catch (e) { alert(e.message); }
}

async function _noteDelete(id) {
  if (!confirm('Delete this note?')) return;
  try { await api(`/api/notes/${id}`, { method: 'DELETE' }); loadNotes(); } catch (e) { alert(e.message); }
}

async function _noteSearch(q) {
  const notes = q ? await api(`/api/notes/search?q=${encodeURIComponent(q)}`).catch(() => []) : await api('/api/notes').catch(() => []);
  const grid = document.getElementById('noteGrid');
  if (grid) grid.innerHTML = notes.length ? notes.map(n => _noteRenderCard(n)).join('') : '<div class="note-empty"><div class="note-empty-text">No matching notes</div></div>';
}

// ═══ WAVE 7: BOOKMARK MANAGER ═══
function _bmRenderCard(b) {
  return `<div class="bm-card">
    <div class="bm-favicon-wrap"><img class="bm-favicon" src="${esc(b.favicon || '')}" onerror="this.style.display='none'" width="16" height="16"></div>
    <div class="bm-info">
      <a class="bm-title" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.title || b.url)}</a>
      ${b.description ? `<div class="bm-desc">${esc(b.description)}</div>` : ''}
      <div class="bm-meta">
        <span class="bm-url">${esc(b.url)}</span>
        ${(b.tags || []).map(t => `<span class="bm-tag">${esc(t)}</span>`).join('')}
      </div>
    </div>
    <button class="bm-del-btn" onclick="_bmDelete('${b.id}')" title="Delete">&times;</button>
  </div>`;
}

async function loadBookmarks() {
  const main = document.getElementById('main');
  const [bookmarks, tags] = await Promise.all([
    api('/api/bookmarks').catch(() => []),
    api('/api/bookmarks/tags').catch(() => []),
  ]);
  main.innerHTML = `
    <div class="page bm-page">
      <div class="page-header"><h1 class="page-title">Bookmarks</h1></div>
      <div class="page-pad">
        <div class="bm-toolbar">
          <input class="bm-search" id="bmSearch" placeholder="Search bookmarks..." oninput="_bmSearch(this.value)">
          <button class="bm-action-btn bm-btn-add" onclick="_bmAdd()">+ BOOKMARK</button>
          <button class="bm-action-btn bm-btn-io" onclick="_bmImport()">IMPORT</button>
          <button class="bm-action-btn bm-btn-io" onclick="_bmExport()">EXPORT</button>
        </div>
        <div class="bm-tags-strip">${tags.map(t => `<button class="bm-tag-chip" onclick="_bmFilterTag('${esc(t.tag)}')">${esc(t.tag)} <span class="bm-tag-count">${t.count}</span></button>`).join('')}</div>
        <div class="bm-list w7-stagger" id="bmList">
          ${bookmarks.length ? bookmarks.map(b => _bmRenderCard(b)).join('') : `
            <div class="bm-empty">
              <div class="bm-empty-icon">\u{1F516}</div>
              <div class="bm-empty-text">No bookmarks yet. Click <strong>+ BOOKMARK</strong> to add one.</div>
            </div>`}
        </div>
      </div>
    </div>`;
}

async function _bmAdd() {
  const url = prompt('Bookmark URL:');
  if (!url) return;
  const title = prompt('Title:', url);
  const tags = prompt('Tags (comma-separated):');
  try {
    await api('/api/bookmarks', { method: 'POST', body: JSON.stringify({ url, title, tags: tags || '' }) });
    loadBookmarks();
  } catch (e) { alert(e.message); }
}

async function _bmDelete(id) {
  if (!confirm('Delete this bookmark?')) return;
  try { await api(`/api/bookmarks/${id}`, { method: 'DELETE' }); loadBookmarks(); } catch (e) { alert(e.message); }
}

async function _bmSearch(q) {
  const bookmarks = q ? await api(`/api/bookmarks/search?q=${encodeURIComponent(q)}`).catch(() => []) : await api('/api/bookmarks').catch(() => []);
  const list = document.getElementById('bmList');
  if (list) list.innerHTML = bookmarks.length ? bookmarks.map(b => _bmRenderCard(b)).join('') : '<div class="bm-empty"><div class="bm-empty-text">No matching bookmarks</div></div>';
}

async function _bmFilterTag(tag) { _bmSearch(tag); }

async function _bmExport() {
  try {
    const data = await api('/api/bookmarks/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bookmarks.json'; a.click();
  } catch (e) { alert(e.message); }
}

async function _bmImport() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      const result = await api('/api/bookmarks/import', { method: 'POST', body: JSON.stringify(data) });
      alert(`Imported: ${result.imported}, Skipped: ${result.skipped}`);
      loadBookmarks();
    } catch (err) { alert(err.message); }
  };
  input.click();
}

// ═══════════════════════════════════════════════════
// ═══ WAVE 8: LOAD TESTER ═══
// ═══════════════════════════════════════════════════

let _ltResults = [];

async function loadLoadTest() {
  const main = document.getElementById('main');
  const tests = await api('/api/load').catch(() => []);
  main.innerHTML = `
    <div class="page lt-page">
      <div class="page-header"><h1 class="page-title">Load Tester</h1></div>
      <div class="page-pad">
        <div class="lt-config">
          <div class="lt-config-row">
            <input class="lt-input lt-url" id="ltUrl" placeholder="https://example.com/api/endpoint" value="https://httpbin.org/get">
            <select class="lt-select" id="ltMethod"><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select>
          </div>
          <div class="lt-config-row">
            <label class="lt-label">Concurrency<input class="lt-input lt-small" id="ltConc" type="number" value="10" min="1" max="500"></label>
            <label class="lt-label">Total Requests<input class="lt-input lt-small" id="ltTotal" type="number" value="100" min="1" max="10000"></label>
            <label class="lt-label">Timeout (ms)<input class="lt-input lt-small" id="ltTimeout" type="number" value="10000" min="100" max="60000"></label>
            <button class="lt-run-btn" onclick="_ltRun()">RUN TEST</button>
          </div>
        </div>
        <div id="ltProgress" style="display:none" class="lt-progress"><div class="lt-progress-bar" id="ltProgressBar"></div><span id="ltProgressText">Running...</span></div>
        <div id="ltSummary"></div>
        <div class="lt-history" id="ltHistory">
          <div class="w7-section-label">HISTORY</div>
          ${tests.length ? tests.map(t => _ltRenderCard(t)).join('') : '<div class="lt-empty">No tests yet. Configure and run a load test above.</div>'}
        </div>
      </div>
    </div>`;
}

function _ltRenderCard(t) {
  const s = t.summary || {};
  return `<div class="lt-card w7-stagger">
    <div class="lt-card-header">
      <span class="w7-pill">${esc(t.method || 'GET')}</span>
      <span class="lt-card-url">${esc(t.url || '')}</span>
      <span class="lt-card-date">${new Date(t.created_at).toLocaleString()}</span>
      <button class="lt-card-del" onclick="_ltDelete('${t.id}')">&times;</button>
    </div>
    <div class="lt-card-stats">
      <div class="lt-stat"><div class="lt-stat-val">${s.rps || 0}</div><div class="lt-stat-label">RPS</div></div>
      <div class="lt-stat"><div class="lt-stat-val">${s.latency?.avg || 0}ms</div><div class="lt-stat-label">Avg Latency</div></div>
      <div class="lt-stat"><div class="lt-stat-val">${s.successRate || 0}%</div><div class="lt-stat-label">Success</div></div>
      <div class="lt-stat"><div class="lt-stat-val">${s.totalRequests || 0}</div><div class="lt-stat-label">Requests</div></div>
    </div>
  </div>`;
}

async function _ltRun() {
  const url = document.getElementById('ltUrl').value;
  const method = document.getElementById('ltMethod').value;
  const concurrency = parseInt(document.getElementById('ltConc').value);
  const totalRequests = parseInt(document.getElementById('ltTotal').value);
  const timeout = parseInt(document.getElementById('ltTimeout').value);
  if (!url) { alert('URL is required'); return; }

  const prog = document.getElementById('ltProgress');
  prog.style.display = 'flex';
  document.getElementById('ltProgressText').textContent = 'Running...';
  document.getElementById('ltProgressBar').style.width = '0%';

  let pct = 0;
  const progTimer = setInterval(() => {
    pct = Math.min(pct + 2, 90);
    document.getElementById('ltProgressBar').style.width = pct + '%';
  }, 200);

  try {
    const result = await api('/api/load/run', { method: 'POST', body: JSON.stringify({ url, method, concurrency, totalRequests, timeout }) });
    clearInterval(progTimer);
    document.getElementById('ltProgressBar').style.width = '100%';
    document.getElementById('ltProgressText').textContent = 'Complete!';
    const s = result.summary;
    document.getElementById('ltSummary').innerHTML = `
      <div class="lt-results">
        <div class="lt-results-grid">
          <div class="lt-result-card lt-result-green"><div class="lt-result-val">${s.rps}</div><div class="lt-result-label">Requests/sec</div></div>
          <div class="lt-result-card"><div class="lt-result-val">${s.latency.avg}ms</div><div class="lt-result-label">Avg Latency</div></div>
          <div class="lt-result-card"><div class="lt-result-val">${s.latency.p95}ms</div><div class="lt-result-label">P95 Latency</div></div>
          <div class="lt-result-card"><div class="lt-result-val">${s.latency.p99}ms</div><div class="lt-result-label">P99 Latency</div></div>
          <div class="lt-result-card lt-result-green"><div class="lt-result-val">${s.successRate}%</div><div class="lt-result-label">Success Rate</div></div>
          <div class="lt-result-card ${parseFloat(s.errorRate) > 0 ? 'lt-result-red' : ''}"><div class="lt-result-val">${s.errorRate}%</div><div class="lt-result-label">Error Rate</div></div>
          <div class="lt-result-card"><div class="lt-result-val">${s.latency.min}ms</div><div class="lt-result-label">Min Latency</div></div>
          <div class="lt-result-card"><div class="lt-result-val">${s.latency.max}ms</div><div class="lt-result-label">Max Latency</div></div>
        </div>
      </div>`;
    setTimeout(() => { prog.style.display = 'none'; loadLoadTest(); }, 2000);
  } catch (e) {
    clearInterval(progTimer);
    prog.style.display = 'none';
    alert(e.message);
  }
}

async function _ltDelete(id) {
  if (!confirm('Delete this test?')) return;
  try { await api(`/api/load/${id}`, { method: 'DELETE' }); loadLoadTest(); } catch (e) { alert(e.message); }
}

// ═══════════════════════════════════════════════════
// ═══ WAVE 8: DATA VIEWER ═══
// ═══════════════════════════════════════════════════

let _dvHeaders = [];
let _dvRows = [];
let _dvFormat = '';

async function loadDataView() {
  const main = document.getElementById('main');
  const saved = await api('/api/data').catch(() => []);
  main.innerHTML = `
    <div class="page dv-page">
      <div class="page-header"><h1 class="page-title">Data Viewer</h1></div>
      <div class="page-pad">
        <div class="dv-input-section">
          <textarea class="dv-textarea" id="dvInput" rows="6" placeholder="Paste CSV, TSV, or JSON data here..."></textarea>
          <div class="dv-actions">
            <button class="dv-btn dv-btn-primary" onclick="_dvParse()">PARSE</button>
            <button class="dv-btn" onclick="_dvClear()">CLEAR</button>
            <button class="dv-btn" onclick="_dvSave()">SAVE</button>
          </div>
        </div>
        <div id="dvFilters" style="display:none" class="dv-filters">
          <select class="dv-select" id="dvFilterCol"></select>
          <select class="dv-select" id="dvFilterOp">
            <option value="equals">equals</option><option value="contains">contains</option>
            <option value="gt">greater than</option><option value="lt">less than</option>
            <option value="startsWith">starts with</option><option value="endsWith">ends with</option>
          </select>
          <input class="dv-filter-input" id="dvFilterVal" placeholder="Value...">
          <button class="dv-btn" onclick="_dvFilter()">Filter</button>
          <button class="dv-btn" onclick="_dvResetFilter()">Reset</button>
        </div>
        <div id="dvTable"></div>
        <div class="dv-saved" id="dvSaved">
          <div class="w7-section-label">SAVED DATASETS</div>
          ${saved.length ? saved.map(s => `<div class="dv-saved-card"><span>${esc(s.name)}</span><span class="dv-saved-meta">${s.format} · ${s.row_count} rows</span><button class="dv-saved-load" onclick="_dvLoad('${s.id}')">Load</button><button class="dv-saved-del" onclick="_dvDelSaved('${s.id}')">&times;</button></div>`).join('') : '<div class="dv-empty">No saved datasets</div>'}
        </div>
      </div>
    </div>`;
}

async function _dvParse() {
  const text = document.getElementById('dvInput').value;
  if (!text.trim()) { alert('Paste some data first'); return; }
  try {
    const result = await api('/api/data/parse', { method: 'POST', body: JSON.stringify({ text }) });
    _dvHeaders = result.headers; _dvRows = result.rows; _dvFormat = result.format;
    _dvRenderTable();
    document.getElementById('dvFilters').style.display = 'flex';
    const colSelect = document.getElementById('dvFilterCol');
    colSelect.innerHTML = _dvHeaders.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');
  } catch (e) { alert(e.message); }
}

function _dvRenderTable() {
  const el = document.getElementById('dvTable');
  if (!_dvHeaders.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="dv-table-wrap"><table class="dv-table">
    <thead><tr>${_dvHeaders.map(h => `<th onclick="_dvSort('${esc(h)}')">${esc(h)} <span class="dv-sort-icon">\u2195</span></th>`).join('')}</tr></thead>
    <tbody>${_dvRows.slice(0, 200).map((r, i) => `<tr class="${i % 2 ? 'dv-stripe' : ''}">${_dvHeaders.map(h => `<td>${esc(String(r[h] || ''))}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  <div class="dv-table-info">${_dvRows.length} rows \xb7 ${_dvHeaders.length} columns \xb7 ${_dvFormat}</div>`;
}

async function _dvSort(col) {
  const result = await api('/api/data/sort', { method: 'POST', body: JSON.stringify({ rows: _dvRows, column: col, direction: 'asc' }) });
  _dvRows = result; _dvRenderTable();
}

async function _dvFilter() {
  const col = document.getElementById('dvFilterCol').value;
  const op = document.getElementById('dvFilterOp').value;
  const val = document.getElementById('dvFilterVal').value;
  const result = await api('/api/data/filter', { method: 'POST', body: JSON.stringify({ rows: _dvRows, column: col, operator: op, value: val }) });
  _dvRows = result; _dvRenderTable();
}

function _dvResetFilter() { _dvParse(); }
function _dvClear() { _dvHeaders = []; _dvRows = []; document.getElementById('dvInput').value = ''; document.getElementById('dvTable').innerHTML = ''; document.getElementById('dvFilters').style.display = 'none'; }

async function _dvSave() {
  const text = document.getElementById('dvInput').value;
  if (!text.trim()) return;
  const name = prompt('Dataset name:');
  if (!name) return;
  try { await api('/api/data', { method: 'POST', body: JSON.stringify({ name, content: text }) }); loadDataView(); } catch (e) { alert(e.message); }
}

async function _dvLoad(id) {
  try {
    const ds = await api(`/api/data/${id}`);
    document.getElementById('dvInput').value = ds.content;
    _dvParse();
  } catch (e) { alert(e.message); }
}

async function _dvDelSaved(id) {
  if (!confirm('Delete this dataset?')) return;
  try { await api(`/api/data/${id}`, { method: 'DELETE' }); loadDataView(); } catch (e) { alert(e.message); }
}

// ═══════════════════════════════════════════════════
// ═══ WAVE 8: TEXT TRANSFORM ═══
// ═══════════════════════════════════════════════════

async function loadTextTools() {
  const main = document.getElementById('main');
  const caseT = ['toUpperCase','toLowerCase','toTitleCase','toCamelCase','toSnakeCase','toKebabCase','toPascalCase','toConstantCase'];
  const lineT = ['sortLines','reverseLines','shuffleLines','deduplicateLines','numberLines','removeEmptyLines','trimLines'];
  const textT = ['reverseText','wrapLines','unwrapLines'];
  const encT = ['rot13','toMorseCode','fromMorseCode'];
  const genT = ['loremIpsum','generatePassword'];
  const extT = ['extractEmails','extractUrls','extractNumbers'];

  const btnGroup = (title, items) => `<div class="tt-group"><div class="tt-group-title">${title}</div><div class="tt-btns">${items.map(t => `<button class="tt-btn" onclick="_ttApply('${t}')">${t.replace(/([A-Z])/g, ' $1').trim()}</button>`).join('')}</div></div>`;

  main.innerHTML = `
    <div class="page tt-page">
      <div class="page-header"><h1 class="page-title">Text Transform</h1></div>
      <div class="page-pad">
        <div class="tt-panels">
          <div class="tt-panel">
            <div class="tt-panel-label">INPUT</div>
            <textarea class="tt-textarea" id="ttInput" rows="12" placeholder="Type or paste text here..."></textarea>
          </div>
          <div class="tt-panel">
            <div class="tt-panel-label">OUTPUT</div>
            <textarea class="tt-textarea tt-output" id="ttOutput" rows="12" readonly></textarea>
            <button class="tt-copy-btn" onclick="_ttCopy()">COPY</button>
          </div>
        </div>
        <div class="tt-controls">
          ${btnGroup('Case', caseT)}
          ${btnGroup('Lines', lineT)}
          ${btnGroup('Text', textT)}
          ${btnGroup('Encode', encT)}
          ${btnGroup('Generate', genT)}
          ${btnGroup('Extract', extT)}
        </div>
        <div class="tt-info" id="ttInfo"></div>
      </div>
    </div>`;
}

async function _ttApply(name) {
  const text = document.getElementById('ttInput').value;
  try {
    const { result } = await api('/api/text/transform', { method: 'POST', body: JSON.stringify({ name, text }) });
    const output = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
    document.getElementById('ttOutput').value = output;
    document.getElementById('ttInfo').textContent = `Applied: ${name}`;
  } catch (e) { alert(e.message); }
}

function _ttCopy() {
  const output = document.getElementById('ttOutput').value;
  if (!output) return;
  navigator.clipboard.writeText(output);
  showToast('Copied to clipboard');
}

// ═══════════════════════════════════════════════════
// ═══ WAVE 8: CLIPBOARD MANAGER ═══
// ═══════════════════════════════════════════════════

async function loadClipboard() {
  const main = document.getElementById('main');
  const [clips, stats] = await Promise.all([
    api('/api/clipboard').catch(() => []),
    api('/api/clipboard/stats').catch(() => ({ total: 0, pinned: 0, totalChars: 0 })),
  ]);
  main.innerHTML = `
    <div class="page cb-page">
      <div class="page-header"><h1 class="page-title">Clipboard Manager</h1></div>
      <div class="page-pad">
        <div class="cb-toolbar">
          <input class="cb-search" id="cbSearch" placeholder="Search clips..." oninput="_cbSearch(this.value)">
          <button class="cb-add-btn" onclick="_cbNew()">+ CLIP</button>
          <div class="cb-stats">${stats.total} clips \xb7 ${stats.pinned} pinned \xb7 ${(stats.totalChars / 1024).toFixed(1)}KB</div>
        </div>
        <div class="cb-list w7-stagger" id="cbList">
          ${clips.length ? clips.map(c => _cbRenderCard(c)).join('') : '<div class="cb-empty">No clips yet. Click <strong>+ CLIP</strong> to save text.</div>'}
        </div>
      </div>
    </div>`;
}

function _cbRenderCard(c) {
  const preview = (c.content || '').substring(0, 150);
  const tags = (c.tags || []).map(t => `<span class="cb-tag">${esc(t)}</span>`).join('');
  return `<div class="cb-card ${c.pinned ? 'cb-pinned' : ''}">
    <div class="cb-card-header">
      <span class="cb-card-label">${esc(c.label || 'Untitled')}</span>
      ${c.pinned ? '<span class="cb-pin-star">\u2605</span>' : ''}
      <div class="cb-card-actions">
        <button class="cb-act-btn" onclick="_cbCopy('${c.id}')" title="Copy">\u2398</button>
        <button class="cb-act-btn" onclick="_cbPin('${c.id}')" title="Toggle pin">\ud83d\udccc</button>
        <button class="cb-act-btn" onclick="_cbDel('${c.id}')" title="Delete">&times;</button>
      </div>
    </div>
    <div class="cb-card-body" onclick="_cbEdit('${c.id}')">${esc(preview)}</div>
    <div class="cb-card-footer">
      <div class="cb-tags">${tags}</div>
      <span>${new Date(c.created_at).toLocaleDateString()}</span>
    </div>
  </div>`;
}

async function _cbNew() {
  const content = prompt('Clip content:');
  if (content === null) return;
  const label = prompt('Label (optional):') || '';
  try { await api('/api/clipboard', { method: 'POST', body: JSON.stringify({ content, label }) }); loadClipboard(); } catch (e) { alert(e.message); }
}

async function _cbCopy(id) {
  try {
    const clips = await api('/api/clipboard');
    const clip = clips.find(c => c.id === id);
    if (clip) { navigator.clipboard.writeText(clip.content); showToast('Copied!'); }
  } catch (e) { alert(e.message); }
}

async function _cbPin(id) {
  try { await api(`/api/clipboard/${id}/pin`, { method: 'PUT' }); loadClipboard(); } catch (e) { alert(e.message); }
}

async function _cbDel(id) {
  if (!confirm('Delete this clip?')) return;
  try { await api(`/api/clipboard/${id}`, { method: 'DELETE' }); loadClipboard(); } catch (e) { alert(e.message); }
}

async function _cbEdit(id) {
  try {
    const clips = await api('/api/clipboard');
    const clip = clips.find(c => c.id === id);
    if (!clip) return;
    const label = prompt('Edit label:', clip.label || '');
    if (label === null) return;
    await api(`/api/clipboard/${id}`, { method: 'PUT', body: JSON.stringify({ label }) });
    loadClipboard();
  } catch (e) { alert(e.message); }
}

async function _cbSearch(q) {
  const clips = q ? await api(`/api/clipboard/search?q=${encodeURIComponent(q)}`).catch(() => []) : await api('/api/clipboard').catch(() => []);
  const list = document.getElementById('cbList');
  if (list) list.innerHTML = clips.length ? clips.map(c => _cbRenderCard(c)).join('') : '<div class="cb-empty">No matching clips</div>';
}

// ═══════════════════════════════════════════════════
// ═══ WAVE 8: POMODORO TIMER ═══
// ═══════════════════════════════════════════════════

let _pomInterval = null;
let _pomRemaining = 0;
let _pomSessionId = null;

async function loadPomodoro() {
  const main = document.getElementById('main');
  const [active, dayStats, weekStats, streak] = await Promise.all([
    api('/api/pomodoro/active').catch(() => null),
    api('/api/pomodoro/stats/day').catch(() => ({ completed: 0, totalFocusMinutes: 0 })),
    api('/api/pomodoro/stats/week').catch(() => ({ totalFocusMinutes: 0, totalSessions: 0, avgFocusPerDay: 0 })),
    api('/api/pomodoro/streak').catch(() => ({ streak: 0 })),
  ]);

  if (_pomInterval) { clearInterval(_pomInterval); _pomInterval = null; }

  const isActive = active && active.status === 'active';
  if (isActive) {
    const elapsed = (Date.now() - new Date(active.started_at).getTime()) / 1000;
    _pomRemaining = Math.max(0, active.duration_min * 60 - elapsed);
    _pomSessionId = active.id;
  }

  main.innerHTML = `
    <div class="page pom-page">
      <div class="page-header"><h1 class="page-title">Pomodoro Timer</h1></div>
      <div class="page-pad">
        <div class="pom-timer-section">
          <div class="pom-timer-ring" id="pomRing">
            <svg viewBox="0 0 200 200" class="pom-svg">
              <circle cx="100" cy="100" r="90" class="pom-ring-bg"/>
              <circle cx="100" cy="100" r="90" class="pom-ring-progress" id="pomRingProgress" stroke-dasharray="565.5" stroke-dashoffset="0"/>
            </svg>
            <div class="pom-timer-display" id="pomDisplay">${isActive ? _pomFmt(_pomRemaining) : '25:00'}</div>
            <div class="pom-timer-label" id="pomLabel">${isActive ? (active.type === 'focus' ? 'FOCUS' : 'BREAK') : 'READY'}</div>
          </div>
          <div class="pom-controls">
            ${isActive ? `
              <button class="pom-btn pom-btn-complete" onclick="_pomComplete()">COMPLETE</button>
              <button class="pom-btn pom-btn-cancel" onclick="_pomCancel()">CANCEL</button>
            ` : `
              <button class="pom-btn pom-btn-focus" onclick="_pomStart('focus', 25)">FOCUS 25m</button>
              <button class="pom-btn pom-btn-break" onclick="_pomStart('break', 5)">BREAK 5m</button>
              <button class="pom-btn pom-btn-long" onclick="_pomStart('long_break', 15)">LONG 15m</button>
            `}
          </div>
        </div>
        <div class="pom-stats">
          <div class="pom-stat"><div class="pom-stat-val">${streak.streak}</div><div class="pom-stat-label">Day Streak</div></div>
          <div class="pom-stat"><div class="pom-stat-val">${dayStats.totalFocusMinutes}m</div><div class="pom-stat-label">Focus Today</div></div>
          <div class="pom-stat"><div class="pom-stat-val">${dayStats.completed}</div><div class="pom-stat-label">Sessions Today</div></div>
          <div class="pom-stat"><div class="pom-stat-val">${weekStats.totalFocusMinutes}m</div><div class="pom-stat-label">Focus This Week</div></div>
        </div>
      </div>
    </div>`;

  if (isActive) _pomStartTimer(active.duration_min * 60);
}

function _pomFmt(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function _pomStartTimer(totalSec) {
  if (_pomInterval) clearInterval(_pomInterval);
  _pomInterval = setInterval(() => {
    _pomRemaining -= 1;
    if (_pomRemaining <= 0) {
      clearInterval(_pomInterval); _pomInterval = null;
      document.getElementById('pomDisplay').textContent = '00:00';
      document.getElementById('pomLabel').textContent = 'DONE!';
      _pomComplete();
      return;
    }
    document.getElementById('pomDisplay').textContent = _pomFmt(_pomRemaining);
    const pct = _pomRemaining / totalSec;
    document.getElementById('pomRingProgress').setAttribute('stroke-dashoffset', String(565.5 * (1 - pct)));
  }, 1000);
}

async function _pomStart(type, duration) {
  try {
    const result = await api('/api/pomodoro/start', { method: 'POST', body: JSON.stringify({ type, duration }) });
    _pomSessionId = result.id;
    _pomRemaining = duration * 60;
    loadPomodoro();
  } catch (e) { alert(e.message); }
}

async function _pomComplete() {
  if (!_pomSessionId) return;
  try {
    await api(`/api/pomodoro/${_pomSessionId}/complete`, { method: 'POST' });
    if (_pomInterval) { clearInterval(_pomInterval); _pomInterval = null; }
    _pomSessionId = null;
    showToast('Session completed!');
    loadPomodoro();
  } catch (e) { alert(e.message); }
}

async function _pomCancel() {
  if (!_pomSessionId) return;
  if (!confirm('Cancel this session?')) return;
  try {
    await api(`/api/pomodoro/${_pomSessionId}/cancel`, { method: 'POST' });
    if (_pomInterval) { clearInterval(_pomInterval); _pomInterval = null; }
    _pomSessionId = null;
    loadPomodoro();
  } catch (e) { alert(e.message); }
}

// ═══════════════════════════════════════════════════
// ═══ WAVE 8: LINK CHECKER ═══
// ═══════════════════════════════════════════════════

async function loadLinkCheck() {
  const main = document.getElementById('main');
  const checks = await api('/api/links').catch(() => []);
  main.innerHTML = `
    <div class="page lc-page">
      <div class="page-header"><h1 class="page-title">Link Checker</h1></div>
      <div class="page-pad">
        <div class="lc-input-section">
          <div class="lc-input-row">
            <input class="lc-input" id="lcUrl" placeholder="https://example.com" value="">
            <button class="lc-btn lc-btn-check" onclick="_lcCheck()">CHECK URL</button>
            <button class="lc-btn lc-btn-crawl" onclick="_lcCrawl()">CRAWL PAGE</button>
          </div>
          <textarea class="lc-textarea" id="lcBatch" rows="3" placeholder="Paste multiple URLs (one per line) for batch check..."></textarea>
          <button class="lc-btn" onclick="_lcBatch()">BATCH CHECK</button>
        </div>
        <div id="lcResults"></div>
        <div class="lc-history" id="lcHistory">
          <div class="w7-section-label">HISTORY</div>
          ${checks.length ? checks.map(c => _lcRenderCard(c)).join('') : '<div class="lc-empty">No checks yet.</div>'}
        </div>
      </div>
    </div>`;
}

function _lcRenderCard(c) {
  const s = c.summary || {};
  return `<div class="lc-card">
    <div class="lc-card-header">
      <span class="lc-card-url">${esc(c.url || '')}</span>
      <span class="lc-card-count">${c.total_links} links</span>
      <span class="lc-card-date">${new Date(c.created_at).toLocaleString()}</span>
      <button class="lc-card-del" onclick="_lcDelete('${c.id}')">&times;</button>
    </div>
    <div class="lc-card-badges">
      ${s.ok ? `<span class="lc-badge lc-badge-ok">${s.ok} OK</span>` : ''}
      ${s.redirect ? `<span class="lc-badge lc-badge-redirect">${s.redirect} Redirect</span>` : ''}
      ${s.clientError ? `<span class="lc-badge lc-badge-error">${s.clientError} Client Error</span>` : ''}
      ${s.serverError ? `<span class="lc-badge lc-badge-error">${s.serverError} Server Error</span>` : ''}
      ${s.timeout ? `<span class="lc-badge lc-badge-warn">${s.timeout} Timeout</span>` : ''}
    </div>
  </div>`;
}

function _lcRenderResults(results) {
  if (!results || !results.length) return '';
  return `<div class="lc-results-table"><table class="lc-table">
    <thead><tr><th>URL</th><th>Status</th><th>Latency</th><th>Category</th></tr></thead>
    <tbody>${results.map(r => `<tr>
      <td class="lc-url-cell">${esc(r.url || '')}</td>
      <td><span class="lc-status lc-status-${r.category || 'error'}">${r.status || 'ERR'}</span></td>
      <td>${r.latency}ms</td>
      <td><span class="lc-badge lc-badge-${r.category === 'ok' ? 'ok' : r.category === 'redirect' ? 'redirect' : r.category === 'timeout' ? 'warn' : 'error'}">${r.category}</span></td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

async function _lcCheck() {
  const url = document.getElementById('lcUrl').value;
  if (!url) { alert('URL is required'); return; }
  try {
    const result = await api('/api/links/check', { method: 'POST', body: JSON.stringify({ url }) });
    document.getElementById('lcResults').innerHTML = _lcRenderResults([result]);
  } catch (e) { alert(e.message); }
}

async function _lcCrawl() {
  const url = document.getElementById('lcUrl').value;
  if (!url) { alert('URL is required'); return; }
  document.getElementById('lcResults').innerHTML = '<div class="lc-loading">Crawling page and checking links...</div>';
  try {
    const result = await api('/api/links/crawl', { method: 'POST', body: JSON.stringify({ url }) });
    document.getElementById('lcResults').innerHTML = `<div class="lc-crawl-summary">Found ${result.linksFound} links</div>` + _lcRenderResults(result.results);
    loadLinkCheck();
  } catch (e) { document.getElementById('lcResults').innerHTML = ''; alert(e.message); }
}

async function _lcBatch() {
  const text = document.getElementById('lcBatch').value;
  const urls = text.split('\n').map(u => u.trim()).filter(u => u.length > 0);
  if (!urls.length) { alert('Enter at least one URL'); return; }
  document.getElementById('lcResults').innerHTML = '<div class="lc-loading">Checking URLs...</div>';
  try {
    const result = await api('/api/links/check-batch', { method: 'POST', body: JSON.stringify({ urls }) });
    document.getElementById('lcResults').innerHTML = _lcRenderResults(result.results);
    loadLinkCheck();
  } catch (e) { document.getElementById('lcResults').innerHTML = ''; alert(e.message); }
}

async function _lcDelete(id) {
  if (!confirm('Delete this check?')) return;
  try { await api(`/api/links/${id}`, { method: 'DELETE' }); loadLinkCheck(); } catch (e) { alert(e.message); }
}

// ═══ WAVE 9: REGEX TESTER ═══
let _rxLiveTimer = null;
async function loadRegex() {
  const main = document.getElementById('main');
  const [common, saved] = await Promise.all([
    api('/api/regex/common').catch(() => []),
    api('/api/regex').catch(() => []),
  ]);
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">Regex Tester</h1></div>
      <div class="rx-layout">
        <div class="rx-input-panel">
          <div class="rx-field">
            <label class="rx-label">Pattern</label>
            <div class="rx-pattern-row">
              <span class="rx-slash">/</span>
              <input id="rxPattern" class="rx-input rx-mono" placeholder="\\d+" oninput="_rxLiveTest()">
              <span class="rx-slash">/</span>
              <input id="rxFlags" class="rx-input rx-flags" value="g" placeholder="flags" oninput="_rxLiveTest()">
            </div>
          </div>
          <div class="rx-field">
            <label class="rx-label">Replacement <span class="rx-hint">(for replace mode)</span></label>
            <input id="rxReplace" class="rx-input rx-mono" placeholder="replacement string">
          </div>
          <div class="rx-field">
            <label class="rx-label">Test String</label>
            <textarea id="rxText" class="rx-textarea" rows="6" placeholder="Paste text to test against..." oninput="_rxLiveTest()"></textarea>
          </div>
          <div class="rx-actions">
            <button class="btn btn-green" onclick="_rxTest()">Test</button>
            <button class="btn" onclick="_rxReplace()">Replace</button>
            <button class="btn" onclick="_rxSplit()">Split</button>
            <button class="btn" onclick="_rxExplain()">Explain</button>
          </div>
          <div class="rx-field">
            <label class="rx-label">Common Patterns</label>
            <div class="rx-presets">
              ${common.map(p => `<button class="rx-preset-btn" onclick="_rxUsePreset('${esc(p.pattern)}','${esc(p.flags)}')" title="${esc(p.description)}">${esc(p.name)}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="rx-results-panel">
          <div id="rxResults" class="rx-results"><div class="rx-empty">Enter a pattern and test string to begin</div></div>
          <div class="rx-saved-section">
            <div class="rx-saved-header">
              <span class="rx-label">Saved Patterns</span>
              <button class="btn btn-sm" onclick="_rxSave()">Save Current</button>
            </div>
            <div id="rxSaved" class="rx-saved-list">
              ${saved.length ? saved.map(p => `<div class="rx-saved-item"><button class="rx-saved-name" onclick="_rxUsePreset('${esc(p.pattern)}','${esc(p.flags)}')">${esc(p.name)}</button><code class="rx-saved-pat">/${esc(p.pattern)}/${esc(p.flags)}</code><button class="rx-del-btn" onclick="_rxDelete('${p.id}')">&times;</button></div>`).join('') : '<div class="rx-empty">No saved patterns</div>'}
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function _rxLiveTest() {
  clearTimeout(_rxLiveTimer);
  _rxLiveTimer = setTimeout(_rxTest, 300);
}

async function _rxTest() {
  const pattern = document.getElementById('rxPattern').value;
  const flags = document.getElementById('rxFlags').value;
  const text = document.getElementById('rxText').value;
  if (!pattern) return;
  try {
    const r = await api('/api/regex/test', 'POST', { pattern, flags, text });
    let html = `<div class="rx-match-count">${r.matchCount} match${r.matchCount !== 1 ? 'es' : ''}</div>`;
    if (r.matches.length) {
      html += `<div class="rx-highlighted">${_rxHighlight(text, r.matches)}</div>`;
      html += '<table class="rx-match-table"><tr><th>#</th><th>Match</th><th>Index</th><th>Groups</th></tr>';
      r.matches.forEach((m, i) => {
        html += `<tr><td>${i+1}</td><td class="rx-mono">${esc(m.match)}</td><td>${m.index}</td><td>${m.groups.length ? m.groups.map(g => `<code>${esc(g)}</code>`).join(', ') : '—'}</td></tr>`;
      });
      html += '</table>';
    }
    document.getElementById('rxResults').innerHTML = html;
  } catch (e) { document.getElementById('rxResults').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

function _rxHighlight(text, matches) {
  if (!matches.length) return esc(text);
  let result = '';
  let last = 0;
  matches.forEach(m => {
    if (m.index > last) result += esc(text.slice(last, m.index));
    result += `<span class="rx-hl">${esc(m.match)}</span>`;
    last = m.index + m.length;
  });
  if (last < text.length) result += esc(text.slice(last));
  return result;
}

async function _rxReplace() {
  const pattern = document.getElementById('rxPattern').value;
  const flags = document.getElementById('rxFlags').value;
  const text = document.getElementById('rxText').value;
  const replacement = document.getElementById('rxReplace').value;
  if (!pattern) return;
  try {
    const r = await api('/api/regex/replace', 'POST', { pattern, flags, text, replacement });
    document.getElementById('rxResults').innerHTML = `<div class="rx-label">Result</div><pre class="rx-pre">${esc(r.result)}</pre>`;
  } catch (e) { document.getElementById('rxResults').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

async function _rxSplit() {
  const pattern = document.getElementById('rxPattern').value;
  const flags = document.getElementById('rxFlags').value;
  const text = document.getElementById('rxText').value;
  if (!pattern) return;
  try {
    const r = await api('/api/regex/split', 'POST', { pattern, flags, text });
    document.getElementById('rxResults').innerHTML = `<div class="rx-match-count">${r.count} parts</div><pre class="rx-pre">${r.parts.map(p => esc(p)).join('\n')}</pre>`;
  } catch (e) { document.getElementById('rxResults').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

async function _rxExplain() {
  const pattern = document.getElementById('rxPattern').value;
  if (!pattern) return;
  try {
    const r = await api('/api/regex/explain', 'POST', { pattern });
    let html = '<table class="rx-match-table"><tr><th>Token</th><th>Description</th></tr>';
    r.tokens.forEach(t => { html += `<tr><td class="rx-mono">${esc(t.token)}</td><td>${esc(t.description)}</td></tr>`; });
    html += '</table>';
    document.getElementById('rxResults').innerHTML = html;
  } catch (e) { document.getElementById('rxResults').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

function _rxUsePreset(pattern, flags) {
  document.getElementById('rxPattern').value = pattern;
  document.getElementById('rxFlags').value = flags;
  _rxTest();
}

async function _rxSave() {
  const pattern = document.getElementById('rxPattern').value;
  const flags = document.getElementById('rxFlags').value;
  if (!pattern) return alert('Enter a pattern first');
  const name = prompt('Pattern name:');
  if (!name) return;
  try { await api('/api/regex', 'POST', { name, pattern, flags }); loadRegex(); } catch (e) { alert(e.message); }
}

async function _rxDelete(id) {
  if (!confirm('Delete this pattern?')) return;
  try { await api(`/api/regex/${id}`, 'DELETE'); loadRegex(); } catch (e) { alert(e.message); }
}

// ═══ WAVE 9: JWT DEBUGGER ═══
async function loadJwt() {
  const main = document.getElementById('main');
  const algs = await api('/api/jwt/algorithms').catch(() => [{name:'HS256'},{name:'HS384'},{name:'HS512'}]);
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">JWT Debugger</h1></div>
      <div class="jwt-layout">
        <div class="jwt-decode-panel">
          <div class="jwt-section-title">Decode / Verify</div>
          <textarea id="jwtToken" class="jwt-textarea jwt-mono" rows="5" placeholder="Paste JWT token here..." oninput="_jwtDecode()"></textarea>
          <div class="jwt-verify-row">
            <input id="jwtSecret" class="rx-input" placeholder="Secret (for verification)">
            <button class="btn btn-green" onclick="_jwtVerify()">Verify</button>
          </div>
          <div id="jwtDecoded" class="jwt-decoded">
            <div class="jwt-empty">Paste a JWT above to decode</div>
          </div>
        </div>
        <div class="jwt-encode-panel">
          <div class="jwt-section-title">Encode</div>
          <div class="jwt-field"><label class="rx-label">Payload (JSON)</label>
            <textarea id="jwtPayload" class="jwt-textarea jwt-mono" rows="6" placeholder='{"sub": "1234", "name": "John"}'></textarea>
          </div>
          <div class="jwt-encode-row">
            <input id="jwtEncSecret" class="rx-input" placeholder="Secret">
            <select id="jwtAlg" class="rx-input" style="width:120px">
              ${algs.map(a => `<option value="${a.name}"${a.name==='HS256'?' selected':''}>${a.name}</option>`).join('')}
            </select>
            <button class="btn btn-green" onclick="_jwtEncode()">Encode</button>
          </div>
          <div id="jwtEncResult" class="jwt-enc-result"></div>
        </div>
      </div>
    </div>`;
}

async function _jwtDecode() {
  const token = document.getElementById('jwtToken').value.trim();
  if (!token) { document.getElementById('jwtDecoded').innerHTML = '<div class="jwt-empty">Paste a JWT above to decode</div>'; return; }
  try {
    const r = await api('/api/jwt/decode', 'POST', { token });
    document.getElementById('jwtDecoded').innerHTML = `
      <div class="jwt-part jwt-header"><div class="jwt-part-label">HEADER</div><pre class="jwt-json">${esc(JSON.stringify(r.header, null, 2))}</pre></div>
      <div class="jwt-part jwt-payload"><div class="jwt-part-label">PAYLOAD</div><pre class="jwt-json">${esc(JSON.stringify(r.payload, null, 2))}</pre></div>
      <div class="jwt-part jwt-sig"><div class="jwt-part-label">SIGNATURE</div><code class="jwt-mono">${esc(r.signature)}</code></div>
    `;
  } catch (e) { document.getElementById('jwtDecoded').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

async function _jwtVerify() {
  const token = document.getElementById('jwtToken').value.trim();
  const secret = document.getElementById('jwtSecret').value;
  if (!token || !secret) return alert('Token and secret required');
  try {
    const r = await api('/api/jwt/verify', 'POST', { token, secret });
    const badge = r.valid
      ? `<span class="jwt-badge jwt-valid">${r.expired ? 'VALID (Expired)' : 'VALID'}</span>`
      : `<span class="jwt-badge jwt-invalid">INVALID</span>`;
    document.getElementById('jwtDecoded').innerHTML = `
      <div style="margin-bottom:12px">${badge}${r.error ? `<span class="rx-hint" style="margin-left:8px">${esc(r.error)}</span>` : ''}</div>
      ${r.header ? `<div class="jwt-part jwt-header"><div class="jwt-part-label">HEADER</div><pre class="jwt-json">${esc(JSON.stringify(r.header,null,2))}</pre></div>` : ''}
      ${r.payload ? `<div class="jwt-part jwt-payload"><div class="jwt-part-label">PAYLOAD</div><pre class="jwt-json">${esc(JSON.stringify(r.payload,null,2))}</pre></div>` : ''}
    `;
  } catch (e) { document.getElementById('jwtDecoded').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

async function _jwtEncode() {
  const payloadStr = document.getElementById('jwtPayload').value.trim();
  const secret = document.getElementById('jwtEncSecret').value;
  const algorithm = document.getElementById('jwtAlg').value;
  if (!payloadStr || !secret) return alert('Payload and secret required');
  try {
    const payload = JSON.parse(payloadStr);
    const r = await api('/api/jwt/encode', 'POST', { payload, secret, options: { algorithm } });
    document.getElementById('jwtEncResult').innerHTML = `<div class="rx-label">Generated Token</div><textarea class="jwt-textarea jwt-mono" rows="3" readonly onclick="this.select()">${esc(r.token)}</textarea>`;
  } catch (e) { document.getElementById('jwtEncResult').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

// ═══ WAVE 9: DIFF VIEWER ═══
async function loadDiff() {
  const main = document.getElementById('main');
  const saved = await api('/api/diff').catch(() => []);
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">Diff Viewer</h1>
        <div style="display:flex;gap:6px"><button class="btn btn-green" onclick="_dfCompare()">Compare</button><button class="btn" onclick="_dfSave()">Save</button></div>
      </div>
      <div class="df-layout">
        <div class="df-input-panel">
          <div class="df-side"><label class="rx-label">Original (A)</label><textarea id="dfTextA" class="df-textarea" rows="12" placeholder="Paste original text..."></textarea></div>
          <div class="df-side"><label class="rx-label">Modified (B)</label><textarea id="dfTextB" class="df-textarea" rows="12" placeholder="Paste modified text..."></textarea></div>
        </div>
        <div id="dfStats" class="df-stats"></div>
        <div id="dfOutput" class="df-output"><div class="rx-empty">Enter two texts and click Compare</div></div>
        ${saved.length ? `<div class="rx-saved-section"><div class="rx-label" style="margin-bottom:8px">Saved Snapshots</div><div class="rx-saved-list">${saved.map(s => `<div class="rx-saved-item"><button class="rx-saved-name" onclick="_dfLoad('${s.id}')">${esc(s.name)}</button><span class="rx-hint">+${s.stats.additions||0} -${s.stats.deletions||0}</span><button class="rx-del-btn" onclick="_dfDelete('${s.id}')">&times;</button></div>`).join('')}</div></div>` : ''}
      </div>
    </div>`;
}

async function _dfCompare() {
  const textA = document.getElementById('dfTextA').value;
  const textB = document.getElementById('dfTextB').value;
  try {
    const r = await api('/api/diff/compare', 'POST', { textA, textB });
    document.getElementById('dfStats').innerHTML = `<span class="df-stat df-add">+${r.stats.additions}</span><span class="df-stat df-rem">-${r.stats.deletions}</span><span class="df-stat">${r.stats.unchanged} unchanged</span>`;
    let html = '<div class="df-lines">';
    r.diff.forEach(d => {
      const cls = d.type === 'add' ? 'df-line-add' : d.type === 'remove' ? 'df-line-rem' : 'df-line-eq';
      const prefix = d.type === 'add' ? '+' : d.type === 'remove' ? '-' : ' ';
      const lineNum = d.type === 'remove' ? (d.lineA || '') : d.type === 'add' ? (d.lineB || '') : (d.lineA || '');
      html += `<div class="df-line ${cls}"><span class="df-linenum">${lineNum}</span><span class="df-prefix">${prefix}</span><span class="df-content">${esc(d.line)}</span></div>`;
    });
    html += '</div>';
    document.getElementById('dfOutput').innerHTML = html;
  } catch (e) { document.getElementById('dfOutput').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

async function _dfSave() {
  const textA = document.getElementById('dfTextA').value;
  const textB = document.getElementById('dfTextB').value;
  const name = prompt('Snapshot name:');
  if (!name) return;
  try { await api('/api/diff', 'POST', { name, textA, textB }); loadDiff(); } catch (e) { alert(e.message); }
}

async function _dfLoad(id) {
  try {
    const s = await api(`/api/diff/${id}`);
    document.getElementById('dfTextA').value = s.text_a || '';
    document.getElementById('dfTextB').value = s.text_b || '';
    _dfCompare();
  } catch (e) { alert(e.message); }
}

async function _dfDelete(id) {
  if (!confirm('Delete snapshot?')) return;
  try { await api(`/api/diff/${id}`, 'DELETE'); loadDiff(); } catch (e) { alert(e.message); }
}

// ═══ WAVE 9: IMAGE TOOLS ═══
async function loadImages() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">Image Tools</h1></div>
      <div class="img-layout">
        <div class="img-drop-panel">
          <div class="img-dropzone" id="imgDropzone" onclick="document.getElementById('imgFile').click()" ondrop="_imgDrop(event)" ondragover="event.preventDefault();this.classList.add('img-dragover')" ondragleave="this.classList.remove('img-dragover')">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>
            <div style="margin-top:8px;color:var(--text2)">Drop image or click to select</div>
            <input type="file" id="imgFile" accept="image/*" style="display:none" onchange="_imgSelect(this)">
          </div>
          <div id="imgPreview" class="img-preview"></div>
          <div id="imgInfo" class="img-info"></div>
        </div>
        <div class="img-tools-panel">
          <div class="jwt-section-title">Base64 Output</div>
          <textarea id="imgBase64" class="jwt-textarea jwt-mono" rows="4" readonly placeholder="Base64 data will appear here..." onclick="this.select()"></textarea>
          <div class="jwt-section-title" style="margin-top:16px">Placeholder Generator</div>
          <div class="img-ph-row">
            <input id="imgPhW" class="rx-input" type="number" value="300" placeholder="W" style="width:70px">
            <span style="color:var(--text3)">&times;</span>
            <input id="imgPhH" class="rx-input" type="number" value="200" placeholder="H" style="width:70px">
            <input id="imgPhColor" class="rx-input" type="color" value="#1a1a28" style="width:40px;padding:2px">
            <input id="imgPhText" class="rx-input" placeholder="Label" style="width:100px">
            <button class="btn btn-green" onclick="_imgPlaceholder()">Generate</button>
          </div>
          <div id="imgPhResult"></div>
        </div>
      </div>
    </div>`;
}

function _imgDrop(e) {
  e.preventDefault();
  document.getElementById('imgDropzone').classList.remove('img-dragover');
  const file = e.dataTransfer.files[0];
  if (file) _imgProcess(file);
}

function _imgSelect(input) {
  if (input.files[0]) _imgProcess(input.files[0]);
}

async function _imgProcess(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    const base64Full = reader.result;
    const base64Data = base64Full.split(',')[1];
    document.getElementById('imgPreview').innerHTML = `<img src="${base64Full}" class="img-preview-img">`;
    document.getElementById('imgBase64').value = base64Full;
    try {
      const info = await api('/api/images/info', 'POST', { data: base64Data });
      document.getElementById('imgInfo').innerHTML = `
        <div class="img-info-grid">
          <div class="img-info-item"><span class="rx-hint">Format</span><span>${info.format}</span></div>
          <div class="img-info-item"><span class="rx-hint">Dimensions</span><span>${info.width || '?'} × ${info.height || '?'}</span></div>
          <div class="img-info-item"><span class="rx-hint">Size</span><span>${(info.size / 1024).toFixed(1)} KB</span></div>
        </div>`;
    } catch (e) { document.getElementById('imgInfo').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
  };
  reader.readAsDataURL(file);
}

async function _imgPlaceholder() {
  const width = parseInt(document.getElementById('imgPhW').value) || 300;
  const height = parseInt(document.getElementById('imgPhH').value) || 200;
  const color = document.getElementById('imgPhColor').value;
  const text = document.getElementById('imgPhText').value;
  try {
    const r = await api('/api/images/placeholder', 'POST', { width, height, color, text });
    document.getElementById('imgPhResult').innerHTML = `<img src="${r.dataUri}" class="img-preview-img" style="max-width:300px;margin-top:8px">`;
  } catch (e) { document.getElementById('imgPhResult').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

// ═══ WAVE 9: CRON BUILDER ═══
async function loadCronExpr() {
  const main = document.getElementById('main');
  const [presets, custom] = await Promise.all([
    api('/api/cron-expr/presets'),
    api('/api/cron-expr'),
  ]);
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">Cron Expression Builder</h1></div>
      <div class="crn-layout">
        <div class="crn-builder">
          <div class="crn-fields">
            <div class="crn-field"><label class="rx-label">Minute</label><input id="crnMin" class="rx-input rx-mono" value="*" oninput="_crnUpdate()"></div>
            <div class="crn-field"><label class="rx-label">Hour</label><input id="crnHr" class="rx-input rx-mono" value="*" oninput="_crnUpdate()"></div>
            <div class="crn-field"><label class="rx-label">Day/Month</label><input id="crnDom" class="rx-input rx-mono" value="*" oninput="_crnUpdate()"></div>
            <div class="crn-field"><label class="rx-label">Month</label><input id="crnMon" class="rx-input rx-mono" value="*" oninput="_crnUpdate()"></div>
            <div class="crn-field"><label class="rx-label">Day/Week</label><input id="crnDow" class="rx-input rx-mono" value="*" oninput="_crnUpdate()"></div>
          </div>
          <div class="crn-expr-row">
            <code id="crnExpr" class="crn-expr-display">* * * * *</code>
            <button class="btn btn-green" onclick="_crnExplain()">Explain</button>
            <button class="btn" onclick="_crnNextRuns()">Next Runs</button>
            <button class="btn" onclick="_crnSave()">Save</button>
          </div>
          <div id="crnExplanation" class="crn-explanation"></div>
          <div id="crnNextRuns" class="crn-next-runs"></div>
        </div>
        <div class="crn-presets-panel">
          <div class="rx-label" style="margin-bottom:8px">Presets</div>
          <div class="crn-presets-grid">
            ${presets.map(p => `<button class="crn-preset-btn" onclick="_crnUsePreset('${esc(p.expression)}')" title="${esc(p.description)}"><span class="crn-preset-name">${esc(p.name)}</span><code class="crn-preset-expr">${esc(p.expression)}</code></button>`).join('')}
          </div>
          ${custom.length ? `<div class="rx-label" style="margin:12px 0 8px">Custom</div><div class="rx-saved-list">${custom.map(c => `<div class="rx-saved-item"><button class="rx-saved-name" onclick="_crnUsePreset('${esc(c.expression)}')">${esc(c.name)}</button><code class="rx-hint">${esc(c.expression)}</code><button class="rx-del-btn" onclick="_crnDelete('${c.id}')">&times;</button></div>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>`;
  _crnUpdate();
}

function _crnUpdate() {
  const expr = `${document.getElementById('crnMin').value} ${document.getElementById('crnHr').value} ${document.getElementById('crnDom').value} ${document.getElementById('crnMon').value} ${document.getElementById('crnDow').value}`;
  document.getElementById('crnExpr').textContent = expr;
}

async function _crnExplain() {
  _crnUpdate();
  const expression = document.getElementById('crnExpr').textContent;
  try {
    const r = await api('/api/cron-expr/explain', 'POST', { expression });
    document.getElementById('crnExplanation').innerHTML = `<div class="crn-explain-text">${esc(r.explanation)}</div>`;
  } catch (e) { document.getElementById('crnExplanation').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

async function _crnNextRuns() {
  _crnUpdate();
  const expression = document.getElementById('crnExpr').textContent;
  try {
    const r = await api('/api/cron-expr/next-runs', 'POST', { expression, count: 5 });
    document.getElementById('crnNextRuns').innerHTML = `<div class="crn-runs-list">${r.runs.map((run, i) => `<div class="crn-run-item"><span class="crn-run-idx">${i+1}</span><span>${new Date(run).toLocaleString()}</span></div>`).join('')}</div>`;
  } catch (e) { document.getElementById('crnNextRuns').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

function _crnUsePreset(expr) {
  const parts = expr.split(' ');
  document.getElementById('crnMin').value = parts[0] || '*';
  document.getElementById('crnHr').value = parts[1] || '*';
  document.getElementById('crnDom').value = parts[2] || '*';
  document.getElementById('crnMon').value = parts[3] || '*';
  document.getElementById('crnDow').value = parts[4] || '*';
  _crnUpdate();
  _crnExplain();
  _crnNextRuns();
}

async function _crnSave() {
  _crnUpdate();
  const expression = document.getElementById('crnExpr').textContent;
  const name = prompt('Preset name:');
  if (!name) return;
  try { await api('/api/cron-expr', 'POST', { name, expression }); loadCronExpr(); } catch (e) { alert(e.message); }
}

async function _crnDelete(id) {
  if (!confirm('Delete preset?')) return;
  try { await api(`/api/cron-expr/${id}`, 'DELETE'); loadCronExpr(); } catch (e) { alert(e.message); }
}

// ═══ WAVE 9: COLOR TOOLS ═══
async function loadColors() {
  const main = document.getElementById('main');
  const saved = await api('/api/colors');
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">Color Tools</h1></div>
      <div class="clr-layout">
        <div class="clr-picker-panel">
          <div class="clr-input-row">
            <input id="clrInput" class="rx-input rx-mono" value="#DA7756" placeholder="#hex, rgb(), hsl(), or name" oninput="_clrConvert()">
            <input id="clrPicker" type="color" value="#DA7756" class="clr-color-input" oninput="document.getElementById('clrInput').value=this.value;_clrConvert()">
          </div>
          <div id="clrConversions" class="clr-conversions"></div>
          <div class="jwt-section-title" style="margin-top:16px">Contrast Checker</div>
          <div class="clr-contrast-row">
            <input id="clrFg" class="rx-input rx-mono" value="#ffffff" placeholder="Foreground">
            <input id="clrBg" class="rx-input rx-mono" value="#000000" placeholder="Background">
            <button class="btn btn-green" onclick="_clrContrast()">Check</button>
          </div>
          <div id="clrContrastResult"></div>
          <div class="jwt-section-title" style="margin-top:16px">Palette Generator</div>
          <div class="clr-palette-row">
            <select id="clrPalType" class="rx-input" style="width:180px">
              <option value="complementary">Complementary</option>
              <option value="analogous">Analogous</option>
              <option value="triadic">Triadic</option>
              <option value="split-complementary">Split-Comp.</option>
              <option value="monochromatic">Monochromatic</option>
            </select>
            <button class="btn btn-green" onclick="_clrPalette()">Generate</button>
            <button class="btn" onclick="_clrSavePalette()">Save</button>
          </div>
          <div id="clrPalette" class="clr-palette-display"></div>
          <div class="jwt-section-title" style="margin-top:16px">Shades</div>
          <div id="clrShades" class="clr-shades-bar"></div>
        </div>
        <div class="clr-saved-panel">
          <div class="rx-label" style="margin-bottom:8px">Saved Palettes</div>
          <div id="clrSaved" class="clr-saved-list">
            ${saved.length ? saved.map(p => `<div class="clr-saved-item"><div class="clr-saved-header"><span>${esc(p.name)}</span><button class="rx-del-btn" onclick="_clrDeletePalette('${p.id}')">&times;</button></div><div class="clr-palette-strip">${(p.colors||[]).map(c => `<div class="clr-swatch" style="background:${c}" title="${c}"></div>`).join('')}</div></div>`).join('') : '<div class="rx-empty">No saved palettes</div>'}
          </div>
        </div>
      </div>
    </div>`;
  _clrConvert();
}

let _clrCurrentPalette = [];

async function _clrConvert() {
  const color = document.getElementById('clrInput').value.trim();
  if (!color) return;
  try {
    const r = await api('/api/colors/convert', 'POST', { color });
    document.getElementById('clrPicker').value = r.hex;
    document.getElementById('clrConversions').innerHTML = `
      <div class="clr-conv-grid">
        <div class="clr-conv-item"><span class="rx-hint">HEX</span><code class="rx-mono">${r.hex}</code></div>
        <div class="clr-conv-item"><span class="rx-hint">RGB</span><code class="rx-mono">rgb(${r.rgb.r}, ${r.rgb.g}, ${r.rgb.b})</code></div>
        <div class="clr-conv-item"><span class="rx-hint">HSL</span><code class="rx-mono">hsl(${r.hsl.h}, ${r.hsl.s}%, ${r.hsl.l}%)</code></div>
      </div>
      <div class="clr-preview-bar" style="background:${r.hex}"></div>`;
    // Auto-generate shades
    const sh = await api('/api/colors/shades', 'POST', { color: r.hex, steps: 9 });
    document.getElementById('clrShades').innerHTML = sh.shades.map(s => `<div class="clr-shade" style="background:${s}" title="${s}"></div>`).join('');
  } catch (e) { document.getElementById('clrConversions').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

async function _clrContrast() {
  const color1 = document.getElementById('clrFg').value.trim();
  const color2 = document.getElementById('clrBg').value.trim();
  if (!color1 || !color2) return;
  try {
    const r = await api('/api/colors/contrast', 'POST', { color1, color2 });
    document.getElementById('clrContrastResult').innerHTML = `
      <div class="clr-contrast-display">
        <div class="clr-ratio">${r.ratio}:1</div>
        <div class="clr-wcag-badges">
          <span class="jwt-badge ${r.AA.normalText ? 'jwt-valid' : 'jwt-invalid'}">AA Normal</span>
          <span class="jwt-badge ${r.AA.largeText ? 'jwt-valid' : 'jwt-invalid'}">AA Large</span>
          <span class="jwt-badge ${r.AAA.normalText ? 'jwt-valid' : 'jwt-invalid'}">AAA Normal</span>
          <span class="jwt-badge ${r.AAA.largeText ? 'jwt-valid' : 'jwt-invalid'}">AAA Large</span>
        </div>
        <div class="clr-contrast-preview" style="background:${document.getElementById('clrBg').value};color:${document.getElementById('clrFg').value};padding:12px;border-radius:6px;margin-top:8px">
          The quick brown fox jumps over the lazy dog
        </div>
      </div>`;
  } catch (e) { document.getElementById('clrContrastResult').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

async function _clrPalette() {
  const color = document.getElementById('clrInput').value.trim();
  const type = document.getElementById('clrPalType').value;
  if (!color) return;
  try {
    const r = await api('/api/colors/palette', 'POST', { color, type });
    _clrCurrentPalette = r.colors;
    document.getElementById('clrPalette').innerHTML = `<div class="clr-palette-strip">${r.colors.map(c => `<div class="clr-swatch-lg" style="background:${c}"><span class="clr-swatch-label">${c}</span></div>`).join('')}</div>`;
  } catch (e) { document.getElementById('clrPalette').innerHTML = `<div class="rx-error">${esc(e.message)}</div>`; }
}

async function _clrSavePalette() {
  if (!_clrCurrentPalette.length) return alert('Generate a palette first');
  const name = prompt('Palette name:');
  if (!name) return;
  const type = document.getElementById('clrPalType').value;
  try { await api('/api/colors', 'POST', { name, colors: _clrCurrentPalette, type }); loadColors(); } catch (e) { alert(e.message); }
}

async function _clrDeletePalette(id) {
  if (!confirm('Delete palette?')) return;
  try { await api(`/api/colors/${id}`, 'DELETE'); loadColors(); } catch (e) { alert(e.message); }
}

// ═══════════════════════════════════════════════════
// WAVE 10 — Base64, Hash, UUID, JSON, YAML, Lorem
// ═══════════════════════════════════════════════════

// ── Cross-Feature Helpers (Phase 3) ──
function _copyToClip(text) {
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard')).catch(() => showToast('Copy failed', 'error'));
}

async function _saveToNotes(title, content) {
  try {
    await api('/api/notes', 'POST', { title, content });
    showToast('Saved to Notes');
  } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
}

// ── Base64 Page ──
async function loadBase64() {
  _trackPageVisit('base64');
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">Base64 Codec</h1></div>
      <div class="b64-layout" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label class="rx-label">Input</label>
          <textarea id="b64Input" class="rx-textarea" rows="8" placeholder="Enter text to encode/decode..."></textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-green" onclick="_b64Encode()">Encode</button>
            <button class="btn" onclick="_b64Decode()">Decode</button>
            <button class="btn" onclick="_b64EncodeUrl()">URL-Safe Encode</button>
            <button class="btn" onclick="_b64DecodeUrl()">URL-Safe Decode</button>
          </div>
        </div>
        <div>
          <label class="rx-label">Output</label>
          <textarea id="b64Output" class="rx-textarea" rows="8" readonly></textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn" onclick="_copyToClip(document.getElementById('b64Output').value)">Copy</button>
            <button class="btn" onclick="_saveToNotes('Base64 Result',document.getElementById('b64Output').value)">Save to Notes</button>
          </div>
        </div>
      </div>
      <div style="margin-top:16px">
        <label class="rx-label">Validate</label>
        <div style="display:flex;gap:8px">
          <input id="b64Validate" class="rx-input" placeholder="Paste Base64 to validate...">
          <button class="btn" onclick="_b64Validate()">Check</button>
          <span id="b64ValidResult" style="line-height:32px;font:12px var(--mono)"></span>
        </div>
      </div>
    </div>`;
}
async function _b64Encode() { try { const r = await api('/api/base64/encode','POST',{text:document.getElementById('b64Input').value}); document.getElementById('b64Output').value = r.result; } catch(e) { document.getElementById('b64Output').value = 'Error: '+e.message; } }
async function _b64Decode() { try { const r = await api('/api/base64/decode','POST',{text:document.getElementById('b64Input').value}); document.getElementById('b64Output').value = r.result; } catch(e) { document.getElementById('b64Output').value = 'Error: '+e.message; } }
async function _b64EncodeUrl() { try { const r = await api('/api/base64/encode-url','POST',{text:document.getElementById('b64Input').value}); document.getElementById('b64Output').value = r.result; } catch(e) { document.getElementById('b64Output').value = 'Error: '+e.message; } }
async function _b64DecodeUrl() { try { const r = await api('/api/base64/decode-url','POST',{text:document.getElementById('b64Input').value}); document.getElementById('b64Output').value = r.result; } catch(e) { document.getElementById('b64Output').value = 'Error: '+e.message; } }
async function _b64Validate() { try { const r = await api('/api/base64/validate','POST',{text:document.getElementById('b64Validate').value}); document.getElementById('b64ValidResult').innerHTML = r.valid ? '<span style="color:var(--green)">Valid Base64</span>' : '<span style="color:var(--red)">Invalid Base64</span>'; } catch(e) { document.getElementById('b64ValidResult').textContent = e.message; } }

// ── Hash Generator Page ──
async function loadHashGen() {
  _trackPageVisit('hashgen');
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">Hash Generator</h1></div>
      <div class="hsh-layout" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label class="rx-label">Input Text</label>
          <textarea id="hshInput" class="rx-textarea" rows="5" placeholder="Enter text to hash..."></textarea>
          <label class="rx-label" style="margin-top:12px">Algorithm</label>
          <select id="hshAlgo" class="rx-input">
            <option value="md5">MD5</option>
            <option value="sha1">SHA-1</option>
            <option value="sha256" selected>SHA-256</option>
            <option value="sha512">SHA-512</option>
          </select>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-green" onclick="_hshGenerate()">Generate Hash</button>
            <button class="btn" onclick="_hshGenerateAll()">All Algorithms</button>
          </div>
          <div class="jwt-section-title" style="margin-top:16px">HMAC</div>
          <input id="hshKey" class="rx-input" placeholder="Secret key" style="margin-bottom:8px">
          <button class="btn" onclick="_hshHmac()">Generate HMAC</button>
          <div class="jwt-section-title" style="margin-top:16px">Bcrypt</div>
          <div style="display:flex;gap:8px">
            <button class="btn" onclick="_hshBcrypt()">Bcrypt Hash</button>
            <input id="hshBcryptHash" class="rx-input" placeholder="Bcrypt hash to compare" style="flex:1">
            <button class="btn" onclick="_hshBcryptCompare()">Compare</button>
          </div>
        </div>
        <div>
          <label class="rx-label">Output</label>
          <div id="hshOutput" style="font:13px var(--mono);color:var(--text);background:var(--bg);padding:16px;border-radius:8px;border:1px solid var(--border);min-height:200px;word-break:break-all;white-space:pre-wrap">Enter text and click Generate</div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn" onclick="_copyToClip(document.getElementById('hshOutput').textContent)">Copy</button>
            <button class="btn" onclick="_saveToNotes('Hash Result',document.getElementById('hshOutput').textContent)">Save to Notes</button>
          </div>
        </div>
      </div>
    </div>`;
}
async function _hshGenerate() { try { const r = await api('/api/hash/generate','POST',{text:document.getElementById('hshInput').value,algorithm:document.getElementById('hshAlgo').value}); document.getElementById('hshOutput').textContent = r.algorithm.toUpperCase()+': '+r.hash; } catch(e) { document.getElementById('hshOutput').textContent = 'Error: '+e.message; } }
async function _hshGenerateAll() { const text = document.getElementById('hshInput').value; const algos = ['md5','sha1','sha256','sha512']; const results = []; for(const a of algos) { try { const r = await api('/api/hash/generate','POST',{text,algorithm:a}); results.push(r.algorithm.toUpperCase()+': '+r.hash); } catch(e) { results.push(a+': Error'); } } document.getElementById('hshOutput').textContent = results.join('\n\n'); }
async function _hshHmac() { try { const r = await api('/api/hash/hmac','POST',{text:document.getElementById('hshInput').value,key:document.getElementById('hshKey').value,algorithm:document.getElementById('hshAlgo').value}); document.getElementById('hshOutput').textContent = 'HMAC-'+r.algorithm.toUpperCase()+': '+r.hash; } catch(e) { document.getElementById('hshOutput').textContent = 'Error: '+e.message; } }
async function _hshBcrypt() { try { const r = await api('/api/hash/bcrypt','POST',{text:document.getElementById('hshInput').value}); document.getElementById('hshOutput').textContent = 'Bcrypt: '+r.hash; } catch(e) { document.getElementById('hshOutput').textContent = 'Error: '+e.message; } }
async function _hshBcryptCompare() { try { const r = await api('/api/hash/bcrypt-compare','POST',{text:document.getElementById('hshInput').value,hash:document.getElementById('hshBcryptHash').value}); document.getElementById('hshOutput').innerHTML = r.match ? '<span style="color:var(--green)">Match!</span>' : '<span style="color:var(--red)">No match</span>'; } catch(e) { document.getElementById('hshOutput').textContent = 'Error: '+e.message; } }

// ── UUID Generator Page ──
async function loadUuidGen() {
  _trackPageVisit('uuidgen');
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">UUID Tools</h1></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div class="jwt-section-title">Generate</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-green" onclick="_uidGen('v4')">UUID v4</button>
            <button class="btn" onclick="_uidGen('v1')">UUID v1</button>
            <button class="btn" onclick="_uidGen('nil')">Nil UUID</button>
          </div>
          <div style="margin-top:12px">
            <label class="rx-label">Batch Generate</label>
            <div style="display:flex;gap:8px">
              <input id="uidBatchCount" class="rx-input" type="number" value="5" min="1" max="100" style="width:80px">
              <button class="btn" onclick="_uidBatch()">Generate Batch</button>
            </div>
          </div>
          <div style="margin-top:16px">
            <div class="jwt-section-title">Validate & Parse</div>
            <input id="uidValidate" class="rx-input" placeholder="Paste UUID to validate..." style="margin-bottom:8px">
            <div style="display:flex;gap:8px">
              <button class="btn" onclick="_uidValidate()">Validate</button>
              <button class="btn" onclick="_uidParse()">Parse</button>
            </div>
          </div>
        </div>
        <div>
          <label class="rx-label">Output</label>
          <div id="uidOutput" style="font:13px var(--mono);color:var(--text);background:var(--bg);padding:16px;border-radius:8px;border:1px solid var(--border);min-height:200px;word-break:break-all;white-space:pre-wrap">Click Generate to create UUIDs</div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn" onclick="_copyToClip(document.getElementById('uidOutput').textContent)">Copy</button>
            <button class="btn" onclick="_saveToNotes('UUID Result',document.getElementById('uidOutput').textContent)">Save to Notes</button>
          </div>
        </div>
      </div>
    </div>`;
}
async function _uidGen(type) { try { const r = await api('/api/uuid/'+type); document.getElementById('uidOutput').textContent = r.uuid; } catch(e) { document.getElementById('uidOutput').textContent = 'Error: '+e.message; } }
async function _uidBatch() { try { const count = parseInt(document.getElementById('uidBatchCount').value)||5; const r = await api('/api/uuid/batch?count='+count); document.getElementById('uidOutput').textContent = r.uuids.join('\n'); } catch(e) { document.getElementById('uidOutput').textContent = 'Error: '+e.message; } }
async function _uidValidate() { try { const r = await api('/api/uuid/validate','POST',{uuid:document.getElementById('uidValidate').value}); document.getElementById('uidOutput').innerHTML = r.valid ? `<span style="color:var(--green)">Valid UUID (v${r.version || '?'})</span>` : '<span style="color:var(--red)">Invalid UUID</span>'; } catch(e) { document.getElementById('uidOutput').textContent = 'Error: '+e.message; } }
async function _uidParse() { try { const r = await api('/api/uuid/parse','POST',{uuid:document.getElementById('uidValidate').value}); document.getElementById('uidOutput').textContent = JSON.stringify(r.parsed,null,2); } catch(e) { document.getElementById('uidOutput').textContent = 'Error: '+e.message; } }

// ── JSON Formatter Page ──
async function loadJsonTools() {
  _trackPageVisit('jsontools');
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">JSON Formatter</h1></div>
      <div class="jsf-layout" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label class="rx-label">Input JSON</label>
          <textarea id="jsfInput" class="rx-textarea rx-mono" rows="12" placeholder='{"key": "value"}'></textarea>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            <button class="btn btn-green" onclick="_jsfFormat()">Format</button>
            <button class="btn" onclick="_jsfMinify()">Minify</button>
            <button class="btn" onclick="_jsfValidate()">Validate</button>
            <button class="btn" onclick="_jsfSortKeys()">Sort Keys</button>
            <button class="btn" onclick="_jsfFlatten()">Flatten</button>
            <button class="btn" onclick="_jsfUnflatten()">Unflatten</button>
            <button class="btn" onclick="_jsfStats()">Stats</button>
          </div>
          <div class="jwt-section-title" style="margin-top:16px">Query (dot-notation)</div>
          <div style="display:flex;gap:8px">
            <input id="jsfQueryPath" class="rx-input rx-mono" placeholder="data.items[0].name">
            <button class="btn" onclick="_jsfQuery()">Query</button>
          </div>
          <div class="jwt-section-title" style="margin-top:16px">Diff</div>
          <textarea id="jsfDiffB" class="rx-textarea rx-mono" rows="4" placeholder="Second JSON for comparison..."></textarea>
          <button class="btn" onclick="_jsfDiff()" style="margin-top:8px">Compare</button>
        </div>
        <div>
          <label class="rx-label">Output</label>
          <pre id="jsfOutput" style="font:13px var(--mono);color:var(--text);background:var(--bg);padding:16px;border-radius:8px;border:1px solid var(--border);min-height:300px;overflow:auto;white-space:pre-wrap;word-break:break-all">Paste JSON and click an action</pre>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn" onclick="_copyToClip(document.getElementById('jsfOutput').textContent)">Copy</button>
            <button class="btn" onclick="_saveToNotes('JSON Result',document.getElementById('jsfOutput').textContent)">Save to Notes</button>
          </div>
        </div>
      </div>
    </div>`;
}
async function _jsfFormat() { try { const r = await api('/api/json/format','POST',{text:document.getElementById('jsfInput').value}); document.getElementById('jsfOutput').textContent = r.result; } catch(e) { document.getElementById('jsfOutput').textContent = 'Error: '+e.message; } }
async function _jsfMinify() { try { const r = await api('/api/json/minify','POST',{text:document.getElementById('jsfInput').value}); document.getElementById('jsfOutput').textContent = r.result; } catch(e) { document.getElementById('jsfOutput').textContent = 'Error: '+e.message; } }
async function _jsfValidate() { try { const r = await api('/api/json/validate','POST',{text:document.getElementById('jsfInput').value}); document.getElementById('jsfOutput').innerHTML = r.valid ? '<span style="color:var(--green)">Valid JSON</span>' : '<span style="color:var(--red)">Invalid: '+esc(r.error)+'</span>'; } catch(e) { document.getElementById('jsfOutput').textContent = 'Error: '+e.message; } }
async function _jsfSortKeys() { try { const r = await api('/api/json/sort-keys','POST',{text:document.getElementById('jsfInput').value}); document.getElementById('jsfOutput').textContent = r.result; } catch(e) { document.getElementById('jsfOutput').textContent = 'Error: '+e.message; } }
async function _jsfFlatten() { try { const r = await api('/api/json/flatten','POST',{text:document.getElementById('jsfInput').value}); document.getElementById('jsfOutput').textContent = JSON.stringify(r.result,null,2); } catch(e) { document.getElementById('jsfOutput').textContent = 'Error: '+e.message; } }
async function _jsfUnflatten() { try { const r = await api('/api/json/unflatten','POST',{text:document.getElementById('jsfInput').value}); document.getElementById('jsfOutput').textContent = JSON.stringify(r.result,null,2); } catch(e) { document.getElementById('jsfOutput').textContent = 'Error: '+e.message; } }
async function _jsfStats() { try { const r = await api('/api/json/stats','POST',{text:document.getElementById('jsfInput').value}); document.getElementById('jsfOutput').textContent = JSON.stringify(r.stats,null,2); } catch(e) { document.getElementById('jsfOutput').textContent = 'Error: '+e.message; } }
async function _jsfQuery() { try { const r = await api('/api/json/query','POST',{text:document.getElementById('jsfInput').value,path:document.getElementById('jsfQueryPath').value}); document.getElementById('jsfOutput').textContent = typeof r.result === 'object' ? JSON.stringify(r.result,null,2) : String(r.result); } catch(e) { document.getElementById('jsfOutput').textContent = 'Error: '+e.message; } }
async function _jsfDiff() { try { const r = await api('/api/json/diff','POST',{a:document.getElementById('jsfInput').value,b:document.getElementById('jsfDiffB').value}); document.getElementById('jsfOutput').textContent = r.diffs.length ? r.diffs.map(d => `${d.type.toUpperCase()} ${d.path}: ${d.type==='added'?JSON.stringify(d.newValue):d.type==='removed'?JSON.stringify(d.oldValue):JSON.stringify(d.oldValue)+' → '+JSON.stringify(d.newValue)}`).join('\n') : 'No differences'; } catch(e) { document.getElementById('jsfOutput').textContent = 'Error: '+e.message; } }

// ── YAML Tools Page ──
async function loadYamlTools() {
  _trackPageVisit('yamltools');
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">YAML Tools</h1></div>
      <div class="yml-layout" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label class="rx-label">Input</label>
          <textarea id="ymlInput" class="rx-textarea rx-mono" rows="12" placeholder="Paste YAML or JSON here..."></textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-green" onclick="_ymlToJson()">YAML → JSON</button>
            <button class="btn" onclick="_ymlToYaml()">JSON → YAML</button>
            <button class="btn" onclick="_ymlValidate()">Validate YAML</button>
          </div>
        </div>
        <div>
          <label class="rx-label">Output</label>
          <pre id="ymlOutput" style="font:13px var(--mono);color:var(--text);background:var(--bg);padding:16px;border-radius:8px;border:1px solid var(--border);min-height:300px;overflow:auto;white-space:pre-wrap">Paste content and convert</pre>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn" onclick="_copyToClip(document.getElementById('ymlOutput').textContent)">Copy</button>
            <button class="btn" onclick="_saveToNotes('YAML Result',document.getElementById('ymlOutput').textContent)">Save to Notes</button>
          </div>
        </div>
      </div>
    </div>`;
}
async function _ymlToJson() { try { const r = await api('/api/yaml/to-json','POST',{text:document.getElementById('ymlInput').value}); document.getElementById('ymlOutput').textContent = r.result; } catch(e) { document.getElementById('ymlOutput').textContent = 'Error: '+e.message; } }
async function _ymlToYaml() { try { const r = await api('/api/yaml/to-yaml','POST',{text:document.getElementById('ymlInput').value}); document.getElementById('ymlOutput').textContent = r.result; } catch(e) { document.getElementById('ymlOutput').textContent = 'Error: '+e.message; } }
async function _ymlValidate() { try { const r = await api('/api/yaml/validate','POST',{text:document.getElementById('ymlInput').value}); document.getElementById('ymlOutput').innerHTML = r.valid ? '<span style="color:var(--green)">Valid YAML</span>' : '<span style="color:var(--red)">Invalid: '+esc(r.error)+'</span>'; } catch(e) { document.getElementById('ymlOutput').textContent = 'Error: '+e.message; } }

// ── Lorem / Fake Data Page ──
async function loadLoremGen() {
  _trackPageVisit('loremgen');
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page page-pad">
      <div class="page-header"><h1 class="page-title">Lorem & Fake Data</h1></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div class="jwt-section-title">Lorem Ipsum</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <div style="display:flex;gap:4px;align-items:center"><label style="font:12px var(--sans);color:var(--text3)">Count:</label><input id="lorCount" class="rx-input" type="number" value="5" min="1" max="100" style="width:60px"></div>
            <button class="btn btn-green" onclick="_lorGen('words')">Words</button>
            <button class="btn" onclick="_lorGen('sentences')">Sentences</button>
            <button class="btn" onclick="_lorGen('paragraphs')">Paragraphs</button>
          </div>
          <div class="jwt-section-title" style="margin-top:16px">Fake Data</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn" onclick="_lorFake('name')">Name</button>
            <button class="btn" onclick="_lorFake('email')">Email</button>
            <button class="btn" onclick="_lorFake('phone')">Phone</button>
            <button class="btn" onclick="_lorFake('address')">Address</button>
            <button class="btn" onclick="_lorFake('company')">Company</button>
            <button class="btn" onclick="_lorFake('date')">Date</button>
            <button class="btn" onclick="_lorFake('number')">Number</button>
          </div>
          <div class="jwt-section-title" style="margin-top:16px">Bulk Generate</div>
          <div style="display:flex;gap:8px;align-items:center">
            <label style="font:12px var(--sans);color:var(--text3)">Rows:</label>
            <input id="lorBulkCount" class="rx-input" type="number" value="10" min="1" max="50" style="width:60px">
            <button class="btn" onclick="_lorBulk()">Generate Dataset</button>
          </div>
        </div>
        <div>
          <label class="rx-label">Output</label>
          <pre id="lorOutput" style="font:13px var(--mono);color:var(--text);background:var(--bg);padding:16px;border-radius:8px;border:1px solid var(--border);min-height:300px;overflow:auto;white-space:pre-wrap">Click any button to generate</pre>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn" onclick="_copyToClip(document.getElementById('lorOutput').textContent)">Copy</button>
            <button class="btn" onclick="_saveToNotes('Generated Data',document.getElementById('lorOutput').textContent)">Save to Notes</button>
          </div>
        </div>
      </div>
    </div>`;
}
async function _lorGen(type) { try { const count = parseInt(document.getElementById('lorCount').value)||5; const r = await api('/api/lorem/'+type+'?count='+count); document.getElementById('lorOutput').textContent = r.result; } catch(e) { document.getElementById('lorOutput').textContent = 'Error: '+e.message; } }
async function _lorFake(type) { try { const r = await api('/api/lorem/'+type); document.getElementById('lorOutput').textContent = typeof r.result === 'object' ? JSON.stringify(r.result,null,2) : r.result; } catch(e) { document.getElementById('lorOutput').textContent = 'Error: '+e.message; } }
async function _lorBulk() { const count = parseInt(document.getElementById('lorBulkCount').value)||10; const rows = []; for(let i=0;i<count;i++) { try { const [n,e,p,c] = await Promise.all([api('/api/lorem/name'),api('/api/lorem/email'),api('/api/lorem/phone'),api('/api/lorem/company')]); rows.push({name:n.result,email:e.result,phone:p.result,company:c.result}); } catch { break; } } document.getElementById('lorOutput').textContent = JSON.stringify(rows,null,2); }

// ═══════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════

let _anlRange = '7d';

async function loadAnalytics() {
  const m = document.getElementById('main');
  m.innerHTML = `
    <div class="page anl-page">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
          <h1 style="font:700 22px var(--sans);margin:0">Analytics</h1>
          <p style="font:400 12px var(--sans);color:var(--dim);margin:4px 0 0">Usage metrics and activity insights</p>
        </div>
        <div class="anl-range">
          <button class="anl-range-btn${_anlRange==='24h'?' active':''}" onclick="_anlSetRange('24h')">24h</button>
          <button class="anl-range-btn${_anlRange==='7d'?' active':''}" onclick="_anlSetRange('7d')">7d</button>
          <button class="anl-range-btn${_anlRange==='30d'?' active':''}" onclick="_anlSetRange('30d')">30d</button>
          <button class="anl-range-btn${_anlRange==='all'?' active':''}" onclick="_anlSetRange('all')">All</button>
        </div>
      </div>
      <div class="anl-grid" id="anlKpis">
        ${_anlKpiPlaceholders()}
      </div>
      <div class="anl-charts">
        <div class="anl-chart-panel">
          <h3 class="anl-chart-title">Page Views</h3>
          <div id="anlPageViews" class="anl-chart-body"><div class="anl-empty">Loading...</div></div>
        </div>
        <div class="anl-chart-panel">
          <h3 class="anl-chart-title">Top Features</h3>
          <div id="anlFeatures" class="anl-chart-body"><div class="anl-empty">Loading...</div></div>
        </div>
      </div>
      <div class="anl-chart-panel" style="margin-top:12px">
        <h3 class="anl-chart-title">Activity Timeline</h3>
        <div id="anlTimeline" class="anl-timeline"><div class="anl-empty">Loading...</div></div>
      </div>
      <div class="anl-chart-panel" style="margin-top:12px">
        <h3 class="anl-chart-title">Recent Events</h3>
        <div id="anlEvents" class="anl-chart-body"><div class="anl-empty">Loading...</div></div>
      </div>
    </div>`;
  _anlRefresh();
}

function _anlKpiPlaceholders() {
  return ['Total Events','Unique Pages','Active Users','Top Feature'].map(l =>
    `<div class="anl-card"><div class="anl-card-label">${l}</div><div class="anl-card-value">--</div></div>`
  ).join('');
}

function _anlSetRange(r) {
  _anlRange = r;
  document.querySelectorAll('.anl-range-btn').forEach(b => b.classList.toggle('active', b.textContent === r || b.textContent === r));
  _anlRefresh();
}

function _anlDateRange() {
  const now = new Date();
  let from;
  if (_anlRange === '24h') from = new Date(now - 864e5);
  else if (_anlRange === '7d') from = new Date(now - 6048e5);
  else if (_anlRange === '30d') from = new Date(now - 2592e6);
  else from = new Date('2020-01-01');
  return { from: from.toISOString(), to: now.toISOString() };
}

async function _anlRefresh() {
  const { from, to } = _anlDateRange();
  const qs = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const [stats, views, features, timeline] = await Promise.all([
    api('/api/analytics/stats').catch(() => null),
    api(`/api/analytics/views?${qs}`).catch(() => null),
    api(`/api/analytics/features?${qs}`).catch(() => null),
    api(`/api/analytics/timeline?${qs}`).catch(() => null),
  ]);
  _anlRenderKpis(stats);
  _anlRenderBars('anlPageViews', views, 'page', 'count');
  _anlRenderBars('anlFeatures', features, 'feature', 'count');
  _anlRenderTimeline(timeline);
  _anlRenderEvents(stats?.recentEvents);
}

function _anlRenderKpis(s) {
  const el = document.getElementById('anlKpis');
  if (!el) return;
  if (!s) { el.innerHTML = _anlKpiPlaceholders(); return; }
  el.innerHTML = `
    <div class="anl-card"><div class="anl-card-label">Total Events</div><div class="anl-card-value">${(s.totalEvents ?? 0).toLocaleString()}</div></div>
    <div class="anl-card"><div class="anl-card-label">Unique Pages</div><div class="anl-card-value">${s.uniquePages ?? 0}</div></div>
    <div class="anl-card"><div class="anl-card-label">Active Users</div><div class="anl-card-value">${s.activeUsers ?? 0}</div><div class="anl-card-sub">today</div></div>
    <div class="anl-card"><div class="anl-card-label">Top Feature</div><div class="anl-card-value anl-card-value-sm">${esc(s.topFeature || 'N/A')}</div></div>`;
}

function _anlRenderBars(id, data, labelKey, valKey) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!data || !data.length) { el.innerHTML = '<div class="anl-empty">No data yet</div>'; return; }
  const max = Math.max(...data.map(d => d[valKey] || 0), 1);
  el.innerHTML = data.slice(0, 15).map(d => {
    const pct = ((d[valKey] || 0) / max * 100).toFixed(1);
    return `<div class="anl-bar-row">
      <span class="anl-bar-label">${esc(String(d[labelKey] || ''))}</span>
      <div class="anl-bar-track"><div class="anl-bar" style="width:${pct}%"></div></div>
      <span class="anl-bar-val">${(d[valKey] || 0).toLocaleString()}</span>
    </div>`;
  }).join('');
}

function _anlRenderTimeline(data) {
  const el = document.getElementById('anlTimeline');
  if (!el) return;
  if (!data || !data.length) { el.innerHTML = '<div class="anl-empty">No data yet</div>'; return; }
  const max = Math.max(...data.map(d => d.count || 0), 1);
  const barW = Math.max(4, Math.floor((el.clientWidth - 40) / data.length) - 2);
  el.innerHTML = `<div class="anl-tl-chart">${data.map(d => {
    const h = Math.max(2, ((d.count || 0) / max * 120));
    const lbl = d.hour != null ? `${String(d.hour).padStart(2,'0')}:00` : (d.label || '');
    return `<div class="anl-tl-col" title="${esc(lbl)}: ${d.count}">
      <div class="anl-tl-bar" style="height:${h}px;width:${barW}px"></div>
      <span class="anl-tl-lbl">${esc(lbl)}</span>
    </div>`;
  }).join('')}</div>`;
}

function _anlRenderEvents(events) {
  const el = document.getElementById('anlEvents');
  if (!el) return;
  if (!events || !events.length) { el.innerHTML = '<div class="anl-empty">No events recorded yet</div>'; return; }
  el.innerHTML = `<div class="anl-table-wrap"><table class="anl-table">
    <thead><tr><th>Time</th><th>Event</th><th>Page</th><th>User</th></tr></thead>
    <tbody>${events.slice(0, 50).map(e => `<tr>
      <td>${esc(e.time ? new Date(e.time).toLocaleString() : '--')}</td>
      <td>${esc(e.event || '')}</td>
      <td>${esc(e.page || '')}</td>
      <td>${esc(e.user || '')}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

// ═══════════════════════════════════════════════════════════════
// BACKUPS
// ═══════════════════════════════════════════════════════════════

async function loadBackups() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page bkp-page">
      <style>
        .bkp-page{padding:24px}
        .bkp-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:8px}
        .bkp-title{font:700 22px var(--sans);margin:0;color:var(--text)}
        .bkp-subtitle{font:400 12px var(--sans);color:var(--dim);margin:4px 0 0}
        .bkp-stats{display:flex;gap:12px;flex-wrap:wrap}
        .bkp-stat{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 18px;min-width:120px}
        .bkp-stat-label{font:400 11px var(--sans);color:var(--dim);text-transform:uppercase;letter-spacing:.5px}
        .bkp-stat-value{font:600 20px var(--mono);color:var(--text);margin-top:2px}
        .bkp-actions{display:flex;gap:8px;margin:16px 0;flex-wrap:wrap}
        .bkp-btn{background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:8px 16px;border-radius:6px;font:500 13px var(--sans);cursor:pointer;transition:all .15s}
        .bkp-btn:hover{background:var(--bg4);border-color:var(--accent)}
        .bkp-btn-primary{background:var(--accent);border-color:var(--accent);color:#000;font-weight:600}
        .bkp-btn-primary:hover{opacity:.85}
        .bkp-btn-danger{color:var(--red)}
        .bkp-btn-danger:hover{border-color:var(--red);background:rgba(239,83,80,.1)}
        .bkp-btn-warn{color:var(--yellow)}
        .bkp-btn-warn:hover{border-color:var(--yellow);background:rgba(255,200,0,.1)}
        .bkp-table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:8px}
        .bkp-table{width:100%;border-collapse:collapse;font:13px var(--sans)}
        .bkp-table th{background:var(--bg2);color:var(--dim);font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.5px;padding:10px 14px;text-align:left;border-bottom:1px solid var(--border)}
        .bkp-table td{padding:10px 14px;border-bottom:1px solid var(--border);color:var(--text)}
        .bkp-table tr:last-child td{border-bottom:none}
        .bkp-table tr:hover td{background:var(--bg2)}
        .bkp-row-actions{display:flex;gap:6px}
        .bkp-empty{padding:48px;text-align:center;color:var(--dim);font:13px var(--sans)}
        .bkp-loading{padding:48px;text-align:center;color:var(--dim);font:13px var(--sans)}
      </style>
      <div class="bkp-header">
        <div>
          <h1 class="bkp-title">Backups</h1>
          <p class="bkp-subtitle">Create, restore, and manage server backups</p>
        </div>
        <div class="bkp-stats" id="bkpStats"></div>
      </div>
      <div class="bkp-actions">
        <button class="bkp-btn bkp-btn-primary" onclick="_bkpCreate()">Create Backup</button>
        <button class="bkp-btn bkp-btn-warn" onclick="_bkpClean()">Clean Old</button>
      </div>
      <div id="bkpTableWrap"><div class="bkp-loading">Loading backups...</div></div>
    </div>`;
  _bkpRefresh();
}

async function _bkpRefresh() {
  try {
    const backups = await api('/api/backup');
    const list = Array.isArray(backups) ? backups : (backups.backups || []);
    const totalSize = list.reduce((s, b) => s + (b.size || 0), 0);
    const statsEl = document.getElementById('bkpStats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="bkp-stat"><div class="bkp-stat-label">Backups</div><div class="bkp-stat-value">${list.length}</div></div>
        <div class="bkp-stat"><div class="bkp-stat-label">Total Size</div><div class="bkp-stat-value">${formatSize(totalSize)}</div></div>`;
    }
    const wrap = document.getElementById('bkpTableWrap');
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = '<div class="bkp-empty">No backups found. Click <strong>Create Backup</strong> to create one.</div>';
      return;
    }
    wrap.innerHTML = `<div class="bkp-table-wrap"><table class="bkp-table">
      <thead><tr><th>Filename</th><th>Size</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody>${list.map(b => `<tr>
        <td>${esc(b.filename || b.name || '')}</td>
        <td>${formatSize(b.size || 0)}</td>
        <td>${b.created ? new Date(b.created).toLocaleString() : (b.createdAt ? new Date(b.createdAt).toLocaleString() : '--')}</td>
        <td><div class="bkp-row-actions">
          <button class="bkp-btn" onclick="_bkpRestore('${esc(b.filename || b.name || '')}')">Restore</button>
          <button class="bkp-btn bkp-btn-danger" onclick="_bkpDelete('${esc(b.filename || b.name || '')}')">Delete</button>
        </div></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch (err) {
    const wrap = document.getElementById('bkpTableWrap');
    if (wrap) wrap.innerHTML = `<div class="bkp-empty" style="color:var(--red)">Failed to load backups: ${esc(err.message)}</div>`;
  }
}

async function _bkpCreate() {
  try {
    showToast('Creating backup...');
    await api('/api/backup', 'POST');
    showToast('Backup created successfully');
    _bkpRefresh();
  } catch (err) { showToast('Backup failed: ' + err.message); }
}

async function _bkpRestore(filename) {
  if (!confirm(`Restore from backup "${filename}"? This may overwrite current data.`)) return;
  try {
    showToast('Restoring backup...');
    await api('/api/backup/restore', 'POST', { filename });
    showToast('Backup restored successfully');
  } catch (err) { showToast('Restore failed: ' + err.message); }
}

async function _bkpDelete(filename) {
  if (!confirm(`Delete backup "${filename}"? This cannot be undone.`)) return;
  try {
    await api(`/api/backup/${encodeURIComponent(filename)}`, 'DELETE');
    showToast('Backup deleted');
    _bkpRefresh();
  } catch (err) { showToast('Delete failed: ' + err.message); }
}

async function _bkpClean() {
  try {
    const result = await api('/api/backup/clean', 'POST');
    const kept = result.kept ?? '?';
    const deleted = result.deleted ?? result.cleaned ?? '?';
    showToast(`Cleanup complete: ${kept} kept, ${deleted} deleted`);
    _bkpRefresh();
  } catch (err) { showToast('Cleanup failed: ' + err.message); }
}

// ═══════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS REFERENCE
// ═══════════════════════════════════════════════════════════════

async function loadShortcuts() {
  const main = document.getElementById('main');
  const kb = getKeybindings();

  // Build key display helper
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  function fmtKey(binding) {
    const parts = [];
    if (binding.meta) parts.push(isMac ? '\u2318' : 'Ctrl');
    if (binding.ctrl && !binding.meta) parts.push('Ctrl');
    if (binding.shift) parts.push(isMac ? '\u21E7' : 'Shift');
    if (binding.alt) parts.push(isMac ? '\u2325' : 'Alt');
    let k = binding.key;
    if (k === ' ') k = 'Space';
    else if (k === ',') k = ',';
    else k = k.toUpperCase();
    parts.push(k);
    return parts.map(p => `<kbd class="kb-ref-key">${esc(p)}</kbd>`).join('<span class="kb-ref-plus">+</span>');
  }

  // Navigation shortcuts from keybindings
  const navShortcuts = [];
  const overlayShortcuts = [];
  for (const [action, binding] of Object.entries(kb)) {
    const row = { keys: fmtKey(binding), desc: binding.desc || action };
    if (action === 'launcher' || action === 'search') overlayShortcuts.push(row);
    else navShortcuts.push(row);
  }

  // Extra shortcuts added in handleGlobalKeydown
  navShortcuts.push({ keys: fmtKey({ ctrl: true, shift: true, key: 'b' }), desc: 'Backups' });
  navShortcuts.push({ keys: '<kbd class="kb-ref-key">?</kbd>', desc: 'Keyboard Shortcuts Reference' });

  // Page-specific shortcuts
  const pageShortcuts = [
    { keys: '<kbd class="kb-ref-key">Escape</kbd>', desc: 'Close modals, overlays, launcher, search' },
    { keys: fmtKey({ ctrl: true, key: 'Enter' }), desc: 'Run action (code runner, regex, JSON format, etc.)' },
    { keys: '<kbd class="kb-ref-key">\u2191</kbd> <kbd class="kb-ref-key">\u2193</kbd>', desc: 'Navigate launcher / search results' },
    { keys: '<kbd class="kb-ref-key">Enter</kbd>', desc: 'Execute selected launcher / search item' },
  ];

  function renderGroup(title, items) {
    return `
      <div class="kb-ref-group">
        <h3 class="kb-ref-group-title">${esc(title)}</h3>
        <table class="kb-ref-table">
          <tbody>${items.map(item => `
            <tr class="kb-ref-row">
              <td class="kb-ref-keys-cell">${item.keys}</td>
              <td class="kb-ref-desc-cell">${esc(item.desc)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  main.innerHTML = `
    <div class="page kb-ref-page">
      <style>
        .kb-ref-page{padding:24px;max-width:720px}
        .kb-ref-title{font:700 22px var(--sans);margin:0;color:var(--text)}
        .kb-ref-subtitle{font:400 12px var(--sans);color:var(--dim);margin:4px 0 20px}
        .kb-ref-group{margin-bottom:24px}
        .kb-ref-group-title{font:600 14px var(--sans);color:var(--accent);margin:0 0 8px;text-transform:uppercase;letter-spacing:.5px;font-size:11px}
        .kb-ref-table{width:100%;border-collapse:collapse}
        .kb-ref-row td{padding:8px 0;border-bottom:1px solid var(--border)}
        .kb-ref-row:last-child td{border-bottom:none}
        .kb-ref-keys-cell{width:200px;white-space:nowrap}
        .kb-ref-desc-cell{font:13px var(--sans);color:var(--text)}
        .kb-ref-key{display:inline-block;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:2px 7px;font:600 12px var(--mono);color:var(--text);min-width:20px;text-align:center;box-shadow:0 1px 0 var(--border)}
        .kb-ref-plus{color:var(--dim);margin:0 3px;font:11px var(--sans)}
      </style>
      <h1 class="kb-ref-title">Keyboard Shortcuts</h1>
      <p class="kb-ref-subtitle">All available keyboard shortcuts in Hyperion</p>
      ${renderGroup('Navigation', navShortcuts)}
      ${renderGroup('Overlays', overlayShortcuts)}
      ${renderGroup('Page Actions', pageShortcuts)}
    </div>`;
}

// ── Settings Export/Import (Phase 5) ──
function _exportSettings() {
  const blob = new Blob([JSON.stringify(_userSettings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'hyperion-settings.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('Settings exported');
}

function _importSettings() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const text = await file.text();
      const settings = JSON.parse(text);
      for (const [key, value] of Object.entries(settings)) {
        await api('/api/settings', 'PUT', { key, value: JSON.stringify(value) });
      }
      _userSettings = settings;
      showToast('Settings imported');
    } catch (err) { showToast('Import failed: ' + err.message, 'error'); }
  };
  input.click();
}

// ═══ API DOCS ═══
async function loadApiDocs() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <span class="page-title">API Documentation</span>
        <a href="/api/docs/swagger" target="_blank" class="btn btn-green" style="margin-left:auto;font-size:12px">Open Swagger UI</a>
      </div>
      <div class="page-pad" id="apiDocsContent" style="font:13px var(--sans)">Loading...</div>
    </div>
  `;
  try {
    const data = await api('/api/docs');
    const el = document.getElementById('apiDocsContent');
    const groups = data.groups || {};
    const methodColors = { GET: '#059669', POST: '#2563eb', PUT: '#d97706', DELETE: '#dc2626', PATCH: '#7c3aed' };
    el.innerHTML = `
      <div style="margin-bottom:16px;color:var(--text2)">
        <strong>${data.totalRoutes || 0}</strong> endpoints across <strong>${Object.keys(groups).length}</strong> groups
      </div>
      ${Object.entries(groups).map(([group, routes]) => `
        <div style="margin-bottom:20px">
          <div style="font:600 14px var(--mono);color:var(--green);margin-bottom:8px">${esc(group)}</div>
          <table class="proc-table" style="width:100%">
            <thead><tr><th>Method</th><th>Path</th></tr></thead>
            <tbody>
              ${routes.map(r => `
                <tr>
                  <td>${r.methods.map(m => '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font:600 10px var(--mono);color:#fff;background:' + (methodColors[m] || 'var(--text3)') + ';margin-right:4px">' + m + '</span>').join('')}</td>
                  <td style="font:12px var(--mono);color:var(--text2)">${esc(r.path)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    `;
  } catch (err) {
    document.getElementById('apiDocsContent').innerHTML = '<div style="color:var(--red)">Failed to load: ' + esc(err.message) + '</div>';
  }
}

// ═══ SSH TUNNELS ═══
async function loadTunnels() {
  const main = document.getElementById('main');
  const [tunnels, connections] = await Promise.all([
    api('/api/ssh/tunnels').catch(() => []),
    api('/api/ssh/connections').catch(() => []),
  ]);
  const connMap = {};
  (connections || []).forEach(c => connMap[c.id] = c.name || c.host);

  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <span class="page-title">SSH Tunnels</span>
        <button class="btn btn-green" onclick="_showCreateTunnel()" style="margin-left:auto;font-size:12px">+ New Tunnel</button>
      </div>
      <div class="page-pad">
        <div id="tunnelCreateForm" style="display:none;margin-bottom:16px;padding:16px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div><label style="font:12px var(--sans);color:var(--text3)">Connection</label>
              <select id="tunConn" class="input" style="width:100%">${(connections || []).map(c => `<option value="${c.id}">${esc(c.name || c.host)}</option>`).join('')}</select></div>
            <div><label style="font:12px var(--sans);color:var(--text3)">Name</label><input id="tunName" class="input" style="width:100%" placeholder="My Tunnel"></div>
            <div><label style="font:12px var(--sans);color:var(--text3)">Local Port</label><input id="tunLocalPort" class="input" style="width:100%" type="number" placeholder="8080"></div>
            <div><label style="font:12px var(--sans);color:var(--text3)">Remote Host</label><input id="tunRemoteHost" class="input" style="width:100%" placeholder="localhost"></div>
            <div><label style="font:12px var(--sans);color:var(--text3)">Remote Port</label><input id="tunRemotePort" class="input" style="width:100%" type="number" placeholder="80"></div>
            <div><label style="font:12px var(--sans);color:var(--text3)">Type</label>
              <select id="tunType" class="input" style="width:100%"><option value="local">Local (-L)</option><option value="reverse">Reverse (-R)</option></select></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn" onclick="document.getElementById('tunnelCreateForm').style.display='none'">Cancel</button>
            <button class="btn btn-green" onclick="_createTunnel()">Create</button>
          </div>
        </div>
        ${(tunnels || []).length === 0 ? '<div style="color:var(--text3);padding:20px;text-align:center">No tunnels configured. Create one to get started.</div>' : `
        <table class="proc-table" style="width:100%">
          <thead><tr><th>Name</th><th>Connection</th><th>Local</th><th>Remote</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${tunnels.map(t => `
              <tr>
                <td style="font:600 13px var(--mono)">${esc(t.name)}</td>
                <td>${esc(connMap[t.connection_id] || t.connection_id)}</td>
                <td style="font:12px var(--mono)">:${t.local_port}</td>
                <td style="font:12px var(--mono)">${esc(t.remote_host)}:${t.remote_port}</td>
                <td><span style="padding:2px 6px;border-radius:3px;font:10px var(--mono);background:${t.type === 'reverse' ? 'var(--amber)' : 'var(--cyan)'};color:#000">${t.type}</span></td>
                <td><span style="color:${t.running || t.status === 'running' ? 'var(--green)' : 'var(--text3)'}">${t.running ? 'Running (PID ' + t.pid + ')' : t.status || 'stopped'}</span></td>
                <td style="display:flex;gap:4px">
                  ${t.running ? `<button class="btn" onclick="_stopTunnel('${t.id}')" style="font-size:11px">Stop</button>` : `<button class="btn btn-green" onclick="_startTunnel('${t.id}')" style="font-size:11px">Start</button>`}
                  <button class="btn" onclick="_deleteTunnel('${t.id}')" style="font-size:11px;color:var(--red)">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
      </div>
    </div>`;
}
window._showCreateTunnel = () => document.getElementById('tunnelCreateForm').style.display = '';
window._createTunnel = async () => {
  await api('/api/ssh/tunnels', 'POST', {
    connectionId: document.getElementById('tunConn').value,
    name: document.getElementById('tunName').value,
    localPort: document.getElementById('tunLocalPort').value,
    remoteHost: document.getElementById('tunRemoteHost').value,
    remotePort: document.getElementById('tunRemotePort').value,
    type: document.getElementById('tunType').value,
  });
  loadTunnels();
};
window._startTunnel = async (id) => { await api(`/api/ssh/tunnels/${id}/start`, 'POST'); loadTunnels(); };
window._stopTunnel = async (id) => { await api(`/api/ssh/tunnels/${id}/stop`, 'POST'); loadTunnels(); };
window._deleteTunnel = async (id) => { if (confirm('Delete this tunnel?')) { await api(`/api/ssh/tunnels/${id}`, 'DELETE'); loadTunnels(); } };

// ═══ FILE HISTORY ═══
async function loadFileHistory() {
  const main = document.getElementById('main');
  const files = await api('/api/files/versions').catch(() => []);

  main.innerHTML = `
    <div class="page">
      <div class="page-header"><span class="page-title">File History</span></div>
      <div class="page-pad">
        ${(files || []).length === 0 ? '<div style="color:var(--text3);padding:20px;text-align:center">No file versions saved yet. Edit files through the file manager to start tracking versions.</div>' : `
        <table class="proc-table" style="width:100%">
          <thead><tr><th>File</th><th>Versions</th><th>Last Modified</th><th>Actions</th></tr></thead>
          <tbody>
            ${files.map(f => `
              <tr>
                <td style="font:12px var(--mono)">${esc(f.file_path)}</td>
                <td>${f.version_count}</td>
                <td>${f.last_modified ? new Date(f.last_modified).toLocaleString() : '--'}</td>
                <td><button class="btn" onclick="_showFileVersions('${esc(f.file_path)}')" style="font-size:11px">View Versions</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
        <div id="fileVersionDetail"></div>
      </div>
    </div>`;
}
window._showFileVersions = async (filePath) => {
  const versions = await api(`/api/files/versions/file?path=${encodeURIComponent(filePath)}`).catch(() => []);
  const el = document.getElementById('fileVersionDetail');
  el.innerHTML = `
    <div style="margin-top:16px;padding:16px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
      <h3 style="font:600 14px var(--sans);margin-bottom:8px">${esc(filePath)}</h3>
      <table class="proc-table" style="width:100%">
        <thead><tr><th>Hash</th><th>Size</th><th>Reason</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          ${(versions || []).map((v, i) => `
            <tr>
              <td style="font:11px var(--mono)">${esc(v.hash)}</td>
              <td>${v.size} B</td>
              <td>${esc(v.reason)}</td>
              <td>${new Date(v.created_at).toLocaleString()}</td>
              <td style="display:flex;gap:4px">
                <button class="btn" onclick="_viewVersion('${v.id}')" style="font-size:11px">View</button>
                ${i < versions.length - 1 ? `<button class="btn" onclick="_diffVersions('${v.id}','${versions[i+1].id}')" style="font-size:11px">Diff</button>` : ''}
                <button class="btn" onclick="_restoreVersion('${v.id}')" style="font-size:11px;color:var(--amber)">Restore</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
};
window._viewVersion = async (id) => {
  const v = await api(`/api/files/versions/${id}`);
  const w = window.open('', '_blank');
  w.document.write(`<pre style="font:13px monospace;padding:20px;background:#0d0d15;color:#e0e0f0;white-space:pre-wrap">${v.content ? v.content.replace(/</g,'&lt;') : '(empty)'}</pre>`);
};
window._diffVersions = async (idA, idB) => {
  const diff = await api('/api/files/versions/diff', 'POST', { idA, idB });
  const el = document.getElementById('fileVersionDetail');
  el.innerHTML += `
    <div style="margin-top:12px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px;max-height:400px;overflow:auto">
      <div style="font:600 12px var(--sans);margin-bottom:8px">Diff: +${diff.stats.added} / -${diff.stats.removed}</div>
      <pre style="font:11px var(--mono);line-height:1.6">${diff.changes.map(c => {
        const color = c.type === 'added' ? 'var(--green)' : 'var(--red)';
        const prefix = c.type === 'added' ? '+' : '-';
        return `<span style="color:${color}">${prefix} ${c.content ? c.content.replace(/</g,'&lt;') : ''}</span>`;
      }).join('\n')}</pre>
    </div>`;
};
window._restoreVersion = async (id) => {
  if (!confirm('Restore this version? This will overwrite the current file.')) return;
  await api(`/api/files/versions/${id}/restore`, 'POST');
  alert('File restored.');
};

// ═══ WEBHOOKS ═══
async function loadWebhooks() {
  const main = document.getElementById('main');
  const [subs, recent] = await Promise.all([
    api('/api/webhooks').catch(() => []),
    api('/api/webhooks/deliveries/recent?limit=20').catch(() => []),
  ]);

  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <span class="page-title">Webhooks</span>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn" onclick="_testWebhooks()" style="font-size:12px">Test All</button>
          <button class="btn btn-green" onclick="_showCreateWebhook()" style="font-size:12px">+ Subscription</button>
        </div>
      </div>
      <div class="page-pad">
        <div id="webhookCreateForm" style="display:none;margin-bottom:16px;padding:16px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div><label style="font:12px var(--sans);color:var(--text3)">Name</label><input id="whName" class="input" style="width:100%" placeholder="My Webhook"></div>
            <div><label style="font:12px var(--sans);color:var(--text3)">URL</label><input id="whUrl" class="input" style="width:100%" placeholder="https://example.com/hook"></div>
            <div><label style="font:12px var(--sans);color:var(--text3)">Events (comma-separated, * for all)</label><input id="whEvents" class="input" style="width:100%" placeholder="*" value="*"></div>
            <div><label style="font:12px var(--sans);color:var(--text3)">Secret (optional)</label><input id="whSecret" class="input" style="width:100%" placeholder="shared_secret"></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn" onclick="document.getElementById('webhookCreateForm').style.display='none'">Cancel</button>
            <button class="btn btn-green" onclick="_createWebhook()">Create</button>
          </div>
        </div>

        <h3 style="font:600 14px var(--sans);margin-bottom:8px">Subscriptions</h3>
        ${(subs || []).length === 0 ? '<div style="color:var(--text3);padding:12px;text-align:center">No webhook subscriptions.</div>' : `
        <table class="proc-table" style="width:100%;margin-bottom:20px">
          <thead><tr><th>Name</th><th>URL</th><th>Events</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            ${subs.map(s => `
              <tr>
                <td style="font:600 13px var(--mono)">${esc(s.name)}</td>
                <td style="font:11px var(--mono);max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(s.url)}</td>
                <td style="font:11px var(--mono)">${(s.events || []).join(', ')}</td>
                <td><span style="color:${s.active ? 'var(--green)' : 'var(--red)'}">${s.active ? 'Active' : 'Disabled'}</span></td>
                <td style="display:flex;gap:4px">
                  <button class="btn" onclick="_toggleWebhook('${s.id}',${!s.active})" style="font-size:11px">${s.active ? 'Disable' : 'Enable'}</button>
                  <button class="btn" onclick="_deleteWebhook('${s.id}')" style="font-size:11px;color:var(--red)">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}

        <h3 style="font:600 14px var(--sans);margin-bottom:8px;margin-top:16px">Recent Deliveries</h3>
        ${(recent || []).length === 0 ? '<div style="color:var(--text3);padding:12px;text-align:center">No deliveries yet.</div>' : `
        <table class="proc-table" style="width:100%">
          <thead><tr><th>Subscription</th><th>Event</th><th>Status</th><th>Duration</th><th>Time</th></tr></thead>
          <tbody>
            ${recent.map(d => `
              <tr>
                <td>${esc(d.subscription_name || d.subscription_id)}</td>
                <td style="font:12px var(--mono)">${esc(d.event)}</td>
                <td><span style="color:${d.success ? 'var(--green)' : 'var(--red)'}">HTTP ${d.status_code || 'ERR'}</span></td>
                <td>${d.duration_ms || 0}ms</td>
                <td>${d.created_at ? new Date(d.created_at).toLocaleString() : '--'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
      </div>
    </div>`;
}
window._showCreateWebhook = () => document.getElementById('webhookCreateForm').style.display = '';
window._createWebhook = async () => {
  const events = document.getElementById('whEvents').value.split(',').map(e => e.trim()).filter(Boolean);
  await api('/api/webhooks', 'POST', {
    name: document.getElementById('whName').value,
    url: document.getElementById('whUrl').value,
    events, secret: document.getElementById('whSecret').value || undefined,
  });
  loadWebhooks();
};
window._toggleWebhook = async (id, active) => { await api(`/api/webhooks/${id}`, 'PUT', { active }); loadWebhooks(); };
window._deleteWebhook = async (id) => { if (confirm('Delete this webhook?')) { await api(`/api/webhooks/${id}`, 'DELETE'); loadWebhooks(); } };
window._testWebhooks = async () => { const r = await api('/api/webhooks/test', 'POST'); alert(`Dispatched to ${r.results?.length || 0} subscription(s)`); loadWebhooks(); };

// ═══ DASHBOARD WIDGETS ═══
async function loadWidgets() {
  const main = document.getElementById('main');
  const [widgets, widgetTypes] = await Promise.all([
    api('/api/dashboard/widgets').catch(() => []),
    api('/api/dashboard/widget-types').catch(() => ({})),
  ]);

  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <span class="page-title">Dashboard Widgets</span>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn" onclick="_resetWidgets()" style="font-size:12px">Reset Defaults</button>
          <button class="btn btn-green" onclick="_showAddWidget()" style="font-size:12px">+ Add Widget</button>
        </div>
      </div>
      <div class="page-pad">
        <div id="widgetAddForm" style="display:none;margin-bottom:16px;padding:16px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div><label style="font:12px var(--sans);color:var(--text3)">Type</label>
              <select id="wdgType" class="input" style="width:100%">${Object.entries(widgetTypes).map(([k, v]) => `<option value="${k}">${esc(v.label)} — ${esc(v.description)}</option>`).join('')}</select></div>
            <div><label style="font:12px var(--sans);color:var(--text3)">Title (optional)</label><input id="wdgTitle" class="input" style="width:100%" placeholder="Custom title"></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn" onclick="document.getElementById('widgetAddForm').style.display='none'">Cancel</button>
            <button class="btn btn-green" onclick="_addWidget()">Add</button>
          </div>
        </div>

        <div class="dash-grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
          ${(widgets || []).map(w => `
            <div class="dash-card" style="position:relative">
              <div class="dash-card-head" style="display:flex;justify-content:space-between;align-items:center">
                ${esc(w.title || w.type)}
                <div style="display:flex;gap:4px">
                  <button onclick="_removeWidget('${w.id}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px" title="Remove">&times;</button>
                </div>
              </div>
              <div class="dash-card-body">
                <div style="font:11px var(--mono);color:var(--text3)">${esc(widgetTypes[w.type]?.description || w.type)}</div>
                <div style="font:10px var(--sans);color:var(--text3);margin-top:4px">Position: ${w.position} | ${w.width}x${w.height}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;
}
window._showAddWidget = () => document.getElementById('widgetAddForm').style.display = '';
window._addWidget = async () => {
  await api('/api/dashboard/widgets', 'POST', {
    type: document.getElementById('wdgType').value,
    title: document.getElementById('wdgTitle').value || undefined,
  });
  loadWidgets();
};
window._removeWidget = async (id) => { if (confirm('Remove this widget?')) { await api(`/api/dashboard/widgets/${id}`, 'DELETE'); loadWidgets(); } };
window._resetWidgets = async () => { if (confirm('Reset widgets to defaults?')) { await api('/api/dashboard/widgets/reset', 'POST'); loadWidgets(); } };

// ═══ METRICS HISTORY ═══
async function loadMetricsHistory() {
  const main = document.getElementById('main');
  const [history, stats] = await Promise.all([
    api('/api/metrics/history?hours=24').catch(() => []),
    api('/api/metrics/history/stats').catch(() => ({})),
  ]);

  const latestMetrics = (history || []).length > 0 ? history[history.length - 1] : null;

  main.innerHTML = `
    <div class="page">
      <div class="page-header">
        <span class="page-title">Metrics History</span>
        <div style="margin-left:auto;display:flex;gap:8px">
          <select id="mhHours" class="input" onchange="_refreshMetricsHistory()" style="font-size:12px">
            <option value="1">Last 1 hour</option>
            <option value="6">Last 6 hours</option>
            <option value="24" selected>Last 24 hours</option>
            <option value="168">Last 7 days</option>
          </select>
          <button class="btn" onclick="_takeSnapshot()" style="font-size:12px">Take Snapshot</button>
        </div>
      </div>
      <div class="page-pad">
        <div class="dash-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:16px">
          <div class="dash-card">
            <div class="dash-card-head">Snapshots</div>
            <div class="dash-card-body"><span style="font:700 20px var(--mono);color:var(--cyan)">${stats.count || 0}</span></div>
          </div>
          <div class="dash-card">
            <div class="dash-card-head">Total Requests</div>
            <div class="dash-card-body"><span style="font:700 20px var(--mono);color:var(--green)">${latestMetrics ? latestMetrics.total_requests : '--'}</span></div>
          </div>
          <div class="dash-card">
            <div class="dash-card-head">Avg Latency</div>
            <div class="dash-card-body"><span style="font:700 20px var(--mono);color:var(--amber)">${latestMetrics ? latestMetrics.avg_duration.toFixed(1) + 'ms' : '--'}</span></div>
          </div>
          <div class="dash-card">
            <div class="dash-card-head">P95 Latency</div>
            <div class="dash-card-body"><span style="font:700 20px var(--mono);color:var(--purple)">${latestMetrics ? latestMetrics.p95_duration.toFixed(1) + 'ms' : '--'}</span></div>
          </div>
        </div>

        <div style="margin-bottom:16px">
          <div style="font:600 13px var(--sans);margin-bottom:8px">Request Rate (last ${document.getElementById('mhHours')?.value || 24}h)</div>
          <div id="mhChart" style="height:120px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;position:relative;overflow:hidden;padding:8px">
            ${_renderSparkline(history || [], 'total_requests')}
          </div>
        </div>

        <div style="margin-bottom:16px">
          <div style="font:600 13px var(--sans);margin-bottom:8px">Avg Latency (ms)</div>
          <div id="mhLatencyChart" style="height:120px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;position:relative;overflow:hidden;padding:8px">
            ${_renderSparkline(history || [], 'avg_duration')}
          </div>
        </div>

        <h3 style="font:600 14px var(--sans);margin:16px 0 8px">Recent Snapshots</h3>
        ${(history || []).length === 0 ? '<div style="color:var(--text3);padding:12px;text-align:center">No snapshots yet. Metrics are captured every 5 minutes.</div>' : `
        <table class="proc-table" style="width:100%">
          <thead><tr><th>Time</th><th>Requests</th><th>Avg (ms)</th><th>P95 (ms)</th><th>P99 (ms)</th><th>Memory</th></tr></thead>
          <tbody>
            ${(history || []).slice(-20).reverse().map(s => `
              <tr>
                <td>${new Date(s.created_at).toLocaleString()}</td>
                <td>${s.total_requests}</td>
                <td>${(s.avg_duration || 0).toFixed(1)}</td>
                <td>${(s.p95_duration || 0).toFixed(1)}</td>
                <td>${(s.p99_duration || 0).toFixed(1)}</td>
                <td>${s.mem_usage ? (s.mem_usage / 1048576).toFixed(0) + ' MB' : '--'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
      </div>
    </div>`;
}
function _renderSparkline(data, field) {
  if (!data.length) return '<div style="color:var(--text3);text-align:center;padding-top:40px">No data</div>';
  const values = data.map(d => d[field] || 0);
  const max = Math.max(...values, 1);
  const w = 100 / values.length;
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%">
    <polyline fill="none" stroke="var(--cyan)" stroke-width="0.5" points="${values.map((v, i) => `${i * w},${100 - (v / max) * 90}`).join(' ')}" />
  </svg>`;
}
window._refreshMetricsHistory = async () => { loadMetricsHistory(); };
window._takeSnapshot = async () => { await api('/api/metrics/history/snapshot', 'POST'); loadMetricsHistory(); };

// ═══════════════════════════════════════════════
// ═══ TIER 3: ENTERPRISE FEATURES ═══
// ═══════════════════════════════════════════════

// ── Active Sessions (Settings → Security) ──
async function _loadActiveSessions() {
  const el = document.getElementById('activeSessionsList');
  if (!el) return;
  try {
    const sessions = await api('/api/admin/sessions');
    if (!sessions.length) { el.innerHTML = '<p style="color:var(--text3);font:13px var(--sans)">No active sessions</p>'; return; }
    el.innerHTML = `<table class="proc-table" style="width:100%">
      <thead><tr><th>User</th><th>IP</th><th>Device</th><th>Last Active</th><th></th></tr></thead>
      <tbody>${sessions.map(s => `<tr>
        <td>${esc(s.username)}<span style="color:var(--text3);margin-left:6px;font:11px var(--mono)">${esc(s.role)}</span></td>
        <td style="font:12px var(--mono)">${esc(s.ip || '--')}</td>
        <td style="font:11px var(--sans);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(s.user_agent || '')}">${esc((s.user_agent || '--').slice(0, 40))}</td>
        <td>${s.last_activity ? new Date(s.last_activity).toLocaleString() : '--'}</td>
        <td><button class="btn btn-sm btn-red" onclick="_revokeSession('${esc(s.id)}')">Revoke</button></td>
      </tr>`).join('')}</tbody></table>`;
  } catch { el.innerHTML = '<p style="color:var(--text3);font:13px var(--sans)">Could not load sessions</p>'; }
}
async function _revokeSession(sid) {
  if (!confirm('Revoke this session?')) return;
  await api(`/api/admin/sessions/${sid}`, 'DELETE');
  _loadActiveSessions();
}

// ── Login History (Settings → Security) ──
async function _loadLoginHistory() {
  const el = document.getElementById('loginHistoryList');
  if (!el) return;
  try {
    const history = await api('/api/admin/login-history?limit=20');
    if (!history.length) { el.innerHTML = '<p style="color:var(--text3);font:13px var(--sans)">No login history</p>'; return; }
    el.innerHTML = `<table class="proc-table" style="width:100%">
      <thead><tr><th>User</th><th>IP</th><th>Status</th><th>Time</th></tr></thead>
      <tbody>${history.map(h => `<tr>
        <td>${esc(h.username || '--')}</td>
        <td style="font:12px var(--mono)">${esc(h.ip || '--')}</td>
        <td><span style="color:${h.success ? 'var(--green)' : 'var(--red)'}">${h.success ? 'Success' : 'Failed'}</span></td>
        <td>${new Date(h.created_at).toLocaleString()}</td>
      </tr>`).join('')}</tbody></table>`;
  } catch { el.innerHTML = '<p style="color:var(--text3);font:13px var(--sans)">Could not load history</p>'; }
}

// ═══ AUDIT VIEWER PAGE ═══
let _auditRange = '24h';
async function loadAuditViewer() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page">
      <div class="page-header"><span class="page-title">Audit Log Viewer</span></div>
      <div class="page-pad">
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
          <div style="display:flex;gap:4px">
            ${['1h','6h','24h','7d','30d'].map(r => `<button class="btn ${_auditRange===r?'btn-green':''}" onclick="_setAuditRange('${r}')">${r}</button>`).join('')}
          </div>
          <select id="auditActionFilter" onchange="_refreshAuditViewer()" style="font:12px var(--mono);padding:5px 8px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px">
            <option value="">All actions</option>
            <option value="CREATE">CREATE</option><option value="UPDATE">UPDATE</option><option value="DELETE">DELETE</option><option value="LOGIN">LOGIN</option>
          </select>
          <button class="btn" onclick="_exportAuditCsv()">Export CSV</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:16px" id="auditStats"></div>
        <div id="auditSuspicious" style="margin-bottom:16px"></div>
        <h3 style="font:600 14px var(--sans);margin-bottom:8px">Activity Timeline</h3>
        <div id="auditTimeline" style="height:100px;margin-bottom:16px;background:var(--bg2);border-radius:8px;overflow:hidden"></div>
        <h3 style="font:600 14px var(--sans);margin-bottom:8px">Audit Logs</h3>
        <div id="auditTable"></div>
        <div id="auditPager" style="display:flex;gap:8px;margin-top:12px;justify-content:center"></div>
      </div>
    </div>`;
  _refreshAuditViewer();
}
function _getAuditFrom() {
  const m = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 };
  const h = m[_auditRange] || 24;
  return new Date(Date.now() - h * 3600000).toISOString();
}
function _setAuditRange(r) { _auditRange = r; _refreshAuditViewer(); }
let _auditOffset = 0;
async function _refreshAuditViewer() {
  _auditOffset = 0;
  const from = _getAuditFrom();
  const action = document.getElementById('auditActionFilter')?.value || '';
  const [stats, suspicious, timeline, logs] = await Promise.all([
    api('/api/audit/stats').catch(() => ({ byAction: [], topResources: [] })),
    api('/api/audit/suspicious').catch(() => []),
    api(`/api/audit/timeline?from=${encodeURIComponent(from)}&bucketMinutes=60`).catch(() => []),
    api(`/api/audit?from=${encodeURIComponent(from)}&action=${action}&limit=50&offset=0`).catch(() => ({ logs: [], total: 0 })),
  ]);
  _renderAuditStats(stats);
  _renderAuditSuspicious(suspicious);
  _renderAuditTimeline(timeline);
  _renderAuditTable(logs);
}
function _renderAuditStats(stats) {
  const el = document.getElementById('auditStats');
  if (!el) return;
  el.innerHTML = (stats.byAction || []).map(a => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px">
      <div style="font:600 20px var(--mono);color:var(--cyan)">${a.count}</div>
      <div style="font:12px var(--sans);color:var(--text3)">${esc(a.action)}</div>
    </div>`).join('');
}
function _renderAuditSuspicious(alerts) {
  const el = document.getElementById('auditSuspicious');
  if (!el || !alerts.length) { if (el) el.innerHTML = ''; return; }
  el.innerHTML = alerts.map(a => `
    <div style="background:rgba(239,83,80,0.1);border:1px solid var(--red);border-radius:8px;padding:10px 14px;margin-bottom:8px;font:13px var(--sans)">
      <span style="color:var(--red);font-weight:600">${esc(a.severity).toUpperCase()}</span> — ${esc(a.message)}
    </div>`).join('');
}
function _renderAuditTimeline(data) {
  const el = document.getElementById('auditTimeline');
  if (!el) return;
  if (!data.length) { el.innerHTML = '<div style="text-align:center;padding-top:35px;color:var(--text3);font:13px var(--sans)">No activity in this period</div>'; return; }
  const max = Math.max(...data.map(d => d.count), 1);
  const barW = 100 / data.length;
  el.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%">
    ${data.map((d, i) => `<rect x="${i * barW}" y="${100 - (d.count / max) * 90}" width="${Math.max(barW - 0.2, 0.5)}" height="${(d.count / max) * 90}" fill="var(--cyan)" opacity="0.7" />`).join('')}
  </svg>`;
}
function _renderAuditTable(result) {
  const el = document.getElementById('auditTable');
  if (!el) return;
  const logs = result.logs || [];
  if (!logs.length) { el.innerHTML = '<p style="color:var(--text3);text-align:center;padding:20px">No logs found</p>'; return; }
  el.innerHTML = `<table class="proc-table" style="width:100%">
    <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th><th>Status</th><th>IP</th></tr></thead>
    <tbody>${logs.map(l => `<tr>
      <td style="white-space:nowrap">${new Date(l.created_at).toLocaleString()}</td>
      <td>${esc(l.username || '--')}</td>
      <td><span style="color:${{CREATE:'var(--green)',UPDATE:'var(--cyan)',DELETE:'var(--red)'}[l.action]||'var(--text2)'}">${esc(l.action)}</span></td>
      <td style="font:11px var(--mono);max-width:250px;overflow:hidden;text-overflow:ellipsis">${esc(l.resource || '--')}</td>
      <td>${l.status_code || '--'}</td>
      <td style="font:11px var(--mono)">${esc(l.ip || '--')}</td>
    </tr>`).join('')}</tbody></table>`;
  const pager = document.getElementById('auditPager');
  if (pager && result.total > 50) {
    const pages = Math.ceil(result.total / 50);
    const cur = Math.floor(_auditOffset / 50);
    pager.innerHTML = Array.from({ length: Math.min(pages, 10) }, (_, i) =>
      `<button class="btn ${i === cur ? 'btn-green' : ''}" onclick="_auditPage(${i})">${i + 1}</button>`
    ).join('');
  }
}
async function _auditPage(p) {
  _auditOffset = p * 50;
  const from = _getAuditFrom();
  const action = document.getElementById('auditActionFilter')?.value || '';
  const logs = await api(`/api/audit?from=${encodeURIComponent(from)}&action=${action}&limit=50&offset=${_auditOffset}`);
  _renderAuditTable(logs);
}
async function _exportAuditCsv() {
  const from = _getAuditFrom();
  window.open(`/api/audit/export?from=${encodeURIComponent(from)}`, '_blank');
}

// ═══ HEALTH DASHBOARD PAGE ═══
async function loadHealthDashboard() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page">
      <div class="page-header"><span class="page-title">System Health</span><button class="btn" onclick="loadHealthDashboard()">Refresh</button></div>
      <div class="page-pad">
        <div id="healthCards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:20px"></div>
        <div id="healthAlerts" style="margin-bottom:16px"></div>
        <h3 style="font:600 14px var(--sans);margin-bottom:8px">Trends (Last 24h)</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
          <div style="background:var(--bg2);border-radius:8px;padding:12px;height:120px" id="healthTrendLatency">
            <div style="font:600 12px var(--sans);color:var(--text3);margin-bottom:4px">API Latency</div>
          </div>
          <div style="background:var(--bg2);border-radius:8px;padding:12px;height:120px" id="healthTrendMemory">
            <div style="font:600 12px var(--sans);color:var(--text3);margin-bottom:4px">Memory Usage</div>
          </div>
        </div>
        <h3 style="font:600 14px var(--sans);margin-bottom:8px">Alert Rules</h3>
        <div id="healthRules"></div>
      </div>
    </div>`;
  const [health, trend, rules] = await Promise.all([
    api('/api/monitor/health').catch(() => null),
    api('/api/monitor/health/trend?hours=24').catch(() => []),
    api('/api/monitor/alert-rules').catch(() => []),
  ]);
  if (health) _renderHealthCards(health);
  _renderHealthAlerts(health);
  _renderHealthTrends(trend);
  _renderHealthRules(rules);
}
function _renderHealthCards(h) {
  const el = document.getElementById('healthCards');
  if (!el) return;
  const checks = h.checks || {};
  const cardColor = s => s === 'ok' ? 'var(--green)' : s === 'warning' ? '#f59e0b' : 'var(--red)';
  const cards = [
    { label: 'Database', status: checks.database?.status || 'ok', value: `${checks.database?.latency || 0}ms` },
    { label: 'API', status: checks.api?.status || 'ok', value: `${checks.api?.avgLatency || 0}ms avg` },
    { label: 'Memory', status: checks.memory?.status || 'ok', value: `${checks.memory?.percent || 0}%` },
    { label: 'CPU', status: checks.cpu?.status || 'ok', value: `${checks.cpu?.loadPercent || 0}% load` },
    { label: 'Disk', status: checks.disk?.status || 'ok', value: `${checks.disk?.usedPercent || 0}% used` },
    { label: 'Overall', status: h.status === 'healthy' ? 'ok' : 'warning', value: h.status },
  ];
  el.innerHTML = cards.map(c => `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="width:8px;height:8px;border-radius:50%;background:${cardColor(c.status)}"></span>
        <span style="font:600 13px var(--sans)">${c.label}</span>
      </div>
      <div style="font:600 18px var(--mono);color:${cardColor(c.status)}">${c.value}</div>
    </div>`).join('');
}
function _renderHealthAlerts(health) {
  const el = document.getElementById('healthAlerts');
  if (!el || !health) return;
  api('/api/monitor/health/alerts').then(alerts => {
    if (!alerts.length) { el.innerHTML = ''; return; }
    el.innerHTML = alerts.map(a => `
      <div style="background:rgba(${a.level==='critical'?'255,68,102':'245,158,11'},0.1);border:1px solid ${a.level==='critical'?'var(--red)':'#f59e0b'};border-radius:8px;padding:10px 14px;margin-bottom:8px;font:13px var(--sans)">
        <span style="font-weight:600;color:${a.level==='critical'?'var(--red)':'#f59e0b'}">${a.level.toUpperCase()}</span> — ${esc(a.message)}
      </div>`).join('');
  }).catch(() => {});
}
function _renderHealthTrends(trend) {
  const latEl = document.getElementById('healthTrendLatency');
  const memEl = document.getElementById('healthTrendMemory');
  if (!trend.length) return;
  if (latEl) latEl.innerHTML += _renderSparkline(trend, 'avg_duration');
  if (memEl) memEl.innerHTML += _renderSparkline(trend, 'mem_usage');
}
function _renderHealthRules(rules) {
  const el = document.getElementById('healthRules');
  if (!el) return;
  el.innerHTML = `<table class="proc-table" style="width:100%">
    <thead><tr><th>Metric</th><th>Operator</th><th>Threshold</th><th>Level</th></tr></thead>
    <tbody>${(rules||[]).map(r => `<tr>
      <td>${esc(r.metric)}</td><td>${esc(r.operator)}</td><td>${r.value}</td>
      <td><span style="color:${r.level==='critical'?'var(--red)':'#f59e0b'}">${esc(r.level)}</span></td>
    </tr>`).join('')}</tbody></table>`;
}

// ═══ RBAC ROLES (Settings → Roles) ═══
async function _loadRoles() {
  const el = document.getElementById('rolesList');
  if (!el) return;
  try {
    const roles = await api('/api/admin/roles');
    if (!roles.length) { el.innerHTML = '<p style="color:var(--text3)">No roles found</p>'; return; }
    el.innerHTML = `<table class="proc-table" style="width:100%">
      <thead><tr><th>Name</th><th>Description</th><th>Permissions</th><th>Type</th><th></th></tr></thead>
      <tbody>${roles.map(r => `<tr>
        <td style="font-weight:600">${esc(r.name)}</td>
        <td style="font:12px var(--sans);color:var(--text2)">${esc(r.description || '')}</td>
        <td style="font:11px var(--mono);max-width:300px;overflow:hidden;text-overflow:ellipsis">${(r.permissions||[]).join(', ')}</td>
        <td>${r.is_system ? '<span style="color:var(--cyan)">System</span>' : 'Custom'}</td>
        <td>${!r.is_system ? `<button class="btn btn-sm btn-red" onclick="_deleteRole('${esc(r.id)}')">Delete</button>` : ''}</td>
      </tr>`).join('')}</tbody></table>`;
  } catch { el.innerHTML = '<p style="color:var(--red)">Failed to load roles</p>'; }
}
async function _createRole() {
  const name = prompt('Role name:');
  if (!name) return;
  const desc = prompt('Description:') || '';
  const permsStr = prompt('Permissions (comma-separated):', 'agents.read,files.read');
  if (!permsStr) return;
  const permissions = permsStr.split(',').map(s => s.trim()).filter(Boolean);
  await api('/api/admin/roles', 'POST', { name, description: desc, permissions });
  _loadRoles();
}
async function _deleteRole(id) {
  if (!confirm('Delete this role?')) return;
  await api(`/api/admin/roles/${id}`, 'DELETE');
  _loadRoles();
}

// ═══ IMPORT / EXPORT CONFIG (Settings → Import/Export) ═══
async function _exportConfigJson(tables) {
  const qs = tables ? `?tables=${tables.join(',')}` : '';
  const data = await api(`/api/settings/export${qs}`);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `hyperion-config-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}
async function _importConfigJson() {
  const file = document.getElementById('configImportFile')?.files?.[0];
  const mode = document.getElementById('configImportMode')?.value || 'merge';
  const resultEl = document.getElementById('importResult');
  if (!file) { if (resultEl) resultEl.innerHTML = '<span style="color:var(--red)">Select a file first</span>'; return; }
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch { if (resultEl) resultEl.innerHTML = '<span style="color:var(--red)">Invalid JSON file</span>'; return; }
  try {
    const result = await api('/api/settings/import', 'POST', { data, mode });
    if (resultEl) {
      const lines = Object.entries(result.results || {}).map(([t, r]) => `${t}: ${r.imported} imported, ${r.skipped} skipped`);
      resultEl.innerHTML = `<span style="color:var(--green)">Import complete</span><br>${lines.join('<br>')}`;
    }
  } catch (err) {
    if (resultEl) resultEl.innerHTML = `<span style="color:var(--red)">${esc(err.message)}</span>`;
  }
}
function _exportCsv(table) {
  window.open(`/api/settings/export/csv/${table}`, '_blank');
}

// ═══ APPEARANCE (Settings → Appearance) ═══
async function _renderAppearanceTab(el) {
  const presets = await api('/api/settings/theme/presets').catch(() => []);
  const current = await api('/api/settings/theme').catch(() => ({}));
  el.innerHTML = `
    <h3 style="font:600 15px var(--sans);margin-bottom:16px">Theme Presets</h3>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px;margin-bottom:20px">
      ${presets.map(p => `
        <div class="theme-card ${current.accent === p.config.accent && current.mode === p.config.mode ? 'active' : ''}" onclick="_applyThemePreset(${esc(JSON.stringify(p.config).replace(/'/g,'&#39;'))})" tabindex="0" style="cursor:pointer">
          <div style="width:100%;height:56px;background:${p.config.mode==='dark'?'#1C1917':'#FAF8F5'};border-radius:${p.config.borderRadius}px;border:2px solid ${p.config.accent};margin-bottom:6px;position:relative;overflow:hidden">
            <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:${p.config.accent}"></div>
            <div style="position:absolute;top:8px;left:8px;width:8px;height:8px;border-radius:50%;background:${p.config.accent};box-shadow:0 0 8px ${p.config.accent}"></div>
          </div>
          <div style="font:600 11px var(--sans);letter-spacing:0.3px">${esc(p.name)}</div>
        </div>
      `).join('')}
    </div>
    <h3 style="font:600 15px var(--sans);margin-bottom:12px">Customize</h3>
    <div class="form-group"><label>Accent Color</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="color" id="themeAccent" value="${current.accent || '#DA7756'}" style="width:50px;height:32px;border:none;cursor:pointer">
        <span id="themeAccentHex" style="font:12px var(--mono);color:var(--text3)">${current.accent || '#DA7756'}</span>
      </div>
    </div>
    <div class="form-group"><label>Font Size: <span id="themeFontVal">${current.fontSize || 13}</span>px</label>
      <input type="range" min="10" max="22" value="${current.fontSize || 13}" id="themeFontSize" oninput="document.getElementById('themeFontVal').textContent=this.value" style="width:100%">
    </div>
    <div class="form-group"><label>Border Radius: <span id="themeRadiusVal">${current.borderRadius || 8}</span>px</label>
      <input type="range" min="0" max="20" value="${current.borderRadius ?? 8}" id="themeBorderRadius" oninput="document.getElementById('themeRadiusVal').textContent=this.value" style="width:100%">
    </div>
    <div class="form-group" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="themeCompact" ${current.compactMode ? 'checked' : ''}>
      <label style="margin:0">Compact Mode</label>
    </div>
    <button class="btn btn-green" onclick="_saveCustomTheme()">Save Theme</button>
  `;
  const colorInput = document.getElementById('themeAccent');
  if (colorInput) colorInput.addEventListener('input', () => { document.getElementById('themeAccentHex').textContent = colorInput.value; });
}
async function _applyThemePreset(config) {
  await api('/api/settings/theme', 'PUT', config);
  _applyThemeLocally(config);
  switchSettingsTab('appearance');
}
async function _saveCustomTheme() {
  const config = {
    mode: document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
    accent: document.getElementById('themeAccent')?.value || '#DA7756',
    fontSize: parseInt(document.getElementById('themeFontSize')?.value) || 13,
    borderRadius: parseInt(document.getElementById('themeBorderRadius')?.value) || 8,
    compactMode: !!document.getElementById('themeCompact')?.checked,
    sidebarPosition: 'left',
  };
  await api('/api/settings/theme', 'PUT', config);
  _applyThemeLocally(config);
}
function _applyThemeLocally(config) {
  localStorage.setItem('hyperion_theme', JSON.stringify(config));
  if (config.mode === 'light') document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  if (config.accent) document.documentElement.style.setProperty('--accent', config.accent);
  if (config.fontSize) document.documentElement.style.setProperty('--font-size', config.fontSize + 'px');
  if (config.borderRadius !== undefined) document.documentElement.style.setProperty('--radius', config.borderRadius + 'px');
  if (config.compactMode) document.documentElement.classList.add('compact-mode');
  else document.documentElement.classList.remove('compact-mode');
}

// ── Load saved theme on startup ──
async function _loadSavedTheme() {
  try {
    const config = await api('/api/settings/theme');
    if (config && config.accent) {
      _applyThemeLocally(config);
    }
  } catch {}
}
// Attach to loadUserSettings
const _origLoadUserSettings = typeof loadUserSettings === 'function' ? loadUserSettings : null;

// ═══ AI CHAT ═══
let _chatSessions = [];
let _chatActiveSession = null;
let _chatStreaming = false;
let _chatAbortController = null;

async function loadChat() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="page" style="padding:0;height:100%">
      <div class="chat-layout">
        <div class="chat-sidebar">
          <div class="chat-sidebar-header">
            <h3>Chats</h3>
            <button class="chat-new-btn" onclick="_chatNewSession()">+ New</button>
          </div>
          <div class="chat-session-list" id="chatSessionList"></div>
        </div>
        <div class="chat-main">
          <div class="chat-messages" id="chatMessages"></div>
          <div class="chat-input-area">
            <div class="chat-input-wrap">
              <textarea class="chat-input" id="chatInput" placeholder="Ask Hyperion anything..." rows="1"
                onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_chatSend()}"></textarea>
              <button class="chat-send-btn" id="chatSendBtn" onclick="_chatSend()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Auto-resize textarea
  const input = document.getElementById('chatInput');
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
  });

  await _chatLoadSessions();
  if (_chatSessions.length > 0) {
    await _chatSelectSession(_chatSessions[0].id);
  } else {
    _chatShowEmpty();
  }
}

async function _chatLoadSessions() {
  try {
    _chatSessions = await api('/api/chat/sessions');
  } catch { _chatSessions = []; }
  _chatRenderSessions();
}

function _chatRenderSessions() {
  const list = document.getElementById('chatSessionList');
  if (!list) return;
  list.innerHTML = _chatSessions.map(s => `
    <div class="chat-session-item${_chatActiveSession === s.id ? ' active' : ''}" onclick="_chatSelectSession('${s.id}')">
      <span class="chat-session-title">${esc(s.title)}</span>
      <button class="chat-session-delete" onclick="event.stopPropagation();_chatDeleteSession('${s.id}')" title="Delete">&times;</button>
    </div>
  `).join('') || '<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">No conversations yet</div>';
}

async function _chatSelectSession(id) {
  _chatActiveSession = id;
  _chatRenderSessions();
  try {
    const messages = await api(`/api/chat/sessions/${id}/messages`);
    _chatRenderMessages(messages);
  } catch {
    _chatRenderMessages([]);
  }
}

async function _chatNewSession() {
  try {
    const session = await api('/api/chat/sessions', 'POST', { title: 'New Chat' });
    _chatSessions.unshift(session);
    await _chatSelectSession(session.id);
  } catch (err) {
    console.error('Failed to create session:', err);
  }
}

async function _chatDeleteSession(id) {
  try {
    await api(`/api/chat/sessions/${id}`, 'DELETE');
    _chatSessions = _chatSessions.filter(s => s.id !== id);
    if (_chatActiveSession === id) {
      _chatActiveSession = _chatSessions[0]?.id || null;
      if (_chatActiveSession) await _chatSelectSession(_chatActiveSession);
      else _chatShowEmpty();
    }
    _chatRenderSessions();
  } catch {}
}

function _chatShowEmpty() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  container.innerHTML = `
    <div class="chat-empty">
      <div class="chat-empty-icon">&#x1F916;</div>
      <div class="chat-empty-title">Hyperion AI Agent</div>
      <div class="chat-empty-sub">Ask me to manage your system, run commands, work with Docker, Git, files, and more. I can execute tools autonomously.</div>
      <div class="chat-example-prompts">
        <button class="chat-example-btn" onclick="_chatExampleClick(this)">Show Docker containers</button>
        <button class="chat-example-btn" onclick="_chatExampleClick(this)">Check disk usage</button>
        <button class="chat-example-btn" onclick="_chatExampleClick(this)">List files in ~/Desktop</button>
        <button class="chat-example-btn" onclick="_chatExampleClick(this)">System CPU and memory info</button>
      </div>
    </div>
  `;
}

function _chatExampleClick(btn) {
  const input = document.getElementById('chatInput');
  if (input) { input.value = btn.textContent; _chatSend(); }
}

function _chatRenderMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  if (!messages.length) { _chatShowEmpty(); return; }

  container.innerHTML = messages.map(m => {
    if (m.role === 'user') {
      return `<div class="chat-msg user"><div class="chat-msg-bubble">${esc(m.content)}</div></div>`;
    }
    let html = '<div class="chat-msg assistant">';
    if (m.tools?.length) {
      html += m.tools.map(t => _chatRenderToolCard(t)).join('');
    }
    if (m.content) {
      html += `<div class="chat-msg-bubble">${_chatFormatText(m.content)}</div>`;
    }
    html += '</div>';
    return html;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function _chatRenderToolCard(tool) {
  if (tool.type === 'start') return ''; // skip starts, show results
  const status = tool.denied ? 'denied' : (tool.result?.error ? 'error' : 'success');
  const statusLabel = tool.denied ? 'Denied' : (tool.result?.error ? 'Error' : 'Done');
  const body = tool.result ? JSON.stringify(tool.result, null, 2) : '';
  const argsStr = tool.arguments ? JSON.stringify(tool.arguments) : '';
  return `
    <div class="chat-tool-card">
      <div class="chat-tool-header" onclick="this.parentElement.querySelector('.chat-tool-body').classList.toggle('hidden')">
        <span class="chat-tool-name">${esc(tool.name)}</span>
        ${argsStr ? `<span class="chat-tool-args" style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px">${esc(argsStr)}</span>` : ''}
        <span class="chat-tool-status ${status}">${statusLabel}</span>
      </div>
      <div class="chat-tool-body${body.length > 500 ? ' hidden' : ''}">${esc(body).slice(0, 3000)}</div>
    </div>
  `;
}

async function _chatSend() {
  const input = document.getElementById('chatInput');
  const message = input?.value?.trim();
  if (!message || _chatStreaming) return;

  // Create session if needed
  if (!_chatActiveSession) {
    try {
      const session = await api('/api/chat/sessions', 'POST', { title: message.slice(0, 60) });
      _chatSessions.unshift(session);
      _chatActiveSession = session.id;
      _chatRenderSessions();
    } catch { return; }
  }

  input.value = '';
  input.style.height = 'auto';
  _chatStreaming = true;
  document.getElementById('chatSendBtn').disabled = true;

  const container = document.getElementById('chatMessages');
  // Clear empty state
  const emptyEl = container.querySelector('.chat-empty');
  if (emptyEl) emptyEl.remove();

  // Add user message
  container.insertAdjacentHTML('beforeend', `<div class="chat-msg user"><div class="chat-msg-bubble">${esc(message)}</div></div>`);

  // Add assistant placeholder
  const assistantDiv = document.createElement('div');
  assistantDiv.className = 'chat-msg assistant';
  container.appendChild(assistantDiv);
  container.scrollTop = container.scrollHeight;

  let currentBubble = null;
  let fullText = '';

  try {
    _chatAbortController = new AbortController();
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': _sessionId },
      body: JSON.stringify({ message, sessionId: _chatActiveSession }),
      signal: _chatAbortController.signal,
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ') && eventType) {
          let data;
          try { data = JSON.parse(line.slice(6)); } catch { continue; }
          _handleChatSSE(eventType, data, assistantDiv, container);
          if (eventType === 'text') {
            fullText += data.text || '';
            if (!currentBubble) {
              currentBubble = document.createElement('div');
              currentBubble.className = 'chat-msg-bubble chat-streaming';
              assistantDiv.appendChild(currentBubble);
            }
            currentBubble.innerHTML = _chatFormatText(fullText);
            container.scrollTop = container.scrollHeight;
          }
          if (eventType === 'done' || eventType === 'close') {
            if (currentBubble) currentBubble.classList.remove('chat-streaming');
          }
          eventType = '';
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      assistantDiv.insertAdjacentHTML('beforeend',
        `<div class="chat-msg-bubble" style="color:var(--red)">Error: ${esc(err.message)}</div>`);
    }
  }

  if (currentBubble) currentBubble.classList.remove('chat-streaming');
  _chatStreaming = false;
  _chatAbortController = null;
  document.getElementById('chatSendBtn').disabled = false;
  container.scrollTop = container.scrollHeight;

  // Update session title if it was the first message
  const sess = _chatSessions.find(s => s.id === _chatActiveSession);
  if (sess && sess.title === 'New Chat') {
    sess.title = message.slice(0, 60);
    api(`/api/chat/sessions/${_chatActiveSession}`, 'PATCH', { title: sess.title }).catch(() => {});
    _chatRenderSessions();
  }
}

function _handleChatSSE(type, data, assistantDiv, container) {
  switch (type) {
    case 'provider':
      assistantDiv.insertAdjacentHTML('afterbegin',
        `<span class="chat-provider">${esc(data.provider)} / ${esc(data.model)}</span>`);
      break;
    case 'session':
      if (data.sessionId && data.sessionId !== _chatActiveSession) {
        _chatActiveSession = data.sessionId;
      }
      break;
    case 'tool_start': {
      const card = document.createElement('div');
      card.className = 'chat-tool-card';
      card.id = `tool-${data.id}`;
      const argsStr = data.arguments ? JSON.stringify(data.arguments) : '';
      card.innerHTML = `
        <div class="chat-tool-header">
          <span class="chat-tool-name">${esc(data.name)}</span>
          <span style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px">${esc(argsStr)}</span>
          <span class="chat-tool-status running">Running</span>
        </div>
        <div class="chat-tool-body" style="color:var(--amber)">Executing...</div>
      `;
      assistantDiv.appendChild(card);
      container.scrollTop = container.scrollHeight;
      break;
    }
    case 'tool_result': {
      const card = document.getElementById(`tool-${data.id}`);
      if (card) {
        const status = data.denied ? 'denied' : (data.result?.error ? 'error' : 'success');
        const label = data.denied ? 'Denied' : (data.result?.error ? 'Error' : 'Done');
        const statusEl = card.querySelector('.chat-tool-status');
        if (statusEl) { statusEl.className = `chat-tool-status ${status}`; statusEl.textContent = label; }
        const body = card.querySelector('.chat-tool-body');
        if (body) {
          const text = JSON.stringify(data.result, null, 2);
          body.style.color = '';
          body.textContent = text.slice(0, 3000);
          body.onclick = () => body.classList.toggle('hidden');
        }
      }
      container.scrollTop = container.scrollHeight;
      break;
    }
    case 'approval_needed': {
      const banner = document.createElement('div');
      banner.className = 'chat-approval';
      banner.id = `approval-${data.id}`;
      const argsStr = data.arguments ? JSON.stringify(data.arguments, null, 2) : '';
      banner.innerHTML = `
        <span class="chat-approval-icon">&#x26A0;</span>
        <div class="chat-approval-text">
          <div><strong>Approval Required</strong></div>
          <div class="chat-approval-tool">${esc(data.name)}</div>
          <pre style="font-size:11px;margin-top:4px;color:var(--text3)">${esc(argsStr)}</pre>
        </div>
        <div class="chat-approval-btns">
          <button class="chat-approve-btn" onclick="_chatApprove('${_chatActiveSession}',true)">Approve</button>
          <button class="chat-deny-btn" onclick="_chatApprove('${_chatActiveSession}',false)">Deny</button>
        </div>
      `;
      assistantDiv.appendChild(banner);
      container.scrollTop = container.scrollHeight;
      break;
    }
    case 'error':
      assistantDiv.insertAdjacentHTML('beforeend',
        `<div style="color:var(--red);font-size:12px;padding:4px 0">${esc(data.error || 'Unknown error')}</div>`);
      break;
  }
}

async function _chatApprove(sessionId, approved) {
  try {
    await api('/api/chat/approve', 'POST', { sessionId, approved });
    // Remove approval banner
    const banners = document.querySelectorAll('.chat-approval');
    banners.forEach(b => {
      b.innerHTML = '<span style="color:' + (approved ? 'var(--cyan)' : 'var(--red)') + ';font-size:12px">' + (approved ? '\u2713 Approved' : '\u2717 Denied') + '</span>';
      setTimeout(() => b.remove(), 2000);
    });
  } catch {}
}

function _chatFormatText(text) {
  if (!text) return '';
  let html = esc(text);
  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code>${code}</code></pre>`);
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  return html;
}
