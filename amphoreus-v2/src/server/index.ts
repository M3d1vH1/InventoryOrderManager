import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { trpcServer } from "@hono/trpc-server";
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
    createContext: (_opts, c) => createContext(c),
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

