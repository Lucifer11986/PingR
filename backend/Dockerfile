FROM node:20-slim AS builder
WORKDIR /app

# Native Build-Abhängigkeiten für mediasoup. Sie bleiben nur im Builder.
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-slim AS production
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads logs backups && chown -R node:node /app
USER node

EXPOSE 4000
CMD ["node", "dist/index.js"]
