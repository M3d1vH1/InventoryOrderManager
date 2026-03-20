import { router, adminProcedure } from "../trpc.js";
import { clearAppCache } from "../lib/cache.js";

export const settingsRouter = router({
    clearCache: adminProcedure.mutation(async () => {
        const cleared = await clearAppCache();
        return { cleared, message: `Cleared ${cleared} cache entries` };
    }),
});

