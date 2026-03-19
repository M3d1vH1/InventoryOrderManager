import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "../../components/layout/PageShell";

export const Route = createFileRoute("/_auth/")({
    component: DashboardPage,
});

function DashboardPage() {
    return (
        <PageShell title="Dashboard">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Placeholder cards */}
                {["Pending Orders", "Low Stock Items", "Shipments Today", "Quality Issues"].map(
                    (label) => (
                        <div
                            key={label}
                            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
                        >
                            <p className="text-sm font-medium text-gray-500">{label}</p>
                            <p className="mt-2 text-3xl font-semibold text-gray-900">--</p>
                        </div>
                    )
                )}
            </div>
        </PageShell>
    );
}
