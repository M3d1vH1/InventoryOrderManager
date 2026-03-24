import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { pickItem, getPickingQueue } from "../services/pickingService.js";

export const pickingRouter = router({
    queue: protectedProcedure.query(() => getPickingQueue()),

    pickItem: protectedProcedure
        .input(
            z.object({
                orderItemId: z.number().int(),
                pickedQuantity: z.number().int().min(0).max(10000),
                hasQualityIssues: z.boolean().default(false),
            })
        )
        .mutation(({ input, ctx }) =>
            pickItem({ ...input, pickedById: ctx.user.id })
        ),

    pickAll: protectedProcedure
        .input(z.object({ orderId: z.number().int() }))
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
