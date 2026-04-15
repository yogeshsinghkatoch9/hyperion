// ═══ Natural Language → Shell Command Translator ═══
// No AI API needed. Works offline. Covers 300+ common patterns.

const os = require('os');
const HOME = os.homedir();
const { resolveAppName, fuzzyMatch, isBrowser, APP_ALIASES } = require('./appDiscovery');
const pluginLoader = require('./pluginLoader');

// Strip dangerous shell metacharacters from user input
function shellSafe(s) {
  return (s || '').replace(/[`$(){}|;&<>\\]/g, '');
}

const PATTERNS = [
  // ════════════════════════════════════════════
  // ── APP: Deep Commands (BEFORE generic open) ──
  // ════════════════════════════════════════════

  // open chrome with google.com → open URL in browser
  { match: /^open\s+(\w[\w\s]*?)\s+(?:with|to|at)\s+(https?:\/\/\S+)/i, build: (m) => {
    const app = resolveAppName(shellSafe(m[1].trim()));
    return `open -a "${app}" "${shellSafe(m[2].trim())}"`;
  }, desc: 'Open app with URL' },

  // open chrome with google.com (no protocol)
  { match: /^open\s+(\w[\w\s]*?)\s+(?:with|to)\s+(\S+\.\S+)/i, build: (m) => {
    const app = resolveAppName(shellSafe(m[1].trim()));
    const target = m[2].trim();
    const url = /^https?:\/\//i.test(target) ? target : `https://${target}`;
    if (isBrowser(app)) return `open -a "${app}" "${shellSafe(url)}"`;
    return `open -a "${app}" "${shellSafe(target)}"`;
  }, desc: 'Open app with target' },

  // open vscode with ~/projects
  { match: /^open\s+(\w[\w\s]*?)\s+(?:with|at)\s+(~\/\S+|\/\S+)/i, build: (m) => {
    const app = resolveAppName(shellSafe(m[1].trim()));
    return `open -a "${app}" "${shellSafe(m[2].trim().replace(/^~/, HOME))}"`;
  }, desc: 'Open app with path' },

  // open finder at ~/Downloads
  { match: /^open\s+finder\s+(?:at|in|to)\s+(.+)/i, build: (m) => {
    return `open "${shellSafe(m[1].trim().replace(/^~/, HOME))}"`;
  }, desc: 'Open Finder at path' },

  // open terminal at ~/Desktop
  { match: /^open\s+terminal\s+(?:at|in|to)\s+(.+)/i, build: (m) => {
    return `open -a Terminal "${shellSafe(m[1].trim().replace(/^~/, HOME))}"`;
  }, desc: 'Open Terminal at path' },

  // ── APP: State Queries ──
  { match: /^is\s+(\w[\w\s]*?)\s+(?:running|open|active)\??$/i, build: (m) => {
    const app = resolveAppName(shellSafe(m[1].trim()));
    return `pgrep -f "${app}" > /dev/null 2>&1 && echo "${app} is running" || echo "${app} is NOT running"`;
  }, desc: 'Check if app is running' },

  { match: /^(?:what|which)\s+apps?\s+(?:are\s+)?(?:running|open)/i, build: () => {
    return process.platform === 'darwin'
      ? `osascript -e 'tell application "System Events" to get name of every process whose background only is false' | tr ',' '\\n' | sed 's/^ //' | sort`
      : `ps aux | grep -i "Applications" | grep -v grep | awk '{print $11}' | sort -u`;
  }, desc: 'List running apps' },

  { match: /^(?:how much|show)\s+(?:memory|ram)\s+(?:is\s+)?(\w[\w\s]*?)\s+using\??$/i, build: (m) => {
    const app = shellSafe(m[1].trim());
    return `ps aux | grep -i "${app}" | grep -v grep | awk '{sum+=$6} END {printf "%.1f MB\\n", sum/1024}'`;
  }, desc: 'Check app memory usage' },

  { match: /^(?:which|what)\s+app\s+(?:is\s+)?using\s+(?:the\s+)?most\s+(?:cpu|processor)/i, build: () => {
    return `ps aux --sort=-%cpu | head -6 | awk 'NR>1{printf "%-6s %-5s%% %s\\n",$2,$3,$11}'`;
  }, desc: 'Top CPU-consuming app' },

  // ── APP: Restart / Force-Kill ──
  { match: /^restart\s+(\w[\w\s]*?)$/i, build: (m) => {
    const app = resolveAppName(shellSafe(m[1].trim()));
    return process.platform === 'darwin'
      ? `osascript -e 'quit app "${app}"' && sleep 1 && open -a "${app}" && echo "Restarted ${app}"`
      : `pkill -f "${app}" && sleep 1 && ${app} & echo "Restarted ${app}"`;
  }, desc: 'Restart app' },

  { match: /^(?:force\s+quit|force\s+kill|force\s+close)\s+(\w[\w\s]*?)$/i, build: (m) => {
    const app = resolveAppName(shellSafe(m[1].trim()));
    return `pkill -9 -f "${app}" && echo "Force-killed ${app}" || echo "${app} was not running"`;
  }, desc: 'Force quit app' },

  // ── NOTIFICATIONS ──
  { match: /^(?:notify|alert)\s+"([^"]+)"(?:\s+urgently)?$/i, build: (m) => {
    const msg = shellSafe(m[1]);
    const urgent = /urgently/i.test(m[0]);
    const sound = urgent ? ' sound name "Funk"' : '';
    return process.platform === 'darwin'
      ? `osascript -e 'display notification "${msg}" with title "Hyperion"${sound}'`
      : `notify-send "Hyperion" "${msg}"`;
  }, desc: 'Show notification' },

  // ════════════════════════════════════════════
  // ── WINDOW MANAGEMENT ──
  // ════════════════════════════════════════════

  { match: /^(?:move|snap|put)\s+(\w[\w\s]*?)\s+to\s+(left half|right half|top half|bottom half|top left|top right|bottom left|bottom right|fullscreen|center)/i, build: (m) => {
    const app = resolveAppName(shellSafe(m[1].trim()));
    const windowMgr = require('./windowManager');
    return windowMgr.moveWindowScript(app, m[2].trim());
  }, desc: 'Move window to position' },

  { match: /^fullscreen\s+(\w[\w\s]*?)$/i, build: (m) => {
    const app = resolveAppName(shellSafe(m[1].trim()));
    const windowMgr = require('./windowManager');
    return windowMgr.moveWindowScript(app, 'fullscreen');
  }, desc: 'Fullscreen app' },

  { match: /^minimize\s+(?:all\s+)?(?:windows?|apps?)$/i, build: () => {
    const windowMgr = require('./windowManager');
    return windowMgr.minimizeAll();
  }, desc: 'Minimize all windows' },

  { match: /^(?:arrange|tile)\s+(\w[\w\s]*?)\s+(?:and|&)\s+(\w[\w\s]*?)\s+side\s+by\s+side$/i, build: (m) => {
    const app1 = resolveAppName(shellSafe(m[1].trim()));
    const app2 = resolveAppName(shellSafe(m[2].trim()));
    const windowMgr = require('./windowManager');
    return windowMgr.sideBySide(app1, app2);
  }, desc: 'Tile two apps side by side' },

  // ════════════════════════════════════════════
  // ── SYSTEM TOGGLES ──
  // ════════════════════════════════════════════

  { match: /^(?:turn\s+on|enable)\s+dark\s+mode$/i, build: () => {
    return process.platform === 'darwin'
      ? `osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to true' && echo "Dark mode enabled"`
      : `gsettings set org.gnome.desktop.interface gtk-theme 'Adwaita-dark' 2>/dev/null && echo "Dark mode enabled"`;
  }, desc: 'Enable dark mode' },

  { match: /^(?:turn\s+off|disable)\s+dark\s+mode$/i, build: () => {
    return process.platform === 'darwin'
      ? `osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to false' && echo "Dark mode disabled"`
      : `gsettings set org.gnome.desktop.interface gtk-theme 'Adwaita' 2>/dev/null && echo "Dark mode disabled"`;
  }, desc: 'Disable dark mode' },

  { match: /^(?:set\s+)?volume\s+(?:to\s+)?(\d+)/i, build: (m) => {
    const vol = Math.min(100, Math.max(0, parseInt(m[1])));
    const osVol = Math.round(vol / 100 * 7); // macOS 0-7 scale
    return process.platform === 'darwin'
      ? `osascript -e 'set volume output volume ${vol}' && echo "Volume set to ${vol}%"`
      : `amixer set Master ${vol}% 2>/dev/null && echo "Volume set to ${vol}%"`;
  }, desc: 'Set volume level' },

  { match: /^mute(?:\s+(?:volume|sound|audio))?$/i, build: () => {
    return process.platform === 'darwin'
      ? `osascript -e 'set volume with output muted' && echo "Audio muted"`
      : `amixer set Master mute 2>/dev/null && echo "Audio muted"`;
  }, desc: 'Mute audio' },

  { match: /^unmute(?:\s+(?:volume|sound|audio))?$/i, build: () => {
    return process.platform === 'darwin'
      ? `osascript -e 'set volume without output muted' && echo "Audio unmuted"`
      : `amixer set Master unmute 2>/dev/null && echo "Audio unmuted"`;
  }, desc: 'Unmute audio' },

  { match: /^(?:turn\s+on|enable)\s+(?:wifi|wi-fi)$/i, build: () => {
    return process.platform === 'darwin'
      ? `networksetup -setairportpower en0 on && echo "WiFi turned on"`
      : `nmcli radio wifi on 2>/dev/null && echo "WiFi turned on"`;
  }, desc: 'Turn on WiFi' },

  { match: /^(?:turn\s+off|disable)\s+(?:wifi|wi-fi)$/i, build: () => {
    return process.platform === 'darwin'
      ? `networksetup -setairportpower en0 off && echo "WiFi turned off"`
      : `nmcli radio wifi off 2>/dev/null && echo "WiFi turned off"`;
  }, desc: 'Turn off WiFi' },

  { match: /^(?:turn\s+on|enable)\s+bluetooth$/i, build: () => {
    return process.platform === 'darwin'
      ? `blueutil --power 1 2>/dev/null && echo "Bluetooth on" || echo "Install blueutil: brew install blueutil"`
      : `rfkill unblock bluetooth 2>/dev/null && echo "Bluetooth on"`;
  }, desc: 'Turn on Bluetooth' },

  { match: /^(?:turn\s+off|disable)\s+bluetooth$/i, build: () => {
    return process.platform === 'darwin'
      ? `blueutil --power 0 2>/dev/null && echo "Bluetooth off" || echo "Install blueutil: brew install blueutil"`
      : `rfkill block bluetooth 2>/dev/null && echo "Bluetooth off"`;
  }, desc: 'Turn off Bluetooth' },

  // ════════════════════════════════════════════
  // ── CLIPBOARD INTEGRATION ──
  // ════════════════════════════════════════════

  { match: /^copy\s+"([^"]+)"\s+to\s+clipboard$/i, build: (m) => {
    return process.platform === 'darwin'
      ? `echo -n "${shellSafe(m[1])}" | pbcopy && echo "Copied to clipboard"`
      : `echo -n "${shellSafe(m[1])}" | xclip -sel clip 2>/dev/null && echo "Copied to clipboard"`;
  }, desc: 'Copy text to clipboard' },

  { match: /^save\s+clipboard\s+to\s+(.+)/i, build: (m) => {
    const filepath = shellSafe(m[1].trim()).replace(/^~/, HOME);
    return process.platform === 'darwin'
      ? `pbpaste > "${filepath}" && echo "Clipboard saved to ${filepath}"`
      : `xclip -sel clip -o > "${filepath}" 2>/dev/null && echo "Clipboard saved"`;
  }, desc: 'Save clipboard to file' },

  { match: /^clear\s+clipboard$/i, build: () => {
    return process.platform === 'darwin'
      ? `echo -n "" | pbcopy && echo "Clipboard cleared"`
      : `echo -n "" | xclip -sel clip 2>/dev/null && echo "Clipboard cleared"`;
  }, desc: 'Clear clipboard' },

  // ════════════════════════════════════════════
  // ── KEYBOARD SIMULATION ──
  // ════════════════════════════════════════════

  { match: /^type\s+"([^"]+)"$/i, build: (m) => {
    return process.platform === 'darwin'
      ? `osascript -e 'tell application "System Events" to keystroke "${shellSafe(m[1])}"' && echo "Typed: ${shellSafe(m[1])}"`
      : `xdotool type "${shellSafe(m[1])}" 2>/dev/null && echo "Typed: ${shellSafe(m[1])}"`;
  }, desc: 'Simulate typing' },

  { match: /^press\s+((?:cmd|command|ctrl|control|alt|option|shift)\+)*(\w+)$/i, build: (m) => {
    if (process.platform !== 'darwin') return `echo "Key simulation requires macOS"`;
    const full = m[0].replace(/^press\s+/i, '');
    const parts = full.split('+');
    const key = parts.pop();
    const mods = parts.map(m => {
      const lower = m.toLowerCase();
      if (lower === 'cmd' || lower === 'command') return 'command down';
      if (lower === 'ctrl' || lower === 'control') return 'control down';
      if (lower === 'alt' || lower === 'option') return 'option down';
      if (lower === 'shift') return 'shift down';
      return '';
    }).filter(Boolean).join(', ');
    const using = mods ? ` using {${mods}}` : '';
    return `osascript -e 'tell application "System Events" to keystroke "${key}"${using}'`;
  }, desc: 'Simulate key press' },

  // ════════════════════════════════════════════
  // ── CREATIVE UTILITIES ──
  // ════════════════════════════════════════════

  // Text-to-speech
  { match: /^say\s+"([^"]+)"$/i, build: (m) => `say "${shellSafe(m[1])}"`, desc: 'Text to speech' },
  { match: /^say\s+(.+)/i, build: (m) => `say "${shellSafe(m[1].trim())}"`, desc: 'Text to speech' },

  // Quick math (restricted to safe math chars only)
  { match: /^(?:calculate|calc|compute|what\s+is)\s+(.+)/i, build: (m) => {
    let expr = m[1].trim();
    // Handle "15% of 2400" pattern
    expr = expr.replace(/(\d+(?:\.\d+)?)\s*%\s+of\s+(\d+(?:\.\d+)?)/g, '($1/100)*$2');
    // Only allow safe math characters: digits, operators, parens, dots, spaces
    expr = expr.replace(/[^0-9+\-*/().%^ \t]/g, '');
    if (!expr.trim()) return `echo "Invalid expression"`;
    return `python3 -c "print(${expr})"`;
  }, desc: 'Quick math calculation' },

  // Password generator
  { match: /^(?:generate|create|make)\s+(?:a\s+)?(?:strong\s+)?password/i, build: () => {
    return `openssl rand -base64 24 | head -c 32 && echo ""`;
  }, desc: 'Generate strong password' },

  // QR code
  { match: /^(?:generate|create|make)\s+(?:a\s+)?(?:qr\s*code|qr)\s+(?:for\s+)?(.+)/i, build: (m) => {
    const data = shellSafe(m[1].trim().replace(/^["']|["']$/g, ''));
    return `qrencode -o ~/Desktop/qr_$(date +%s).png "${data}" 2>/dev/null && echo "QR code saved to Desktop" || echo "Install qrencode: brew install qrencode"`;
  }, desc: 'Generate QR code' },

  // Trash
  { match: /^empty\s+(?:the\s+)?trash$/i, build: () => {
    return process.platform === 'darwin'
      ? `osascript -e 'tell application "Finder" to empty trash' && echo "Trash emptied"`
      : `rm -rf ~/.local/share/Trash/files/* 2>/dev/null && echo "Trash emptied"`;
  }, desc: 'Empty trash' },

  { match: /^(?:show|check|how much)\s+(?:is\s+)?(?:in\s+)?(?:the\s+)?trash\s*(?:size)?/i, build: () => {
    return `du -sh ~/.Trash 2>/dev/null || du -sh ~/.local/share/Trash 2>/dev/null || echo "No trash found"`;
  }, desc: 'Show trash size' },

  // Lock / Sleep / Restart / Shutdown
  { match: /^lock\s+(?:my\s+)?(?:screen|computer|mac)$/i, build: () => {
    return process.platform === 'darwin'
      ? `pmset displaysleepnow`
      : `xdg-screensaver lock 2>/dev/null || loginctl lock-session`;
  }, desc: 'Lock screen' },

  { match: /^(?:sleep|suspend)\s+(?:my\s+)?(?:computer|mac|system)$/i, build: () => {
    return process.platform === 'darwin'
      ? `pmset sleepnow`
      : `systemctl suspend`;
  }, desc: 'Sleep computer' },

  { match: /^restart\s+(?:my\s+)?(?:computer|mac|system)$/i, build: () => {
    return process.platform === 'darwin'
      ? `osascript -e 'tell application "System Events" to restart'`
      : `systemctl reboot`;
  }, desc: 'Restart computer' },

  { match: /^(?:shut\s*down|power\s+off)\s+(?:my\s+)?(?:computer|mac|system)$/i, build: () => {
    return process.platform === 'darwin'
      ? `osascript -e 'tell application "System Events" to shut down'`
      : `systemctl poweroff`;
  }, desc: 'Shutdown computer' },

  // Screen recording
  { match: /^start\s+(?:screen\s+)?recording$/i, build: () => {
    return process.platform === 'darwin'
      ? `osascript -e 'tell application "QuickTime Player" to activate' -e 'tell application "QuickTime Player" to start (new screen recording)' && echo "Recording started"`
      : `echo "Use OBS or ffmpeg for screen recording on Linux"`;
  }, desc: 'Start screen recording' },

  { match: /^stop\s+(?:screen\s+)?recording$/i, build: () => {
    return process.platform === 'darwin'
      ? `osascript -e 'tell application "QuickTime Player" to stop (front document)' && echo "Recording stopped"`
      : `echo "Stop recording in your screen capture tool"`;
  }, desc: 'Stop screen recording' },

  // Reminders
  { match: /^remind\s+me\s+in\s+(\d+)\s+(minutes?|hours?|seconds?)\s+(?:to\s+)?(.+)/i, build: (m) => {
    const amount = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    const msg = shellSafe(m[3].trim());
    let seconds = amount;
    if (unit.startsWith('minute')) seconds = amount * 60;
    else if (unit.startsWith('hour')) seconds = amount * 3600;
    const notifyCmd = process.platform === 'darwin'
      ? `osascript -e 'display notification "${msg}" with title "Reminder" sound name "Glass"'`
      : `notify-send "Reminder" "${msg}"`;
    return `(sleep ${seconds} && ${notifyCmd}) & echo "Reminder set: '${msg}' in ${amount} ${unit}"`;
  }, desc: 'Set a reminder' },

  // ════════════════════════════════════════════
  // ── ORIGINAL PATTERNS (expanded) ──
  // ════════════════════════════════════════════

  // ── DISK & STORAGE (must be before generic show/list/find patterns) ──
  { match: /(?:show|check|how much)\s+(?:disk\s+)?(?:space|storage)/i, build: () => `df -h | grep -v tmpfs | grep -v devfs`, desc: 'Show disk space usage' },
  { match: /(?:disk|storage)\s+(?:space|usage)/i, build: () => `df -h | grep -v tmpfs | grep -v devfs`, desc: 'Show disk space usage' },
  { match: /(?:what|show|how)\s+(?:is\s+)?(?:taking|using)\s+(?:up\s+)?(?:the\s+)?(?:most\s+)?(?:space|storage|disk)/i, build: () => `du -sh ~/* 2>/dev/null | sort -rh | head -15`, desc: 'Show what uses the most space' },
  { match: /(?:folder|directory)\s+size(?:s)?/i, build: () => `du -sh ~/* 2>/dev/null | sort -rh | head -15`, desc: 'Show folder sizes' },
  { match: /(?:clean|clear|free)\s+(?:up\s+)?(?:disk\s+)?(?:space|storage|cache)/i, build: () => `echo "=== Caches ===" && du -sh ~/Library/Caches 2>/dev/null && echo "=== Logs ===" && du -sh ~/Library/Logs 2>/dev/null && echo "=== Trash ===" && du -sh ~/.Trash 2>/dev/null && echo "\\nTo clean: rm -rf ~/Library/Caches/* ~/.Trash/*"`, desc: 'Show what can be cleaned' },

  // ── FILES: Find (specific patterns first, generic last) ──
  { match: /(?:find|show|get)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?big(?:gest)?\s+files?/i, build: () => `find ~ -type f -size +100M -exec ls -lhS {} + 2>/dev/null | head -20`, desc: 'Find files larger than 100MB' },

  { match: /(?:find|show)\s+(?:me\s+)?(?:all\s+)?(?:recent|new|latest|last)\s+(?:modified\s+)?files?/i, build: () => `find ~ -type f -mtime -7 -not -path "*/.*" 2>/dev/null | head -30`, desc: 'Files modified in the last 7 days' },

  { match: /(?:find|show)\s+(?:me\s+)?(?:all\s+)?empty\s+(?:files?|folders?|director)/i, build: () => `find ~ -maxdepth 3 -empty -not -path "*/.*" 2>/dev/null | head -20`, desc: 'Find empty files and folders' },

  { match: /(?:find|search)\s+(?:for\s+)?["\'](.+?)["\']\s+(?:in|inside|within)\s+(?:my\s+)?files?/i, build: (m) => `grep -rl "${shellSafe(m[1])}" ~ --include="*.txt" --include="*.md" --include="*.py" --include="*.js" 2>/dev/null | head -20`, desc: 'Search inside files for text' },

  { match: /(?:find|search|where)\s+(?:is\s+)?(?:the\s+)?file\s+(?:called\s+|named\s+)?["\']?(.+?)["\']?\s*$/i, build: (m) => `find ~ -iname "*${shellSafe(m[1].trim())}*" 2>/dev/null | head -20`, desc: 'Search for a file by name' },

  { match: /(?:find|show|list|get|search)\s+(?:me\s+)?(?:all\s+)?(?:my\s+)?(.+?)\s+files?/i, build: (m) => {
    const ext = guessExtension(m[1]);
    return ext ? `find ~ -name "*.${shellSafe(ext)}" -type f 2>/dev/null | head -50` : `find ~ -iname "*${shellSafe(m[1])}*" -type f 2>/dev/null | head -50`;
  }, desc: 'Find files by type or name' },

  // ── FILES: List ──
  { match: /(?:show|list|what(?:'s| is))\s+(?:in\s+)?(?:my\s+)?(?:the\s+)?desktop/i, build: () => `ls -lah ~/Desktop`, desc: 'List Desktop contents' },
  { match: /(?:show|list|what(?:'s| is))\s+(?:in\s+)?(?:my\s+)?(?:the\s+)?downloads?/i, build: () => `ls -lah ~/Downloads`, desc: 'List Downloads contents' },
  { match: /(?:show|list|what(?:'s| is))\s+(?:in\s+)?(?:my\s+)?(?:the\s+)?documents?/i, build: () => `ls -lah ~/Documents`, desc: 'List Documents contents' },
  { match: /(?:show|list|what(?:'s| is))\s+(?:in\s+)?(?:my\s+)?(?:the\s+)?home/i, build: () => `ls -lah ~`, desc: 'List home directory' },
  { match: /(?:show|list)\s+(?:files?\s+)?(?:in\s+)?(?:the\s+)?(?:current\s+)?(?:folder|directory|dir)/i, build: () => `ls -lah`, desc: 'List current directory' },
  { match: /(?:show|list)\s+(?:all\s+)?(?:files?\s+)?(?:in\s+)?["\']?(.+?)["\']?\s*$/i, build: (m) => `ls -lah "${shellSafe(m[1].trim())}"`, desc: 'List directory contents' },

  // ── FILES: Create / Delete / Move ──
  { match: /(?:create|make|new)\s+(?:a\s+)?folder\s+(?:called\s+|named\s+)?["\']?(.+?)["\']?\s*$/i, build: (m) => `mkdir -p "${shellSafe(m[1].trim())}"`, desc: 'Create a new folder' },
  { match: /(?:create|make|new|touch)\s+(?:a\s+)?file\s+(?:called\s+|named\s+)?["\']?(.+?)["\']?\s*$/i, build: (m) => `touch "${shellSafe(m[1].trim())}"`, desc: 'Create a new empty file' },
  { match: /(?:rename)\s+["\']?(.+?)["\']?\s+(?:to)\s+["\']?(.+?)["\']?\s*$/i, build: (m) => `mv "${shellSafe(m[1].trim())}" "${shellSafe(m[2].trim())}"`, desc: 'Rename a file or folder' },
  { match: /(?:copy)\s+["\']?(.+?)["\']?\s+(?:to)\s+["\']?(.+?)["\']?\s*$/i, build: (m) => `cp -r "${shellSafe(m[1].trim())}" "${shellSafe(m[2].trim())}"`, desc: 'Copy file or folder' },
  { match: /(?:move)\s+["\']?(.+?)["\']?\s+(?:to)\s+["\']?(.+?)["\']?\s*$/i, build: (m) => `mv "${shellSafe(m[1].trim())}" "${shellSafe(m[2].trim())}"`, desc: 'Move file or folder' },

  // ── SYSTEM INFO ──
  { match: /(?:what|show|my)\s+(?:is\s+)?(?:my\s+)?(?:computer|system|machine)\s*(?:info|specs?|details?)?/i, build: () => `echo "Hostname: $(hostname)" && echo "OS: $(sw_vers -productName 2>/dev/null || uname -s) $(sw_vers -productVersion 2>/dev/null || uname -r)" && echo "CPU: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || uname -m)" && echo "Cores: $(sysctl -n hw.ncpu 2>/dev/null || nproc)" && echo "Memory: $(sysctl -n hw.memsize 2>/dev/null | awk '{print $1/1073741824 " GB"}')" && echo "User: $(whoami)"`, desc: 'Show system information' },

  { match: /(?:what|show|check)\s+(?:is\s+)?(?:my\s+)?(?:cpu|processor)\s*(?:usage)?/i, build: () => `top -l 1 | head -10`, desc: 'Show CPU usage' },
  { match: /(?:what|show|check)\s+(?:is\s+)?(?:my\s+)?(?:memory|ram)\s*(?:usage)?/i, build: () => `vm_stat | head -10 && echo "---" && sysctl hw.memsize | awk '{print "Total: " $2/1073741824 " GB"}'`, desc: 'Show memory usage' },
  { match: /(?:how long|show)\s+(?:has\s+)?(?:my\s+)?(?:computer|system|machine)?\s*(?:been\s+)?(?:up|uptime|running)/i, build: () => `uptime`, desc: 'Show system uptime' },
  { match: /(?:what|show|list)\s+(?:is\s+|are\s+)?(?:all\s+)?(?:running|active)\s*(?:processes|programs|apps)?/i, build: () => `ps aux --sort=-%mem | head -25`, desc: 'Show running processes' },

  // ── NETWORK ──
  { match: /(?:what|show|my)\s+(?:is\s+)?(?:my\s+)?ip\s*(?:address)?/i, build: () => `echo "Local: $(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')" && echo "Public: $(curl -s ifconfig.me 2>/dev/null || echo 'Could not fetch')"`, desc: 'Show your IP address' },
  { match: /(?:am i|check|test)\s+(?:connected\s+)?(?:to\s+)?(?:the\s+)?(?:internet|online|connected)/i, build: () => `ping -c 3 google.com 2>&1 && echo "\\n✓ Connected!" || echo "\\n✗ Not connected"`, desc: 'Test internet connection' },
  { match: /(?:what|show)\s+(?:is\s+)?(?:my\s+)?(?:wifi|network|connection)/i, build: () => `networksetup -getairportnetwork en0 2>/dev/null || iwconfig 2>/dev/null | head -5`, desc: 'Show WiFi info' },
  { match: /(?:show|list|what)\s+(?:are\s+)?(?:my\s+)?(?:open\s+)?ports?/i, build: () => `lsof -iTCP -sTCP:LISTEN -P 2>/dev/null | head -20`, desc: 'Show open network ports' },
  { match: /(?:speed\s*test|test\s+(?:my\s+)?(?:internet\s+)?speed|how fast)/i, build: () => `curl -o /dev/null -s -w "Download speed: %{speed_download} bytes/sec (%{time_total}s total)\\n" https://speed.cloudflare.com/__down?bytes=10000000`, desc: 'Quick internet speed test' },
  { match: /(?:ping|check)\s+(.+)/i, build: (m) => `ping -c 4 ${shellSafe(m[1].trim())}`, desc: 'Ping a host' },

  // ── SOFTWARE ──
  { match: /(?:what|which)\s+(?:version\s+(?:of\s+)?)?(?:programming\s+)?(?:languages?|runtimes?)\s+(?:are\s+|do i have\s+)?(?:installed)?/i, build: () => `echo "Node: $(node -v 2>/dev/null || echo N/A)" && echo "Python: $(python3 --version 2>/dev/null || echo N/A)" && echo "Ruby: $(ruby -v 2>/dev/null | head -1 || echo N/A)" && echo "Go: $(go version 2>/dev/null || echo N/A)" && echo "Rust: $(rustc --version 2>/dev/null || echo N/A)" && echo "Java: $(java --version 2>&1 | head -1 || echo N/A)" && echo "Swift: $(swift --version 2>&1 | head -1 || echo N/A)" && echo "GCC: $(gcc --version 2>&1 | head -1 || echo N/A)"`, desc: 'Check installed languages' },
  { match: /(?:install)\s+(?:python\s+)?(?:package\s+)?(?:called\s+)?["\']?(\S+)["\']?(?:\s+(?:with|using)\s+pip)?/i, build: (m) => `pip3 install ${shellSafe(m[1].trim())}`, desc: 'Install Python package' },
  { match: /(?:install)\s+(?:node|npm|js)\s+(?:package\s+)?(?:called\s+)?["\']?(\S+)["\']?/i, build: (m) => `npm install -g ${shellSafe(m[1].trim())}`, desc: 'Install npm package' },
  { match: /(?:install)\s+(?:brew\s+)?(?:package\s+)?(?:called\s+)?["\']?(\S+)["\']?\s+(?:with|using)\s+brew/i, build: (m) => `brew install ${shellSafe(m[1].trim())}`, desc: 'Install with Homebrew' },
  { match: /(?:update|upgrade)\s+(?:all\s+)?(?:my\s+)?(?:brew|homebrew)\s*(?:packages)?/i, build: () => `brew update && brew upgrade`, desc: 'Update Homebrew packages' },
  { match: /(?:update|upgrade)\s+(?:all\s+)?(?:my\s+)?(?:pip|python)\s*(?:packages)?/i, build: () => `pip3 list --outdated`, desc: 'Check outdated Python packages' },
  { match: /(?:update|upgrade)\s+(?:all\s+)?(?:my\s+)?(?:npm|node)\s*(?:packages)?/i, build: () => `npm outdated -g`, desc: 'Check outdated npm packages' },

  // ── GIT ──
  { match: /(?:git\s+)?status/i, build: () => `git status`, desc: 'Git status' },
  { match: /(?:show|git)\s+(?:my\s+)?(?:git\s+)?(?:recent\s+)?commits?(?:\s+log)?/i, build: () => `git log --oneline -20`, desc: 'Show recent git commits' },
  { match: /(?:show|git)\s+(?:my\s+)?(?:git\s+)?branches?/i, build: () => `git branch -a`, desc: 'Show git branches' },

  // ── DOWNLOADS ──
  { match: /(?:download)\s+(?:from\s+)?(?:url\s+)?["\']?(https?:\/\/\S+)["\']?/i, build: (m) => `curl -LO "${shellSafe(m[1].trim())}"`, desc: 'Download a file from URL' },

  // ── COMPRESSION ──
  { match: /(?:compress|zip)\s+(?:the\s+)?(?:folder\s+)?["\']?(.+?)["\']?\s*$/i, build: (m) => `zip -r "${shellSafe(m[1].trim())}.zip" "${shellSafe(m[1].trim())}"`, desc: 'Compress to zip' },
  { match: /(?:extract|unzip|decompress)\s+["\']?(.+?)["\']?\s*$/i, build: (m) => `unzip "${shellSafe(m[1].trim())}" || tar -xf "${shellSafe(m[1].trim())}"`, desc: 'Extract archive' },

  // ── WEATHER / FUN ──
  { match: /(?:what(?:'s| is)|show|check)\s+(?:the\s+)?weather/i, build: () => `curl -s wttr.in/?format=3`, desc: 'Show current weather' },
  { match: /(?:what(?:'s| is)|show)\s+(?:the\s+)?(?:date|time|today)/i, build: () => `date`, desc: 'Show current date and time' },
  { match: /what\s+time\s+is\s+it/i, build: () => `date`, desc: 'Show current time' },
  { match: /what\s+(?:day|date)\s+is\s+(?:it|today)/i, build: () => `date`, desc: 'Show current date' },
  { match: /(?:calendar|show\s+calendar)/i, build: () => `cal`, desc: 'Show calendar' },

  // ── BATTERY ──
  { match: /(?:what|show|check)\s+(?:is\s+)?(?:my\s+)?battery/i, build: () => `pmset -g batt 2>/dev/null || echo "Battery info not available"`, desc: 'Show battery status' },

  // ── CLIPBOARD ──
  { match: /(?:what(?:'s| is)|show)\s+(?:in\s+)?(?:my\s+)?clipboard/i, build: () => `pbpaste | head -20`, desc: 'Show clipboard contents' },

  // ── KILL / STOP ──
  { match: /(?:kill|stop|close|quit)\s+(?:the\s+)?(?:app\s+|program\s+|process\s+)?["\']?(.+?)["\']?\s*$/i, build: (m) => { const s = resolveAppName(shellSafe(m[1].trim())); return `pkill -f "${s}" && echo "Killed ${s}" || echo "Process not found"`; }, desc: 'Kill a process by name' },

  // ── OPEN ──
  { match: /(?:open)\s+(?:the\s+)?(?:app\s+|application\s+)?["\']?(.+?)["\']?\s*$/i, build: (m) => { const s = resolveAppName(shellSafe(m[1].trim())); return `open -a "${s}" 2>/dev/null || open "${s}"`; }, desc: 'Open an app or file' },

  // ── USERS ──
  { match: /(?:who\s+am\s+i|what(?:'s| is)\s+my\s+user(?:name)?)/i, build: () => `whoami && echo "Home: $HOME" && echo "Shell: $SHELL"`, desc: 'Show current user info' },

  // ── SCREENSHOTS ──
  { match: /(?:take|capture)\s+(?:a\s+)?screenshot/i, build: () => `screencapture -x ~/Desktop/screenshot_$(date +%Y%m%d_%H%M%S).png && echo "Screenshot saved to Desktop"`, desc: 'Take a screenshot' },

  // ── DOCKER ──
  { match: /(?:show|list)\s+(?:all\s+)?(?:docker\s+)?containers?/i, build: () => `docker ps -a`, desc: 'List Docker containers' },
  { match: /(?:show|list)\s+(?:all\s+)?docker\s+images?/i, build: () => `docker images`, desc: 'List Docker images' },

  // ── WORD COUNT / FILE INFO ──
  { match: /(?:how many|count)\s+(?:lines?|words?)\s+(?:in|of)\s+["\']?(.+?)["\']?\s*$/i, build: (m) => `wc -lwc "${shellSafe(m[1].trim())}"`, desc: 'Count lines/words in file' },
  { match: /(?:show|read|cat|display)\s+(?:the\s+)?(?:file\s+|contents?\s+(?:of\s+)?)?["\']?(.+?)["\']?\s*$/i, build: (m) => `cat "${shellSafe(m[1].trim())}" | head -100`, desc: 'Show file contents' },

  // ── PERMISSIONS ──
  { match: /(?:make)\s+["\']?(.+?)["\']?\s+executable/i, build: (m) => `chmod +x "${shellSafe(m[1].trim())}"`, desc: 'Make file executable' },

  // ── HISTORY ──
  { match: /(?:show|my)\s+(?:command\s+)?history/i, build: () => `history | tail -30`, desc: 'Show command history' },

  // ── ENVIRONMENT ──
  { match: /(?:show|list|print)\s+(?:my\s+)?(?:environment\s+)?(?:variables?|env)/i, build: () => `env | sort | head -40`, desc: 'Show environment variables' },
  { match: /(?:what|show)\s+(?:is\s+)?(?:my\s+)?(?:the\s+)?(?:path|PATH)/i, build: () => `echo $PATH | tr ':' '\\n'`, desc: 'Show PATH directories' },
];

// Extension guessing
function guessExtension(typeStr) {
  const map = {
    'pdf': 'pdf', 'image': '{jpg,jpeg,png,gif,svg}', 'photo': '{jpg,jpeg,png}',
    'picture': '{jpg,jpeg,png}', 'video': '{mp4,mov,avi,mkv}', 'music': '{mp3,wav,flac,m4a}',
    'audio': '{mp3,wav,flac,m4a}', 'document': '{doc,docx,pdf,txt}', 'text': 'txt',
    'python': 'py', 'javascript': 'js', 'code': '{py,js,ts,go,rs,c,cpp,java,rb}',
    'spreadsheet': '{xlsx,xls,csv}', 'excel': '{xlsx,xls}', 'csv': 'csv',
    'presentation': '{pptx,ppt}', 'zip': '{zip,gz,tar,rar,7z}', 'archive': '{zip,gz,tar,rar}',
    'json': 'json', 'html': 'html', 'css': 'css', 'markdown': 'md', 'log': 'log',
    'config': '{json,yml,yaml,toml,ini,conf}', 'word': '{doc,docx}',
  };
  const lower = typeStr.toLowerCase().trim();
  return map[lower] || null;
}

function translate(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct command passthrough (starts with $ or !)
  if (trimmed.startsWith('$') || trimmed.startsWith('!')) {
    return { command: trimmed.slice(1).trim(), description: 'Direct command', confidence: 1 };
  }

  // Get all patterns including plugin patterns
  const allPatterns = [...PATTERNS, ...pluginLoader.getPluginPatterns()];

  // Try natural language pattern matching FIRST
  for (const pattern of allPatterns) {
    const match = trimmed.match(pattern.match);
    if (match) {
      return {
        command: pattern.build(match),
        description: pattern.desc,
        confidence: 0.9,
        natural: trimmed,
        _plugin: pattern._plugin || null,
      };
    }
  }

  // If no pattern matched, check if it looks like a raw shell command
  const cmdStarters = ['ls', 'cd', 'cat', 'grep', 'find', 'curl', 'wget', 'git', 'docker', 'npm', 'pip', 'brew', 'python', 'node', 'mkdir', 'rm', 'cp', 'mv', 'chmod', 'ssh', 'scp', 'tar', 'zip', 'unzip', 'top', 'ps', 'kill', 'echo', 'export', 'which', 'man', 'touch', 'head', 'tail', 'wc', 'sort', 'awk', 'sed', 'du', 'df'];
  const firstWord = trimmed.split(/\s/)[0].toLowerCase();
  if (cmdStarters.includes(firstWord)) {
    return { command: trimmed, description: 'Direct command', confidence: 1 };
  }

  // Fallback: try to be helpful
  return {
    command: null,
    description: null,
    confidence: 0,
    natural: trimmed,
    suggestions: getSuggestions(trimmed),
  };
}

function getSuggestions(input) {
  const lower = input.toLowerCase();
  const suggestions = [];

  if (lower.includes('file')) suggestions.push('find my pdf files', 'show files in downloads', 'find big files');
  if (lower.includes('space') || lower.includes('storage') || lower.includes('disk')) suggestions.push('how much disk space', 'what is taking up space', 'clean up space');
  if (lower.includes('network') || lower.includes('internet') || lower.includes('wifi')) suggestions.push('what is my ip', 'am i connected to internet', 'test internet speed');
  if (lower.includes('install')) suggestions.push('install python package requests', 'install node package express');
  if (lower.includes('process') || lower.includes('running')) suggestions.push('what is running', 'show running apps');
  if (lower.includes('system') || lower.includes('computer')) suggestions.push('show my computer info', 'check cpu usage', 'check memory usage');
  if (lower.includes('window') || lower.includes('move') || lower.includes('arrange')) suggestions.push('move chrome to left half', 'fullscreen safari', 'minimize all windows');
  if (lower.includes('dark') || lower.includes('mode') || lower.includes('volume')) suggestions.push('turn on dark mode', 'set volume to 50', 'mute');
  if (lower.includes('remind') || lower.includes('timer')) suggestions.push('remind me in 30 minutes to take a break');
  if (lower.includes('password') || lower.includes('generate')) suggestions.push('generate a strong password', 'generate qr code for example.com');

  if (suggestions.length === 0) {
    suggestions.push('show my computer info', 'find big files', 'how much disk space', 'what is my ip', 'show running processes', 'generate password');
  }

  return suggestions.slice(0, 4);
}

// Quick action categories for the UI
const QUICK_ACTIONS = [
  { category: 'Files', actions: [
    { label: 'Find big files', query: 'find big files' },
    { label: 'Recent files', query: 'find recent files' },
    { label: 'Desktop contents', query: 'show desktop' },
    { label: 'Downloads contents', query: 'show downloads' },
    { label: 'Find PDFs', query: 'find pdf files' },
    { label: 'Find images', query: 'find image files' },
  ]},
  { category: 'System', actions: [
    { label: 'System info', query: 'what is my computer' },
    { label: 'Disk space', query: 'how much disk space' },
    { label: 'What uses space', query: 'what is taking up space' },
    { label: 'Battery', query: 'check battery' },
    { label: 'Running apps', query: 'what apps are running' },
    { label: 'CPU usage', query: 'check cpu usage' },
  ]},
  { category: 'Network', actions: [
    { label: 'My IP address', query: 'what is my ip' },
    { label: 'Internet test', query: 'am i connected to internet' },
    { label: 'Speed test', query: 'test internet speed' },
    { label: 'Open ports', query: 'show open ports' },
    { label: 'WiFi info', query: 'show wifi' },
  ]},
  { category: 'Control', actions: [
    { label: 'Dark mode ON', query: 'turn on dark mode' },
    { label: 'Dark mode OFF', query: 'turn off dark mode' },
    { label: 'Mute', query: 'mute' },
    { label: 'Volume 50%', query: 'set volume to 50' },
    { label: 'Lock screen', query: 'lock my screen' },
    { label: 'Minimize all', query: 'minimize all windows' },
  ]},
  { category: 'Utilities', actions: [
    { label: 'Password', query: 'generate password' },
    { label: 'Say hello', query: 'say "Hello from Hyperion!"' },
    { label: 'Calculator', query: 'calculate 15% of 2400' },
    { label: 'Empty trash', query: 'empty trash' },
    { label: 'Trash size', query: 'show trash size' },
    { label: 'Screenshot', query: 'take screenshot' },
  ]},
  { category: 'Tools', actions: [
    { label: 'Installed languages', query: 'what languages are installed' },
    { label: 'Weather', query: 'what is the weather' },
    { label: 'Date & time', query: 'what is the time' },
    { label: 'Calendar', query: 'show calendar' },
    { label: 'Clipboard', query: 'show clipboard' },
    { label: 'Clean cache', query: 'clean up space' },
  ]},
];

module.exports = { translate, QUICK_ACTIONS, PATTERNS, resolveAppName, APP_ALIASES };
