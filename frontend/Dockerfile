# ── Stage 1: Build ────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# API-URL als Build-Argument (Vite baked es in den Bundle)
ARG VITE_API_URL=http://217.154.165.25:8084
ARG VITE_WS_URL=ws://217.154.165.25:8084
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN node node_modules/vite/bin/vite.js build

# Alte Sicherungskopien gehören nicht in das öffentlich erreichbare Webroot.
RUN find dist -maxdepth 1 -type f -name 'admin.html.backup*' -delete

# ── Stage 2: Nginx für statische Dateien ─────────────────────────
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
