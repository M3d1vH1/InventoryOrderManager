# Milestone 1 — Repo + Docker + Dev Environment

| Field | Value |
|-------|-------|
| **Step** | 1 of 5 |
| **Priority** | P0 |
| **Depends on** | Nothing |
| **Estimated effort** | 0.5 days |

---

## Problem / Goal

We need a reproducible, containerized development and production environment for the Amphoreus warehouse management system. Every developer must be able to run `docker compose up` and have a fully working stack (Node 22, PostgreSQL 16, Redis 7, Cloudflare Tunnel) within minutes. Environment variables must be validated at startup so misconfigurations fail fast, not at runtime.

---

## Implementation

### 1. Initialize the repository

```bash
npm init -y
```

### 2. Install all dependencies

```bash
# Runtime dependencies
npm install hono @hono/node-server @trpc/server@11 @trpc/client@11 @trpc/react-query@11 \
  @tanstack/react-query@5 @tanstack/react-router@1 @tanstack/react-router-devtools@1 \
  drizzle-orm pg dotenv zod winston ioredis lucia @lucia-auth/adapter-drizzle \
  bcrypt react@19 react-dom@19 clsx tailwind-merge lucide-react \
  class-variance-authority @radix-ui/react-slot

# Dev dependencies
npm install -D typescript @types/node@22 @types/pg @types/bcrypt @types/react@19 \
  @types/react-dom@19 tsx vite@6 @vitejs/plugin-react drizzle-kit \
  tailwindcss@4 @tailwindcss/vite postcss autoprefixer \
  eslint prettier @tanstack/router-plugin@1
```

### 3. `package.json`

```jsonc
// /package.json
{
  "name": "amphoreus",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "dev": "tsx watch src/server/index.ts",
    "dev:client": "vite",
    "build": "vite build && tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx src/server/db/seed.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.0",
    "@lucia-auth/adapter-drizzle": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@tanstack/react-query": "^5.60.0",
    "@tanstack/react-router": "^1.80.0",
    "@tanstack/react-router-devtools": "^1.80.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@trpc/server": "^11.0.0",
    "bcrypt": "^5.1.1",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "dotenv": "^16.4.5",
    "drizzle-orm": "^0.36.0",
    "hono": "^4.6.0",
    "ioredis": "^5.4.1",
    "lucia": "^3.2.1",
    "lucide-react": "^0.460.0",
    "pg": "^8.13.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^2.5.0",
    "winston": "^3.15.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@tanstack/router-plugin": "^1.80.0",
    "@types/bcrypt": "^5.0.2",
    "@types/node": "^22.9.0",
    "@types/pg": "^8.11.10",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.28.0",
    "eslint": "^9.14.0",
    "postcss": "^8.4.47",
    "prettier": "^3.4.0",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

### 4. `tsconfig.json` (base)

```jsonc
// /tsconfig.json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@server/*": ["src/server/*"],
      "@client/*": ["src/client/*"],
      "@shared/*": ["src/shared/*"]
    },
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
```

### 5. `tsconfig.server.json`

```jsonc
// /tsconfig.server.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/server",
    "jsx": "react-jsx"
  },
  "include": ["src/server/**/*.ts", "src/shared/**/*.ts"]
}
```

### 6. `tsconfig.client.json`

```jsonc
// /tsconfig.client.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "outDir": "dist/client"
  },
  "include": ["src/client/**/*.ts", "src/client/**/*.tsx", "src/shared/**/*.ts"]
}
```

### 7. `Dockerfile`

```dockerfile
# /Dockerfile
# ---------- Stage 1: Build ----------
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json tsconfig.client.json vite.config.ts drizzle.config.ts ./
COPY src/ src/

# Build frontend (Vite) and backend (tsc)
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ---------- Stage 2: Production ----------
FROM node:22-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production

# Copy production node_modules and built output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Vite build output is served as static files
COPY --from=builder /app/dist/client ./dist/client

# Copy drizzle migrations for runtime migration
COPY --from=builder /app/drizzle ./drizzle

EXPOSE 3000

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server/index.js"]
```

### 8. `docker-compose.yml`

```yaml
# /docker-compose.yml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: amphoreus-app
    restart: unless-stopped
    ports:
      - "${APP_PORT:-3000}:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379
      SESSION_SECRET: ${SESSION_SECRET}
      ADMIN_INITIAL_PASSWORD: ${ADMIN_INITIAL_PASSWORD}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - amphoreus-net

  postgres:
    image: postgres:16-alpine
    container_name: amphoreus-postgres
    restart: unless-stopped
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-amphoreus}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-amphoreus}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-amphoreus} -d ${POSTGRES_DB:-amphoreus}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - amphoreus-net

  redis:
    image: redis:7-alpine
    container_name: amphoreus-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - amphoreus-net

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: amphoreus-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - app
    networks:
      - amphoreus-net

volumes:
  postgres-data:
  redis-data:

networks:
  amphoreus-net:
    driver: bridge
```

### 9. `docker-compose.dev.yml`

```yaml
# /docker-compose.dev.yml
# Usage: docker compose -f docker-compose.yml -f docker-compose.dev.yml up
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    container_name: amphoreus-app-dev
    command: npm run dev
    ports:
      - "3000:3000"
      - "5173:5173"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://${POSTGRES_USER:-amphoreus}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-amphoreus}
      REDIS_URL: redis://redis:6379
      SESSION_SECRET: ${SESSION_SECRET:-dev-secret-change-me}
      ADMIN_INITIAL_PASSWORD: ${ADMIN_INITIAL_PASSWORD:-admin123}
    volumes:
      - ./src:/app/src
      - ./vite.config.ts:/app/vite.config.ts
      - ./tsconfig.json:/app/tsconfig.json
      - ./tsconfig.server.json:/app/tsconfig.server.json
      - ./tsconfig.client.json:/app/tsconfig.client.json
      - ./drizzle.config.ts:/app/drizzle.config.ts
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    ports:
      - "5432:5432"

  redis:
    ports:
      - "6379:6379"

  cloudflared:
    profiles:
      - tunnel
```

### 10. `.env.example`

```bash
# /.env.example

# ── App ──────────────────────────────────────────
NODE_ENV=development
APP_PORT=3000

# ── Database ─────────────────────────────────────
POSTGRES_USER=amphoreus
POSTGRES_PASSWORD=changeme
POSTGRES_DB=amphoreus
POSTGRES_PORT=5432
DATABASE_URL=postgresql://amphoreus:changeme@localhost:5432/amphoreus

# ── Redis ────────────────────────────────────────
REDIS_URL=redis://localhost:6379
REDIS_PORT=6379

# ── Auth ─────────────────────────────────────────
SESSION_SECRET=generate-a-random-64-char-string-here
ADMIN_INITIAL_PASSWORD=changeme-on-first-login

# ── Cloudflare Tunnel (optional for local dev) ──
CLOUDFLARE_TUNNEL_TOKEN=
```

### 11. `src/server/lib/env.ts`

```ts
// src/server/lib/env.ts
import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_PORT: z.coerce.number().default(3000),

  DATABASE_URL: z
    .string()
    .url()
    .startsWith("postgresql://", "DATABASE_URL must be a PostgreSQL connection string"),

  REDIS_URL: z.string().url().startsWith("redis://"),

  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),

  ADMIN_INITIAL_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error(
      "\n❌ Invalid environment variables:\n",
      result.error.flatten().fieldErrors
    );
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
```

### 12. `vite.config.ts`

```ts
// /vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tailwindcss(),
  ],
  root: "src/client",
  publicDir: "../../public",
  build: {
    outDir: "../../dist/client",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@client": path.resolve(__dirname, "src/client"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/trpc": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

### 13. `.gitignore`

```gitignore
# /.gitignore
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
drizzle/meta/
*.tsbuildinfo
```

### 14. `.dockerignore`

```dockerignore
# /.dockerignore
node_modules
dist
.git
.env
.env.local
*.log
.DS_Store
docs/
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `package.json` | Project manifest and scripts |
| `tsconfig.json` | Base TypeScript config |
| `tsconfig.server.json` | Server-specific TS config |
| `tsconfig.client.json` | Client-specific TS config |
| `Dockerfile` | Multi-stage production image |
| `docker-compose.yml` | Full production stack |
| `docker-compose.dev.yml` | Dev overrides (volume mounts, hot reload) |
| `.env.example` | Documented environment variable template |
| `src/server/lib/env.ts` | Zod-validated env loader |
| `vite.config.ts` | Vite config with API proxy |
| `.gitignore` | Git ignore rules |
| `.dockerignore` | Docker build context ignore rules |
| `drizzle.config.ts` | Drizzle Kit config (created in Milestone 2) |

---

## Verification

```bash
# 1. Copy env template and fill in values
cp .env.example .env

# 2. Install dependencies
npm install

# 3. TypeScript compiles without errors
npx tsc --noEmit

# 4. Env validation works (should crash with missing vars)
DATABASE_URL="" npx tsx src/server/lib/env.ts
# Expected: exits with error about invalid DATABASE_URL

# 5. Env validation passes with correct vars
npx tsx src/server/lib/env.ts
# Expected: no output, exit code 0

# 6. Docker builds successfully
docker compose build

# 7. Full stack starts
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
docker compose ps
# Expected: all services show "running" or "healthy"

# 8. Postgres is reachable
docker compose exec postgres pg_isready
# Expected: "accepting connections"

# 9. Redis is reachable
docker compose exec redis redis-cli ping
# Expected: "PONG"
```

---

## Definition of Done

- [ ] `npm install` completes without errors
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `env.ts` crashes with a clear message when required vars are missing
- [ ] `env.ts` succeeds silently when all vars are valid
- [ ] `docker compose build` produces a working image under 200 MB
- [ ] `docker compose up` starts app, postgres, redis, and cloudflared containers
- [ ] `docker-compose.dev.yml` mounts local source and enables hot reload
- [ ] Vite dev server proxies `/api` and `/trpc` requests to the backend on port 3000
- [ ] `.env.example` documents every required and optional variable
- [ ] `.gitignore` excludes `node_modules`, `dist`, `.env`, and logs
- [ ] `.dockerignore` excludes `node_modules`, `.git`, docs, and `.env`
