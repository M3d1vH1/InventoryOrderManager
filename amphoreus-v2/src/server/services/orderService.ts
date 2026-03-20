import { db } from "../db/index.js";
import { orders, orderItems, products, orderChangelogs } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

interface CreateOrderInput {
    customerId: number;
    priority: "low" | "normal" | "high" | "urgent";
    notes?: string;
    estimatedShippingDate?: Date;
    items: { productId: number; quantity: number }[];
    createdById: number;
}

/**
 * Atomically creates an order and reserves stock for all items.
 * If ANY product has insufficient available stock the entire transaction
 * rolls back and returns which items failed.
 */
export async function createOrder(input: CreateOrderInput) {
    return db.transaction(async (tx) => {
        // 1. Generate order number — ORD-YYYYMMDD-NNN (daily sequence)
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const [{ count }] = await tx
            .select({ count: sql<number>`count(*)` })
            .from(orders)
            .where(sql`DATE(${orders.createdAt}) = CURRENT_DATE`);
        const seq = String(Number(count) + 1).padStart(3, "0");
        const orderNumber = `ORD-${today}-${seq}`;

        // 2. Validate stock availability for ALL items before reserving anything
        const insufficientStock: {
            productId: number;
            name: string;
            requested: number;
            available: number;
        }[] = [];

        for (const item of input.items) {
            const [product] = await tx
                .select()
                .from(products)
                .where(eq(products.id, item.productId))
                .for("update"); // Lock row to prevent race conditions

            if (!product) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `Product ${item.productId} not found`,
                });
            }

            const available = product.currentStock - product.reservedStock;
            if (available < item.quantity) {
                insufficientStock.push({
                    productId: product.id,
                    name: product.name,
                    requested: item.quantity,
                    available,
                });
            }
        }

        if (insufficientStock.length > 0) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Insufficient stock: ${insufficientStock
                    .map((i) => `${i.name} (requested ${i.requested}, available ${i.available})`)
                    .join("; ")}`,
            });
        }

        // 3. Insert order
        const [order] = await tx
            .insert(orders)
            .values({
                orderNumber,
                customerId: input.customerId,
                status: "pending",
                priority: input.priority,
                notes: input.notes,
                estimatedShippingDate: input.estimatedShippingDate,
                createdById: input.createdById,
            })
            .returning();

        // 4. Insert items and reserve stock
        for (const item of input.items) {
            await tx.insert(orderItems).values({
                orderId: order.id,
                productId: item.productId,
                quantity: item.quantity,
            });

            await tx
                .update(products)
                .set({
                    reservedStock: sql`${products.reservedStock} + ${item.quantity}`,
                })
                .where(eq(products.id, item.productId));
        }

        // 5. Create changelog entry
        await tx.insert(orderChangelogs).values({
            orderId: order.id,
            action: "created",
            notes: `Order created with ${input.items.length} item(s)`,
            userId: input.createdById,
        });

        return order;
    });
}

/**
 * Cancels an order: unreserves stock for all non-picked items.
 */
export async function cancelOrder(orderId: number, userId: number) {
    return db.transaction(async (tx) => {
        const [order] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .for("update");

        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.status === "shipped" || order.status === "cancelled") {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Cannot cancel an order with status "${order.status}"`,
            });
        }

        const items = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, orderId));

        for (const item of items) {
            if (!item.pickedAt) {
                // Only unreserve stock for non-picked items
                await tx
                    .update(products)
                    .set({
                        reservedStock: sql`GREATEST(${products.reservedStock} - ${item.quantity}, 0)`,
                    })
                    .where(eq(products.id, item.productId));
            }
        }

        await tx
            .update(orders)
            .set({ status: "cancelled" })
            .where(eq(orders.id, orderId));

        await tx.insert(orderChangelogs).values({
            orderId,
            action: "cancelled",
            notes: `Order cancelled from status "${order.status}"`,
            userId,
        });

        return { success: true };
    });
}
