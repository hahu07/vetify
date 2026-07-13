# Vetify agents runtime — Supervisor loop (review gap G8).
# Build:  docker build -t vetify-agents ./agents
# Run:    docker run --env-file agents/.env vetify-agents
#
# Deliberately NOT a compiled/dist image: the agents spawn their MCP servers
# as subprocesses via `npm run mcp:*` (see MultiServerMCPClient configs),
# which resolve through package.json scripts and tsx — so the runtime image
# needs the full source tree and dev dependencies. Revisit if/when MCP
# servers move in-process or to prebuilt entry points.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY skills ./skills
USER node
CMD ["npx", "tsx", "src/index.ts"]
