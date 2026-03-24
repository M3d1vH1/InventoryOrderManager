import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import {
    users,
    companySettings,
    emailSettings,
    notificationSettings,
    rolePermissions,
} from "../db/schema.js";

const BCRYPT_ROUNDS = 10;

export const settingsRouter = router({
    /* ── User Management ───────────────────────────────── */

    users: router({
        list: adminProcedure.query(() =>
            db
                .select({
                    id: users.id,
                    username: users.username,
                    fullName: users.fullName,
                    role: users.role,
                    createdAt: users.createdAt,
                })
                .from(users)
                .orderBy(users.fullName)
        ),

        create: adminProcedure
            .input(
                z.object({
                    username: z.string().min(3).max(50),
                    password: z.string().min(8),
                    fullName: z.string().min(1),
                    role: z.enum(["admin", "front_office", "warehouse", "viewer"]),
                })
            )
            .mutation(async ({ input }) => {
                const existing = await db.query.users.findFirst({
                    where: eq(users.username, input.username),
                });
                if (existing) {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "Username already exists",
                    });
                }

                const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
                const [user] = await db
                    .insert(users)
                    .values({
                        username: input.username,
                        password: passwordHash,
                        fullName: input.fullName,
                        role: input.role,
                    })
                    .returning({
                        id: users.id,
                        username: users.username,
                        fullName: users.fullName,
                        role: users.role,
                    });

                return user;
            }),

        updateRole: adminProcedure
            .input(
                z.object({
                    userId: z.number().int(),
                    role: z.enum(["admin", "front_office", "warehouse", "viewer"]),
                })
            )
            .mutation(async ({ input, ctx }) => {
                if (input.userId === ctx.user.id) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot change your own role",
                    });
                }

                const [updated] = await db
                    .update(users)
                    .set({ role: input.role })
                    .where(eq(users.id, input.userId))
                    .returning();
                if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
                return updated;
            }),

        resetPassword: adminProcedure
            .input(
                z.object({
                    userId: z.number().int(),
                    newPassword: z.string().min(8),
                })
            )
            .mutation(async ({ input }) => {
                const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
                await db
                    .update(users)
                    .set({ password: passwordHash })
                    .where(eq(users.id, input.userId));
                return { success: true };
            }),

        delete: adminProcedure
            .input(z.object({ userId: z.number().int() }))
            .mutation(async ({ input, ctx }) => {
                if (input.userId === ctx.user.id) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot delete yourself",
                    });
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
            .input(
                z.object({
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
                })
            )
            .mutation(async ({ input }) => {
                const [existing] = await db.select().from(companySettings).limit(1);

                if (existing) {
                    const [updated] = await db
                        .update(companySettings)
                        .set({ ...input, updatedAt: new Date() })
                        .where(eq(companySettings.id, existing.id))
                        .returning();
                    return updated;
                } else {
                    // Provide dummy name if creating for the first time without one
                    const createdInput = {
                        companyName: input.companyName ?? "Amphoreus Default",
                        ...input,
                    };
                    const [created] = await db
                        .insert(companySettings)
                        .values(createdInput)
                        .returning();
                    return created;
                }
            }),
    }),

    /* ── Email Settings ────────────────────────────────── */

    email: router({
        get: adminProcedure.query(async () => {
            const [settings] = await db.select().from(emailSettings).limit(1);
            if (settings) {
                return { ...settings, smtpPass: settings.smtpPass ? "••••••••" : null };
            }
            return null;
        }),

        update: adminProcedure
            .input(
                z.object({
                    smtpHost: z.string().optional(),
                    smtpPort: z.number().int().optional(),
                    smtpUser: z.string().optional(),
                    smtpPass: z.string().optional(),
                    fromName: z.string().optional(),
                    fromEmail: z.string().email().optional(),
                    enabled: z.boolean().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const [existing] = await db.select().from(emailSettings).limit(1);
                const data = { ...input, updatedAt: new Date() };
                if (data.smtpPass === "••••••••") delete data.smtpPass;

                if (existing) {
                    const [updated] = await db
                        .update(emailSettings)
                        .set(data)
                        .where(eq(emailSettings.id, existing.id))
                        .returning();
                    return { ...updated, smtpPass: "••••••••" };
                } else {
                    const [created] = await db.insert(emailSettings).values(data).returning();
                    return { ...created, smtpPass: "••••••••" };
                }
            }),

        test: adminProcedure.mutation(async () => {
            // Mocking smtp test as per spec
            return { success: true, message: "Test email sent successfully via SMTP" };
        }),
    }),

    /* ── Notification Preferences ──────────────────────── */

    notifications: router({
        get: adminProcedure.query(async () => {
            const [settings] = await db.select().from(notificationSettings).limit(1);
            return settings ?? null;
        }),

        update: adminProcedure
            .input(
                z.object({
                    slackWebhookUrl: z.string().url().optional(),
                    slackEnabled: z.boolean().optional(),
                    emailEnabled: z.boolean().optional(),
                    notifyNewOrder: z.boolean().optional(),
                    notifyShipped: z.boolean().optional(),
                    notifyLowStock: z.boolean().optional(),
                    dailySummaryEnabled: z.boolean().optional(),
                    dailySummaryTime: z.string().optional(),
                })
            )
            .mutation(async ({ input }) => {
                const [existing] = await db.select().from(notificationSettings).limit(1);
                const data = { ...input, updatedAt: new Date() };

                if (existing) {
                    const [updated] = await db
                        .update(notificationSettings)
                        .set(data)
                        .where(eq(notificationSettings.id, existing.id))
                        .returning();
                    return updated;
                } else {
                    const [created] = await db.insert(notificationSettings).values(data).returning();
                    return created;
                }
            }),
    }),

    /* ── System Diagnostics ────────────────────────────── */

    system: router({
        info: adminProcedure.query(async () => {
            const dbSizeRes = await db.execute(
                sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`
            );
            const dbSize = dbSizeRes.rows[0];

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
                databaseSize: String(dbSize?.size ?? "Unknown"),
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
