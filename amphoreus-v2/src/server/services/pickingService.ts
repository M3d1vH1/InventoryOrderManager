import { db } from "../db/index.js";
import {
    orders,
    orderItems,
    products,
    inventoryChanges,
    orderChangelogs,
} from "../db/schema.js";
import { eq, and, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

interface PickItemInput {
    orderItemId: number;
    pickedQuantity: number;
    hasQualityIssues?: boolean;
    pickedById: number;
}

/**
 * Picks a single order item: deducts currentStock, releases reservedStock,
 * records inventory change, and marks the item as picked.
 */
export async function pickItem(input: PickItemInput) {
    return db.transaction(async (tx) => {
        const [item] = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.id, input.orderItemId))
            .for("update");

        if (!item) throw new TRPCError({ code: "NOT_FOUND" });
        if (item.pickedAt) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Item already picked" });
        }

        const [order] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, item.orderId));

        if (!order || order.status === "shipped" || order.status === "cancelled") {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Order is not in a pickable state",
            });
        }

        const [product] = await tx
            .select()
            .from(products)
            .where(eq(products.id, item.productId))
            .for("update");

        if (!product) throw new TRPCError({ code: "NOT_FOUND" });

        const actualQty = input.pickedQuantity;

        if (product.currentStock < actualQty) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Cannot pick ${actualQty} units — only ${product.currentStock} in stock for "${product.name}"`,
            });
        }

        // Deduct physical stock and release reservation
        await tx
            .update(products)
            .set({
                currentStock: sql`${products.currentStock} - ${actualQty}`,
                reservedStock: sql`GREATEST(${products.reservedStock} - ${item.quantity}, 0)`,
                lastStockUpdate: new Date(),
            })
            .where(eq(products.id, item.productId));

        // Record inventory change
        await tx.insert(inventoryChanges).values({
            productId: item.productId,
            quantityChanged: -actualQty,
            previousQuantity: product.currentStock,
            newQuantity: product.currentStock - actualQty,
            changeType: "reservation_released",
            userId: input.pickedById,
            notes: `Order ${order.orderNumber}, item picked`,
        });

        // Mark item as picked
        await tx
            .update(orderItems)
            .set({
                picked: true,
                pickedAt: new Date(),
                pickedById: input.pickedById,
                actualQuantity: actualQty,
                hasQualityIssues: input.hasQualityIssues ?? false,
            })
            .where(eq(orderItems.id, input.orderItemId));

        // Check if all items in the order are picked
        const unpicked = await tx
            .select({ id: orderItems.id })
            .from(orderItems)
            .where(and(eq(orderItems.orderId, item.orderId), isNull(orderItems.pickedAt)));

        if (unpicked.length === 0) {
            // All items picked — transition order to "picked"
            await tx
                .update(orders)
                .set({ status: "picked" })
                .where(eq(orders.id, item.orderId));

            await tx.insert(orderChangelogs).values({
                orderId: item.orderId,
                action: "status_changed",
                notes: 'All items picked — status auto-changed to "picked"',
                userId: input.pickedById,
            });
        }

        return { pickedQuantity: actualQty, remainingUnpicked: unpicked.length };
    });
}

/**
 * Returns all orders that have unpicked items (the picking queue).
 * Sorted by priority (urgent first) then creation date.
 */
export async function getPickingQueue() {
    const pendingOrders = await db.query.orders.findMany({
        where: and(
            sql`${orders.status} IN ('pending', 'picked')`,
            sql`EXISTS (
        SELECT 1 FROM order_items
        WHERE order_items.order_id = orders.id
        AND order_items.picked_at IS NULL
      )`
        ),
        with: {
            customer: true,
            items: { with: { product: true } },
        },
        orderBy: (o, { asc }) => [
            sql`CASE ${o.priority}
        WHEN 'urgent' THEN 0
        WHEN 'high' THEN 1
        ELSE 2
      END`,
            asc(o.createdAt),
        ],
    });

    return pendingOrders.map((order) => ({
        ...order,
        totalItems: order.items.length,
        pickedItems: order.items.filter((i) => i.pickedAt).length,
        unpickedItems: order.items.filter((i) => !i.pickedAt),
    }));
}
