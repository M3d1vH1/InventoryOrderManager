// src/server/routers/auth.ts
import { z } from "zod";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { setCookie } from "hono/cookie";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { users } from "../db/schema.js";
import { lucia } from "../auth/lucia.js";
import { logger } from "../lib/logger.js";
import { getRedis } from "../lib/cache.js";
import type { SafeUser } from "../../shared/types.js";

const BCRYPT_ROUNDS = 12;

export const authRouter = router({
    /**
     * Login: validate username + password, create session, set httpOnly cookie.
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

            // Rate limiting (brute-force protection)
            const redis = getRedis();
            if (redis?.isReady) {
                const limitKey = `ratelimit:login:${username}`;
                const attempts = await redis.incr(limitKey);
                if (attempts === 1) {
                    await redis.expire(limitKey, 60); // 1 minute window
                }
                if (attempts > 5) {
                    logger.warn("Login rate limit exceeded", { username });
                    throw new TRPCError({
                        code: "TOO_MANY_REQUESTS",
                        message: "Too many login attempts. Please try again in a minute.",
                    });
                }
            }

            // Find user by username
            const [user] = await ctx.db
                .select()
                .from(users)
                .where(eq(users.username, username))
                .limit(1);

            // Use identical error message for both "user not found" and "wrong password"
            // to prevent user enumeration
            if (!user) {
                throw new TRPCError({
                    code: "UNAUTHORIZED",
                    message: "Invalid username or password",
                });
            }

            // Reject inactive accounts (separate message so admins can diagnose)
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

            // Create Lucia session (userId is number per Register.UserId)
            const session = await lucia.createSession(user.id, {});
            const sessionCookie = lucia.createSessionCookie(session.id);

            // Set the cookie directly on the HTTP response
            setCookie(ctx.honoCtx, sessionCookie.name, sessionCookie.value, {
                ...sessionCookie.attributes,
                httpOnly: true,
            });

            // Update last login timestamp (fire-and-forget is fine here)
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

            return { user: safeUser };
        }),

    /**
     * Logout: invalidate the current session and clear the session cookie.
     */
    logout: protectedProcedure.mutation(async ({ ctx }) => {
        await lucia.invalidateSession(ctx.sessionId);

        const blankCookie = lucia.createBlankSessionCookie();
        setCookie(ctx.honoCtx, blankCookie.name, blankCookie.value, {
            ...blankCookie.attributes,
            httpOnly: true,
        });

        logger.info("User logged out", {
            userId: ctx.user.id,
            username: ctx.user.username,
        });

        return { success: true };
    }),

    /**
     * Me: return the currently authenticated user, or null (no error thrown).
     */
    me: publicProcedure.query(async ({ ctx }) => {
        if (!ctx.user) {
            return null;
        }
        return ctx.user;
    }),

    /**
     * Change password: verify old password, hash the new one, invalidate all
     * other sessions, and create a fresh session so the user stays logged in.
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

            // Re-fetch the user row to get the stored password hash
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

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
            await ctx.db
                .update(users)
                .set({ password: hashedPassword })
                .where(eq(users.id, ctx.user.id));

            // Invalidate all existing sessions for this user (including the current one)
            await lucia.invalidateUserSessions(ctx.user.id);

            // Create a fresh session so the user doesn't get kicked out
            const session = await lucia.createSession(ctx.user.id, {});
            const sessionCookie = lucia.createSessionCookie(session.id);
            setCookie(ctx.honoCtx, sessionCookie.name, sessionCookie.value, {
                ...sessionCookie.attributes,
                httpOnly: true,
            });

            logger.info("User changed password", {
                userId: ctx.user.id,
                username: ctx.user.username,
            });

            return { success: true };
        }),
});
