import { db } from "../db/index.js";
import {
    orders, orderItems, products, inventoryPredictions, seasonalPatterns,
} from "../db/schema.js";
import { eq, and, gte, sql, desc } from "drizzle-orm";

export interface ProductPrediction {
    productId: number;
    productName: string;
    currentStock: number;
    reservedStock: number;
    availableStock: number;
    avgDailyDemand: number;
    daysUntilStockout: number;
    suggestedReorderQty: number;
    confidence: number;
    seasonalMultiplier: number;
}

/**
 * Calculate demand predictions for all products based on order history.
 * Uses a weighted moving average with seasonal adjustment.
 */
export async function calculatePredictions(): Promise<ProductPrediction[]> {
    const allProducts = await db.select().from(products);
    const predictions: ProductPrediction[] = [];

    for (const product of allProducts) {
        // Get daily sales for the last 90 days
        const salesData = await db.execute(sql`
SELECT
DATE(o.created_at) as sale_date,
    SUM(oi.quantity):: int as units_sold
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.product_id = ${product.id}
        AND o.status != 'cancelled'
        AND o.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY DATE(o.created_at)
      ORDER BY sale_date
    `);

        const dailySales = salesData.rows as { sale_date: string; units_sold: number }[];

        // Calculate weighted moving average (recent days weighted more)
        const totalDays = 90;
        const daysWithSales = dailySales.length;
        const totalUnitsSold = dailySales.reduce((sum, d) => sum + d.units_sold, 0);

        // Simple average daily demand
        const avgDailyDemand = totalDays > 0 ? totalUnitsSold / totalDays : 0;

        // Get current month's seasonal multiplier
        const currentMonth = new Date().getMonth() + 1;
        const [seasonalData] = await db.select()
            .from(seasonalPatterns)
            .where(and(
                eq(seasonalPatterns.productId, product.id),
                eq(seasonalPatterns.month, currentMonth),
            ));

        const seasonalMultiplier = seasonalData ? Number(seasonalData.demandMultiplier) : 1.0;
        const adjustedDemand = avgDailyDemand * seasonalMultiplier;

        // Calculate days until stockout
        const availableStock = product.currentStock - product.reservedStock;
        const daysUntilStockout = adjustedDemand > 0
            ? Math.floor(availableStock / adjustedDemand)
            : availableStock > 0 ? 999 : 0;

        // Suggested reorder: cover 30 days of demand + safety buffer (20%)
        const leadTimeDays = 7; // Assumed lead time
        const safetyFactor = 1.2;
        const suggestedReorderQty = Math.ceil(
            adjustedDemand * (30 + leadTimeDays) * safetyFactor
        );

        // Confidence score based on data quality
        const confidence = Math.min(daysWithSales / 30, 1.0); // Full confidence at 30+ days

        predictions.push({
            productId: product.id,
            productName: product.name,
            currentStock: product.currentStock,
            reservedStock: product.reservedStock,
            availableStock,
            avgDailyDemand: Math.round(adjustedDemand * 100) / 100,
            daysUntilStockout,
            suggestedReorderQty: Math.max(suggestedReorderQty, 0),
            confidence: Math.round(confidence * 100) / 100,
            seasonalMultiplier: Math.round(seasonalMultiplier * 100) / 100,
        });
    }

    // Store predictions
    for (const pred of predictions) {
        await db.insert(inventoryPredictions).values({
            productId: pred.productId,
            predictedDailyDemand: pred.avgDailyDemand,
            daysUntilStockout: pred.daysUntilStockout,
            suggestedReorderQuantity: pred.suggestedReorderQty,
            confidenceScore: pred.confidence,
            calculatedAt: new Date(),
        }).onConflictDoUpdate({
            target: [inventoryPredictions.productId],
            set: {
                predictedDailyDemand: pred.avgDailyDemand,
                daysUntilStockout: pred.daysUntilStockout,
                suggestedReorderQuantity: pred.suggestedReorderQty,
                confidenceScore: pred.confidence,
                calculatedAt: new Date(),
            },
        });
    }

    return predictions.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
}

/**
 * Analyze historical sales to detect seasonal patterns per product.
 * Calculates monthly demand averages over the last 12 months.
 */
export async function calculateSeasonalPatterns(): Promise<void> {
    const monthlyData = await db.execute(sql`
SELECT
oi.product_id,
    EXTRACT(MONTH FROM o.created_at):: int as month,
        SUM(oi.quantity):: int as total_sold,
            COUNT(DISTINCT DATE(o.created_at)):: int as days_with_sales
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.status != 'cancelled'
      AND o.created_at >= NOW() - INTERVAL '12 months'
    GROUP BY oi.product_id, EXTRACT(MONTH FROM o.created_at)
    `);

    // Group by product
    const byProduct = new Map<string, { month: number; totalSold: number; daysWithSales: number }[]>();
    for (const row of monthlyData.rows as any[]) {
        if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, []);
        byProduct.get(row.product_id)!.push({
            month: row.month,
            totalSold: row.total_sold,
            daysWithSales: row.days_with_sales,
        });
    }

    for (const [productId, months] of byProduct) {
        const annualAvg = months.reduce((s, m) => s + m.totalSold, 0) / 12;

        for (const m of months) {
            const daysInMonth = new Date(2024, m.month, 0).getDate();
            const avgDailyDemand = m.totalSold / daysInMonth;
            const monthlyAvg = m.totalSold;
            const multiplier = annualAvg > 0 ? monthlyAvg / annualAvg : 1.0;

            await db.insert(seasonalPatterns).values({
                productId: Number(productId),
                month: m.month,
                avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
                demandMultiplier: Math.round(multiplier * 100) / 100,
                sampleSize: m.daysWithSales,
            }).onConflictDoUpdate({
                target: [seasonalPatterns.productId, seasonalPatterns.month],
                set: {
                    avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
                    demandMultiplier: Math.round(multiplier * 100) / 100,
                    sampleSize: m.daysWithSales,
                },
            });
        }
    }
}
