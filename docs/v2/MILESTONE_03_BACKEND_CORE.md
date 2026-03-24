# Milestone 3 — Backend Core (Hono + tRPC)

| Field | Value |
|-------|-------|
| **Step** | 3 of 5 |
| **Priority** | P0 |
| **Depends on** | Step 2 |
| **Estimated effort** | 1 day |

---

## Problem / Goal

Stand up the HTTP server (Hono), wire tRPC with context-aware procedures (public, protected, admin), set up structured logging (Winston), add a Redis caching layer with in-memory fallback, and create stub routers for every domain. After this milestone, the backend is a running process that responds to health checks and tRPC requests with proper error handling, request logging, and role-based procedure enforcement.

---

## Implementation

### 1. `src/server/lib/logger.ts`

```ts
// src/server/lib/logger.ts
import winston from "winston";
import { env } from "./env.js";

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  format: env.NODE_ENV === "development" ? devFormat : prodFormat,
  transports: [new winston.transports.Console()],
  defaultMeta: { service: "amphoreus" },
});
```

### 2. `src/server/lib/cache.ts`

```ts
// src/server/lib/cache.ts
import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

let redis: Redis | null = null;

// In-memory fallback when Redis is unavailable
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

function getRedis(): Redis | null {
  if (redis) return redis;

  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 5) {
          logger.warn("Redis connection failed after 5 retries, using in-memory fallback");
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    redis.on("error", (err) => {
      logger.error("Redis error", { error: err.message });
    });

    redis.on("connect", () => {
      logger.info("Redis connected");
    });

    redis.connect().catch(() => {
      logger.warn("Redis unavailable, falling back to in-memory cache");
      redis = null;
    });

    return redis;
  } catch {
    logger.warn("Redis initialization failed, using in-memory cache");
    return null;
  }
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const client = getRedis();

    if (client) {
      try {
        const value = await client.get(key);
        return value ? (JSON.parse(value) as T) : null;
      } catch {
        // Fall through to memory cache
      }
    }

    const entry = memoryCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return JSON.parse(entry.value) as T;
    }
    memoryCache.delete(key);
    return null;
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    const serialized = JSON.stringify(value);
    const client = getRedis();

    if (client) {
      try {
        await client.set(key, serialized, "EX", ttlSeconds);
        return;
      } catch {
        // Fall through to memory cache
      }
    }

    memoryCache.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  async del(key: string): Promise<void> {
    const client = getRedis();

    if (client) {
      try {
        await client.del(key);
      } catch {
        // ignore
      }
    }

    memoryCache.delete(key);
  },

  async invalidate(pattern: string): Promise<void> {
    const client = getRedis();

    if (client) {
      try {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } catch {
        // ignore
      }
    }

    // In-memory: iterate and match
    for (const key of memoryCache.keys()) {
      const regex = new RegExp(
        "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
      );
      if (regex.test(key)) {
        memoryCache.delete(key);
      }
    }
  },

  async disconnect(): Promise<void> {
    if (redis) {
      await redis.quit();
      redis = null;
    }
    memoryCache.clear();
  },
};
```

### 3. `src/server/trpc.ts`

```ts
// src/server/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context as HonoContext } from "hono";
import { db, type Database } from "./db/index.js";
import type { SafeUser } from "../shared/types.js";

export interface TRPCContext {
  db: Database;
  user: SafeUser | null;
  sessionId: string | null;
}

export async function createContext(c: HonoContext): Promise<TRPCContext> {
  // Session validation is done by Hono middleware before tRPC;
  // the user and sessionId are attached to the Hono context.
  const user = c.get("user") as SafeUser | null ?? null;
  const sessionId = c.get("sessionId") as string | null ?? null;

  return {
    db,
    user,
    sessionId,
  };
}

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.code === "BAD_REQUEST" && error.cause instanceof Error
            ? error.cause.message
            : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // now guaranteed non-null
      sessionId: ctx.sessionId!,
    },
  });
});

export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  if (ctx.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only administrators can access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      sessionId: ctx.sessionId!,
    },
  });
});
```

### 4. Stub Routers

Each domain gets a stub router. Here is the pattern, shown for `products`:

```ts
// src/server/routers/products.ts
import { router } from "../trpc.js";

export const productsRouter = router({
  // Procedures will be added in later milestones
});
```

Create identical stubs for all domains:

```ts
// src/server/routers/auth.ts
import { router } from "../trpc.js";
export const authRouter = router({});

// src/server/routers/orders.ts
import { router } from "../trpc.js";
export const ordersRouter = router({});

// src/server/routers/inventory.ts
import { router } from "../trpc.js";
export const inventoryRouter = router({});

// src/server/routers/customers.ts
import { router } from "../trpc.js";
export const customersRouter = router({});

// src/server/routers/picking.ts
import { router } from "../trpc.js";
export const pickingRouter = router({});

// src/server/routers/shipping.ts
import { router } from "../trpc.js";
export const shippingRouter = router({});

// src/server/routers/settings.ts
import { router } from "../trpc.js";
export const settingsRouter = router({});
```

### 5. `src/server/router.ts`

```ts
// src/server/router.ts
import { router } from "./trpc.js";
import { authRouter } from "./routers/auth.js";
import { ordersRouter } from "./routers/orders.js";
import { productsRouter } from "./routers/products.js";
import { inventoryRouter } from "./routers/inventory.js";
import { customersRouter } from "./routers/customers.js";
import { pickingRouter } from "./routers/picking.js";
import { shippingRouter } from "./routers/shipping.js";
import { settingsRouter } from "./routers/settings.js";

export const appRouter = router({
  auth: authRouter,
  orders: ordersRouter,
  products: productsRouter,
  inventory: inventoryRouter,
  customers: customersRouter,
  picking: pickingRouter,
  shipping: shippingRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
```

### 6. `src/server/index.ts`

```ts
// src/server/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { env } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { appRouter } from "./router.js";
import { createContext } from "./trpc.js";
import { closeDatabase } from "./db/index.js";
import { cache } from "./lib/cache.js";
import { sessionMiddleware } from "./auth/middleware.js";

const app = new Hono();

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  "*",
  cors({
    origin:
      env.NODE_ENV === "development"
        ? "http://localhost:5173"
        : (origin) => origin, // same-origin in production
    credentials: true,
  })
);

// ── Request logging ──────────────────────────────────────────────────────────
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  logger.info(`${c.req.method} ${c.req.path}`, {
    status: c.res.status,
    duration: `${duration}ms`,
  });
});

// ── Session middleware (validates cookie, attaches user to context) ──────────
app.use("*", sessionMiddleware);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── tRPC ─────────────────────────────────────────────────────────────────────
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: ({ req }) => {
      // The Hono context is accessible via the request
      return createContext(req as any);
    },
    onError({ error, path }) {
      logger.error(`tRPC error on ${path}`, {
        code: error.code,
        message: error.message,
        ...(env.NODE_ENV === "development" && { stack: error.stack }),
      });
    },
  })
);

// ── Static files (Vite build output in production) ───────────────────────────
if (env.NODE_ENV === "production") {
  app.use("/*", serveStatic({ root: "./dist/client" }));

  // SPA fallback: serve index.html for all non-API routes
  app.get("*", serveStatic({ root: "./dist/client", path: "index.html" }));
}

// ── Error handler ────────────────────────────────────────────────────────────
app.onError((err, c) => {
  logger.error("Unhandled error", {
    error: err.message,
    stack: env.NODE_ENV === "development" ? err.stack : undefined,
    path: c.req.path,
  });

  return c.json(
    {
      error: "Internal Server Error",
      ...(env.NODE_ENV === "development" && { message: err.message }),
    },
    500
  );
});

// ── Start server ─────────────────────────────────────────────────────────────
const port = env.APP_PORT;

serve({ fetch: app.fetch, port }, () => {
  logger.info(`Amphoreus server running on http://localhost:${port}`, {
    env: env.NODE_ENV,
  });
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown() {
  logger.info("Shutting down gracefully...");
  await closeDatabase();
  await cache.disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
```

> **Note:** The `sessionMiddleware` import will be a no-op stub until Milestone 4. Create a placeholder:

```ts
// src/server/auth/middleware.ts (placeholder for Milestone 3)
import type { MiddlewareHandler } from "hono";

export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  // Will be implemented in Milestone 4.
  // For now, set user and sessionId to null.
  c.set("user", null);
  c.set("sessionId", null);
  await next();
};
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/server/index.ts` | Hono app entry point: mounts tRPC, serves static files, health check |
| `src/server/trpc.ts` | tRPC initialization, context, publicProcedure, protectedProcedure, adminProcedure |
| `src/server/router.ts` | Root router merging all domain routers |
| `src/server/lib/logger.ts` | Winston logger (JSON prod, colorized dev) |
| `src/server/lib/cache.ts` | Redis cache wrapper with in-memory fallback |
| `src/server/routers/auth.ts` | Auth router stub |
| `src/server/routers/orders.ts` | Orders router stub |
| `src/server/routers/products.ts` | Products router stub |
| `src/server/routers/inventory.ts` | Inventory router stub |
| `src/server/routers/customers.ts` | Customers router stub |
| `src/server/routers/picking.ts` | Picking router stub |
| `src/server/routers/shipping.ts` | Shipping router stub |
| `src/server/routers/settings.ts` | Settings router stub |
| `src/server/auth/middleware.ts` | Session middleware placeholder |

---

## Verification

```bash
# 1. TypeScript compiles
npx tsc --noEmit
# Expected: zero errors

# 2. Server starts
npx tsx src/server/index.ts &
SERVER_PID=$!
sleep 2

# 3. Health check responds
curl -s http://localhost:3000/api/health | jq .
# Expected: { "status": "ok", "timestamp": "..." }

# 4. tRPC endpoint is reachable (empty batch returns valid response)
curl -s 'http://localhost:3000/trpc' -H 'Content-Type: application/json'
# Expected: a tRPC response (even if it's an error about missing procedure)

# 5. CORS headers present
curl -sI -X OPTIONS http://localhost:3000/api/health \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET"
# Expected: Access-Control-Allow-Origin header present

# 6. Logger outputs in correct format
# In dev: colored, human-readable output in terminal
# Check the console output from step 2

# 7. Cleanup
kill $SERVER_PID
```

---

## Definition of Done

- [ ] Server starts without errors on `npx tsx src/server/index.ts`
- [ ] `GET /api/health` returns `{ "status": "ok" }` with 200
- [ ] tRPC is mounted at `/trpc/*` and returns valid tRPC responses
- [ ] CORS is configured: allows `localhost:5173` in dev, same-origin in prod
- [ ] Request logging middleware logs method, path, status, and duration for every request
- [ ] `onError` handler catches unhandled errors and returns 500 JSON in production
- [ ] Winston logger outputs colorized format in dev, JSON in production
- [ ] Redis cache wrapper works, falls back to in-memory Map when Redis is unavailable
- [ ] `publicProcedure` allows unauthenticated access
- [ ] `protectedProcedure` throws `UNAUTHORIZED` when `ctx.user` is null
- [ ] `adminProcedure` throws `FORBIDDEN` when `ctx.user.role !== "admin"`
- [ ] All 8 domain router stubs are created and merged into the root router
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] Graceful shutdown closes database pool and Redis connection on SIGTERM/SIGINT
