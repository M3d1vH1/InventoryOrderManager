import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { products, barcodeScanLogs } from "../db/schema.js";

export const barcodeRouter = router({
    lookup: protectedProcedure
        .input(z.object({ code: z.string().min(1) }))
        .query(async ({ input }) => {
            const product = await db.query.products.findFirst({
                where: or(
                    eq(products.barcode, input.code),
                    eq(products.sku, input.code)
                ),
                with: { category: true },
            });

            return product
                ? {
                    found: true as const,
                    product: {
                        ...product,
                        availableStock: product.currentStock - product.reservedStock,
                    },
                }
                : { found: false as const, code: input.code };
        }),

    logScan: protectedProcedure
        .input(
            z.object({
                barcode: z.string(),
                source: z.enum(["camera", "scanner", "manual"]),
                context: z.enum(["lookup", "picking", "order", "inventory"]),
                productId: z.number().int().optional(),
                success: z.boolean(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            await db.insert(barcodeScanLogs).values({
                barcode: input.barcode,
                scanType: input.source,
                notes: `Context: ${input.context} | Success: ${input.success}`,
                productId: input.productId,
                userId: ctx.user.id,
            });
            return { logged: true };
        }),
});
