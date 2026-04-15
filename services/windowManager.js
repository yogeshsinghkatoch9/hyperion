/**
 * Window Manager Service
 * AppleScript-based window positioning for macOS.
 */

const { execSync } = require('child_process');

const POSITIONS = {
  'left half':     (w, h) => `{0, 0, ${Math.floor(w/2)}, ${h}}`,
  'right half':    (w, h) => `{${Math.floor(w/2)}, 0, ${w}, ${h}}`,
  'top half':      (w, h) => `{0, 0, ${w}, ${Math.floor(h/2)}}`,
  'bottom half':   (w, h) => `{0, ${Math.floor(h/2)}, ${w}, ${h}}`,
  'top left':      (w, h) => `{0, 0, ${Math.floor(w/2)}, ${Math.floor(h/2)}}`,
  'top right':     (w, h) => `{${Math.floor(w/2)}, 0, ${w}, ${Math.floor(h/2)}}`,
  'bottom left':   (w, h) => `{0, ${Math.floor(h/2)}, ${Math.floor(w/2)}, ${h}}`,
  'bottom right':  (w, h) => `{${Math.floor(w/2)}, ${Math.floor(h/2)}, ${w}, ${h}}`,
  'fullscreen':    (w, h) => `{0, 0, ${w}, ${h}}`,
  'center':        (w, h) => `{${Math.floor(w/4)}, ${Math.floor(h/4)}, ${Math.floor(3*w/4)}, ${Math.floor(3*h/4)}}`,
};

function getScreenSize() {
  if (process.platform !== 'darwin') return { width: 1920, height: 1080 };
  try {
    const result = execSync(
      `osascript -e 'tell application "Finder" to get bounds of window of desktop'`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    const parts = result.split(', ').map(Number);
    return { width: parts[2] || 1920, height: parts[3] || 1080 };
  } catch {
    return { width: 1920, height: 1080 };
  }
}

function moveWindow(appName, position) {
  if (process.platform !== 'darwin') {
    return `echo "Window management requires macOS"`;
  }

  const pos = position.toLowerCase();
  const posFn = POSITIONS[pos];
  if (!posFn) {
    return `echo "Unknown position: ${position}. Available: ${Object.keys(POSITIONS).join(', ')}"`;
  }

  const { width, height } = getScreenSize();
  const bounds = posFn(width, height);

  return `osascript -e 'tell application "${appName}" to activate' -e 'tell application "System Events" to tell process "${appName}" to set position of window 1 to {${bounds.slice(1, bounds.indexOf(','))}}'  -e 'tell application "System Events" to tell process "${appName}" to set size of window 1 to {${Math.floor(width/2)}, ${height}}'`;
}

function moveWindowScript(appName, position) {
  if (process.platform !== 'darwin') {
    return `echo "Window management requires macOS"`;
  }

  const pos = position.toLowerCase();
  const { width, height } = getScreenSize();

  let x = 0, y = 0, w = width, h = height;
  switch (pos) {
    case 'left half':    w = Math.floor(width / 2); break;
    case 'right half':   x = Math.floor(width / 2); w = Math.floor(width / 2); break;
    case 'top half':     h = Math.floor(height / 2); break;
    case 'bottom half':  y = Math.floor(height / 2); h = Math.floor(height / 2); break;
    case 'top left':     w = Math.floor(width / 2); h = Math.floor(height / 2); break;
    case 'top right':    x = Math.floor(width / 2); w = Math.floor(width / 2); h = Math.floor(height / 2); break;
    case 'bottom left':  y = Math.floor(height / 2); w = Math.floor(width / 2); h = Math.floor(height / 2); break;
    case 'bottom right': x = Math.floor(width / 2); y = Math.floor(height / 2); w = Math.floor(width / 2); h = Math.floor(height / 2); break;
    case 'fullscreen':   break;
    case 'center':       x = Math.floor(width / 4); y = Math.floor(height / 4); w = Math.floor(width / 2); h = Math.floor(height / 2); break;
    default:
      return `echo "Unknown position: ${position}. Use: ${Object.keys(POSITIONS).join(', ')}"`;
  }

  return `osascript -e 'tell application "${appName}" to activate' -e 'tell application "System Events" to tell process "${appName}" to set position of window 1 to {${x}, ${y}}' -e 'tell application "System Events" to tell process "${appName}" to set size of window 1 to {${w}, ${h}}'`;
}

function sideBySide(app1, app2) {
  if (process.platform !== 'darwin') {
    return `echo "Window management requires macOS"`;
  }
  const { width, height } = getScreenSize();
  const half = Math.floor(width / 2);
  return `osascript -e 'tell application "${app1}" to activate' -e 'tell application "System Events" to tell process "${app1}" to set position of window 1 to {0, 0}' -e 'tell application "System Events" to tell process "${app1}" to set size of window 1 to {${half}, ${height}}' -e 'tell application "${app2}" to activate' -e 'tell application "System Events" to tell process "${app2}" to set position of window 1 to {${half}, 0}' -e 'tell application "System Events" to tell process "${app2}" to set size of window 1 to {${half}, ${height}}'`;
}

function minimizeAll() {
  if (process.platform !== 'darwin') {
    return `wmctrl -k on 2>/dev/null || echo "Install wmctrl for window management"`;
  }
  return `osascript -e 'tell application "System Events" to set visible of every process whose visible is true to false'`;
}

module.exports = {
  moveWindowScript,
  sideBySide,
  minimizeAll,
  getScreenSize,
  POSITIONS,
};
