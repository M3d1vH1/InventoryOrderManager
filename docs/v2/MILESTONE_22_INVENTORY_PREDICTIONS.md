# Milestone 22 — Inventory Predictions

| Field | Value |
|-------|-------|
| **Step** | 22 of 25 |
| **Priority** | P3 |
| **Depends on** | Steps 6, 8 |
| **Estimated effort** | 1.5 days |

---

## Goal

Implement an inventory prediction system that analyzes historical sales data to forecast demand, detect seasonal patterns, and generate reorder alerts. The system calculates days-until-stockout, suggested reorder quantities, and flags products with seasonal demand spikes. This helps prevent both stockouts and overstocking.

---

## Implementation

### 1. Database Schema (from Milestone 02) — Required Unique Constraints

The schema already defines `inventory_predictions` and `seasonal_patterns`, but the `onConflictDoUpdate` calls in the prediction service require unique constraints that are **not yet present**. Add a migration:

```sql
-- drizzle migration (new file in drizzle/)
ALTER TABLE inventory_predictions
  ADD CONSTRAINT uq_inventory_predictions_product_id UNIQUE (product_id);

ALTER TABLE seasonal_patterns
  ADD CONSTRAINT uq_seasonal_patterns_product_month UNIQUE (product_id, month);
```

In `src/server/db/schema.ts`, update both table definitions to include these constraints so Drizzle is aware of them:

```ts
// inventoryPredictions table — add to the constraints array:
uniqueIndex("uq_inventory_predictions_product_id").on(table.productId),

// seasonalPatterns table — add to the constraints array:
uniqueIndex("uq_seasonal_patterns_product_month").on(table.productId, table.month),
```

Without these, calling `onConflictDoUpdate({ target: [inventoryPredictions.productId] })` will throw:
> `there is no unique or exclusion constraint matching the ON CONFLICT specification`

```
inventory_predictions
  - id, product_id (FK, UNIQUE), predicted_daily_demand, days_until_stockout,
    suggested_reorder_quantity, confidence_score (0-1),
    calculated_at, created_at

seasonal_patterns
  - id, product_id (FK), month (1-12), avg_daily_demand,
    demand_multiplier (vs annual avg), sample_size, created_at
  - UNIQUE (product_id, month)
```

### 2. Prediction Service — `src/server/services/predictionService.ts`

```ts
// src/server/services/predictionService.ts
import { db } from "../db/index.js";
import {
  orders, orderItems, products, inventoryPredictions, seasonalPatterns,
} from "../db/schema.js";
import { eq, and, gte, sql, desc } from "drizzle-orm";

interface ProductPrediction {
  productId: number; // products.id is serial (integer), not uuid
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
        SUM(oi.quantity)::int as units_sold
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

    const seasonalMultiplier = seasonalData?.demandMultiplier ?? 1.0;
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
      EXTRACT(MONTH FROM o.created_at)::int as month,
      SUM(oi.quantity)::int as total_sold,
      COUNT(DISTINCT DATE(o.created_at))::int as days_with_sales
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
        productId,
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
```

### 3. tRPC Router — `src/server/routers/predictions.ts`

```ts
// src/server/routers/predictions.ts
import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { calculatePredictions, calculateSeasonalPatterns } from "../services/predictionService.js";
import { db } from "../db/index.js";
import { inventoryPredictions, seasonalPatterns } from "../db/schema.js";
import { eq, lte, desc } from "drizzle-orm";

export const predictionsRouter = router({
  getAll: protectedProcedure.query(() => calculatePredictions()),

  getAlerts: protectedProcedure
    .input(z.object({
      daysThreshold: z.number().int().min(1).default(14),
    }).optional())
    .query(async ({ input }) => {
      const threshold = input?.daysThreshold ?? 14;
      const predictions = await calculatePredictions();
      return predictions.filter((p) => p.daysUntilStockout <= threshold && p.daysUntilStockout < 999);
    }),

  getSeasonalPatterns: protectedProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(({ input }) =>
      db.select().from(seasonalPatterns)
        .where(eq(seasonalPatterns.productId, input.productId))
        .orderBy(seasonalPatterns.month)
    ),

  recalculate: adminProcedure.mutation(async () => {
    await calculateSeasonalPatterns();
    const predictions = await calculatePredictions();
    return { recalculated: predictions.length };
  }),
});
```

### 4. Frontend Page

```tsx
// src/client/routes/_auth/inventory/predictions.tsx
// - Sortable table: product, current stock, daily demand, days until stockout, reorder qty
// - Color coding: red (< 7 days), yellow (< 14 days), green (14+ days)
// - Seasonal chart per product (12-month demand pattern)
// - "Recalculate" admin button
// - Alert badges for products needing immediate reorder
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/services/predictionService.ts` | Demand forecasting and seasonal pattern detection |
| `src/server/routers/predictions.ts` | tRPC router: predictions, alerts, seasonal data |
| `src/client/routes/_auth/inventory/predictions.tsx` | Predictions page with sortable table and alerts |
| `src/client/components/inventory/StockoutAlertBanner.tsx` | Banner for products nearing stockout |
| `src/client/components/inventory/SeasonalChart.tsx` | 12-month demand pattern chart |

---

## Verification

1. **Predictions** — view predictions page, confirm all products have demand forecasts.
2. **Days until stockout** — for a product with known sales velocity, confirm calculation is accurate.
3. **Reorder suggestion** — confirm suggested quantity covers 30 days + lead time + safety buffer.
4. **Seasonal patterns** — for a product with seasonal sales, confirm monthly demand multipliers.
5. **Alerts** — set threshold to 14 days, confirm only at-risk products appear.
6. **Zero sales** — product with no sales history shows 999 days (effectively infinite).
7. **Confidence score** — product with 30+ days of data shows confidence 1.0, new product shows lower.
8. **Recalculate** — click admin recalculate button, confirm predictions and patterns updated.
9. **Color coding** — confirm red/yellow/green visual indicators match stockout thresholds.
10. **Integration** — confirm stockout alerts appear on the main dashboard.

---

## Definition of Done

- [ ] Daily demand calculated from 90-day weighted sales history
- [ ] Seasonal multipliers detected from 12-month historical data
- [ ] Days-until-stockout = available stock / adjusted daily demand
- [ ] Reorder suggestions account for lead time (7 days) + 20% safety buffer
- [ ] Confidence score reflects data quality (0-1 based on sample size)
- [ ] Alerts surface products within configurable stockout threshold
- [ ] Predictions stored in database with `calculatedAt` timestamp
- [ ] Admin recalculate endpoint refreshes all predictions and seasonal data
- [ ] Predictions page with sortable table, color coding, and export
- [ ] Seasonal chart shows 12-month demand pattern per product
