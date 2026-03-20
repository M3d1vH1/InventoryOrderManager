import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, ilike, or, sql, desc, asc } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { customers, orders } from "../db/schema.js";
import { cached, invalidateTag } from "../lib/cache.js";

/* ── Schemas ─────────────────────────────────────── */

const customerInput = z.object({
    name: z.string().min(1).max(255),
    vatNumber: z.string().max(50).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().email().max(255).optional().or(z.literal("")),
    address: z.string().optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    contactPerson: z.string().max(255).optional(),
    billingCompany: z.string().max(255).optional(),
    shippingCompany: z
        .enum(["brt", "dhl", "gls", "sda", "tnt", "ups", "fedex", "poste_italiane", "other", "pickup"])
        .optional(),
    preferredShippingCompany: z
        .enum(["brt", "dhl", "gls", "sda", "tnt", "ups", "fedex", "poste_italiane", "other", "pickup"])
        .optional(),
    notes: z.string().optional(),
});

const listInput = z.object({
    page: z.number().int().min(1).default(1),
    perPage: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    sortBy: z.enum(["name", "city", "createdAt"]).default("name"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
});

/* ── Router ──────────────────────────────────────── */

export const customersRouter = router({
    list: protectedProcedure.input(listInput).query(async ({ input }) => {
        const cacheKey = `cache:customers:list:${JSON.stringify(input)}`;

        return cached(cacheKey, async () => {
            const { page, perPage, search, sortBy, sortDir } = input;
            const offset = (page - 1) * perPage;

            const where = search
                ? or(
                    ilike(customers.name, `%${search}%`),
                    ilike(customers.phone, `%${search}%`),
                    ilike(customers.email, `%${search}%`)
                )
                : undefined;

            let orderCol: any = customers.name;
            if (sortBy === "city") orderCol = customers.city;
            if (sortBy === "createdAt") orderCol = customers.createdAt;
            const orderFn = sortDir === "desc" ? desc(orderCol) : asc(orderCol);

            const [rows, countResult] = await Promise.all([
                db.select().from(customers).where(where).orderBy(orderFn).limit(perPage).offset(offset),
                db.select({ count: sql<number>`count(*)` }).from(customers).where(where),
            ]);

            return { items: rows, total: Number(countResult[0].count), page, perPage };
        }, { ttl: 120, tags: ["customers"] });
    }),

    getById: protectedProcedure
        .input(z.object({ id: z.number().int() }))
        .query(async ({ input }) => {
            const customer = await db.query.customers.findFirst({
                where: eq(customers.id, input.id),
            });
            if (!customer) throw new TRPCError({ code: "NOT_FOUND" });

            // Order history summary
            const [summary] = await db
                .select({
                    orderCount: sql<number>`count(*)`,
                    lastOrderDate: sql<string>`max(${orders.createdAt})`,
                })
                .from(orders)
                .where(eq(orders.customerId, input.id));

            // Recent orders (20 most recent)
            const recentOrders = await db
                .select({
                    id: orders.id,
                    orderNumber: orders.orderNumber,
                    status: orders.status,
                    createdAt: orders.createdAt,
                })
                .from(orders)
                .where(eq(orders.customerId, input.id))
                .orderBy(desc(orders.createdAt))
                .limit(20);

            return {
                ...customer,
                orderCount: Number(summary.orderCount),
                lastOrderDate: summary.lastOrderDate ?? null,
                recentOrders,
            };
        }),

    create: protectedProcedure
        .input(customerInput)
        .mutation(async ({ input }) => {
            const data = {
                ...input,
                email: input.email === "" ? null : input.email,
            };
            const [customer] = await db.insert(customers).values(data).returning();
            await invalidateTag("customers");
            return customer;
        }),

    update: protectedProcedure
        .input(customerInput.partial().extend({ id: z.number().int() }))
        .mutation(async ({ input }) => {
            const { id, email, ...rest } = input;
            const data = { ...rest, email: email === "" ? null : email };
            const [updated] = await db
                .update(customers)
                .set(data)
                .where(eq(customers.id, id))
                .returning();
            if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

            await invalidateTag("customers");
            return updated;
        }),

    delete: adminProcedure
        .input(z.object({ id: z.number().int() }))
        .mutation(async ({ input }) => {
            const [orderCheck] = await db
                .select({ count: sql<number>`count(*)` })
                .from(orders)
                .where(eq(orders.customerId, input.id));

            if (Number(orderCheck.count) > 0) {
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: `Cannot delete customer with ${orderCheck.count} existing order(s). Remove the orders first.`,
                });
            }

            await db.delete(customers).where(eq(customers.id, input.id));
            await invalidateTag("customers");
            return { success: true };
        }),
});
