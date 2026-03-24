import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, gte, lte, sql, desc, asc, ilike, or } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { orders, orderItems, orderChangelogs, products, inventoryChanges, customers, users } from "../db/schema.js";
import { createOrder, cancelOrder } from "../services/orderService.js";
import { notifyNewOrder, notifyOrderShipped } from "../services/slackService.js";
import { createNotification } from "./notifications.js";

const statusEnum = z.enum([
    "pending", "confirmed", "processing", "picking",
    "picked", "partially_shipped", "shipped", "delivered",
    "cancelled", "on_hold"
]);
const priorityEnum = z.enum(["low", "normal", "high", "urgent"]);

const VALID_TRANSITIONS: Record<string, string[]> = {
    pending: ["confirmed", "processing", "picking", "cancelled", "on_hold"],
    confirmed: ["processing", "picking", "cancelled", "on_hold"],
    processing: ["picking", "cancelled", "on_hold"],
    picking: ["picked", "cancelled", "on_hold"],
    picked: ["partially_shipped", "shipped", "cancelled"],
    partially_shipped: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
    on_hold: ["pending", "cancelled"],
};

export const ordersRouter = router({
    list: protectedProcedure
        .input(
            z.object({
                page: z.number().int().min(1).default(1),
                perPage: z.number().int().min(1).max(100).default(20),
                status: statusEnum.optional(),
                priority: priorityEnum.optional(),
                customerId: z.number().int().optional(),
                dateFrom: z.string().optional(),
                dateTo: z.string().optional(),
                search: z.string().optional(),
                sortBy: z.enum(["orderNumber", "orderDate", "createdAt"]).default("createdAt"),
                sortDir: z.enum(["asc", "desc"]).default("desc"),
            })
        )
        .query(async ({ input }) => {
            const { page, perPage, status, priority, customerId, dateFrom, dateTo, search, sortBy, sortDir } = input;
            const offset = (page - 1) * perPage;

            const conditions = [];
            if (status) conditions.push(eq(orders.status, status));
            if (priority) conditions.push(eq(orders.priority, priority));
            if (customerId) conditions.push(eq(orders.customerId, customerId));
            if (dateFrom) conditions.push(gte(orders.createdAt, new Date(dateFrom)));
            if (dateTo) conditions.push(lte(orders.createdAt, new Date(dateTo)));
            if (search) {
                conditions.push(
                    or(
                        ilike(orders.orderNumber, `%${search}%`),
                        ilike(customers.name, `%${search}%`)
                    )!
                );
            }

            const where = conditions.length ? and(...conditions) : undefined;

            let orderCol: any = orders.createdAt;
            if (sortBy === "orderNumber") orderCol = orders.orderNumber;
            if (sortBy === "orderDate") orderCol = orders.orderDate;
            const orderFn = sortDir === "desc" ? desc(orderCol) : asc(orderCol);

            const [rows, countResult] = await Promise.all([
                db
                    .select({
                        id: orders.id,
                        orderNumber: orders.orderNumber,
                        status: orders.status,
                        priority: orders.priority,
                        orderDate: orders.orderDate,
                        createdAt: orders.createdAt,
                        estimatedShippingDate: orders.estimatedShippingDate,
                        customerName: customers.name,
                        customerId: orders.customerId,
                        itemCount: sql<number>`count(${orderItems.id})`,
                    })
                    .from(orders)
                    .leftJoin(customers, eq(orders.customerId, customers.id))
                    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
                    .where(where)
                    .groupBy(orders.id, customers.name)
                    .orderBy(orderFn)
                    .limit(perPage)
                    .offset(offset),
                db
                    .select({ count: sql<number>`count(distinct ${orders.id})` })
                    .from(orders)
                    .leftJoin(customers, eq(orders.customerId, customers.id))
                    .where(where),
            ]);

            return { items: rows, total: Number(countResult[0].count), page, perPage };
        }),

    getById: protectedProcedure
        .input(z.object({ id: z.number().int() }))
        .query(async ({ input }) => {
            const order = await db.query.orders.findFirst({
                where: eq(orders.id, input.id),
                with: {
                    customer: true,
                    items: { with: { product: true } },
                    changelogs: { orderBy: (c: any, { desc }: any) => [desc(c.timestamp)] },
                },
            });
            if (!order) throw new TRPCError({ code: "NOT_FOUND" });
            return order;
        }),

    create: protectedProcedure
        .input(
            z.object({
                customerId: z.number().int(),
                priority: priorityEnum.default("normal"),
                notes: z.string().optional(),
                area: z.string().optional(),
                estimatedShippingDate: z.string().optional(),
                items: z
                    .array(
                        z.object({
                            productId: z.number().int(),
                            quantity: z.number().int().min(1),
                        })
                    )
                    .min(1, "At least one item is required"),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const order = await createOrder({
                ...input,
                estimatedShippingDate: input.estimatedShippingDate
                    ? new Date(input.estimatedShippingDate)
                    : undefined,
                createdById: ctx.user.id,
            });

            // Fire notifications without blocking return
            (async () => {
                try {
                    const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId));
                    const totalQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0);

                    await notifyNewOrder({
                        orderNumber: order.orderNumber,
                        customerName: customer?.name ?? "Unknown",
                        totalAmount: 0,
                        itemCount: totalQuantity,
                        priority: order.priority,
                    });

                    const targets = await db.select().from(users).where(or(eq(users.role, "admin"), eq(users.role, "front_office")));
                    for (const u of targets) {
                        await createNotification({
                            userId: u.id,
                            title: `New Order: ${order.orderNumber}`,
                            message: `Priority: ${order.priority}, Items: ${totalQuantity}`,
                            type: "new_order",
                            referenceId: String(order.id),
                            referenceType: "order"
                        });
                    }
                } catch (err) {
                    console.error("Order notification failed:", err);
                }
            })();

            return order;
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.number().int(),
                priority: priorityEnum.optional(),
                notes: z.string().optional(),
                area: z.string().optional(),
                estimatedShippingDate: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { id, estimatedShippingDate, ...rest } = input;
            const data: any = { ...rest };
            if (estimatedShippingDate !== undefined) {
                data.estimatedShippingDate = estimatedShippingDate ? new Date(estimatedShippingDate) : null;
            }

            const [updated] = await db
                .update(orders)
                .set(data)
                .where(eq(orders.id, id))
                .returning();
            if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

            const changedFields = Object.keys(rest).join(", ") || "fields";
            await db.insert(orderChangelogs).values({
                orderId: id,
                action: "note_added",
                notes: `Updated: ${changedFields}`,
                userId: ctx.user.id,
            });

            return updated;
        }),

    updateStatus: protectedProcedure
        .input(
            z.object({
                id: z.number().int(),
                status: statusEnum,
            })
        )
        .mutation(async ({ input, ctx }) => {
            const [order] = await db.select().from(orders).where(eq(orders.id, input.id));
            if (!order) throw new TRPCError({ code: "NOT_FOUND" });

            const allowed = VALID_TRANSITIONS[order.status] ?? [];
            if (!allowed.includes(input.status)) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Cannot transition from "${order.status}" to "${input.status}". Allowed: ${allowed.join(", ") || "none"}`,
                });
            }

            if (input.status === "cancelled") {
                return cancelOrder(input.id, ctx.user.id);
            }

            // When manually transitioning to 'shipped' or 'picked', auto-pick any remaining unpicked items
            if (input.status === "shipped" || input.status === "picked") {
                await db.transaction(async (tx) => {
                    const items = await tx
                        .select()
                        .from(orderItems)
                        .where(eq(orderItems.orderId, input.id));

                    for (const item of items) {
                        if (!item.pickedAt) {
                            const [product] = await tx
                                .select()
                                .from(products)
                                .where(eq(products.id, item.productId))
                                .for("update");

                            if (!product) continue;

                            const qty = item.quantity;

                            await tx
                                .update(products)
                                .set({
                                    currentStock: sql`GREATEST(${products.currentStock} - ${qty}, 0)`,
                                    reservedStock: sql`GREATEST(${products.reservedStock} - ${qty}, 0)`,
                                    lastStockUpdate: new Date(),
                                })
                                .where(eq(products.id, item.productId));

                            await tx.insert(inventoryChanges).values({
                                productId: item.productId,
                                quantityChanged: -qty,
                                previousQuantity: product.currentStock,
                                newQuantity: Math.max(product.currentStock - qty, 0),
                                changeType: "reservation_released",
                                userId: ctx.user.id,
                                notes: `Auto-picked on status change to "${input.status}" — Order ${order.orderNumber}`,
                            });

                            await tx
                                .update(orderItems)
                                .set({
                                    picked: true,
                                    pickedAt: new Date(),
                                    pickedById: ctx.user.id,
                                    actualQuantity: qty,
                                    shippedQuantity: input.status === "shipped" ? qty : item.shippedQuantity,
                                    shippingStatus: input.status === "shipped" ? "shipped" : item.shippingStatus,
                                })
                                .where(eq(orderItems.id, item.id));
                        } else if (input.status === "shipped" && item.shippedQuantity < item.quantity) {
                            // Item was previously picked but shippedQuantity not yet set
                            await tx
                                .update(orderItems)
                                .set({ shippedQuantity: item.quantity, shippingStatus: "shipped" })
                                .where(eq(orderItems.id, item.id));
                        }
                    }

                    await tx
                        .update(orders)
                        .set({ status: input.status })
                        .where(eq(orders.id, input.id));

                    await tx.insert(orderChangelogs).values({
                        orderId: input.id,
                        action: "status_changed",
                        notes: `Status changed from "${order.status}" to "${input.status}"`,
                        userId: ctx.user.id,
                    });
                });
            } else {
                await db
                    .update(orders)
                    .set({ status: input.status })
                    .where(eq(orders.id, input.id));

                await db.insert(orderChangelogs).values({
                    orderId: input.id,
                    action: "status_changed",
                    notes: `Status changed from "${order.status}" to "${input.status}"`,
                    userId: ctx.user.id,
                });
            }


            if (input.status === "shipped") {
                (async () => {
                    try {
                        const [customer] = await db.select().from(customers).where(eq(customers.id, order.customerId));
                        await notifyOrderShipped({
                            orderNumber: order.orderNumber,
                            customerName: customer?.name ?? "Unknown"
                        });

                        if (order.createdById) {
                            await createNotification({
                                userId: order.createdById,
                                title: `Order Shipped: ${order.orderNumber}`,
                                message: `Order for ${customer?.name ?? "Unknown"} has shipped`,
                                type: "order_shipped",
                                referenceId: String(order.id),
                                referenceType: "order"
                            });
                        }
                    } catch (err) {
                        console.error("Order shipping notification failed:", err);
                    }
                })();
            }

            return { success: true };
        }),

    addItem: protectedProcedure
        .input(
            z.object({
                orderId: z.number().int(),
                productId: z.number().int(),
                quantity: z.number().int().min(1),
            })
        )
        .mutation(async ({ input, ctx }) => {
            return db.transaction(async (tx) => {
                const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId));
                if (!order) throw new TRPCError({ code: "NOT_FOUND" });
                if (order.status !== "pending") {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Can only add items to pending orders" });
                }

                const [product] = await tx
                    .select()
                    .from(products)
                    .where(eq(products.id, input.productId))
                    .for("update");
                if (!product) throw new TRPCError({ code: "NOT_FOUND" });

                const available = product.currentStock - product.reservedStock;
                if (available < input.quantity) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Only ${available} units available for "${product.name}"`,
                    });
                }

                const [newItem] = await tx.insert(orderItems).values({
                    orderId: input.orderId,
                    productId: input.productId,
                    quantity: input.quantity,
                }).returning();

                await tx
                    .update(products)
                    .set({ reservedStock: sql`${products.reservedStock} + ${input.quantity}` })
                    .where(eq(products.id, input.productId));

                await tx.insert(orderChangelogs).values({
                    orderId: input.orderId,
                    action: "items_modified",
                    notes: `Added ${input.quantity}x ${product.name}`,
                    userId: ctx.user.id,
                });
                return newItem;
            });
        }),

    removeItem: protectedProcedure
        .input(z.object({ orderItemId: z.number().int() }))
        .mutation(async ({ input, ctx }) => {
            return db.transaction(async (tx) => {
                const [item] = await tx
                    .select()
                    .from(orderItems)
                    .where(eq(orderItems.id, input.orderItemId));
                if (!item) throw new TRPCError({ code: "NOT_FOUND" });

                const [order] = await tx.select().from(orders).where(eq(orders.id, item.orderId)).for("update");
                if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

                if (order.status !== "pending") {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Can only remove items from pending orders" });
                }

                if (!item.pickedAt) {
                    await tx
                        .update(products)
                        .set({
                            reservedStock: sql`GREATEST(${products.reservedStock} - ${item.quantity}, 0)`,
                        })
                        .where(eq(products.id, item.productId));
                }

                await tx.delete(orderItems).where(eq(orderItems.id, input.orderItemId));

                await tx.insert(orderChangelogs).values({
                    orderId: item.orderId,
                    action: "items_modified",
                    notes: `Removed item (product #${item.productId}, qty ${item.quantity})`,
                    userId: ctx.user.id,
                });
            });
        }),

    cancel: protectedProcedure
        .input(z.object({ id: z.number().int() }))
        .mutation(async ({ input, ctx }) => cancelOrder(input.id, ctx.user.id)),

    getChangelog: protectedProcedure
        .input(z.object({ orderId: z.number().int() }))
        .query(({ input }) =>
            db
                .select()
                .from(orderChangelogs)
                .where(eq(orderChangelogs.orderId, input.orderId))
                .orderBy(desc(orderChangelogs.timestamp))
        ),

    listUnshipped: protectedProcedure
        .query(async () => {
            return db
                .select({
                    id: orderItems.id,
                    orderId: orderItems.orderId,
                    orderNumber: orders.orderNumber,
                    productId: orderItems.productId,
                    productName: products.name,
                    sku: products.sku,
                    quantity: orderItems.quantity,
                    shippedQuantity: orderItems.shippedQuantity,
                    remainingQuantity: sql<number>`${orderItems.quantity} - ${orderItems.shippedQuantity}`,
                    customerName: customers.name,
                    customerId: orders.customerId,
                    orderDate: orders.orderDate,
                })
                .from(orderItems)
                .innerJoin(orders, eq(orderItems.orderId, orders.id))
                .innerJoin(products, eq(orderItems.productId, products.id))
                .innerJoin(customers, eq(orders.customerId, customers.id))
                .where(
                    and(
                        sql`${orderItems.shippedQuantity} < ${orderItems.quantity}`,
                        or(
                            eq(orders.status, "pending"),
                            eq(orders.status, "confirmed"),
                            eq(orders.status, "processing"),
                            eq(orders.status, "picking"),
                            eq(orders.status, "picked"),
                            eq(orders.status, "partially_shipped")
                        )
                    )
                )
                .orderBy(asc(orders.orderDate));
        }),

    listUnshippedByCustomer: protectedProcedure
        .input(z.object({ customerId: z.number().int() }))
        .query(async ({ input }) => {
            return db
                .select({
                    id: orderItems.id,
                    orderId: orderItems.orderId,
                    orderNumber: orders.orderNumber,
                    productId: orderItems.productId,
                    productName: products.name,
                    sku: products.sku,
                    quantity: orderItems.quantity,
                    shippedQuantity: orderItems.shippedQuantity,
                    remainingQuantity: sql<number>`${orderItems.quantity} - ${orderItems.shippedQuantity}`,
                    availableStock: sql<number>`${products.currentStock} - ${products.reservedStock}`,
                    customerId: orders.customerId,
                    orderDate: orders.orderDate,
                })
                .from(orderItems)
                .innerJoin(orders, eq(orderItems.orderId, orders.id))
                .innerJoin(products, eq(orderItems.productId, products.id))
                .where(
                    and(
                        eq(orders.customerId, input.customerId),
                        sql`${orderItems.shippedQuantity} < ${orderItems.quantity}`,
                        or(
                            eq(orders.status, "pending"),
                            eq(orders.status, "confirmed"),
                            eq(orders.status, "processing"),
                            eq(orders.status, "picking"),
                            eq(orders.status, "picked"),
                            eq(orders.status, "partially_shipped")
                        )
                    )
                )
                .orderBy(asc(orders.orderDate));
        }),

    dismissUnshippedItem: protectedProcedure
        .input(z.object({ id: z.number().int() }))
        .mutation(async ({ input, ctx }) => {
            const [item] = await db
                .select()
                .from(orderItems)
                .where(eq(orderItems.id, input.id));
            if (!item) throw new TRPCError({ code: "NOT_FOUND" });

            await db
                .update(orderItems)
                .set({
                    shippedQuantity: item.quantity,
                    shippingStatus: "dismissed"
                })
                .where(eq(orderItems.id, input.id));

            await db.insert(orderChangelogs).values({
                orderId: item.orderId,
                action: "note_added",
                notes: `Unshipped item (product #${item.productId}) dismissed by user`,
                userId: ctx.user.id,
            });

            return { success: true };
        }),
});
