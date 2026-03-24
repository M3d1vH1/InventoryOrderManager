import cron from "node-cron";
import { notifyDailySummary, notifyLowStock } from "../services/slackService.js";
import { db } from "../db/index.js";
import { orders, products } from "../db/schema.js";
import { sql, eq, gte, and } from "drizzle-orm";
import { logger } from "../lib/logger.js";

export function scheduleDailySummary() {
    // Run at 6 PM (18:00) every day — Greek business hours
    cron.schedule("0 18 * * *", async () => {
        logger.info("Running daily summary cron job");
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const [created] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(orders)
                .where(gte(orders.createdAt, today));

            const [shipped] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(orders)
                .where(and(eq(orders.status, "shipped"), gte(orders.lastUpdated, today)));

            const lowStock = await db
                .select()
                .from(products)
                .where(sql`${products.currentStock} - ${products.reservedStock} <= ${products.minStockLevel}`);

            await notifyDailySummary({
                ordersCreated: created?.count ?? 0,
                ordersShipped: shipped?.count ?? 0,
                revenue: 0, // No pricing modeled in DB schema, omitting revenue
                pickingQueue: 0, // Simplified — no join needed for summary
                lowStockCount: lowStock.length,
            });

            if (lowStock.length > 0) {
                await notifyLowStock(
                    lowStock.map((p) => ({
                        name: p.name,
                        sku: p.sku,
                        available: p.currentStock - p.reservedStock,
                        minLevel: p.minStockLevel,
                    }))
                );
            }

            logger.info("Daily summary cron job completed");
        } catch (err) {
            logger.error("Daily summary cron job failed", { error: (err as Error).message });
        }
    });

    logger.info("Daily summary scheduled at 18:00 daily");
}
