import { initTRPC, TRPCError } from "@trpc/server";
import type { Context as HonoContext } from "hono";
import { db, type Database } from "./db/index.js";
import type { SafeUser } from "../shared/types.js";

export interface TRPCContext extends Record<string, unknown> {
  db: Database;
  user: SafeUser | null;
  sessionId: string | null;
  honoCtx: HonoContext; // raw Hono context — used by auth router to set cookies
}

export async function createContext(c: HonoContext): Promise<TRPCContext> {
  // Session validation is done by Hono middleware before tRPC;
  // the user and sessionId are attached to the Hono context.
  const user = (c.get("user") as SafeUser | null) ?? null;
  const sessionId = (c.get("sessionId") as string | null) ?? null;

  return {
    db,
    user,
    sessionId,
    honoCtx: c,
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
      user: ctx.user,
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

