const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── Parse package.json ──
function parsePackageJson(dir) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) throw new Error('package.json not found');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = Object.entries(pkg.dependencies || {}).map(([name, version]) => ({
    name, version, type: 'production',
  }));
  const devDeps = Object.entries(pkg.devDependencies || {}).map(([name, version]) => ({
    name, version, type: 'development',
  }));
  return {
    name: pkg.name || 'unknown',
    version: pkg.version || '0.0.0',
    deps,
    devDeps,
    total: deps.length + devDeps.length,
  };
}

// ── npm audit ──
function runAudit(dir) {
  try {
    const raw = execSync('npm audit --json 2>/dev/null', {
      cwd: dir, encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(raw);
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities found
    if (err.stdout) {
      try { return JSON.parse(err.stdout); } catch { /* fall through */ }
    }
    return { vulnerabilities: {}, metadata: {} };
  }
}

// ── Count Severities ──
function countSeverities(auditResult) {
  const counts = { critical: 0, high: 0, moderate: 0, low: 0, info: 0, total: 0 };
  if (auditResult && auditResult.metadata && auditResult.metadata.vulnerabilities) {
    const v = auditResult.metadata.vulnerabilities;
    counts.critical = v.critical || 0;
    counts.high = v.high || 0;
    counts.moderate = v.moderate || 0;
    counts.low = v.low || 0;
    counts.info = v.info || 0;
    counts.total = v.total || (counts.critical + counts.high + counts.moderate + counts.low + counts.info);
  } else if (auditResult && auditResult.vulnerabilities) {
    for (const vuln of Object.values(auditResult.vulnerabilities)) {
      const sev = (vuln.severity || 'info').toLowerCase();
      if (counts[sev] !== undefined) counts[sev]++;
      counts.total++;
    }
  }
  return counts;
}

// ── Security Score ──
function calculateSecurityScore(severities) {
  let score = 100;
  score -= (severities.critical || 0) * 25;
  score -= (severities.high || 0) * 15;
  score -= (severities.moderate || 0) * 8;
  score -= (severities.low || 0) * 3;
  score -= (severities.info || 0) * 1;
  return Math.max(0, Math.min(100, score));
}

// ── npm outdated ──
function runOutdated(dir) {
  try {
    const raw = execSync('npm outdated --json 2>/dev/null', {
      cwd: dir, encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(raw || '{}');
  } catch (err) {
    // npm outdated exits 1 when packages are outdated
    if (err.stdout) {
      try { return JSON.parse(err.stdout); } catch { /* fall through */ }
    }
    return {};
  }
}

// ── License Extraction ──
function extractLicenses(dir) {
  const modulesDir = path.join(dir, 'node_modules');
  if (!fs.existsSync(modulesDir)) return [];
  const licenses = [];
  try {
    const pkgPath = path.join(dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of Object.keys(allDeps)) {
      const depPkgPath = path.join(modulesDir, name, 'package.json');
      try {
        if (fs.existsSync(depPkgPath)) {
          const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf8'));
          licenses.push({
            name,
            version: depPkg.version || 'unknown',
            license: depPkg.license || 'UNKNOWN',
          });
        }
      } catch { /* skip unreadable packages */ }
    }
  } catch { /* skip on error */ }
  return licenses;
}

// ── Version Comparison Helpers ──
function parseVersion(v) {
  if (!v || typeof v !== 'string') return [0, 0, 0];
  const clean = v.replace(/^[^0-9]*/, '');
  const parts = clean.split('.').map(n => parseInt(n) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function isMajorUpdate(current, latest) {
  const c = parseVersion(current);
  const l = parseVersion(latest);
  return l[0] > c[0];
}

function isMinorUpdate(current, latest) {
  const c = parseVersion(current);
  const l = parseVersion(latest);
  return l[0] === c[0] && l[1] > c[1];
}

function isPatchUpdate(current, latest) {
  const c = parseVersion(current);
  const l = parseVersion(latest);
  return l[0] === c[0] && l[1] === c[1] && l[2] > c[2];
}

module.exports = {
  parsePackageJson,
  runAudit,
  countSeverities,
  calculateSecurityScore,
  runOutdated,
  extractLicenses,
  parseVersion,
  compareVersions,
  isMajorUpdate,
  isMinorUpdate,
  isPatchUpdate,
};
