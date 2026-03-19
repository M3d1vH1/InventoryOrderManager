import type { MiddlewareHandler } from "hono";

export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  // Will be implemented in Milestone 4.
  // For now, set user and sessionId to null.
  c.set("user", null);
  c.set("sessionId", null);
  await next();
};

