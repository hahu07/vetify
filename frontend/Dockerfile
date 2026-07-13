# Vetify frontend (review gap G8) — static build served by nginx, with /api
# proxied to the backend (the app calls same-origin /api, mirroring vite's
# dev-server proxy).
# Build:  docker build -t vetify-frontend ./frontend
# Run:    docker run -e BACKEND_URL=http://backend:3000 -p 8080:80 vetify-frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# nginx's official image runs envsubst over /etc/nginx/templates/*.template
# at startup — BACKEND_URL lands in the proxy_pass below.
COPY <<'EOF' /etc/nginx/templates/default.conf.template
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass ${BACKEND_URL};
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
EOF
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
