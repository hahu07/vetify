# Vetify backend API (review gap G8).
# Build:  docker build -t vetify-backend ./backend
# Run:    docker run --env-file backend/.env -p 3000:3000 vetify-backend
# Needs network reachability to the Canton JSON API and both Postgres
# databases (see backend/.env.example) — in production, NODE_ENV=production
# makes config.ts refuse to start on missing/placeholder values.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
