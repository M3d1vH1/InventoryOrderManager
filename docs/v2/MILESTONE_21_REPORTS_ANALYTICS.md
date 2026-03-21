# Milestone 21 — Reports & Analytics

| Field | Value |
|-------|-------|
| **Step** | 21 of 25 |
| **Priority** | P2 |
| **Depends on** | Steps 6–12 |
| **Estimated effort** | 1.5 days |

---

## Goal

Build a reports page with pre-built analytical queries: sales by period, top products, top customers, inventory turnover, picking performance, and supplier spending. Reports support date range filtering and CSV export. This gives managers data-driven visibility into operations.

---

## Schema Prerequisite

The `orders` table has no `total_amount` column and `order_items` has no `line_total` column — revenue must be computed from a `unit_price` stored on each order line. Add this column in a migration **before** implementing the reports router:

```sql
-- drizzle migration (new file in drizzle/)
ALTER TABLE order_items ADD COLUMN unit_price numeric(10,2) NOT NULL DEFAULT 0;
```

In `src/server/db/schema.ts`, add to `orderItems`:
```ts
unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
```

The `unit_price` is populated at order-creation time (copied from the product's price at that moment) so revenue figures are historically accurate even if product prices change later. All report queries below use `oi.quantity * oi.unit_price` for revenue.

---

## Implementation

### 1. tRPC Router — `src/server/routers/reports.ts`

```ts
// src/server/routers/reports.ts
import { z } from "zod";
import { sql, and, gte, lte, eq, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import {
  orders, orderItems, products, customers, inventoryChanges,
  supplierInvoices, supplierPayments, suppliers,
} from "../db/schema.js";

const dateRangeInput = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const reportsRouter = router({
  salesSummary: protectedProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      const dateFilter = and(
        gte(orders.createdAt, new Date(input.from)),
        lte(orders.createdAt, new Date(input.to)),
      );

      const [summary, dailyBreakdown] = await Promise.all([
        db.execute(sql`
          SELECT
            COUNT(DISTINCT o.id)::int as total_orders,
            COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_revenue,
            CASE WHEN COUNT(DISTINCT o.id) > 0
              THEN COALESCE(SUM(oi.quantity * oi.unit_price), 0) / COUNT(DISTINCT o.id)
              ELSE 0
            END as avg_order_value,
            COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'shipped')::int as shipped_orders,
            COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'cancelled')::int as cancelled_orders
          FROM orders o
          LEFT JOIN order_items oi ON oi.order_id = o.id
          WHERE o.created_at >= ${new Date(input.from)}
            AND o.created_at <= ${new Date(input.to)}
        `).then((r) => r.rows[0]),

        db.execute(sql`
          SELECT
            DATE(o.created_at) as date,
            COUNT(DISTINCT o.id)::int as orders,
            COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue,
            COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'shipped')::int as shipped
          FROM orders o
          LEFT JOIN order_items oi ON oi.order_id = o.id
          WHERE o.created_at >= ${new Date(input.from)}
            AND o.created_at <= ${new Date(input.to)}
          GROUP BY DATE(o.created_at)
          ORDER BY date
        `),
      ]);

      return { summary, dailyBreakdown: dailyBreakdown.rows };
    }),

  topProducts: protectedProcedure
    .input(dateRangeInput.extend({
      limit: z.number().int().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      return db.execute(sql`
        SELECT
          p.id, p.name, p.sku,
          SUM(oi.quantity)::int as total_sold,
          COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_revenue,
          COUNT(DISTINCT oi.order_id)::int as order_count
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.created_at >= ${new Date(input.from)}
          AND o.created_at <= ${new Date(input.to)}
          AND o.status != 'cancelled'
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_sold DESC
        LIMIT ${input.limit}
      `).then((r) => r.rows);
    }),

  topCustomers: protectedProcedure
    .input(dateRangeInput.extend({
      limit: z.number().int().min(1).max(50).default(10),
    }))
    .query(async ({ input }) => {
      return db.execute(sql`
        SELECT
          c.id, c.name, c.city,
          COUNT(DISTINCT o.id)::int as order_count,
          COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_spent,
          MAX(o.created_at) as last_order_date
        FROM customers c
        JOIN orders o ON o.customer_id = c.id
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.created_at >= ${new Date(input.from)}
          AND o.created_at <= ${new Date(input.to)}
          AND o.status != 'cancelled'
        GROUP BY c.id, c.name, c.city
        ORDER BY total_spent DESC
        LIMIT ${input.limit}
      `).then((r) => r.rows);
    }),

  inventoryTurnover: protectedProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      return db.execute(sql`
        SELECT
          p.id, p.name, p.sku,
          p.current_stock,
          COALESCE(SUM(oi.quantity) FILTER (WHERE o.status != 'cancelled'), 0)::int as units_sold,
          CASE
            WHEN p.current_stock > 0
            THEN ROUND(
              COALESCE(SUM(oi.quantity) FILTER (WHERE o.status != 'cancelled'), 0)::numeric
              / p.current_stock, 2
            )
            ELSE 0
          END as turnover_ratio
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN orders o ON oi.order_id = o.id
          AND o.created_at >= ${new Date(input.from)}
          AND o.created_at <= ${new Date(input.to)}
        GROUP BY p.id, p.name, p.sku, p.current_stock
        ORDER BY turnover_ratio DESC
      `).then((r) => r.rows);
    }),

  pickingPerformance: protectedProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      return db.execute(sql`
        SELECT
          u.id, u.full_name,
          COUNT(oi.id)::int as items_picked,
          COUNT(DISTINCT oi.order_id)::int as orders_picked,
          AVG(EXTRACT(EPOCH FROM (oi.picked_at - o.created_at)) / 3600)::numeric(10,1) as avg_hours_to_pick
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN users u ON oi.picked_by_id = u.id
        WHERE oi.picked_at >= ${new Date(input.from)}
          AND oi.picked_at <= ${new Date(input.to)}
        GROUP BY u.id, u.full_name
        ORDER BY items_picked DESC
      `).then((r) => r.rows);
    }),

  supplierSpending: protectedProcedure
    .input(dateRangeInput)
    .query(async ({ input }) => {
      return db.execute(sql`
        SELECT
          s.id, s.name,
          COUNT(si.id)::int as invoice_count,
          COALESCE(SUM(si.total_amount), 0) as total_invoiced,
          COALESCE(SUM(sp.amount), 0) as total_paid,
          COALESCE(SUM(si.total_amount), 0) - COALESCE(SUM(sp.amount), 0) as outstanding
        FROM suppliers s
        LEFT JOIN supplier_invoices si ON si.supplier_id = s.id
          AND si.invoice_date >= ${new Date(input.from)}
          AND si.invoice_date <= ${new Date(input.to)}
        LEFT JOIN supplier_payments sp ON sp.invoice_id = si.id
        GROUP BY s.id, s.name
        ORDER BY total_invoiced DESC
      `).then((r) => r.rows);
    }),

  exportCsv: protectedProcedure
    .input(z.object({
      report: z.enum([
        "sales_summary", "top_products", "top_customers",
        "inventory_turnover", "picking_performance", "supplier_spending",
      ]),
      from: z.string().datetime(),
      to: z.string().datetime(),
    }))
    .query(async ({ input }) => {
      // Returns data in a format the frontend can convert to CSV
      // The actual CSV generation happens client-side
      // This endpoint re-uses the same queries above
      // but returns all rows (no limit)
      return { reportType: input.report, from: input.from, to: input.to };
    }),
});
```

### 2. Frontend — Reports Page

```tsx
// src/client/routes/_auth/reports/index.tsx
// Tabbed interface with date range picker:
// - Sales Summary (total orders, revenue, avg order, daily chart)
// - Top Products (table with sold units, revenue, order count)
// - Top Customers (table with orders, spending, last order)
// - Inventory Turnover (table with stock, sold, ratio)
// - Picking Performance (table with picker, items, avg time)
// - Supplier Spending (table with invoiced, paid, outstanding)
// Each tab has a "Download CSV" button
```

```tsx
// src/client/lib/csv.ts — CSV export utility
export function downloadCsv(data: Record<string, any>[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h];
        if (typeof val === "string" && val.includes(",")) return `"${val}"`;
        return val ?? "";
      }).join(",")
    ),
  ];

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/routers/reports.ts` | tRPC router: all report queries |
| `src/client/routes/_auth/reports/index.tsx` | Reports page with tabbed interface |
| `src/client/components/reports/DateRangePicker.tsx` | Date range selector |
| `src/client/components/reports/ReportTable.tsx` | Generic sortable report table |
| `src/client/components/reports/SalesSummaryChart.tsx` | Daily revenue/orders chart |
| `src/client/lib/csv.ts` | Client-side CSV export utility |

---

## Verification

1. **Sales summary** — select a date range, confirm total orders, revenue, and avg order value are correct.
2. **Daily breakdown** — confirm chart shows per-day data within the selected range.
3. **Top products** — confirm products sorted by units sold, with revenue and order count.
4. **Top customers** — confirm customers sorted by spending with last order date.
5. **Inventory turnover** — confirm turnover ratio = units sold / current stock.
6. **Picking performance** — confirm per-picker stats with items picked and avg time.
7. **Supplier spending** — confirm invoiced vs paid totals with outstanding balance.
8. **CSV export** — click Download CSV on each report, confirm valid CSV file downloaded.
9. **Empty range** — select a date range with no data, confirm graceful empty state.
10. **Date boundaries** — confirm orders on the boundary dates are included.

---

## Definition of Done

- [ ] Sales summary report with total orders, revenue, average order value, shipped/cancelled counts
- [ ] Daily breakdown chart within selected date range
- [ ] Top products by units sold with revenue and order count
- [ ] Top customers by spending with order count and last order date
- [ ] Inventory turnover ratio per product
- [ ] Picking performance per user (items picked, orders, average time)
- [ ] Supplier spending with invoiced, paid, and outstanding per supplier
- [ ] All reports support date range filtering
- [ ] CSV export for every report type
- [ ] Reports page with tabbed interface and date range picker
