# Stage 1: Install production deps
FROM node:22-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --production

# Stage 2: Runtime
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl python3 && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -r hyperion && useradd -r -g hyperion -m hyperion

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Data directory with correct ownership
RUN mkdir -p /app/data && chown -R hyperion:hyperion /app /app/data

USER hyperion
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3333/api/health || exit 1

CMD ["node", "server.js"]
