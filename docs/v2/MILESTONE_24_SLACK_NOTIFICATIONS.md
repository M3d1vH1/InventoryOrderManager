# Milestone 24 — Slack Integrations & Notifications

| Field | Value |
|-------|-------|
| **Step** | 24 of 25 |
| **Priority** | P2 |
| **Depends on** | Steps 8, 12 |
| **Estimated effort** | 1 day |

---

## Goal

Integrate with Slack to send real-time notifications for key business events: new orders, orders shipped, low stock alerts, daily summary reports, and system errors. Also implement an in-app notification system that persists notifications with read/unread status for users who aren't watching Slack.

---

## Implementation

### 1. Slack Service — `src/server/services/slackService.ts`

```ts
// src/server/services/slackService.ts
import { env } from "../lib/env.js";
import { logger } from "../lib/logger.js";

interface SlackMessage {
  channel?: string;
  text: string;
  blocks?: SlackBlock[];
}

interface SlackBlock {
  type: "section" | "divider" | "header" | "context";
  text?: { type: "mrkdwn" | "plain_text"; text: string };
  fields?: { type: "mrkdwn"; text: string }[];
}

const WEBHOOK_URL = env.SLACK_WEBHOOK_URL;

async function sendSlack(message: SlackMessage): Promise<boolean> {
  if (!WEBHOOK_URL) {
    logger.warn("Slack webhook not configured, skipping notification");
    return false;
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      logger.error("Slack notification failed", {
        status: response.status,
        body: await response.text(),
      });
      return false;
    }

    return true;
  } catch (err) {
    logger.error("Slack notification error", { error: (err as Error).message });
    return false;
  }
}

/* ── Pre-built notification templates ────────────────── */

export async function notifyNewOrder(order: {
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  itemCount: number;
  priority: string;
}) {
  const priorityEmoji = order.priority === "urgent" ? "🔴" : order.priority === "high" ? "🟡" : "🟢";

  return sendSlack({
    text: `New order: ${order.orderNumber}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${priorityEmoji} New Order: ${order.orderNumber}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Customer:*\n${order.customerName}` },
          { type: "mrkdwn", text: `*Amount:*\n€${order.totalAmount.toFixed(2)}` },
          { type: "mrkdwn", text: `*Items:*\n${order.itemCount}` },
          { type: "mrkdwn", text: `*Priority:*\n${order.priority}` },
        ],
      },
    ],
  });
}

export async function notifyOrderShipped(order: {
  orderNumber: string;
  customerName: string;
  trackingNumber?: string;
}) {
  return sendSlack({
    text: `Order shipped: ${order.orderNumber}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📦 *Order Shipped:* ${order.orderNumber}\n*Customer:* ${order.customerName}${order.trackingNumber ? `\n*Tracking:* ${order.trackingNumber}` : ""}`,
        },
      },
    ],
  });
}

export async function notifyLowStock(products: {
  name: string;
  sku: string;
  available: number;
  minLevel: number;
}[]) {
  if (products.length === 0) return false;

  const productList = products
    .map((p) => `• *${p.name}* (${p.sku}): ${p.available} left (min: ${p.minLevel})`)
    .join("\n");

  return sendSlack({
    text: `⚠️ Low stock alert: ${products.length} products`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `⚠️ Low Stock Alert` },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: productList },
      },
    ],
  });
}

export async function notifyDailySummary(stats: {
  ordersCreated: number;
  ordersShipped: number;
  revenue: number;
  pickingQueue: number;
  lowStockCount: number;
}) {
  return sendSlack({
    text: `Daily summary: ${stats.ordersCreated} orders, €${stats.revenue.toFixed(2)} revenue`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `📊 Daily Summary — ${new Date().toLocaleDateString("el-GR")}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Orders Created:*\n${stats.ordersCreated}` },
          { type: "mrkdwn", text: `*Orders Shipped:*\n${stats.ordersShipped}` },
          { type: "mrkdwn", text: `*Revenue:*\n€${stats.revenue.toFixed(2)}` },
          { type: "mrkdwn", text: `*Picking Queue:*\n${stats.pickingQueue}` },
        ],
      },
      stats.lowStockCount > 0 ? {
        type: "context",
        text: { type: "mrkdwn", text: `⚠️ ${stats.lowStockCount} products below minimum stock level` },
      } : { type: "divider" },
    ],
  });
}

export async function notifyError(error: {
  message: string;
  context?: string;
}) {
  return sendSlack({
    text: `❌ System Error: ${error.message}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `❌ *System Error*\n\`\`\`${error.message}\`\`\`${error.context ? `\n*Context:* ${error.context}` : ""}`,
        },
      },
    ],
  });
}
```

### 2. In-App Notifications — `src/server/routers/notifications.ts`

```ts
// src/server/routers/notifications.ts
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { notifications } from "../db/schema.js";

// Schema:
// notifications: id, user_id (FK), title, message, type, reference_id,
//   reference_type, read, created_at

export const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({
      unreadOnly: z.boolean().default(false),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [eq(notifications.userId, ctx.user.id)];
      if (input.unreadOnly) conditions.push(eq(notifications.read, false));

      return db.select().from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit);
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, ctx.user.id),
        eq(notifications.read, false),
      ));
    return result.count;
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await db.update(notifications)
        .set({ read: true })
        .where(and(
          eq(notifications.id, input.id),
          eq(notifications.userId, ctx.user.id),
        ));
      return { success: true };
    }),

  markAllRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      await db.update(notifications)
        .set({ read: true })
        .where(and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.read, false),
        ));
      return { success: true };
    }),
});

/**
 * Create an in-app notification for a specific user.
 * Called internally when events happen.
 */
export async function createNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: string;
  referenceId?: string;
  referenceType?: string;
}) {
  await db.insert(notifications).values({
    ...params,
    read: false,
  });
}
```

### 3. Scheduled Daily Summary — Cron Job

```ts
// src/server/jobs/dailySummary.ts
import cron from "node-cron";
import { notifyDailySummary, notifyLowStock } from "../services/slackService.js";
import { db } from "../db/index.js";
import { orders, products } from "../db/schema.js";
import { sql, eq, gte, and } from "drizzle-orm";

export function scheduleDailySummary() {
  // Run at 6 PM Greece time (UTC+2/+3)
  cron.schedule("0 18 * * *", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Gather stats
    const [created] = await db.select({ count: sql<number>`count(*)::int` })
      .from(orders).where(gte(orders.createdAt, today));
    const [shipped] = await db.select({ count: sql<number>`count(*)::int` })
      .from(orders).where(and(eq(orders.status, "shipped"), gte(orders.updatedAt, today)));
    const [revenue] = await db.select({ total: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)` })
      .from(orders).where(and(eq(orders.status, "shipped"), gte(orders.updatedAt, today)));
    const [queue] = await db.select({ count: sql<number>`count(DISTINCT order_id)::int` })
      .from(sql`order_items oi JOIN orders o ON oi.order_id = o.id`)
      .where(sql`oi.picked_at IS NULL AND o.status NOT IN ('shipped', 'cancelled')`);
    const lowStock = await db.select()
      .from(products)
      .where(sql`${products.currentStock} - ${products.reservedStock} <= ${products.minStockLevel}`);

    await notifyDailySummary({
      ordersCreated: created.count,
      ordersShipped: shipped.count,
      revenue: Number(revenue.total),
      pickingQueue: queue.count,
      lowStockCount: lowStock.length,
    });

    if (lowStock.length > 0) {
      await notifyLowStock(lowStock.map((p) => ({
        name: p.name,
        sku: p.sku,
        available: p.currentStock - p.reservedStock,
        minLevel: p.minStockLevel,
      })));
    }
  });
}
```

### 4. Frontend — Notification Bell

```tsx
// src/client/components/layout/NotificationBell.tsx
// - Bell icon in header with unread count badge
// - Click opens dropdown with recent notifications
// - Each notification links to reference (order, product, etc.)
// - "Mark all read" button
// - Auto-refresh unread count every 30 seconds
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/services/slackService.ts` | Slack webhook integration with message templates |
| `src/server/routers/notifications.ts` | In-app notifications: list, count, mark read |
| `src/server/jobs/dailySummary.ts` | Cron job for daily Slack summary at 6 PM |
| `src/client/components/layout/NotificationBell.tsx` | Header notification bell with dropdown |
| `src/client/components/layout/NotificationDropdown.tsx` | Notification list dropdown |

---

## Notification Events

| Event | Slack | In-App |
|-------|-------|--------|
| New order created | Yes | All admin/front_office users |
| Order shipped | Yes | Order creator |
| Low stock alert | Yes | All admin users |
| Daily summary | Yes (6 PM) | No |
| System error | Yes | Admin users |
| Invoice overdue | No | Admin/front_office users |
| Follow-up due | No | Assigned user |

---

## Verification

1. **Slack new order** — create an order, confirm Slack message with order details.
2. **Slack shipped** — ship an order, confirm Slack notification.
3. **Slack low stock** — reduce stock below min level, confirm Slack alert.
4. **Daily summary** — trigger daily summary cron, confirm comprehensive Slack message.
5. **In-app notification** — create an order, confirm notification appears for admin users.
6. **Unread count** — confirm bell badge shows correct count.
7. **Mark read** — click a notification, confirm it's marked as read and count decrements.
8. **Mark all read** — click "mark all", confirm all notifications marked read.
9. **Slack disabled** — unset webhook URL, confirm app continues working without errors.
10. **Error notification** — trigger a system error, confirm Slack receives error details.

---

## Definition of Done

- [ ] Slack webhook integration sends formatted messages (Block Kit)
- [ ] Notification templates for: new order, shipped, low stock, daily summary, error
- [ ] Daily summary cron job runs at 6 PM with key business metrics
- [ ] In-app notifications persist with read/unread status per user
- [ ] Notification bell in header shows unread count badge
- [ ] Notification dropdown lists recent notifications with links
- [ ] Mark individual or all notifications as read
- [ ] Graceful degradation when Slack webhook is not configured
- [ ] Notifications auto-refresh every 30 seconds
- [ ] Each notification links to its source record (order, product, etc.)
