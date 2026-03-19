# Milestone 25 — Settings & Admin Panel

| Field | Value |
|-------|-------|
| **Step** | 25 of 25 |
| **Priority** | P2 |
| **Depends on** | Steps 1–5, 4 |
| **Estimated effort** | 1.5 days |

---

## Goal

Build the settings and administration panel: user management (create, edit roles, reset passwords), company settings (name, address, logo, tax ID), email configuration, notification preferences, role-based permissions display, and system diagnostics. This is the admin-only area for configuring the application.

---

## Implementation

### 1. Database Schema (from Milestone 02)

```
company_settings
  - id, company_name, address, city, postal_code, country, tax_id,
    phone, email, logo_url, website, default_currency, timezone, updated_at

email_settings
  - id, smtp_host, smtp_port, smtp_user, smtp_pass (encrypted),
    from_name, from_email, enabled, updated_at

notification_settings
  - id, slack_webhook_url, slack_enabled, email_enabled,
    notify_new_order, notify_shipped, notify_low_stock,
    daily_summary_enabled, daily_summary_time, updated_at

role_permissions
  - id, role, permission, enabled, created_at
```

### 2. tRPC Router — `src/server/routers/settings.ts`

```ts
// src/server/routers/settings.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import {
  users, companySettings, emailSettings,
  notificationSettings, rolePermissions,
} from "../db/schema.js";
import { hashPassword } from "../auth/lucia.js";

export const settingsRouter = router({
  /* ── User Management ───────────────────────────────── */

  users: router({
    list: adminProcedure.query(() =>
      db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        createdAt: users.createdAt,
      }).from(users).orderBy(users.fullName)
    ),

    create: adminProcedure
      .input(z.object({
        username: z.string().min(3).max(50),
        password: z.string().min(8),
        fullName: z.string().min(1),
        role: z.enum(["admin", "front_office", "warehouse", "viewer"]),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.query.users.findFirst({
          where: eq(users.username, input.username),
        });
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Username already exists" });
        }

        const passwordHash = await hashPassword(input.password);
        const [user] = await db.insert(users).values({
          username: input.username,
          passwordHash,
          fullName: input.fullName,
          role: input.role,
        }).returning({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
        });

        return user;
      }),

    updateRole: adminProcedure
      .input(z.object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "front_office", "warehouse", "viewer"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
        }

        const [updated] = await db.update(users)
          .set({ role: input.role })
          .where(eq(users.id, input.userId))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }),

    resetPassword: adminProcedure
      .input(z.object({
        userId: z.string().uuid(),
        newPassword: z.string().min(8),
      }))
      .mutation(async ({ input }) => {
        const passwordHash = await hashPassword(input.newPassword);
        await db.update(users)
          .set({ passwordHash })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ userId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        if (input.userId === ctx.user.id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete yourself" });
        }
        await db.delete(users).where(eq(users.id, input.userId));
        return { success: true };
      }),
  }),

  /* ── Company Settings ──────────────────────────────── */

  company: router({
    get: protectedProcedure.query(async () => {
      const [settings] = await db.select().from(companySettings).limit(1);
      return settings ?? null;
    }),

    update: adminProcedure
      .input(z.object({
        companyName: z.string().min(1).optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        postalCode: z.string().optional(),
        country: z.string().optional(),
        taxId: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        logoUrl: z.string().url().optional(),
        website: z.string().url().optional(),
        defaultCurrency: z.string().default("EUR"),
        timezone: z.string().default("Europe/Athens"),
      }))
      .mutation(async ({ input }) => {
        const [existing] = await db.select().from(companySettings).limit(1);

        if (existing) {
          const [updated] = await db.update(companySettings)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(companySettings.id, existing.id))
            .returning();
          return updated;
        } else {
          const [created] = await db.insert(companySettings)
            .values(input).returning();
          return created;
        }
      }),
  }),

  /* ── Email Settings ────────────────────────────────── */

  email: router({
    get: adminProcedure.query(async () => {
      const [settings] = await db.select().from(emailSettings).limit(1);
      // Don't expose password
      if (settings) {
        return { ...settings, smtpPass: settings.smtpPass ? "••••••••" : null };
      }
      return null;
    }),

    update: adminProcedure
      .input(z.object({
        smtpHost: z.string().optional(),
        smtpPort: z.number().int().optional(),
        smtpUser: z.string().optional(),
        smtpPass: z.string().optional(),
        fromName: z.string().optional(),
        fromEmail: z.string().email().optional(),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const [existing] = await db.select().from(emailSettings).limit(1);
        const data = { ...input, updatedAt: new Date() };
        // Don't overwrite password with masked value
        if (data.smtpPass === "••••••••") delete data.smtpPass;

        if (existing) {
          const [updated] = await db.update(emailSettings)
            .set(data).where(eq(emailSettings.id, existing.id)).returning();
          return { ...updated, smtpPass: "••••••••" };
        } else {
          const [created] = await db.insert(emailSettings)
            .values(data).returning();
          return { ...created, smtpPass: "••••••••" };
        }
      }),

    test: adminProcedure.mutation(async () => {
      // Send a test email using configured SMTP settings
      // Implementation depends on email library (nodemailer)
      return { success: true, message: "Test email sent" };
    }),
  }),

  /* ── Notification Preferences ──────────────────────── */

  notifications: router({
    get: adminProcedure.query(async () => {
      const [settings] = await db.select().from(notificationSettings).limit(1);
      return settings ?? null;
    }),

    update: adminProcedure
      .input(z.object({
        slackWebhookUrl: z.string().url().optional(),
        slackEnabled: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
        notifyNewOrder: z.boolean().optional(),
        notifyShipped: z.boolean().optional(),
        notifyLowStock: z.boolean().optional(),
        dailySummaryEnabled: z.boolean().optional(),
        dailySummaryTime: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const [existing] = await db.select().from(notificationSettings).limit(1);
        const data = { ...input, updatedAt: new Date() };

        if (existing) {
          const [updated] = await db.update(notificationSettings)
            .set(data).where(eq(notificationSettings.id, existing.id)).returning();
          return updated;
        } else {
          const [created] = await db.insert(notificationSettings)
            .values(data).returning();
          return created;
        }
      }),
  }),

  /* ── System Diagnostics ────────────────────────────── */

  system: router({
    info: adminProcedure.query(async () => {
      const [dbSize] = await db.execute(
        sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`
      );

      const tableSizes = await db.execute(sql`
        SELECT
          relname as table_name,
          n_live_tup::int as row_count
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
        LIMIT 20
      `);

      return {
        nodeVersion: process.version,
        uptime: Math.floor(process.uptime()),
        memoryUsage: process.memoryUsage(),
        databaseSize: dbSize.rows[0]?.size,
        tableSizes: tableSizes.rows,
        environment: process.env.NODE_ENV,
      };
    }),

    clearCache: adminProcedure.mutation(async () => {
      const { clearAppCache } = await import("../lib/cache.js");
      const cleared = await clearAppCache();
      return { cleared };
    }),
  }),
});

import { sql } from "drizzle-orm";
```

### 3. Frontend Pages

```
src/client/routes/_auth/settings/
  ├── index.tsx           — Settings dashboard with navigation cards
  ├── users.tsx           — User management: list, create, edit role, reset password
  ├── company.tsx         — Company settings form
  ├── email.tsx           — SMTP configuration + test button
  ├── notifications.tsx   — Notification preferences (Slack, email toggles)
  └── system.tsx          — System diagnostics: DB size, uptime, memory, cache clear
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/routers/settings.ts` | tRPC router: users, company, email, notifications, system |
| `src/client/routes/_auth/settings/index.tsx` | Settings dashboard |
| `src/client/routes/_auth/settings/users.tsx` | User management page |
| `src/client/routes/_auth/settings/company.tsx` | Company settings page |
| `src/client/routes/_auth/settings/email.tsx` | Email configuration page |
| `src/client/routes/_auth/settings/notifications.tsx` | Notification preferences page |
| `src/client/routes/_auth/settings/system.tsx` | System diagnostics page |
| `src/client/components/settings/CreateUserDialog.tsx` | Create user dialog |
| `src/client/components/settings/ResetPasswordDialog.tsx` | Password reset dialog |
| `src/client/components/settings/RoleSelect.tsx` | Role selector dropdown |

---

## Role Permissions Matrix

| Permission | Admin | Front Office | Warehouse | Viewer |
|------------|-------|-------------|-----------|--------|
| View dashboard | Yes | Yes | Yes | Yes |
| Manage orders | Yes | Yes | No | View |
| Manage products | Yes | Yes | No | View |
| Manage customers | Yes | Yes | No | View |
| Picking | Yes | Yes | Yes | No |
| Manage suppliers | Yes | Yes | No | No |
| View reports | Yes | Yes | No | No |
| Manage users | Yes | No | No | No |
| System settings | Yes | No | No | No |
| Clear cache | Yes | No | No | No |

---

## Verification

1. **User list** — view all users with roles.
2. **Create user** — create a new user, confirm login works with the new credentials.
3. **Update role** — change a user's role, confirm permissions change on next login.
4. **Self-protection** — attempt to change own role or delete self, confirm error.
5. **Reset password** — reset a user's password, confirm old password no longer works.
6. **Company settings** — update company name, confirm it appears in PDF labels.
7. **Email settings** — configure SMTP, send test email, confirm delivery.
8. **Password masking** — view email settings, confirm SMTP password is masked.
9. **Notification toggles** — disable Slack notifications, confirm no Slack messages sent.
10. **System diagnostics** — view database size, table row counts, uptime, and memory usage.
11. **Clear cache** — click clear cache, confirm Redis entries cleared.
12. **Non-admin access** — as a warehouse user, confirm settings pages are inaccessible.

---

## Definition of Done

- [ ] User management: list, create, update role, reset password, delete (admin only)
- [ ] Self-protection: cannot change own role or delete own account
- [ ] Company settings: name, address, tax ID, logo, currency, timezone
- [ ] Email settings: SMTP configuration with password masking and test send
- [ ] Notification preferences: toggle Slack/email per event type
- [ ] System diagnostics: Node version, uptime, memory, DB size, table counts
- [ ] Cache management: clear all application cache
- [ ] Role-based access: settings pages restricted to admin role
- [ ] Settings forms validate input with Zod before submission
- [ ] All settings are persisted in database (not environment variables)
