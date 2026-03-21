import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { calculatePredictions, calculateSeasonalPatterns } from "../services/predictionService.js";
import { db } from "../db/index.js";
import { seasonalPatterns } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const predictionsRouter = router({
    getAll: protectedProcedure.query(() => calculatePredictions()),

    getAlerts: protectedProcedure
        .input(z.object({
            daysThreshold: z.number().int().min(1).default(14),
        }).optional())
        .query(async ({ input }) => {
            const threshold = input?.daysThreshold ?? 14;
            const predictions = await calculatePredictions();
            return predictions.filter((p) => p.daysUntilStockout <= threshold && p.daysUntilStockout < 999);
        }),

    getSeasonalPatterns: protectedProcedure
        .input(z.object({ productId: z.number().int().positive() }))
        .query(({ input }) =>
            db.select().from(seasonalPatterns)
                .where(eq(seasonalPatterns.productId, input.productId))
                .orderBy(seasonalPatterns.month)
        ),

    recalculate: adminProcedure.mutation(async () => {
        await calculateSeasonalPatterns();
        const predictions = await calculatePredictions();
        return { recalculated: predictions.length };
    }),
});
