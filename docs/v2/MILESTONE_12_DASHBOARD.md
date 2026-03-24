# Milestone 12 — Dashboard

| Field | Value |
|-------|-------|
| **Step** | 12 of 12 |
| **Priority** | P1 |
| **Depends on** | Steps 6–11 |
| **Estimated effort** | 1.5 days |

---

## Goal

Build a real-time dashboard that gives office staff and managers an at-a-glance view of operations: orders pending/shipped today, picking queue depth, low-stock alerts, recent activity, and key metrics. The dashboard auto-refreshes and serves as the landing page after login.

---

## Implementation

### 1. tRPC Router — `src/server/routers/dashboard.ts`

```ts
// src/server/routers/dashboard.ts
import { sql, eq, and, gte, lte, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import {
  orders, orderItems, products, customers, inventoryChanges, orderChangelog,
} from "../db/schema.js";

export const dashboardRouter = router({
  stats: protectedProcedure.query(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      orderStats,
      todayOrders,
      todayShipped,
      pickingQueue,
      lowStockCount,
      totalProducts,
      totalCustomers,
      revenueToday,
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
          gte(orders.updatedAt, today),
        )),

      // Orders waiting to be picked (have unpicked items)
      db.select({ count: sql<number>`count(DISTINCT ${orderItems.orderId})::int` })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(
          sql`${orderItems.pickedAt} IS NULL`,
          sql`${orders.status} NOT IN ('shipped', 'cancelled')`,
        )),

      // Products below minimum stock
      db.select({ count: sql<number>`count(*)::int` })
        .from(products)
        .where(sql`${products.currentStock} - ${products.reservedStock} <= ${products.minStockLevel}`),

      // Total active products
      db.select({ count: sql<number>`count(*)::int` }).from(products),

      // Total customers
      db.select({ count: sql<number>`count(*)::int` }).from(customers),

      // Revenue today (shipped orders)
      db.select({ total: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)` })
        .from(orders)
        .where(and(
          eq(orders.status, "shipped"),
          gte(orders.updatedAt, today),
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
        revenue: Number(revenueToday[0].total),
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
        id: orderChangelog.id,
        orderId: orderChangelog.orderId,
        action: orderChangelog.action,
        details: orderChangelog.details,
        createdAt: orderChangelog.createdAt,
        orderNumber: orders.orderNumber,
      })
      .from(orderChangelog)
      .innerJoin(orders, eq(orderChangelog.orderId, orders.id))
      .orderBy(desc(orderChangelog.createdAt))
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
        COUNT(*) FILTER (WHERE status = 'shipped')::int as shipped
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '14 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
    return rows.rows;
  }),
});
```

### 2. Frontend — Dashboard Page

```tsx
// src/client/routes/_auth/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc";
import { PageShell } from "@/components/layout/PageShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { LowStockAlerts } from "@/components/dashboard/LowStockAlerts";
import { OrdersTrendChart } from "@/components/dashboard/OrdersTrendChart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart, PackageCheck, Truck, AlertTriangle,
  Users, Package, TrendingUp, ClipboardList,
} from "lucide-react";

export const Route = createFileRoute("/_auth/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery(undefined, {
    refetchInterval: 30_000, // Refresh every 30s
  });
  const { data: activity } = trpc.dashboard.recentActivity.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  const { data: lowStock } = trpc.dashboard.lowStockProducts.useQuery();
  const { data: trend } = trpc.dashboard.ordersTrend.useQuery();

  if (isLoading) {
    return (
      <PageShell title="Dashboard">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Dashboard">
      {/* KPI Cards — top row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Orders Today"
          value={stats?.today.newOrders ?? 0}
          icon={ShoppingCart}
          href="/orders"
        />
        <StatCard
          title="Shipped Today"
          value={stats?.today.shipped ?? 0}
          icon={Truck}
          variant="success"
        />
        <StatCard
          title="Picking Queue"
          value={stats?.pickingQueueDepth ?? 0}
          icon={ClipboardList}
          variant={stats?.pickingQueueDepth ? "warning" : "default"}
          href="/picking"
        />
        <StatCard
          title="Revenue Today"
          value={`€${(stats?.today.revenue ?? 0).toLocaleString("el-GR", { minimumFractionDigits: 2 })}`}
          icon={TrendingUp}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="Pending Orders" value={stats?.orders.pending ?? 0} icon={ShoppingCart} href="/orders?status=pending" />
        <StatCard title="Low Stock Alerts" value={stats?.lowStockAlerts ?? 0} icon={AlertTriangle} variant={stats?.lowStockAlerts ? "destructive" : "default"} />
        <StatCard title="Total Products" value={stats?.totalProducts ?? 0} icon={Package} href="/products" />
        <StatCard title="Total Customers" value={stats?.totalCustomers ?? 0} icon={Users} href="/customers" />
      </div>

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <OrdersTrendChart data={trend ?? []} />
        </div>
        <div className="space-y-6">
          <LowStockAlerts products={lowStock ?? []} />
          <RecentActivity entries={activity ?? []} />
        </div>
      </div>
    </PageShell>
  );
}
```

### 3. Key Components

```tsx
// src/client/components/dashboard/StatCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  value: number | string;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "destructive";
  href?: string;
}

const variantStyles = {
  default: "text-primary",
  success: "text-green-600",
  warning: "text-yellow-600",
  destructive: "text-red-600",
};

export function StatCard({ title, value, icon: Icon, variant = "default", href }: Props) {
  const Wrapper = href ? "a" : "div";
  return (
    <Wrapper href={href}>
      <Card className={cn("hover:shadow-md transition-shadow", href && "cursor-pointer")}>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={cn("p-2 rounded-lg bg-muted", variantStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </CardContent>
      </Card>
    </Wrapper>
  );
}
```

```tsx
// src/client/components/dashboard/LowStockAlerts.tsx
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  reservedStock: number;
  minStockLevel: number;
}

export function LowStockAlerts({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          Low Stock ({products.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {products.map((p) => {
          const available = p.currentStock - p.reservedStock;
          return (
            <a key={p.id} href={`/products/${p.id}`} className="flex items-center justify-between py-1 hover:bg-muted rounded px-2 -mx-2">
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.sku}</p>
              </div>
              <Badge variant={available <= 0 ? "destructive" : "outline"}>
                {available} left
              </Badge>
            </a>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

```tsx
// src/client/components/dashboard/RecentActivity.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

interface Entry {
  id: string;
  orderNumber: string;
  action: string;
  details: string;
  createdAt: string;
}

export function RecentActivity({ entries }: { entries: Entry[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.slice(0, 10).map((entry) => (
          <div key={entry.id} className="border-l-2 border-muted pl-3 py-1">
            <p className="text-sm">
              <span className="font-mono text-xs">{entry.orderNumber}</span>{" "}
              — {entry.details}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

```tsx
// src/client/components/dashboard/OrdersTrendChart.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DataPoint {
  date: string;
  total: number;
  shipped: number;
}

export function OrdersTrendChart({ data }: { data: DataPoint[] }) {
  const maxValue = Math.max(...data.map((d) => d.total), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Orders — Last 14 Days</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-1 h-40">
          {data.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center">
                <div
                  className="w-full bg-primary/20 rounded-t relative"
                  style={{ height: `${(d.total / maxValue) * 120}px` }}
                >
                  <div
                    className="absolute bottom-0 w-full bg-primary rounded-t"
                    style={{ height: `${(d.shipped / maxValue) * 120}px` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(d.date).getDate()}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-primary/20 rounded" /> Total
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 bg-primary rounded" /> Shipped
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/routers/dashboard.ts` | tRPC router: stats, recentActivity, lowStock, ordersTrend |
| `src/client/routes/_auth/index.tsx` | Dashboard landing page |
| `src/client/components/dashboard/StatCard.tsx` | KPI card with icon and optional link |
| `src/client/components/dashboard/LowStockAlerts.tsx` | Low stock product list |
| `src/client/components/dashboard/RecentActivity.tsx` | Recent order changelog feed |
| `src/client/components/dashboard/OrdersTrendChart.tsx` | Simple bar chart (CSS-only, no chart library) |

---

## Verification

1. **Stats load** — open dashboard, confirm all 8 KPI cards display correct counts.
2. **Today's orders** — create an order, confirm "Orders Today" increments.
3. **Revenue** — ship an order, confirm "Revenue Today" updates.
4. **Picking queue** — confirm depth matches the number of orders with unpicked items.
5. **Low stock alerts** — set a product's stock below minStockLevel, confirm it appears in the alert list.
6. **Recent activity** — perform order operations, confirm they appear in the activity feed.
7. **Orders trend** — confirm bar chart shows data for the last 14 days.
8. **Auto-refresh** — leave dashboard open, ship an order from another tab, confirm stats update within 30 seconds.
9. **Card links** — click "Orders Today" card, confirm navigation to orders list.
10. **Empty state** — on a fresh database, confirm dashboard renders gracefully with zero values.

---

## Definition of Done

- [ ] `dashboard.stats` aggregates all key metrics in a single optimized query batch
- [ ] KPI cards show: orders today, shipped today, picking queue depth, revenue, pending orders, low stock, products, customers
- [ ] Low stock alert list shows products where available stock <= minStockLevel
- [ ] Recent activity feed shows last 20 order changelog entries with relative timestamps
- [ ] Orders trend bar chart shows total vs shipped per day for 14 days (CSS-only rendering)
- [ ] Dashboard auto-refreshes every 30 seconds
- [ ] Revenue displays in EUR with Greek locale formatting
- [ ] Stat cards link to relevant pages where applicable
- [ ] Loading skeletons display during initial fetch
- [ ] Dashboard is the landing page after login (`/_auth/` route)
