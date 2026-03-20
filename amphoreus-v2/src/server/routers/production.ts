import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, sql, desc, and } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import {
    productionRecipes,
    recipeIngredients,
    productionBatches,
    materialConsumptions,
    productionQualityChecks,
    rawMaterials,
    materialInventoryChanges,
    products,
    inventoryChanges,
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
                const payload = {
                    ...input,
                    unitCost: input.unitCost !== undefined ? String(input.unitCost) : undefined,
                };
                const [material] = await db.insert(rawMaterials).values(payload).returning();
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
                productId: z.number().int(),
                name: z.string().min(1),
                description: z.string().optional(),
                yieldQuantity: z.number().int().min(1),
                ingredients: z.array(z.object({
                    rawMaterialId: z.string().uuid(),
                    quantity: z.number().min(0.01),
                    unit: z.enum(["kg", "liters", "pieces", "bottles", "cans"]),
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

        getById: protectedProcedure
            .input(z.object({ id: z.string().uuid() }))
            .query(async ({ input }) => {
                const batch = await db.query.productionBatches.findFirst({
                    where: eq(productionBatches.id, input.id),
                    with: {
                        recipe: { with: { product: true } },
                        consumptions: { with: { rawMaterial: true } },
                        qualityChecks: true,
                    },
                });
                if (!batch) throw new TRPCError({ code: "NOT_FOUND" });
                return batch;
            }),

        create: protectedProcedure
            .input(z.object({
                recipeId: z.string().uuid(),
                plannedQuantity: z.number().int().min(1),
                notes: z.string().optional(),
            }))
            .mutation(async ({ input, ctx }) => {
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

                    const [product] = await tx.select().from(products)
                        .where(eq(products.id, recipe.productId)).for("update");

                    await tx.update(products)
                        .set({
                            currentStock: sql`${products.currentStock} + ${input.actualQuantity}`,
                            lastStockUpdate: new Date(),
                        })
                        .where(eq(products.id, recipe.productId));

                    await tx.insert(inventoryChanges).values({
                        productId: recipe.productId,
                        userId: ctx.user.id,
                        changeType: "stock_received",
                        previousQuantity: product?.currentStock ?? 0,
                        newQuantity: (product?.currentStock ?? 0) + input.actualQuantity,
                        quantityChanged: input.actualQuantity,
                        reference: `Production batch ${batch.batchNumber}`,
                    });

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
