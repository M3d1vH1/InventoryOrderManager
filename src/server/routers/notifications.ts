import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";

export const notificationsRouter = router({
    list: protectedProcedure
        .input(z.object({
            unreadOnly: z.boolean().default(false),
            limit: z.number().int().min(1).max(50).default(20),
        }))
        .query(async ({ input, ctx }) => {
            const conditions = [eq(notifications.userId, ctx.user.id)];
            if (input.unreadOnly) conditions.push(eq(notifications.read, false));

            return db.select().from(notifications)
                .where(and(...conditions))
                .orderBy(desc(notifications.createdAt))
                .limit(input.limit);
        }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
        const [result] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(notifications)
            .where(and(
                eq(notifications.userId, ctx.user.id),
                eq(notifications.read, false),
            ));
        return result?.count ?? 0;
    }),

    markRead: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input, ctx }) => {
            await db.update(notifications)
                .set({ read: true })
                .where(and(
                    eq(notifications.id, input.id),
                    eq(notifications.userId, ctx.user.id),
                ));
            return { success: true };
        }),

    markAllRead: protectedProcedure
        .mutation(async ({ ctx }) => {
            await db.update(notifications)
                .set({ read: true })
                .where(and(
                    eq(notifications.userId, ctx.user.id),
                    eq(notifications.read, false),
                ));
            return { success: true };
        }),
});

/**
 * Creates an in-app notification for a specific user.
 * Call this internally when business events happen.
 */
export async function createNotification(params: {
    userId: number;
    title: string;
    message: string;
    type: string;
    referenceId?: string;
    referenceType?: string;
}) {
    await db.insert(notifications).values({
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type,
        referenceId: params.referenceId,
        referenceType: params.referenceType,
        read: false,
    });
}
