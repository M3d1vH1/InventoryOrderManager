import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../lib/trpc";
import { PageShell } from "../../components/layout/PageShell";
import { StatCard } from "../../components/dashboard/StatCard";
import { RecentActivity } from "../../components/dashboard/RecentActivity";
import { LowStockAlerts } from "../../components/dashboard/LowStockAlerts";
import { OrdersTrendChart } from "../../components/dashboard/OrdersTrendChart";
import { Skeleton } from "../../components/ui/skeleton";
import {
    ShoppingCart,
    PackageCheck,
    Truck,
    AlertTriangle,
    Users,
    Package,
    TrendingUp,
    ClipboardList,
} from "lucide-react";

export const Route = createFileRoute("/_auth/")({
    component: DashboardPage,
});

function DashboardPage() {
    const { data: stats, isLoading } = trpc.dashboard.stats.useQuery(undefined, {
        refetchInterval: 30_000,
    });
    const { data: activity } = trpc.dashboard.recentActivity.useQuery(undefined, {
        refetchInterval: 30_000,
    });
    const { data: lowStock } = trpc.dashboard.lowStockProducts.useQuery(undefined, {
        refetchInterval: 60_000,
    });
    const { data: trend } = trpc.dashboard.ordersTrend.useQuery(undefined, {
        refetchInterval: 300_000,
    });

    if (isLoading) {
        return (
            <PageShell title="Dashboard">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-28 rounded-lg" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="lg:col-span-2 h-80 rounded-lg" />
                    <Skeleton className="h-80 rounded-lg" />
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell title="Dashboard">
            {/* KPI Cards — top row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard
                    title="Orders Today"
                    value={stats?.today.newOrders ?? 0}
                    icon={ShoppingCart}
                    href="/orders"
                />
                <StatCard
                    title="Shipped Today"
                    value={stats?.today.shipped ?? 0}
                    icon={Truck}
                    variant="success"
                    href="/orders?status=shipped"
                />
                <StatCard
                    title="Picking Queue"
                    value={stats?.pickingQueueDepth ?? 0}
                    icon={ClipboardList}
                    variant={stats?.pickingQueueDepth ? "warning" : "default"}
                    href="/picking"
                />
                <StatCard
                    title="Items Picked Today"
                    value={stats?.today.itemsPicked ?? 0}
                    icon={TrendingUp}
                    variant="success"
                />
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard
                    title="Pending Orders"
                    value={stats?.orders.pending ?? 0}
                    icon={ShoppingCart}
                    href="/orders?status=pending"
                />
                <StatCard
                    title="Low Stock Alerts"
                    value={stats?.lowStockAlerts ?? 0}
                    icon={AlertTriangle}
                    variant={stats?.lowStockAlerts ? "destructive" : "default"}
                    href="/products"
                />
                <StatCard
                    title="Total Products"
                    value={stats?.totalProducts ?? 0}
                    icon={Package}
                    href="/products"
                />
                <StatCard
                    title="Total Customers"
                    value={stats?.totalCustomers ?? 0}
                    icon={Users}
                    href="/customers"
                />
            </div>

            {/* Charts + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
                <div className="lg:col-span-2 h-full">
                    <OrdersTrendChart data={trend ?? []} />
                </div>
                <div className="flex flex-col gap-6 h-full">
                    <div className="flex-1 min-h-0">
                        <LowStockAlerts products={lowStock ?? []} />
                    </div>
                    <div className="flex-1 min-h-0">
                        <RecentActivity entries={activity ?? []} />
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
