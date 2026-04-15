#!/usr/bin/env node
/**
 * Hyperion — Interactive Setup Script
 * Checks prerequisites, creates .env, initializes data directory.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

function check(label, cmd) {
  try {
    const v = execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0];
    console.log(`  \x1b[32m✓\x1b[0m ${label}: ${v}`);
    return true;
  } catch {
    console.log(`  \x1b[31m✗\x1b[0m ${label}: not found`);
    return false;
  }
}

async function main() {
  console.log(`
  ╦ ╦╦ ╦╔═╗╔═╗╦═╗╦╔═╗╔╗╔  Setup
  ╠═╣╚╦╝╠═╝║╣ ╠╦╝║║ ║║║║
  ╩ ╩ ╩ ╩  ╚═╝╩╚═╩╚═╝╝╚╝
`);

  // 1. Check prerequisites
  console.log('  Checking prerequisites...\n');
  const hasNode = check('Node.js', 'node --version');
  check('npm', 'npm --version');
  check('Git', 'git --version');
  check('Docker', 'docker --version');
  check('Python3', 'python3 --version');

  if (!hasNode) {
    console.log('\n  \x1b[31mNode.js is required. Install from https://nodejs.org\x1b[0m\n');
    process.exit(1);
  }

  const nodeVer = parseInt(process.version.slice(1));
  if (nodeVer < 20) {
    console.log(`\n  \x1b[33mWarning: Node.js 20+ recommended (you have ${process.version})\x1b[0m\n`);
  }

  // 2. Install dependencies
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    console.log('\n  Installing dependencies...');
    execSync('npm install', { cwd: ROOT, stdio: 'inherit' });
  } else {
    console.log('\n  \x1b[32m✓\x1b[0m Dependencies already installed');
  }

  // 3. Create data directory
  const dataDir = path.join(ROOT, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('  \x1b[32m✓\x1b[0m Created data/ directory');
  }

  // 4. Create .env if missing
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    const port = await ask('  Port [3333]: ') || '3333';
    const logLevel = await ask('  Log level (debug/info/warn/error) [info]: ') || 'info';

    const env = [
      `PORT=${port}`,
      `LOG_LEVEL=${logLevel}`,
      'MCP_ENABLED=false',
      'DISCOVERY_ENABLED=false',
      '',
      '# LLM (optional)',
      '# LLM_PROVIDER=ollama',
      '# OLLAMA_HOST=http://localhost:11434',
      '# OLLAMA_MODEL=llama3.2',
    ].join('\n');

    fs.writeFileSync(envPath, env + '\n');
    console.log('  \x1b[32m✓\x1b[0m Created .env');
  } else {
    console.log('  \x1b[32m✓\x1b[0m .env already exists');
  }

  // 5. Done
  console.log(`
  \x1b[32m✓ Setup complete!\x1b[0m

  Start Hyperion:
    npm start           # production
    npm run dev         # dev mode (auto-reload)
    docker compose up   # Docker

  Then open http://localhost:${process.env.PORT || 3333}
`);

  rl.close();
}

main().catch((err) => {
  console.error('Setup failed:', err.message);
  rl.close();
  process.exit(1);
});
