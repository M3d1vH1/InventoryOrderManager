# Milestone 6 — Products & Inventory

| Field | Value |
|-------|-------|
| **Step** | 6 of 12 |
| **Priority** | P1 |
| **Depends on** | Steps 1–5 |
| **Estimated effort** | 2 days |

---

## Goal

Deliver full product CRUD, category/tag management, and manual stock adjustment with inventory change tracking. This milestone surfaces the V2 dual-stock model (`currentStock` / `reservedStock`) throughout the UI so that warehouse staff always see the true *available* quantity (`currentStock - reservedStock`). It also provides a bulk stock-count import via CSV.

---

## Implementation

### 1. tRPC Router — `src/server/routers/products.ts`

```ts
// src/server/routers/products.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, ilike, and, sql, desc, asc, inArray } from "drizzle-orm";
import {
  router,
  publicProcedure,
  protectedProcedure,
  adminProcedure,
} from "../trpc.js";
import { db } from "../db/index.js";
import {
  products,
  categories,
  tags,
  productTags,
  inventoryChanges,
} from "../db/schema.js";

/* ── Zod Schemas ────────────────────────────────────── */

const productCreateInput = z.object({
  name: z.string().min(1).max(255),
  sku: z.string().min(1).max(100),
  barcode: z.string().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().optional(),
  currentStock: z.number().int().min(0).default(0),
  minStockLevel: z.number().int().min(0).default(0),
  unitPrice: z.number().min(0).optional(),
  imageUrl: z.string().url().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

const productUpdateInput = productCreateInput.partial().extend({
  id: z.string().uuid(),
  tagIds: z.array(z.string().uuid()).optional(),
});

const listInput = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  tagId: z.string().uuid().optional(),
  stockStatus: z.enum(["all", "in_stock", "low_stock", "out_of_stock"]).default("all"),
  sortBy: z.enum(["name", "sku", "currentStock", "createdAt"]).default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

const stockAdjustInput = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int(), // positive = add, negative = subtract
  reason: z.enum([
    "manual_count",
    "damaged",
    "returned",
    "received",
    "correction",
    "other",
  ]),
  notes: z.string().optional(),
});

/* ── Router ─────────────────────────────────────────── */

export const productsRouter = router({
  list: protectedProcedure.input(listInput).query(async ({ input }) => {
    const { page, perPage, search, categoryId, stockStatus, sortBy, sortDir } = input;
    const offset = (page - 1) * perPage;

    const conditions = [];
    if (search) {
      conditions.push(
        sql`(${products.name} ILIKE ${"%" + search + "%"} OR ${products.sku} ILIKE ${"%" + search + "%"})`
      );
    }
    if (categoryId) conditions.push(eq(products.categoryId, categoryId));
    if (stockStatus === "out_of_stock")
      conditions.push(eq(products.currentStock, 0));
    if (stockStatus === "low_stock")
      conditions.push(
        sql`${products.currentStock} > 0 AND ${products.currentStock} <= ${products.minStockLevel}`
      );
    if (stockStatus === "in_stock")
      conditions.push(sql`${products.currentStock} > ${products.minStockLevel}`);

    const where = conditions.length ? and(...conditions) : undefined;
    const orderCol = products[sortBy] ?? products.name;
    const orderFn = sortDir === "desc" ? desc(orderCol) : asc(orderCol);

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          barcode: products.barcode,
          currentStock: products.currentStock,
          reservedStock: products.reservedStock,
          minStockLevel: products.minStockLevel,
          unitPrice: products.unitPrice,
          imageUrl: products.imageUrl,
          categoryId: products.categoryId,
          categoryName: categories.name,
          createdAt: products.createdAt,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(where)
        .orderBy(orderFn)
        .limit(perPage)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(products).where(where),
    ]);

    return {
      items: rows.map((r) => ({
        ...r,
        availableStock: r.currentStock - r.reservedStock,
      })),
      total: Number(countResult[0].count),
      page,
      perPage,
    };
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const product = await db.query.products.findFirst({
        where: eq(products.id, input.id),
        with: { category: true, productTags: { with: { tag: true } } },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND" });

      const history = await db
        .select()
        .from(inventoryChanges)
        .where(eq(inventoryChanges.productId, input.id))
        .orderBy(desc(inventoryChanges.createdAt))
        .limit(50);

      return {
        ...product,
        availableStock: product.currentStock - product.reservedStock,
        inventoryHistory: history,
      };
    }),

  create: protectedProcedure // admin + front_office
    .input(productCreateInput)
    .mutation(async ({ input, ctx }) => {
      const { tagIds, ...data } = input;

      return db.transaction(async (tx) => {
        const [product] = await tx.insert(products).values(data).returning();

        if (tagIds?.length) {
          await tx.insert(productTags).values(
            tagIds.map((tagId) => ({ productId: product.id, tagId }))
          );
        }

        if (data.currentStock > 0) {
          await tx.insert(inventoryChanges).values({
            productId: product.id,
            quantityChange: data.currentStock,
            newQuantity: data.currentStock,
            reason: "received",
            changedById: ctx.user.id,
          });
        }

        return product;
      });
    }),

  update: protectedProcedure
    .input(productUpdateInput)
    .mutation(async ({ input }) => {
      const { id, tagIds, ...data } = input;

      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(products)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(products.id, id))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

        if (tagIds !== undefined) {
          await tx.delete(productTags).where(eq(productTags.productId, id));
          if (tagIds.length) {
            await tx.insert(productTags).values(
              tagIds.map((tagId) => ({ productId: id, tagId }))
            );
          }
        }

        return updated;
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(products).where(eq(products.id, input.id));
      return { success: true };
    }),

  updateStock: protectedProcedure
    .input(stockAdjustInput)
    .mutation(async ({ input, ctx }) => {
      return db.transaction(async (tx) => {
        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.id, input.productId))
          .for("update");

        if (!product) throw new TRPCError({ code: "NOT_FOUND" });

        const newStock = product.currentStock + input.quantity;
        if (newStock < 0)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Stock cannot go below 0",
          });
        if (newStock < product.reservedStock)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Stock cannot go below reserved amount (${product.reservedStock})`,
          });

        await tx
          .update(products)
          .set({ currentStock: newStock, updatedAt: new Date() })
          .where(eq(products.id, input.productId));

        await tx.insert(inventoryChanges).values({
          productId: input.productId,
          quantityChange: input.quantity,
          newQuantity: newStock,
          reason: input.reason,
          notes: input.notes,
          changedById: ctx.user.id,
        });

        return { currentStock: newStock, availableStock: newStock - product.reservedStock };
      });
    }),

  bulkUpdateStock: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            sku: z.string(),
            newStock: z.number().int().min(0),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const results = { updated: 0, errors: [] as string[] };

      await db.transaction(async (tx) => {
        for (const item of input.items) {
          const [product] = await tx
            .select()
            .from(products)
            .where(eq(products.sku, item.sku))
            .for("update");

          if (!product) {
            results.errors.push(`SKU "${item.sku}" not found`);
            continue;
          }
          if (item.newStock < product.reservedStock) {
            results.errors.push(
              `SKU "${item.sku}": new stock ${item.newStock} < reserved ${product.reservedStock}`
            );
            continue;
          }

          const diff = item.newStock - product.currentStock;
          await tx
            .update(products)
            .set({ currentStock: item.newStock, updatedAt: new Date() })
            .where(eq(products.id, product.id));

          await tx.insert(inventoryChanges).values({
            productId: product.id,
            quantityChange: diff,
            newQuantity: item.newStock,
            reason: "manual_count",
            changedById: ctx.user.id,
          });

          results.updated++;
        }
      });

      return results;
    }),

  /* ── Categories sub-router ──────────────────────── */

  categories: router({
    list: protectedProcedure.query(() =>
      db.select().from(categories).orderBy(asc(categories.name))
    ),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(({ input }) =>
        db.insert(categories).values(input).returning()
      ),
    update: protectedProcedure
      .input(z.object({ id: z.string().uuid(), name: z.string().min(1) }))
      .mutation(({ input }) =>
        db.update(categories).set({ name: input.name }).where(eq(categories.id, input.id)).returning()
      ),
    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ input }) =>
        db.delete(categories).where(eq(categories.id, input.id))
      ),
  }),

  /* ── Tags sub-router ────────────────────────────── */

  tags: router({
    list: protectedProcedure.query(() =>
      db.select().from(tags).orderBy(asc(tags.name))
    ),
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(50) }))
      .mutation(({ input }) =>
        db.insert(tags).values(input).returning()
      ),
    delete: adminProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(({ input }) =>
        db.delete(tags).where(eq(tags.id, input.id))
      ),
  }),
});
```

### 2. Frontend — Product List Page

```tsx
// src/client/routes/_auth/products/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageShell } from "@/components/layout/PageShell";
import { ProductCard } from "@/components/products/ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutGrid, List, Plus } from "lucide-react";

export const Route = createFileRoute("/_auth/products/")({
  component: ProductsPage,
});

function ProductsPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>();
  const [stockStatus, setStockStatus] = useState<
    "all" | "in_stock" | "low_stock" | "out_of_stock"
  >("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.products.list.useQuery({
    page,
    search: search || undefined,
    categoryId,
    stockStatus,
  });

  const { data: categoriesList } = trpc.products.categories.list.useQuery();

  return (
    <PageShell
      title="Products"
      actions={
        <Button asChild>
          <a href="/products/new"><Plus className="mr-2 h-4 w-4" /> Add Product</a>
        </Button>
      }
    >
      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs"
        />

        {/* Category filter chips */}
        <div className="flex gap-1 flex-wrap">
          {categoriesList?.map((cat) => (
            <Button
              key={cat.id}
              size="sm"
              variant={categoryId === cat.id ? "default" : "outline"}
              onClick={() => { setCategoryId(categoryId === cat.id ? undefined : cat.id); setPage(1); }}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Stock status filter */}
        <div className="flex gap-1">
          {(["all", "in_stock", "low_stock", "out_of_stock"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={stockStatus === s ? "default" : "outline"}
              onClick={() => { setStockStatus(s); setPage(1); }}
            >
              {s.replace(/_/g, " ")}
            </Button>
          ))}
        </div>

        {/* View toggle */}
        <div className="ml-auto flex gap-1">
          <Button size="icon" variant={viewMode === "grid" ? "default" : "ghost"} onClick={() => setViewMode("grid")}>
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button size="icon" variant={viewMode === "list" ? "default" : "ghost"} onClick={() => setViewMode("list")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Product grid / list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className={viewMode === "grid"
          ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4"
          : "flex flex-col gap-2"
        }>
          {data?.items.map((product) => (
            <ProductCard key={product.id} product={product} viewMode={viewMode} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && (
        <div className="flex justify-center gap-2 mt-6">
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="py-2 px-3 text-sm">
            Page {page} of {Math.ceil(data.total / data.perPage)}
          </span>
          <Button disabled={page * data.perPage >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </PageShell>
  );
}
```

### 3. Key Components

```tsx
// src/client/components/products/ProductCard.tsx
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function stockColor(available: number, min: number) {
  if (available <= 0) return "bg-red-100 text-red-800";
  if (available <= min) return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-800";
}

export function ProductCard({ product, viewMode }: { product: Product; viewMode: "grid" | "list" }) {
  const available = product.currentStock - product.reservedStock;

  return (
    <Link
      to="/products/$productId"
      params={{ productId: product.id }}
      className={cn(
        "border rounded-lg p-4 hover:shadow-md transition-shadow",
        viewMode === "list" && "flex items-center gap-4"
      )}
    >
      {product.imageUrl && (
        <img src={product.imageUrl} alt={product.name} className="h-24 w-24 object-cover rounded" />
      )}
      <div className="flex-1">
        <h3 className="font-medium">{product.name}</h3>
        <p className="text-sm text-muted-foreground">{product.sku}</p>
        {product.categoryName && <Badge variant="outline">{product.categoryName}</Badge>}
      </div>
      <Badge className={stockColor(available, product.minStockLevel)}>
        {available} available
      </Badge>
    </Link>
  );
}
```

```tsx
// src/client/components/products/StockAdjustmentDialog.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  quantity: z.number().int().refine((n) => n !== 0, "Cannot be zero"),
  reason: z.enum(["manual_count", "damaged", "returned", "received", "correction", "other"]),
  notes: z.string().optional(),
});

export function StockAdjustmentDialog({
  productId, open, onOpenChange,
}: {
  productId: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { quantity: 0, reason: "manual_count" as const } });

  const mutation = trpc.products.updateStock.useMutation({
    onSuccess: () => {
      utils.products.getById.invalidate({ id: productId });
      utils.products.list.invalidate();
      onOpenChange(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjust Stock</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((data) => mutation.mutate({ productId, ...data }))}>
          <Input type="number" {...form.register("quantity", { valueAsNumber: true })} placeholder="+10 or -5" />
          <Select onValueChange={(v) => form.setValue("reason", v as any)} defaultValue="manual_count">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual_count">Manual Count</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="correction">Correction</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Input {...form.register("notes")} placeholder="Notes (optional)" />
          <Button type="submit" disabled={mutation.isPending} className="w-full mt-4">
            {mutation.isPending ? "Saving..." : "Apply Adjustment"}
          </Button>
          {mutation.error && <p className="text-red-600 text-sm mt-2">{mutation.error.message}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

```tsx
// src/client/components/products/InventoryHistory.tsx
// Timeline of inventory changes for a product, displayed on the detail page.
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export function InventoryHistory({ changes }: { changes: InventoryChange[] }) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Inventory History</h3>
      {changes.map((c) => (
        <div key={c.id} className="flex items-center gap-3 border-l-2 border-muted pl-4 py-1">
          <Badge variant={c.quantityChange > 0 ? "default" : "destructive"}>
            {c.quantityChange > 0 ? "+" : ""}{c.quantityChange}
          </Badge>
          <span className="text-sm">{c.reason.replace(/_/g, " ")}</span>
          {c.notes && <span className="text-sm text-muted-foreground">— {c.notes}</span>}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
          </span>
        </div>
      ))}
    </div>
  );
}
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/routers/products.ts` | tRPC router: CRUD, stock, categories, tags |
| `src/client/routes/_auth/products/index.tsx` | Product list page |
| `src/client/routes/_auth/products/$productId.tsx` | Product detail + edit page |
| `src/client/routes/_auth/products/new.tsx` | Create product page |
| `src/client/components/products/ProductCard.tsx` | Grid/list card with stock indicator |
| `src/client/components/products/ProductForm.tsx` | Shared create/edit form (React Hook Form + Zod) |
| `src/client/components/products/StockAdjustmentDialog.tsx` | Manual stock adjustment dialog |
| `src/client/components/products/InventoryHistory.tsx` | Timeline of inventory changes |

---

## Verification

1. **List page** — load `/products`, confirm products render with stock colors.
2. **Search** — type in search bar, confirm list filters by name/SKU.
3. **Category filter** — click a chip, confirm only matching products show.
4. **Stock status filter** — select "low_stock", confirm only products with `0 < currentStock <= minStockLevel` appear.
5. **Create** — fill out form at `/products/new`, submit, confirm product appears in list.
6. **Edit** — open product, change name, save, confirm update persists.
7. **Stock adjustment** — open dialog, add +10, confirm `currentStock` increases, `inventoryChanges` row created.
8. **Boundary check** — adjust stock to a value below `reservedStock`, confirm error is returned and stock is unchanged.
9. **Bulk import** — call `products.bulkUpdateStock` with 3 SKUs (one invalid), confirm 2 updated + 1 error.
10. **Categories** — create, rename, delete a category. Confirm products referencing a deleted category are handled.
11. **Tags** — add tags to a product, remove one, confirm `productTags` junction rows are synced.

---

## Definition of Done

- [ ] `products.list` returns paginated results with joined category name and computed `availableStock`
- [ ] `products.create` inserts product + tags in a single transaction
- [ ] `products.updateStock` validates `currentStock >= reservedStock` after adjustment
- [ ] `products.bulkUpdateStock` processes CSV-style input and returns per-row errors
- [ ] Categories and tags CRUD fully functional
- [ ] Product list page renders with search, category chips, stock filter, grid/list toggle, pagination
- [ ] Product detail page shows edit form, stock adjustment dialog, inventory history timeline
- [ ] Create product form validates with Zod before submission
- [ ] Loading skeletons display while data is fetching
- [ ] All mutations invalidate relevant queries on success
