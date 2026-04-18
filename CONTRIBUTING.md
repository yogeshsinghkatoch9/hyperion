# Contributing to Hyperion

Thanks for your interest in contributing! Hyperion is a self-hosted server admin panel with 55+ tools, built on vanilla JavaScript with zero framework dependencies.

## Getting Started

```bash
git clone https://github.com/yogeshsinghkatoch9/hyperion.git
cd hyperion
npm install
npm run dev
```

Open http://localhost:3333 — changes auto-reload in dev mode.

## Project Structure

```
server.js          # Express + WebSocket entry point
routes/            # 67+ REST API route modules
services/          # 81+ business logic modules
public/            # SPA frontend (vanilla JS, no build step)
  index.html       # Single HTML shell
  js/hyperion.js   # Frontend application
  css/hyperion.css # Styles
tests/             # 1,970+ Vitest tests
```

## How to Contribute

### Bug Reports

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS

### Pull Requests

1. Fork the repo and create a feature branch: `git checkout -b feature/my-feature`
2. Write tests for your changes
3. Ensure all tests pass: `npm test`
4. Keep changes focused — one feature or fix per PR
5. Submit a pull request

### Code Style

- **No frameworks** — vanilla JavaScript only (frontend and backend)
- **No build step** — everything runs directly
- **Minimal dependencies** — 7 runtime deps. Think twice before adding one
- **Write tests** — every route and service has a corresponding test file

### Adding a New Tool

1. Create `routes/myTool.js` with Express routes
2. Create `services/myTool.js` with business logic
3. Register the route in `server.js`
4. Add the UI panel in `public/js/hyperion.js`
5. Add navigation entry in the sidebar
6. Write tests in `tests/myTool.test.js`

## Testing

```bash
npm test                    # Run all tests
npx vitest                  # Watch mode
npx vitest run -t "auth"   # Run matching tests
```

## Questions?

Open an issue — happy to help.
