# ---------- Stage 1: Build ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json tsconfig.client.json vite.config.ts drizzle.config.ts ./
COPY src/ src/

RUN npm run build

RUN npm prune --production

# ---------- Stage 2: Production ----------
FROM node:22-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

COPY --from=builder /app/dist/client ./dist/client

COPY --from=builder /app/drizzle ./drizzle

EXPOSE 3000

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server/index.js"]
