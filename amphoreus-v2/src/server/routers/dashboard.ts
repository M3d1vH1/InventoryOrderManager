import { z } from "zod";
import { sql, eq, and, gte, desc, isNotNull, or, inArray, notInArray } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import {
    orders, orderItems, products, customers, orderChangelogs,
} from "../db/schema.js";

export const dashboardRouter = router({
    stats: protectedProcedure.query(async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            orderStats,
            todayOrders,
            todayShipped,
            pickingQueue,
            lowStockCount,
            totalProducts,
            totalCustomers,
            itemsPickedToday,
        ] = await Promise.all([
            // Total orders by status
            db.select({
                status: orders.status,
                count: sql<number>`count(*)::int`,
            })
                .from(orders)
                .groupBy(orders.status),

            // Orders created today
            db.select({ count: sql<number>`count(*)::int` })
                .from(orders)
                .where(gte(orders.createdAt, today)),

            // Orders shipped today
            db.select({ count: sql<number>`count(*)::int` })
                .from(orders)
                .where(and(
                    eq(orders.status, "shipped"),
                    gte(orders.actualShippingDate ?? orders.lastUpdated ?? orders.createdAt, today),
                )),

            // Orders waiting to be picked (have unpicked items)
            db.select({ count: sql<number>`count(DISTINCT ${orderItems.orderId})::int` })
                .from(orderItems)
                .innerJoin(orders, eq(orderItems.orderId, orders.id))
                .where(and(
                    sql`${orderItems.pickedAt} IS NULL`,
                    sql`${orders.status} NOT IN ('shipped', 'cancelled', 'delivered')`,
                )),

            // Products below minimum stock
            db.select({ count: sql<number>`count(*)::int` })
                .from(products)
                .where(sql`${products.currentStock} - ${products.reservedStock} <= ${products.minStockLevel}`),

            // Total active products
            db.select({ count: sql<number>`count(*)::int` }).from(products),

            // Total customers
            db.select({ count: sql<number>`count(*)::int` }).from(customers),

            // Items picked today (replacement for revenue)
            db.select({ total: sql<number>`COALESCE(SUM(${orderItems.actualQuantity}), 0)::int` })
                .from(orderItems)
                .where(and(
                    isNotNull(orderItems.pickedAt),
                    gte(orderItems.pickedAt, today),
                )),
        ]);

        const statusMap = Object.fromEntries(
            orderStats.map((s) => [s.status, s.count])
        );

        return {
            orders: {
                pending: statusMap.pending ?? 0,
                picked: statusMap.picked ?? 0,
                partiallyShipped: statusMap.partially_shipped ?? 0,
                shipped: statusMap.shipped ?? 0,
                cancelled: statusMap.cancelled ?? 0,
            },
            today: {
                newOrders: todayOrders[0].count,
                shipped: todayShipped[0].count,
                itemsPicked: itemsPickedToday[0].total,
            },
            pickingQueueDepth: pickingQueue[0].count,
            lowStockAlerts: lowStockCount[0].count,
            totalProducts: totalProducts[0].count,
            totalCustomers: totalCustomers[0].count,
        };
    }),

    recentActivity: protectedProcedure.query(async () => {
        const recentChanges = await db
            .select({
                id: orderChangelogs.id,
                orderId: orderChangelogs.orderId,
                action: orderChangelogs.action,
                notes: orderChangelogs.notes,
                timestamp: orderChangelogs.timestamp,
                orderNumber: orders.orderNumber,
            })
            .from(orderChangelogs)
            .innerJoin(orders, eq(orderChangelogs.orderId, orders.id))
            .orderBy(desc(orderChangelogs.timestamp))
            .limit(20);

        return recentChanges;
    }),

    lowStockProducts: protectedProcedure.query(async () => {
        return db
            .select({
                id: products.id,
                name: products.name,
                sku: products.sku,
                currentStock: products.currentStock,
                reservedStock: products.reservedStock,
                minStockLevel: products.minStockLevel,
            })
            .from(products)
            .where(sql`${products.currentStock} - ${products.reservedStock} <= ${products.minStockLevel}`)
            .orderBy(sql`${products.currentStock} - ${products.reservedStock}`)
            .limit(10);
    }),

    ordersTrend: protectedProcedure.query(async () => {
        // Orders per day for the last 14 days
        const rows = await db.execute(sql`
      SELECT
        DATE(created_at) as date,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status IN ('shipped', 'delivered'))::int as shipped
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
        return rows.rows as { date: string; total: number; shipped: number }[];
    }),
});
