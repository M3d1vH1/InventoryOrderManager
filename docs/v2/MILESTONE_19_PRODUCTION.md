# Milestone 19 — Production Module

| Field | Value |
|-------|-------|
| **Step** | 19 of 25 |
| **Priority** | P2 |
| **Depends on** | Steps 6 |
| **Estimated effort** | 2 days |

---

## Goal

Build the olive oil production tracking system: recipes (what raw materials are needed to produce a finished product), production batches (actual production runs), raw material inventory, material consumption tracking, and quality checks. This is the manufacturing side of the business — raw materials go in, finished products come out with updated stock.

---

## Implementation

### 1. Database Schema (from Milestone 02)

```
raw_materials
  - id, name, sku, unit (kg/liters/pieces), current_stock, min_stock_level,
    unit_cost, supplier_id (FK), created_at

production_recipes
  - id, product_id (FK products), name, description, yield_quantity, created_at

recipe_ingredients
  - id, recipe_id (FK), raw_material_id (FK), quantity, unit, created_at

production_batches
  - id, recipe_id (FK), batch_number, status (planned/in_progress/completed/cancelled),
    planned_quantity, actual_quantity, started_at, completed_at,
    created_by_id (FK users), notes, created_at

material_consumptions
  - id, batch_id (FK), raw_material_id (FK), planned_quantity, actual_quantity,
    consumed_at, created_at

production_quality_checks
  - id, batch_id (FK), check_type (visual/chemical/taste/weight),
    result (pass/fail/warning), value, notes, checked_by_id (FK users), created_at

material_inventory_changes
  - id, raw_material_id (FK), quantity_change, new_quantity, reason, notes,
    changed_by_id (FK users), created_at
```

### 2. tRPC Router — `src/server/routers/production.ts`

```ts
// src/server/routers/production.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, sql, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import {
  productionRecipes, recipeIngredients, productionBatches,
  materialConsumptions, productionQualityChecks,
  rawMaterials, materialInventoryChanges, products, inventoryChanges,
} from "../db/schema.js";

export const productionRouter = router({
  /* ── Raw Materials ─────────────────────────────────── */

  materials: router({
    list: protectedProcedure.query(() =>
      db.select().from(rawMaterials).orderBy(rawMaterials.name)
    ),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        sku: z.string().min(1),
        unit: z.enum(["kg", "liters", "pieces", "bottles", "cans"]),
        currentStock: z.number().min(0).default(0),
        minStockLevel: z.number().min(0).default(0),
        unitCost: z.number().min(0).optional(),
        supplierId: z.string().uuid().optional(),
      }))
      .mutation(async ({ input }) => {
        const [material] = await db.insert(rawMaterials).values(input).returning();
        return material;
      }),

    adjustStock: protectedProcedure
      .input(z.object({
        materialId: z.string().uuid(),
        quantity: z.number(),
        reason: z.enum(["received", "damaged", "correction", "consumed", "other"]),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.transaction(async (tx) => {
          const [material] = await tx.select().from(rawMaterials)
            .where(eq(rawMaterials.id, input.materialId)).for("update");
          if (!material) throw new TRPCError({ code: "NOT_FOUND" });

          const newStock = material.currentStock + input.quantity;
          if (newStock < 0) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Stock cannot go below 0" });
          }

          await tx.update(rawMaterials)
            .set({ currentStock: newStock })
            .where(eq(rawMaterials.id, input.materialId));

          await tx.insert(materialInventoryChanges).values({
            rawMaterialId: input.materialId,
            quantityChange: input.quantity,
            newQuantity: newStock,
            reason: input.reason,
            notes: input.notes,
            changedById: ctx.user.id,
          });

          return { currentStock: newStock };
        });
      }),
  }),

  /* ── Recipes ───────────────────────────────────────── */

  recipes: router({
    list: protectedProcedure.query(() =>
      db.query.productionRecipes.findMany({
        with: {
          product: true,
          ingredients: { with: { rawMaterial: true } },
        },
      })
    ),

    create: protectedProcedure
      .input(z.object({
        productId: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().optional(),
        yieldQuantity: z.number().int().min(1),
        ingredients: z.array(z.object({
          rawMaterialId: z.string().uuid(),
          quantity: z.number().min(0.01),
          unit: z.string(),
        })).min(1),
      }))
      .mutation(async ({ input }) => {
        return db.transaction(async (tx) => {
          const { ingredients, ...recipeData } = input;
          const [recipe] = await tx.insert(productionRecipes)
            .values(recipeData).returning();

          await tx.insert(recipeIngredients).values(
            ingredients.map((i) => ({ ...i, recipeId: recipe.id }))
          );

          return recipe;
        });
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        const recipe = await db.query.productionRecipes.findFirst({
          where: eq(productionRecipes.id, input.id),
          with: {
            product: true,
            ingredients: { with: { rawMaterial: true } },
          },
        });
        if (!recipe) throw new TRPCError({ code: "NOT_FOUND" });
        return recipe;
      }),
  }),

  /* ── Batches ───────────────────────────────────────── */

  batches: router({
    list: protectedProcedure
      .input(z.object({
        status: z.enum(["planned", "in_progress", "completed", "cancelled"]).optional(),
      }).optional())
      .query(async ({ input }) => {
        return db.query.productionBatches.findMany({
          where: input?.status ? eq(productionBatches.status, input.status) : undefined,
          with: {
            recipe: { with: { product: true } },
          },
          orderBy: [desc(productionBatches.createdAt)],
        });
      }),

    create: protectedProcedure
      .input(z.object({
        recipeId: z.string().uuid(),
        plannedQuantity: z.number().int().min(1),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Generate batch number
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const [{ count }] = await db.select({ count: sql<number>`count(*)` })
          .from(productionBatches)
          .where(sql`DATE(${productionBatches.createdAt}) = CURRENT_DATE`);
        const seq = String(Number(count) + 1).padStart(3, "0");

        const [batch] = await db.insert(productionBatches).values({
          ...input,
          batchNumber: `BATCH-${today}-${seq}`,
          status: "planned",
          createdById: ctx.user.id,
        }).returning();

        return batch;
      }),

    start: protectedProcedure
      .input(z.object({ batchId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        return db.transaction(async (tx) => {
          const [batch] = await tx.select().from(productionBatches)
            .where(eq(productionBatches.id, input.batchId));
          if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
          if (batch.status !== "planned") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Batch must be in planned status" });
          }

          // Get recipe ingredients and check material availability
          const recipe = await tx.query.productionRecipes.findFirst({
            where: eq(productionRecipes.id, batch.recipeId),
            with: { ingredients: { with: { rawMaterial: true } } },
          });
          if (!recipe) throw new TRPCError({ code: "NOT_FOUND" });

          const multiplier = batch.plannedQuantity / recipe.yieldQuantity;

          // Deduct raw materials
          for (const ingredient of recipe.ingredients) {
            const neededQty = ingredient.quantity * multiplier;
            const [material] = await tx.select().from(rawMaterials)
              .where(eq(rawMaterials.id, ingredient.rawMaterialId)).for("update");

            if (!material || material.currentStock < neededQty) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Insufficient ${ingredient.rawMaterial.name}: need ${neededQty}, have ${material?.currentStock ?? 0}`,
              });
            }

            await tx.update(rawMaterials)
              .set({ currentStock: sql`${rawMaterials.currentStock} - ${neededQty}` })
              .where(eq(rawMaterials.id, ingredient.rawMaterialId));

            await tx.insert(materialConsumptions).values({
              batchId: input.batchId,
              rawMaterialId: ingredient.rawMaterialId,
              plannedQuantity: neededQty,
              actualQuantity: neededQty,
              consumedAt: new Date(),
            });

            await tx.insert(materialInventoryChanges).values({
              rawMaterialId: ingredient.rawMaterialId,
              quantityChange: -neededQty,
              newQuantity: material.currentStock - neededQty,
              reason: "consumed",
              notes: `Batch ${batch.batchNumber}`,
              changedById: ctx.user.id,
            });
          }

          // Update batch status
          await tx.update(productionBatches)
            .set({ status: "in_progress", startedAt: new Date() })
            .where(eq(productionBatches.id, input.batchId));

          return { started: true };
        });
      }),

    complete: protectedProcedure
      .input(z.object({
        batchId: z.string().uuid(),
        actualQuantity: z.number().int().min(0),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.transaction(async (tx) => {
          const [batch] = await tx.select().from(productionBatches)
            .where(eq(productionBatches.id, input.batchId));
          if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
          if (batch.status !== "in_progress") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Batch must be in progress" });
          }

          const recipe = await tx.query.productionRecipes.findFirst({
            where: eq(productionRecipes.id, batch.recipeId),
          });
          if (!recipe) throw new TRPCError({ code: "NOT_FOUND" });

          // Add finished product to stock
          const [product] = await tx.select().from(products)
            .where(eq(products.id, recipe.productId)).for("update");

          await tx.update(products)
            .set({
              currentStock: sql`${products.currentStock} + ${input.actualQuantity}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, recipe.productId));

          await tx.insert(inventoryChanges).values({
            productId: recipe.productId,
            quantityChange: input.actualQuantity,
            newQuantity: (product?.currentStock ?? 0) + input.actualQuantity,
            reason: "received",
            notes: `Production batch ${batch.batchNumber}`,
            changedById: ctx.user.id,
          });

          // Complete batch
          await tx.update(productionBatches)
            .set({
              status: "completed",
              actualQuantity: input.actualQuantity,
              completedAt: new Date(),
            })
            .where(eq(productionBatches.id, input.batchId));

          return { completed: true, producedQuantity: input.actualQuantity };
        });
      }),

    addQualityCheck: protectedProcedure
      .input(z.object({
        batchId: z.string().uuid(),
        checkType: z.enum(["visual", "chemical", "taste", "weight"]),
        result: z.enum(["pass", "fail", "warning"]),
        value: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const [check] = await db.insert(productionQualityChecks).values({
          ...input,
          checkedById: ctx.user.id,
        }).returning();
        return check;
      }),
  }),
});
```

### 3. Frontend Pages

```
src/client/routes/_auth/production/
  ├── index.tsx           — Production dashboard: active batches, material alerts
  ├── batches/
  │   ├── index.tsx       — Batch list with status filters
  │   ├── new.tsx         — Start new batch (select recipe, set quantity)
  │   └── $batchId.tsx    — Batch detail: progress, materials consumed, quality checks
  ├── recipes/
  │   ├── index.tsx       — Recipe list
  │   └── new.tsx         — Create recipe (select product, add ingredients)
  └── materials/
      └── index.tsx       — Raw material list with stock levels
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/routers/production.ts` | tRPC router: materials, recipes, batches, quality checks |
| `src/client/routes/_auth/production/index.tsx` | Production dashboard |
| `src/client/routes/_auth/production/batches/index.tsx` | Batch list |
| `src/client/routes/_auth/production/batches/new.tsx` | Create batch |
| `src/client/routes/_auth/production/batches/$batchId.tsx` | Batch detail |
| `src/client/routes/_auth/production/recipes/index.tsx` | Recipe list |
| `src/client/routes/_auth/production/recipes/new.tsx` | Create recipe |
| `src/client/routes/_auth/production/materials/index.tsx` | Raw materials list |

---

## Verification

1. **Raw material CRUD** — create, list, adjust stock for raw materials.
2. **Recipe creation** — create a recipe with 3 ingredients, confirm yield quantity stored.
3. **Batch planning** — create a planned batch with quantity, confirm batch number generated.
4. **Batch start** — start a batch, confirm raw materials deducted and consumption records created.
5. **Insufficient materials** — attempt to start a batch without enough materials, confirm error with specific material.
6. **Batch completion** — complete a batch, confirm finished product stock increases by actual quantity.
7. **Yield variance** — complete a batch with actual < planned, confirm the actual quantity is stored.
8. **Quality checks** — add quality checks to a batch, confirm results stored.
9. **Material inventory history** — view raw material detail, confirm consumption events logged.
10. **Production → inventory** — complete a batch, confirm `inventoryChanges` entry created for the finished product.

---

## Definition of Done

- [ ] Raw material CRUD with stock tracking and inventory change log
- [ ] Recipe management: create recipes linking finished products to raw material ingredients
- [ ] Batch lifecycle: planned → in_progress → completed/cancelled
- [ ] Starting a batch atomically deducts raw materials and creates consumption records
- [ ] Completing a batch adds finished product to `products.currentStock`
- [ ] Quality checks recorded per batch with type, result, and notes
- [ ] Insufficient material check prevents batch start with specific error
- [ ] Batch numbers auto-generated (BATCH-YYYYMMDD-NNN)
- [ ] All material movements create `materialInventoryChanges` entries
- [ ] Production pages: dashboard, batch list, recipe management, materials list
