# Milestone 9 — Order Picking

| Field | Value |
|-------|-------|
| **Step** | 9 of 12 |
| **Priority** | P1 |
| **Depends on** | Step 8 |
| **Estimated effort** | 2 days |

---

## Goal

Deliver a mobile-first picking interface designed for warehouse workers using tablets. When a picker confirms an item, `reservedStock` decreases and `currentStock` decreases — this is the moment physical stock leaves the shelf. The picking flow uses a card-based UI (not a table), supports partial picks, quality checks, and batch picking across multiple orders.

**Stock model during picking:**
```
Order created  → reservedStock += qty
Item picked    → reservedStock -= qty, currentStock -= qty
Order cancelled → reservedStock -= qty (unpicked items only)
```

---

## Implementation

### 1. Service Layer — `src/server/services/pickingService.ts`

```ts
// src/server/services/pickingService.ts
import { db } from "../db/index.js";
import {
  orders, orderItems, products, inventoryChanges, orderChangelog,
} from "../db/schema.js";
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

interface PickItemInput {
  orderItemId: string;
  pickedQuantity: number;
  qualityStatus?: "ok" | "damaged" | "short";
  qualityNotes?: string;
  pickedById: string;
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
      throw new TRPCError({ code: "BAD_REQUEST", message: "Order is not in a pickable state" });
    }

    const [product] = await tx
      .select()
      .from(products)
      .where(eq(products.id, item.productId))
      .for("update");

    if (!product) throw new TRPCError({ code: "NOT_FOUND" });

    const actualQty = input.pickedQuantity;

    // Deduct physical stock and release reservation
    await tx.update(products).set({
      currentStock: sql`${products.currentStock} - ${actualQty}`,
      reservedStock: sql`GREATEST(${products.reservedStock} - ${item.quantity}, 0)`,
      updatedAt: new Date(),
    }).where(eq(products.id, item.productId));

    // Record inventory change
    await tx.insert(inventoryChanges).values({
      productId: item.productId,
      quantityChange: -actualQty,
      newQuantity: product.currentStock - actualQty,
      reason: "picked",
      notes: `Order ${order.orderNumber}, item picked`,
      changedById: input.pickedById,
    });

    // Mark item as picked
    await tx.update(orderItems).set({
      pickedAt: new Date(),
      pickedById: input.pickedById,
      pickedQuantity: actualQty,
      qualityStatus: input.qualityStatus ?? "ok",
      qualityNotes: input.qualityNotes,
    }).where(eq(orderItems.id, input.orderItemId));

    // Check if all items in the order are picked
    const unpicked = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(and(eq(orderItems.orderId, item.orderId), isNull(orderItems.pickedAt)));

    if (unpicked.length === 0) {
      // All items picked — transition order to "picked"
      await tx.update(orders).set({ status: "picked", updatedAt: new Date() })
        .where(eq(orders.id, item.orderId));

      await tx.insert(orderChangelog).values({
        orderId: item.orderId,
        action: "status_change",
        details: 'All items picked — status changed to "picked"',
        changedById: input.pickedById,
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
    orderBy: (o, { asc, desc }) => [
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
```

### 2. tRPC Router — `src/server/routers/picking.ts`

```ts
// src/server/routers/picking.ts
import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { pickItem, getPickingQueue } from "../services/pickingService.js";

export const pickingRouter = router({
  queue: protectedProcedure.query(() => getPickingQueue()),

  pickItem: protectedProcedure
    .input(
      z.object({
        orderItemId: z.string().uuid(),
        pickedQuantity: z.number().int().min(0),
        qualityStatus: z.enum(["ok", "damaged", "short"]).default("ok"),
        qualityNotes: z.string().optional(),
      })
    )
    .mutation(({ input, ctx }) =>
      pickItem({ ...input, pickedById: ctx.user.id })
    ),

  pickAll: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Convenience: pick all unpicked items in an order at full quantity
      const queue = await getPickingQueue();
      const order = queue.find((o) => o.id === input.orderId);
      if (!order) return { picked: 0 };

      let picked = 0;
      for (const item of order.unpickedItems) {
        await pickItem({
          orderItemId: item.id,
          pickedQuantity: item.quantity,
          pickedById: ctx.user.id,
        });
        picked++;
      }
      return { picked };
    }),
});
```

### 3. Frontend — Picking Queue Page (Mobile-First)

```tsx
// src/client/routes/_auth/picking/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc";
import { PageShell } from "@/components/layout/PageShell";
import { PickingCard } from "@/components/picking/PickingCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_auth/picking/")({
  component: PickingPage,
});

function PickingPage() {
  const { data: queue, isLoading } = trpc.picking.queue.useQuery(undefined, {
    refetchInterval: 10_000, // Auto-refresh every 10s
  });

  const urgentCount = queue?.filter((o) => o.priority === "urgent").length ?? 0;

  return (
    <PageShell title="Picking Queue">
      {urgentCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <Badge variant="destructive">{urgentCount} urgent</Badge>
          <span className="text-sm text-red-700">orders need immediate attention</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {queue?.map((order) => (
            <PickingCard key={order.id} order={order} />
          ))}
          {queue?.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              No orders waiting to be picked
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
```

### 4. Key Components

```tsx
// src/client/components/picking/PickingCard.tsx
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { PickItemDialog } from "./PickItemDialog";
import { CheckCircle, Package, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface PickingOrder {
  id: string;
  orderNumber: string;
  priority: string;
  customer: { name: string };
  totalItems: number;
  pickedItems: number;
  unpickedItems: Array<{
    id: string;
    quantity: number;
    product: { name: string; sku: string; currentStock: number };
  }>;
}

export function PickingCard({ order }: { order: PickingOrder }) {
  const [expanded, setExpanded] = useState(false);
  const [pickingItem, setPickingItem] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const pickAllMutation = trpc.picking.pickAll.useMutation({
    onSuccess: () => utils.picking.queue.invalidate(),
  });

  const progress = order.totalItems > 0
    ? Math.round((order.pickedItems / order.totalItems) * 100)
    : 0;

  return (
    <Card className={cn(
      order.priority === "urgent" && "border-red-300 bg-red-50/50",
      order.priority === "high" && "border-yellow-300 bg-yellow-50/50",
    )}>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono font-semibold">{order.orderNumber}</span>
            <span className="ml-2 text-muted-foreground">{order.customer.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {order.priority !== "normal" && (
              <Badge variant={order.priority === "urgent" ? "destructive" : "default"}>
                {order.priority}
              </Badge>
            )}
            <span className="text-sm">{order.pickedItems}/{order.totalItems}</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full mt-2">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {order.unpickedItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-background rounded-md border">
              <div>
                <p className="font-medium">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">
                  SKU: {item.product.sku} · Pick: {item.quantity} units
                </p>
              </div>
              <Button size="sm" onClick={() => setPickingItem(item.id)}>
                <CheckCircle className="h-4 w-4 mr-1" /> Pick
              </Button>
            </div>
          ))}

          {order.unpickedItems.length > 1 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => pickAllMutation.mutate({ orderId: order.id })}
              disabled={pickAllMutation.isPending}
            >
              <Package className="h-4 w-4 mr-2" />
              {pickAllMutation.isPending ? "Picking all..." : "Pick All Items"}
            </Button>
          )}

          {pickingItem && (
            <PickItemDialog
              orderItemId={pickingItem}
              open={!!pickingItem}
              onClose={() => setPickingItem(null)}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}
```

```tsx
// src/client/components/picking/PickItemDialog.tsx
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function PickItemDialog({
  orderItemId, open, onClose,
}: {
  orderItemId: string; open: boolean; onClose: () => void;
}) {
  const [qualityStatus, setQualityStatus] = useState<"ok" | "damaged" | "short">("ok");
  const [qualityNotes, setQualityNotes] = useState("");
  const [pickedQuantity, setPickedQuantity] = useState<number | undefined>();
  const utils = trpc.useUtils();

  const mutation = trpc.picking.pickItem.useMutation({
    onSuccess: () => {
      utils.picking.queue.invalidate();
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirm Pick</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Picked Quantity</label>
            <Input
              type="number"
              min={0}
              value={pickedQuantity ?? ""}
              onChange={(e) => setPickedQuantity(parseInt(e.target.value) || 0)}
              placeholder="Enter quantity picked"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Quality Check</label>
            <Select value={qualityStatus} onValueChange={(v) => setQualityStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ok">OK — Good condition</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="short">Short — Not enough on shelf</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {qualityStatus !== "ok" && (
            <Textarea
              value={qualityNotes}
              onChange={(e) => setQualityNotes(e.target.value)}
              placeholder="Describe the issue..."
              rows={2}
            />
          )}
          <Button
            className="w-full"
            onClick={() => mutation.mutate({
              orderItemId,
              pickedQuantity: pickedQuantity ?? 0,
              qualityStatus,
              qualityNotes: qualityNotes || undefined,
            })}
            disabled={mutation.isPending || pickedQuantity === undefined}
          >
            {mutation.isPending ? "Confirming..." : "Confirm Pick"}
          </Button>
          {mutation.error && (
            <p className="text-red-600 text-sm">{mutation.error.message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/services/pickingService.ts` | Core picking logic: pickItem, getPickingQueue |
| `src/server/routers/picking.ts` | tRPC router: queue, pickItem, pickAll |
| `src/client/routes/_auth/picking/index.tsx` | Picking queue page (mobile-first card layout) |
| `src/client/components/picking/PickingCard.tsx` | Expandable order card with item list and progress bar |
| `src/client/components/picking/PickItemDialog.tsx` | Individual pick confirmation with quality check |

---

## Verification

1. **Picking queue** — load `/picking`, confirm only orders with unpicked items appear, sorted by priority.
2. **Pick single item** — click Pick on an item, confirm `currentStock` decreases, `reservedStock` decreases, `inventoryChanges` row created.
3. **Pick all** — click "Pick All Items", confirm all items marked as picked and order transitions to "picked".
4. **Partial pick** — enter a picked quantity less than ordered, confirm the short quantity is recorded.
5. **Quality check** — pick an item with "damaged" status and notes, confirm quality fields are stored.
6. **Auto-transition** — pick the last unpicked item in an order, confirm order status changes to "picked".
7. **Already picked** — attempt to pick an already-picked item, confirm error.
8. **Cancelled order** — attempt to pick an item from a cancelled order, confirm error.
9. **Auto-refresh** — leave the picking page open, create a new order from another tab, confirm it appears within 10 seconds.
10. **Mobile layout** — open `/picking` on a narrow viewport (tablet), confirm cards are full-width and touch-friendly.

---

## Definition of Done

- [ ] `pickItem` atomically deducts `currentStock`, releases `reservedStock`, and records `inventoryChanges`
- [ ] `getPickingQueue` returns only orders with unpicked items, sorted by priority then date
- [ ] Picking the last item in an order automatically transitions status to "picked"
- [ ] Partial picks are supported (picked quantity can differ from ordered quantity)
- [ ] Quality check (ok/damaged/short) is recorded per item
- [ ] "Pick All" convenience action picks all remaining items in an order
- [ ] Picking queue auto-refreshes every 10 seconds
- [ ] Cards show progress bar, priority badges, and expand to reveal item list
- [ ] Mobile-first layout works on tablets (768px viewport)
- [ ] Already-picked items and non-pickable orders are rejected with clear errors
