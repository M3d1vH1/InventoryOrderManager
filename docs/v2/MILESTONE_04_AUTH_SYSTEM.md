# Milestone 4 — Auth System (Lucia)

| Field | Value |
|-------|-------|
| **Step** | 4 of 5 |
| **Priority** | P0 |
| **Depends on** | Step 3 |
| **Estimated effort** | 1 day |

---

## Problem / Goal

Implement session-based authentication using Lucia Auth backed by the PostgreSQL sessions table (defined in Milestone 2). Users log in with username + password (bcrypt-hashed), receive an httpOnly session cookie, and every subsequent request is validated via Hono middleware. The tRPC `protectedProcedure` and `adminProcedure` must enforce authentication and role checks. A seed script creates the initial admin account.

---

## Implementation

### 1. `src/server/auth/lucia.ts`

```ts
// src/server/auth/lucia.ts
import { Lucia, TimeSpan } from "lucia";
import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import { env } from "../lib/env.js";
import type { UserRole } from "../../shared/types.js";

const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(30, "d"), // 30-day sessions
  sessionCookie: {
    name: "amphoreus_session",
    attributes: {
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      username: attributes.username,
      fullName: attributes.full_name,
      role: attributes.role,
      email: attributes.email,
      active: attributes.active,
    };
  },
});

// Extend Lucia types
declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      username: string;
      full_name: string;
      role: UserRole;
      email: string | null;
      active: boolean;
    };
  }
}
```

### 2. `src/server/auth/middleware.ts`

```ts
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
      // Session was extended — update the cookie
      const sessionCookie = lucia.createSessionCookie(session.id);
      setCookie(c, sessionCookie.name, sessionCookie.value, {
        ...sessionCookie.attributes,
        httpOnly: true,
      });
    }

    if (!session) {
      // Session is invalid — clear the cookie
      const blankCookie = lucia.createBlankSessionCookie();
      setCookie(c, blankCookie.name, blankCookie.value, {
        ...blankCookie.attributes,
        httpOnly: true,
      });
      c.set("user", null);
      c.set("sessionId", null);
      return next();
    }

    // Attach user (without password) and session ID to Hono context
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
```

### 3. `src/server/routers/auth.ts`

```ts
// src/server/routers/auth.ts
import { z } from "zod";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { users } from "../db/schema.js";
import { lucia } from "../auth/lucia.js";
import { logger } from "../lib/logger.js";
import type { SafeUser } from "../../shared/types.js";

const BCRYPT_ROUNDS = 12;

export const authRouter = router({
  /**
   * Login: validate username + password, create session, return user.
   */
  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1, "Username is required"),
        password: z.string().min(1, "Password is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { username, password } = input;

      // Find user by username
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid username or password",
        });
      }

      // Check if user is active
      if (!user.active) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This account has been deactivated",
        });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid username or password",
        });
      }

      // Create session
      const session = await lucia.createSession(String(user.id), {});
      const sessionCookie = lucia.createSessionCookie(session.id);

      // Update last login
      await ctx.db
        .update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, user.id));

      logger.info("User logged in", {
        userId: user.id,
        username: user.username,
      });

      const safeUser: SafeUser = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        email: user.email,
        active: user.active,
        createdAt: user.createdAt,
        lastLogin: new Date(),
      };

      return {
        user: safeUser,
        sessionCookie: {
          name: sessionCookie.name,
          value: sessionCookie.value,
          attributes: sessionCookie.attributes,
        },
      };
    }),

  /**
   * Logout: invalidate current session.
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await lucia.invalidateSession(ctx.sessionId);

    logger.info("User logged out", {
      userId: ctx.user.id,
      username: ctx.user.username,
    });

    const blankCookie = lucia.createBlankSessionCookie();

    return {
      success: true,
      sessionCookie: {
        name: blankCookie.name,
        value: blankCookie.value,
        attributes: blankCookie.attributes,
      },
    };
  }),

  /**
   * Me: return the currently authenticated user, or null.
   */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      return null;
    }

    return ctx.user;
  }),

  /**
   * Change password: validate old password, hash new one, update.
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z
          .string()
          .min(8, "New password must be at least 8 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { currentPassword, newPassword } = input;

      // Fetch user with password hash
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Verify current password
      const validPassword = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!validPassword) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Current password is incorrect",
        });
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await ctx.db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, ctx.user.id));

      // Invalidate all other sessions for this user
      await lucia.invalidateUserSessions(String(ctx.user.id));

      // Create a fresh session so the user stays logged in
      const session = await lucia.createSession(String(ctx.user.id), {});
      const sessionCookie = lucia.createSessionCookie(session.id);

      logger.info("User changed password", {
        userId: ctx.user.id,
        username: ctx.user.username,
      });

      return {
        success: true,
        sessionCookie: {
          name: sessionCookie.name,
          value: sessionCookie.value,
          attributes: sessionCookie.attributes,
        },
      };
    }),
});
```

### 4. `src/server/db/seed.ts`

```ts
// src/server/db/seed.ts
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, closeDatabase } from "./index.js";
import { users } from "./schema.js";
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

const BCRYPT_ROUNDS = 12;

async function seed() {
  logger.info("Starting database seed...");

  const adminPassword = env.ADMIN_INITIAL_PASSWORD;
  if (!adminPassword) {
    logger.error(
      "ADMIN_INITIAL_PASSWORD environment variable is required for seeding"
    );
    process.exit(1);
  }

  // Check if admin already exists
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.username, "admin"))
    .limit(1);

  if (existingAdmin) {
    logger.info("Admin user already exists, skipping seed");
    await closeDatabase();
    return;
  }

  // Hash the password
  const hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

  // Create admin user
  const [admin] = await db
    .insert(users)
    .values({
      username: "admin",
      password: hashedPassword,
      fullName: "System Administrator",
      role: "admin",
      email: null,
      active: true,
    })
    .returning();

  logger.info("Admin user created", {
    id: admin.id,
    username: admin.username,
    role: admin.role,
  });

  logger.info("Seed completed successfully");
  await closeDatabase();
}

seed().catch((err) => {
  logger.error("Seed failed", { error: err.message });
  process.exit(1);
});
```

### 5. Update `src/server/trpc.ts` — Context wiring with Hono

The `createContext` function in `trpc.ts` (from Milestone 3) already reads `user` and `sessionId` from the Hono context, which is populated by `sessionMiddleware`. No changes needed unless the tRPC-Hono adapter requires a different integration pattern.

For `@hono/trpc-server`, the context factory receives the Hono `Context` object directly. Update `src/server/index.ts` if needed:

```ts
// In src/server/index.ts, the tRPC mount becomes:
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, c) => createContext(c),
    onError({ error, path }) {
      logger.error(`tRPC error on ${path}`, {
        code: error.code,
        message: error.message,
      });
    },
  })
);
```

The key point: `createContext` receives the Hono context `c`, from which it reads the `user` and `sessionId` set by `sessionMiddleware`.

### 6. Cookie handling in the tRPC layer

Since tRPC mutations return the cookie data but cannot set cookies directly (tRPC is transport-agnostic), the client must read the `sessionCookie` from the response and handle it. However, since we are using `@hono/trpc-server` (which is HTTP-native), we can alternatively set cookies directly in the Hono context.

A cleaner pattern is to set cookies directly in the auth router using the Hono context. To access it, pass the Hono context through tRPC context:

```ts
// Updated createContext in src/server/trpc.ts
import type { Context as HonoContext } from "hono";

export interface TRPCContext {
  db: Database;
  user: SafeUser | null;
  sessionId: string | null;
  honoCtx: HonoContext; // raw Hono context for cookie access
}

export async function createContext(c: HonoContext): Promise<TRPCContext> {
  const user = c.get("user") as SafeUser | null ?? null;
  const sessionId = c.get("sessionId") as string | null ?? null;

  return {
    db,
    user,
    sessionId,
    honoCtx: c,
  };
}
```

Then in the auth router, set cookies directly:

```ts
// In login mutation, after creating session:
import { setCookie } from "hono/cookie";

// ... inside the mutation:
const session = await lucia.createSession(String(user.id), {});
const sessionCookie = lucia.createSessionCookie(session.id);

setCookie(
  ctx.honoCtx,
  sessionCookie.name,
  sessionCookie.value,
  {
    ...sessionCookie.attributes,
    httpOnly: true,
  }
);

// In logout mutation:
const blankCookie = lucia.createBlankSessionCookie();
setCookie(
  ctx.honoCtx,
  blankCookie.name,
  blankCookie.value,
  {
    ...blankCookie.attributes,
    httpOnly: true,
  }
);
```

This way cookies are set server-side as proper `Set-Cookie` headers, and the client never handles session tokens manually.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/server/auth/lucia.ts` | Lucia initialization with Drizzle adapter and session config |
| `src/server/auth/middleware.ts` | Hono middleware: validate session cookie, attach user to context |
| `src/server/routers/auth.ts` | tRPC auth router: login, logout, me, changePassword |
| `src/server/db/seed.ts` | Seed script to create initial admin user |

Files modified (from previous milestones):
- `src/server/trpc.ts` — Add `honoCtx` to TRPCContext for cookie access
- `src/server/index.ts` — Pass Hono context to `createContext`

---

## Verification

```bash
# 1. TypeScript compiles
npx tsc --noEmit
# Expected: zero errors

# 2. Run migrations (if not already done)
npx drizzle-kit migrate

# 3. Seed the admin user
ADMIN_INITIAL_PASSWORD=Admin123! npx tsx src/server/db/seed.ts
# Expected: "Admin user created" log message

# 4. Verify admin exists in DB
docker compose exec postgres psql -U amphoreus -d amphoreus \
  -c "SELECT id, username, role, active FROM users;"
# Expected: 1 row with username=admin, role=admin, active=true

# 5. Start the server
npx tsx src/server/index.ts &
SERVER_PID=$!
sleep 2

# 6. Test login via tRPC
curl -s -X POST http://localhost:3000/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"json":{"username":"admin","password":"Admin123!"}}' \
  -c cookies.txt -v 2>&1 | grep -E "Set-Cookie|session"
# Expected: Set-Cookie header with amphoreus_session

# 7. Test auth.me with session cookie
curl -s http://localhost:3000/trpc/auth.me \
  -b cookies.txt | jq '.result.data.json'
# Expected: { "id": 1, "username": "admin", "role": "admin", ... }

# 8. Test protected route without cookie
curl -s http://localhost:3000/trpc/auth.me | jq '.result.data.json'
# Expected: null (public procedure returns null for unauthenticated)

# 9. Test logout
curl -s -X POST http://localhost:3000/trpc/auth.logout \
  -H "Content-Type: application/json" \
  -d '{"json":{}}' \
  -b cookies.txt | jq .
# Expected: { "result": { "data": { "json": { "success": true, ... } } } }

# 10. Verify session is invalidated after logout
curl -s http://localhost:3000/trpc/auth.me \
  -b cookies.txt | jq '.result.data.json'
# Expected: null

# 11. Test login with wrong password
curl -s -X POST http://localhost:3000/trpc/auth.login \
  -H "Content-Type: application/json" \
  -d '{"json":{"username":"admin","password":"wrong"}}' | jq .error
# Expected: UNAUTHORIZED error

# 12. Cleanup
kill $SERVER_PID
rm cookies.txt
```

---

## Definition of Done

- [ ] Lucia Auth is initialized with the Drizzle adapter using the `sessions` and `users` tables
- [ ] Session cookies are httpOnly, secure in production, sameSite=lax
- [ ] Session expiry is set to 30 days
- [ ] `sessionMiddleware` validates the session cookie on every request and attaches user to context
- [ ] `sessionMiddleware` refreshes the cookie when the session is extended by Lucia
- [ ] `sessionMiddleware` clears invalid session cookies
- [ ] `auth.login` validates username + password with bcrypt, creates a session, sets the cookie, and returns the user
- [ ] `auth.login` rejects inactive users with a `FORBIDDEN` error
- [ ] `auth.login` returns the same error message for wrong username and wrong password (no user enumeration)
- [ ] `auth.logout` invalidates the session and clears the cookie
- [ ] `auth.me` returns the current user or null (no error for unauthenticated)
- [ ] `auth.changePassword` validates the old password, hashes the new one with bcrypt (12 rounds), invalidates all other sessions, and creates a fresh session
- [ ] `protectedProcedure` throws `UNAUTHORIZED` for unauthenticated requests
- [ ] `adminProcedure` throws `FORBIDDEN` for non-admin users
- [ ] `seed.ts` creates the admin user with password from `ADMIN_INITIAL_PASSWORD` env var
- [ ] `seed.ts` is idempotent (skips if admin already exists)
- [ ] `npx tsc --noEmit` passes with zero errors
