import { z } from "zod";
import { sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { products } from "../db/schema.js";

export const inventoryRouter = router({
    reorderAlerts: protectedProcedure
        .input(z.object({ limit: z.number().int().min(1).max(50).default(5) }).optional())
        .query(async ({ input }) => {
            const limit = input?.limit ?? 5;
            const alerts = await db.select({
                productId: products.id,
                productName: products.name,
                currentStock: products.currentStock,
                minStockLevel: products.minStockLevel,
            })
                .from(products)
                .where(sql`${products.currentStock} - ${products.reservedStock} <= ${products.minStockLevel}`)
                .orderBy(sql`${products.currentStock} - ${products.reservedStock}`)
                .limit(limit);

            return alerts;
        }),
});
