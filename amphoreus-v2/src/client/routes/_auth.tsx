import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { trpc } from "../lib/trpc";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";
import { useState } from "react";

export const Route = createFileRoute("/_auth")({
    component: AuthLayout,
    beforeLoad: async () => {
        // This will be checked on the client side via the component
        // Server-side redirect is handled by the component below
    },
});

function AuthLayout() {
    const { data: user, isLoading } = trpc.auth.me.useQuery();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Show loading skeleton while checking auth
    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!user) {
        window.location.href = "/login";
        return null;
    }

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            {/* Sidebar */}
            <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                userRole={user.role}
            />

            {/* Main content area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                <Header
                    user={user}
                    sidebarCollapsed={sidebarCollapsed}
                />

                <main className="flex-1 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
