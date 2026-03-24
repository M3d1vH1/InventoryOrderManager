// src/server/auth/middleware.ts
import type { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { lucia } from "./lucia.js";
import { logger } from "../lib/logger.js";

export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  const sessionId = getCookie(c, lucia.sessionCookieName) ?? null;

  if (!sessionId) {
    c.set("user", null);
    c.set("sessionId", null);
    return next();
  }

  try {
    const { session, user } = await lucia.validateSession(sessionId);

    if (session && session.fresh) {
      // Session was rolled (still within expiry window) — refresh the cookie
      const sessionCookie = lucia.createSessionCookie(session.id);
      setCookie(c, sessionCookie.name, sessionCookie.value, {
        ...sessionCookie.attributes,
        httpOnly: true,
      });
    }

    if (!session) {
      // Session is expired or not found — clear the cookie
      const blankCookie = lucia.createBlankSessionCookie();
      setCookie(c, blankCookie.name, blankCookie.value, {
        ...blankCookie.attributes,
        httpOnly: true,
      });
      c.set("user", null);
      c.set("sessionId", null);
      return next();
    }

    // Attach the safe user object (no password) and session ID to context
    c.set("user", {
      id: Number(user.id),
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      email: user.email,
      active: user.active,
    });
    c.set("sessionId", session.id);
  } catch (err) {
    logger.error("Session validation error", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    c.set("user", null);
    c.set("sessionId", null);
  }

  return next();
};
