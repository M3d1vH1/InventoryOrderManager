import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, ilike, and, or, sql, desc, asc, inArray } from "drizzle-orm";
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
import { cached, invalidateTag } from "../lib/cache.js";
import { deleteProductImage } from "../services/imageService.js";

/* ── Zod Schemas ────────────────────────────────────── */

const productCreateInput = z.object({
    name: z.string().min(1).max(255),
    sku: z.string().min(1).max(100),
    barcode: z.string().max(100).optional(),
    categoryId: z.number().int().optional(),
    description: z.string().optional(),
    currentStock: z.number().int().min(0).default(0),
    minStockLevel: z.number().int().min(0).default(0),
    imageUrl: z.string().url().optional(),
    tagIds: z.array(z.number().int()).optional(),
});

const productUpdateInput = productCreateInput.partial().extend({
    id: z.number().int(),
    tagIds: z.array(z.number().int()).optional(),
});

const listInput = z.object({
    page: z.number().int().min(1).default(1),
    perPage: z.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    categoryId: z.number().int().optional(),
    tagId: z.number().int().optional(),
    stockStatus: z.enum(["all", "in_stock", "low_stock", "out_of_stock"]).default("all"),
    sortBy: z.enum(["name", "sku", "currentStock", "createdAt"]).default("name"),
    sortDir: z.enum(["asc", "desc"]).default("asc"),
});

const stockAdjustInput = z.object({
    productId: z.number().int(),
    quantity: z.number().int(), // positive = add, negative = subtract
    reason: z.enum([
        "manual_adjustment",
        "damaged",
        "return_received",
        "stock_received",
        "cycle_count",
    ]),
    notes: z.string().optional(),
});

/* ── Router ─────────────────────────────────────────── */

export const productsRouter = router({
    list: protectedProcedure.input(listInput).query(async ({ input }) => {
        const cacheKey = `cache:products:list:${JSON.stringify(input)}`;

        return cached(cacheKey, async () => {
            const { page, perPage, search, categoryId, stockStatus, sortBy, sortDir } = input;
            const offset = (page - 1) * perPage;

            const conditions = [];
            if (search) {
                // Use trigram similarity for fuzzy matching (Greek-friendly)
                // We also keep SKU as ILIKE because it's usually exact or prefix
                conditions.push(
                    or(
                        sql`similarity(${products.name}, ${search}) > 0.3`,
                        ilike(products.sku, `%${search}%`)
                    )!
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

            let orderCol: any = products.name;
            if (sortBy === "sku") orderCol = products.sku;
            if (sortBy === "currentStock") orderCol = products.currentStock;
            if (sortBy === "createdAt") orderCol = products.createdAt;

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
                        imageUrl: products.imagePath,
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
        }, { ttl: 120, tags: ["products"] });
    }),

    listHistory: protectedProcedure
        .input(
            z.object({
                page: z.number().int().min(1).default(1),
                perPage: z.number().int().min(1).max(100).default(20),
                search: z.string().optional(),
                productId: z.number().int().optional(),
                changeType: z.string().optional(),
            })
        )
        .query(async ({ input }) => {
            const { page, perPage, search, productId, changeType } = input;
            const offset = (page - 1) * perPage;

            const conditions = [];
            if (productId) conditions.push(eq(inventoryChanges.productId, productId));
            if (changeType && changeType !== "all") {
                conditions.push(eq(inventoryChanges.changeType, changeType as any));
            }
            if (search) {
                conditions.push(
                    or(
                        sql`similarity(${products.name}, ${search}) > 0.3`,
                        ilike(products.sku, `%${search}%`)
                    )!
                );
            }

            const where = conditions.length ? and(...conditions) : undefined;

            const [rows, countResult] = await Promise.all([
                db
                    .select({
                        id: inventoryChanges.id,
                        quantityChanged: inventoryChanges.quantityChanged,
                        previousQuantity: inventoryChanges.previousQuantity,
                        newQuantity: inventoryChanges.newQuantity,
                        changeType: inventoryChanges.changeType,
                        timestamp: inventoryChanges.timestamp,
                        notes: inventoryChanges.notes,
                        product: {
                            id: products.id,
                            name: products.name,
                            sku: products.sku,
                        },
                    })
                    .from(inventoryChanges)
                    .innerJoin(products, eq(inventoryChanges.productId, products.id))
                    .where(where)
                    .orderBy(desc(inventoryChanges.timestamp))
                    .limit(perPage)
                    .offset(offset),
                db
                    .select({ count: sql<number>`count(*)` })
                    .from(inventoryChanges)
                    .innerJoin(products, eq(inventoryChanges.productId, products.id))
                    .where(where),
            ]);

            return {
                items: rows,
                total: Number(countResult[0].count),
                page,
                perPage,
            };
        }),

    getById: protectedProcedure
        .input(z.object({ id: z.number().int() }))
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
                .orderBy(desc(inventoryChanges.timestamp))
                .limit(50);

            return {
                ...product,
                imageUrl: product.imagePath,
                availableStock: product.currentStock - product.reservedStock,
                inventoryHistory: history,
            };
        }),

    create: protectedProcedure // admin + front_office
        .input(productCreateInput)
        .mutation(async ({ input, ctx }) => {
            const { tagIds, imageUrl, ...data } = input;

            const result = await db.transaction(async (tx) => {
                const [product] = await tx.insert(products).values({ ...data, imagePath: imageUrl }).returning();

                if (tagIds?.length) {
                    await tx.insert(productTags).values(
                        tagIds.map((tagId) => ({ productId: product.id, tagId }))
                    );
                }

                if (data.currentStock > 0) {
                    await tx.insert(inventoryChanges).values({
                        productId: product.id,
                        quantityChanged: data.currentStock,
                        previousQuantity: 0,
                        newQuantity: data.currentStock,
                        changeType: "stock_received",
                        userId: ctx.user.id,
                    });
                }

                return product;
            });

            await invalidateTag("products");
            return result;
        }),

    update: protectedProcedure
        .input(productUpdateInput)
        .mutation(async ({ input }) => {
            const { id, tagIds, imageUrl, ...data } = input;

            const result = await db.transaction(async (tx) => {
                const [existing] = await tx.select().from(products).where(eq(products.id, id));
                if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

                if (imageUrl !== undefined && existing.imagePath && existing.imagePath !== imageUrl) {
                    deleteProductImage(existing.imagePath).catch(() => { });
                }

                const updateData: any = { ...data };
                if (imageUrl !== undefined) {
                    updateData.imagePath = imageUrl;
                }

                const [updated] = await tx
                    .update(products)
                    .set(updateData)
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

            await invalidateTag("products");
            return result;
        }),

    delete: adminProcedure
        .input(z.object({ id: z.number().int() }))
        .mutation(async ({ input }) => {
            const [deletedProduct] = await db.delete(products).where(eq(products.id, input.id)).returning();
            if (deletedProduct?.imagePath) {
                deleteProductImage(deletedProduct.imagePath).catch(() => { });
            }
            await invalidateTag("products");
            return { success: true };
        }),

    updateStock: protectedProcedure
        .input(stockAdjustInput)
        .mutation(async ({ input, ctx }) => {
            const result = await db.transaction(async (tx) => {
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
                    .set({ currentStock: newStock })
                    .where(eq(products.id, input.productId));

                await tx.insert(inventoryChanges).values({
                    productId: input.productId,
                    quantityChanged: input.quantity,
                    previousQuantity: product.currentStock,
                    newQuantity: newStock,
                    changeType: input.reason,
                    notes: input.notes,
                    userId: ctx.user.id,
                });

                return { currentStock: newStock, availableStock: newStock - product.reservedStock };
            });
            await invalidateTag("products");
            return result;
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
                        .set({ currentStock: item.newStock })
                        .where(eq(products.id, product.id));

                    await tx.insert(inventoryChanges).values({
                        productId: product.id,
                        quantityChanged: diff,
                        previousQuantity: product.currentStock,
                        newQuantity: item.newStock,
                        changeType: "cycle_count",
                        userId: ctx.user.id,
                    });

                    results.updated++;
                }
            });

            await invalidateTag("products");
            return results;
        }),

    /* ── Categories sub-router ──────────────────────── */

    categories: router({
        list: protectedProcedure.query(() =>
            cached("cache:categories:all",
                () => db.select().from(categories).orderBy(asc(categories.name)),
                { ttl: 600, tags: ["categories"] }
            )
        ),
        create: protectedProcedure
            .input(z.object({ name: z.string().min(1).max(100) }))
            .mutation(async ({ input }) => {
                const res = await db.insert(categories).values(input).returning();
                await invalidateTag("categories");
                return res;
            }),
        update: protectedProcedure
            .input(z.object({ id: z.number().int(), name: z.string().min(1) }))
            .mutation(async ({ input }) => {
                const res = await db.update(categories).set({ name: input.name }).where(eq(categories.id, input.id)).returning();
                await invalidateTag("categories");
                return res;
            }),
        delete: adminProcedure
            .input(z.object({ id: z.number().int() }))
            .mutation(async ({ input }) => {
                const res = await db.delete(categories).where(eq(categories.id, input.id));
                await invalidateTag("categories");
                return res;
            }),
    }),

    /* ── Tags sub-router ────────────────────────────── */

    tags: router({
        list: protectedProcedure.query(() =>
            cached("cache:tags:all",
                () => db.select().from(tags).orderBy(asc(tags.name)),
                { ttl: 600, tags: ["tags"] }
            )
        ),
        create: protectedProcedure
            .input(z.object({ name: z.string().min(1).max(50) }))
            .mutation(async ({ input }) => {
                const res = await db.insert(tags).values(input).returning();
                await invalidateTag("tags");
                return res;
            }),
        delete: adminProcedure
            .input(z.object({ id: z.number().int() }))
            .mutation(async ({ input }) => {
                const res = await db.delete(tags).where(eq(tags.id, input.id));
                await invalidateTag("tags");
                return res;
            }),
    }),
});
