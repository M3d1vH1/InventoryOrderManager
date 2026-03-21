import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { trpc } from "../../../lib/trpc";

export const Route = createFileRoute("/_auth/settings")({
    beforeLoad: async () => {
        // Enforce basic auth check (usually handled by _auth but repeated for safety)
        // We will do a strict check in the component using TRPC.
    },
    component: SettingsLayout,
});

function SettingsLayout() {
    const { data: user, isLoading } = trpc.auth.me.useQuery();

    if (isLoading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
            </div>
        );
    }

    if (!user || user.role !== "admin") {
        window.location.href = "/";
        return null;
    }

    return (
        <div className="flex min-h-full flex-col bg-gray-50/50">
            <div className="mx-auto w-full max-w-6xl p-6">
                <Outlet />
            </div>
        </div>
    );
}
