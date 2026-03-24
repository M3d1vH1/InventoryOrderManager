import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import { QueryClient } from "@tanstack/react-query";
import type { AppRouter } from "../../server/router.js";

export const trpc = createTRPCReact<AppRouter>();

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

export const trpcClient = trpc.createClient({
    links: [
        httpBatchLink({
            url: "/trpc",
            headers() {
                return {};
            },
        }),
    ],
});
