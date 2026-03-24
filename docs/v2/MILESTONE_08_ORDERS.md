# Milestone 8 — Orders

| Field | Value |
|-------|-------|
| **Step** | 8 of 12 |
| **Priority** | P1 |
| **Depends on** | Steps 6, 7 |
| **Estimated effort** | 2.5 days |

---

## Goal

Deliver the complete order lifecycle: creation (with atomic stock reservation), status transitions, line item management, cancellation (with stock unreservation), and changelog tracking. This is the most complex milestone and the core of the V2 business logic — the `reservedStock` model is what prevents overselling.

**Order lifecycle:**
```
pending → picked → partially_shipped → shipped
   ↓
cancelled (from any pre-shipped state)
```

---

## Implementation

### 1. Service Layer — `src/server/services/orderService.ts`

Encapsulates the critical transactional logic so it can be reused across tRPC procedures and tested independently.

```ts
// src/server/services/orderService.ts
import { db } from "../db/index.js";
import { orders, orderItems, products, orderChangelog } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { PgTransaction } from "drizzle-orm/pg-core";

interface CreateOrderInput {
  customerId: string;
  priority: "normal" | "high" | "urgent";
  notes?: string;
  estimatedShippingDate?: Date;
  items: { productId: string; quantity: number }[];
  createdById: string;
}

/**
 * Atomically creates an order and reserves stock for all items.
 * If any product has insufficient available stock, the entire transaction
 * rolls back and returns which items failed.
 */
export async function createOrder(input: CreateOrderInput) {
  return db.transaction(async (tx) => {
    // 1. Generate order number (e.g., ORD-20260318-001)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(sql`DATE(${orders.createdAt}) = CURRENT_DATE`);
    const seq = String(Number(count) + 1).padStart(3, "0");
    const orderNumber = `ORD-${today}-${seq}`;

    // 2. Validate stock availability for ALL items before reserving
    const insufficientStock: { productId: string; name: string; requested: number; available: number }[] = [];

    for (const item of input.items) {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .for("update"); // Lock row to prevent race conditions

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Product ${item.productId} not found` });
      }

      const available = product.currentStock - product.reservedStock;
      if (available < item.quantity) {
        insufficientStock.push({
          productId: product.id,
          name: product.name,
          requested: item.quantity,
          available,
        });
      }
    }

    if (insufficientStock.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Insufficient stock for some items",
        cause: insufficientStock,
      });
    }

    // 3. Insert order
    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        customerId: input.customerId,
        status: "pending",
        priority: input.priority,
        notes: input.notes,
        estimatedShippingDate: input.estimatedShippingDate,
        createdById: input.createdById,
      })
      .returning();

    // 4. Insert items and reserve stock
    let totalAmount = 0;
    for (const item of input.items) {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, item.productId));

      const lineTotal = (product.unitPrice ?? 0) * item.quantity;
      totalAmount += lineTotal;

      await tx.insert(orderItems).values({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: product.unitPrice ?? 0,
        lineTotal,
      });

      // Reserve stock
      await tx
        .update(products)
        .set({
          reservedStock: sql`${products.reservedStock} + ${item.quantity}`,
        })
        .where(eq(products.id, item.productId));
    }

    // 5. Update total amount
    await tx
      .update(orders)
      .set({ totalAmount })
      .where(eq(orders.id, order.id));

    // 6. Create changelog entry
    await tx.insert(orderChangelog).values({
      orderId: order.id,
      action: "created",
      details: `Order created with ${input.items.length} items`,
      changedById: input.createdById,
    });

    return { ...order, orderNumber, totalAmount };
  });
}

/**
 * Cancels an order: unreserves all stock and sets status to cancelled.
 */
export async function cancelOrder(orderId: string, userId: string) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");

    if (!order) throw new TRPCError({ code: "NOT_FOUND" });
    if (order.status === "shipped" || order.status === "cancelled") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cannot cancel an order with status "${order.status}"`,
      });
    }

    // Get unpicked items and unreserve their stock
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    for (const item of items) {
      if (!item.pickedAt) {
        // Only unreserve unpicked items — picked items already deducted currentStock
        await tx
          .update(products)
          .set({
            reservedStock: sql`GREATEST(${products.reservedStock} - ${item.quantity}, 0)`,
          })
          .where(eq(products.id, item.productId));
      }
    }

    await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    await tx.insert(orderChangelog).values({
      orderId,
      action: "status_change",
      details: `Status changed from "${order.status}" to "cancelled"`,
      changedById: userId,
    });

    return { success: true };
  });
}
```

### 2. tRPC Router — `src/server/routers/orders.ts`

```ts
// src/server/routers/orders.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, gte, lte, ilike, sql, desc, asc } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { orders, orderItems, orderChangelog, products, customers } from "../db/schema.js";
import { createOrder, cancelOrder } from "../services/orderService.js";

const statusEnum = z.enum(["pending", "picked", "partially_shipped", "shipped", "cancelled"]);
const priorityEnum = z.enum(["normal", "high", "urgent"]);

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["picked", "cancelled"],
  picked: ["partially_shipped", "shipped", "cancelled"],
  partially_shipped: ["shipped", "cancelled"],
  shipped: [],
  cancelled: [],
};

export const ordersRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(20),
        status: statusEnum.optional(),
        priority: priorityEnum.optional(),
        customerId: z.string().uuid().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        search: z.string().optional(),
        sortBy: z.enum(["orderNumber", "createdAt", "totalAmount"]).default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ input }) => {
      const { page, perPage, status, priority, customerId, dateFrom, dateTo, search, sortBy, sortDir } = input;
      const offset = (page - 1) * perPage;

      const conditions = [];
      if (status) conditions.push(eq(orders.status, status));
      if (priority) conditions.push(eq(orders.priority, priority));
      if (customerId) conditions.push(eq(orders.customerId, customerId));
      if (dateFrom) conditions.push(gte(orders.createdAt, new Date(dateFrom)));
      if (dateTo) conditions.push(lte(orders.createdAt, new Date(dateTo)));
      if (search) {
        conditions.push(
          sql`(${orders.orderNumber} ILIKE ${"%" + search + "%"} OR ${customers.name} ILIKE ${"%" + search + "%"})`
        );
      }

      const where = conditions.length ? and(...conditions) : undefined;
      const orderCol = orders[sortBy] ?? orders.createdAt;
      const orderFn = sortDir === "desc" ? desc(orderCol) : asc(orderCol);

      const [rows, countResult] = await Promise.all([
        db
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            status: orders.status,
            priority: orders.priority,
            totalAmount: orders.totalAmount,
            createdAt: orders.createdAt,
            estimatedShippingDate: orders.estimatedShippingDate,
            customerName: customers.name,
            customerId: orders.customerId,
          })
          .from(orders)
          .leftJoin(customers, eq(orders.customerId, customers.id))
          .where(where)
          .orderBy(orderFn)
          .limit(perPage)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(orders)
          .leftJoin(customers, eq(orders.customerId, customers.id))
          .where(where),
      ]);

      return { items: rows, total: Number(countResult[0].count), page, perPage };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, input.id),
        with: {
          customer: true,
          items: { with: { product: true } },
          changelog: { orderBy: (c, { desc }) => [desc(c.createdAt)] },
          shippingDocument: true,
        },
      });
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      return order;
    }),

  create: protectedProcedure
    .input(
      z.object({
        customerId: z.string().uuid(),
        priority: priorityEnum.default("normal"),
        notes: z.string().optional(),
        estimatedShippingDate: z.string().datetime().optional(),
        items: z
          .array(
            z.object({
              productId: z.string().uuid(),
              quantity: z.number().int().min(1),
            })
          )
          .min(1, "At least one item is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return createOrder({
        ...input,
        estimatedShippingDate: input.estimatedShippingDate
          ? new Date(input.estimatedShippingDate)
          : undefined,
        createdById: ctx.user.id,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        priority: priorityEnum.optional(),
        notes: z.string().optional(),
        estimatedShippingDate: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const [updated] = await db
        .update(orders)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(orders.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      await db.insert(orderChangelog).values({
        orderId: id,
        action: "updated",
        details: `Order fields updated: ${Object.keys(data).join(", ")}`,
        changedById: ctx.user.id,
      });

      return updated;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: statusEnum,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.id));
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      const allowed = VALID_TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot transition from "${order.status}" to "${input.status}". Allowed: ${allowed.join(", ") || "none"}`,
        });
      }

      if (input.status === "cancelled") {
        return cancelOrder(input.id, ctx.user.id);
      }

      await db
        .update(orders)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(orders.id, input.id));

      await db.insert(orderChangelog).values({
        orderId: input.id,
        action: "status_change",
        details: `Status changed from "${order.status}" to "${input.status}"`,
        changedById: ctx.user.id,
      });

      return { success: true };
    }),

  addItem: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        productId: z.string().uuid(),
        quantity: z.number().int().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return db.transaction(async (tx) => {
        const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId));
        if (!order) throw new TRPCError({ code: "NOT_FOUND" });
        if (order.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Can only add items to pending orders" });
        }

        const [product] = await tx.select().from(products).where(eq(products.id, input.productId)).for("update");
        if (!product) throw new TRPCError({ code: "NOT_FOUND" });

        const available = product.currentStock - product.reservedStock;
        if (available < input.quantity) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Only ${available} available` });
        }

        const lineTotal = (product.unitPrice ?? 0) * input.quantity;

        await tx.insert(orderItems).values({
          orderId: input.orderId,
          productId: input.productId,
          quantity: input.quantity,
          unitPrice: product.unitPrice ?? 0,
          lineTotal,
        });

        await tx.update(products).set({
          reservedStock: sql`${products.reservedStock} + ${input.quantity}`,
        }).where(eq(products.id, input.productId));

        await tx.update(orders).set({
          totalAmount: sql`${orders.totalAmount} + ${lineTotal}`,
          updatedAt: new Date(),
        }).where(eq(orders.id, input.orderId));

        await tx.insert(orderChangelog).values({
          orderId: input.orderId,
          action: "item_added",
          details: `Added ${input.quantity}x ${product.name}`,
          changedById: ctx.user.id,
        });
      });
    }),

  removeItem: protectedProcedure
    .input(z.object({ orderItemId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return db.transaction(async (tx) => {
        const [item] = await tx.select().from(orderItems).where(eq(orderItems.id, input.orderItemId));
        if (!item) throw new TRPCError({ code: "NOT_FOUND" });

        const [order] = await tx.select().from(orders).where(eq(orders.id, item.orderId));
        if (order.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Can only remove items from pending orders" });
        }

        // Unreserve stock
        await tx.update(products).set({
          reservedStock: sql`GREATEST(${products.reservedStock} - ${item.quantity}, 0)`,
        }).where(eq(products.id, item.productId));

        // Update order total
        await tx.update(orders).set({
          totalAmount: sql`${orders.totalAmount} - ${item.lineTotal}`,
          updatedAt: new Date(),
        }).where(eq(orders.id, item.orderId));

        await tx.delete(orderItems).where(eq(orderItems.id, input.orderItemId));

        await tx.insert(orderChangelog).values({
          orderId: item.orderId,
          action: "item_removed",
          details: `Removed item`,
          changedById: ctx.user.id,
        });
      });
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => cancelOrder(input.id, ctx.user.id)),

  getChangelog: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(({ input }) =>
      db
        .select()
        .from(orderChangelog)
        .where(eq(orderChangelog.orderId, input.orderId))
        .orderBy(desc(orderChangelog.createdAt))
    ),
});
```

### 3. Frontend — New Order Page

```tsx
// src/client/routes/_auth/orders/new.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { trpc } from "@/lib/trpc";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineItemEditor } from "@/components/orders/LineItemEditor";
import { QuickCreateCustomerPopover } from "@/components/customers/QuickCreateCustomerPopover";
import { CustomerCombobox } from "@/components/orders/CustomerCombobox";

export const Route = createFileRoute("/_auth/orders/new")({
  component: NewOrderPage,
});

interface LineItem {
  productId: string;
  productName: string;
  quantity: number;
  available: number;
  unitPrice: number;
}

function NewOrderPage() {
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState<string>("");
  const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
  const [notes, setNotes] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);

  const createMutation = trpc.orders.create.useMutation({
    onSuccess: (order) => {
      navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
    },
  });

  const handleSubmit = () => {
    if (!customerId || items.length === 0) return;

    createMutation.mutate({
      customerId,
      priority,
      notes: notes || undefined,
      estimatedShippingDate: estimatedDate || undefined,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });
  };

  return (
    <PageShell title="New Order">
      <div className="max-w-3xl space-y-6">
        {/* Customer selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Customer *</label>
          <div className="flex gap-2 items-center">
            <CustomerCombobox value={customerId} onChange={setCustomerId} />
            <QuickCreateCustomerPopover
              onCreated={(c) => setCustomerId(c.id)}
            />
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Priority</label>
          <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Line items */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Items *</label>
          <LineItemEditor items={items} onChange={setItems} />
        </div>

        {/* Estimated shipping date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Estimated Shipping Date</label>
          <Input type="date" value={estimatedDate} onChange={(e) => setEstimatedDate(e.target.value)} className="w-48" />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>

        {/* Error display */}
        {createMutation.error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800 text-sm">
            {createMutation.error.message}
          </div>
        )}

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={!customerId || items.length === 0 || createMutation.isPending} size="lg">
          {createMutation.isPending ? "Creating Order..." : "Create Order"}
        </Button>
      </div>
    </PageShell>
  );
}
```

### 4. Key Components

```tsx
// src/client/components/orders/LineItemEditor.tsx
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCombobox } from "./ProductCombobox";
import { Trash2, AlertTriangle } from "lucide-react";

interface LineItem {
  productId: string;
  productName: string;
  quantity: number;
  available: number;
  unitPrice: number;
}

interface Props {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
}

export function LineItemEditor({ items, onChange }: Props) {
  const addItem = (product: { id: string; name: string; availableStock: number; unitPrice: number }) => {
    if (items.some((i) => i.productId === product.id)) return; // no dupes
    onChange([
      ...items,
      {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        available: product.availableStock,
        unitPrice: product.unitPrice,
      },
    ]);
  };

  const updateQuantity = (idx: number, qty: number) => {
    const next = [...items];
    next[idx] = { ...next[idx], quantity: Math.max(1, qty) };
    onChange(next);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <ProductCombobox onSelect={addItem} />

      {items.map((item, idx) => (
        <div key={item.productId} className="flex items-center gap-3 p-3 border rounded-md">
          <div className="flex-1">
            <p className="font-medium">{item.productName}</p>
            <p className="text-sm text-muted-foreground">
              Available: {item.available}
              {item.quantity > item.available && (
                <span className="text-red-600 ml-2">
                  <AlertTriangle className="inline h-3 w-3" /> Exceeds stock
                </span>
              )}
            </p>
          </div>
          <Input
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => updateQuantity(idx, parseInt(e.target.value) || 1)}
            className="w-20 text-center"
          />
          <span className="text-sm w-20 text-right">
            {(item.unitPrice * item.quantity).toFixed(2)}
          </span>
          <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ))}

      {items.length > 0 && (
        <div className="text-right font-semibold">
          Total: {items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0).toFixed(2)}
        </div>
      )}
    </div>
  );
}
```

```tsx
// src/client/components/orders/OrderStatusBadge.tsx
import { Badge } from "@/components/ui/badge";

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  picked: "bg-blue-100 text-blue-800",
  partially_shipped: "bg-purple-100 text-purple-800",
  shipped: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={statusStyles[status] ?? "bg-gray-100"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
```

```tsx
// src/client/components/orders/OrderTimeline.tsx
import { formatDistanceToNow } from "date-fns";

interface ChangelogEntry {
  id: string;
  action: string;
  details: string;
  createdAt: string;
}

export function OrderTimeline({ entries }: { entries: ChangelogEntry[] }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Activity Log</h3>
      <div className="relative border-l-2 border-muted pl-6 space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="relative">
            <div className="absolute -left-[31px] w-4 h-4 bg-background border-2 border-primary rounded-full" />
            <p className="text-sm font-medium">{entry.action.replace(/_/g, " ")}</p>
            <p className="text-sm text-muted-foreground">{entry.details}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/services/orderService.ts` | Core transaction logic: createOrder, cancelOrder |
| `src/server/routers/orders.ts` | tRPC router: CRUD, status transitions, item management |
| `src/client/routes/_auth/orders/index.tsx` | Order list with status tabs, search, filters |
| `src/client/routes/_auth/orders/new.tsx` | New order form (full page) |
| `src/client/routes/_auth/orders/$orderId.tsx` | Order detail: view/edit, items, timeline, shipping doc |
| `src/client/components/orders/OrderStatusBadge.tsx` | Colored status badge |
| `src/client/components/orders/LineItemEditor.tsx` | Add/remove products with quantity and stock display |
| `src/client/components/orders/OrderTimeline.tsx` | Changelog visualization |
| `src/client/components/orders/ProductCombobox.tsx` | Searchable product selector for line items |
| `src/client/components/orders/CustomerCombobox.tsx` | Searchable customer selector |

---

## Verification

1. **Create order** — create an order with 2 items, confirm `reservedStock` increases on both products.
2. **Insufficient stock** — attempt to order more than available, confirm transaction rolls back with specific item errors.
3. **Race condition** — send two concurrent order creation requests for the same scarce product, confirm only one succeeds (SELECT FOR UPDATE prevents overselling).
4. **Add item** — add a new line item to a pending order, confirm stock reserved.
5. **Remove item** — remove a line item, confirm stock unreserved and order total recalculated.
6. **Cancel** — cancel a pending order, confirm all unpicked item stock is unreserved.
7. **Status transition** — try to move from "shipped" to "pending", confirm error. Move pending->picked, confirm success.
8. **Changelog** — after multiple operations, confirm the changelog lists every change with timestamp.
9. **List page** — filter by status tab, search by order number, confirm pagination.
10. **New order page** — select customer (or quick-create), add items, see real-time stock availability, submit.

---

## Definition of Done

- [ ] `createOrder` atomically inserts order + items + reserves stock in a single transaction
- [ ] Insufficient stock causes full rollback with per-item error details
- [ ] `SELECT FOR UPDATE` prevents race conditions on concurrent orders
- [ ] `cancelOrder` unreserves stock for all unpicked items
- [ ] Status transitions are validated (only valid forward transitions allowed)
- [ ] `addItem` / `removeItem` correctly update `reservedStock` and order total
- [ ] Every mutation creates a changelog entry
- [ ] Order list page has status tabs, search, date range filter, pagination
- [ ] New order page has customer combobox + quick-create, line item editor with real-time stock, priority selector
- [ ] Order detail page shows items, status actions, changelog timeline
