// src/server/auth/lucia.ts
import { Lucia, TimeSpan } from "lucia";
import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import { env } from "../lib/env.js";
import type { UserRole } from "../../shared/types.js";

const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users);

export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(30, "d"), // 30-day rolling sessions
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

// Extend Lucia's type registry so all downstream code is fully typed.
// We register UserId as number to match the serial integer PK on users.id —
// this makes the DrizzlePostgreSQLAdapter accept our integer columns.
declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    UserId: number;
    DatabaseUserAttributes: {
      username: string;
      full_name: string;
      role: UserRole;
      email: string | null;
      active: boolean;
    };
  }
}
