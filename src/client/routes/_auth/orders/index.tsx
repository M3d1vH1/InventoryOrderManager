import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { PageShell } from "../../../components/layout/PageShell";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Skeleton } from "../../../components/ui/skeleton";
import { OrderStatusBadge, OrderPriorityBadge } from "../../../components/orders/OrderStatusBadge";
import {
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "../../../components/ui/table";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_auth/orders/")({
    component: OrdersPage,
});

const STATUS_TABS = [
    { label: "All", value: undefined },
    { label: "Pending", value: "pending" },
    { label: "Picked", value: "picked" },
    { label: "Partially Shipped", value: "partially_shipped" },
    { label: "Shipped", value: "shipped" },
    { label: "Cancelled", value: "cancelled" },
] as const;

function OrdersPage() {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<string | undefined>(undefined);
    const [page, setPage] = useState(1);

    const { data, isLoading } = trpc.orders.list.useQuery({
        page,
        search: search || undefined,
        status: status as any,
        sortDir: "desc",
    });

    return (
        <PageShell
            title="Orders"
            actions={
                <Button asChild>
                    <Link to="/orders/new">
                        <Plus className="mr-2 h-4 w-4" /> New Order
                    </Link>
                </Button>
            }
        >
            {/* Status tabs */}
            <div className="flex gap-1 flex-wrap mb-4 border-b">
                {STATUS_TABS.map((tab) => (
                    <button
                        key={tab.label}
                        className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${status === tab.value
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        onClick={() => { setStatus(tab.value); setPage(1); }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <Input
                placeholder="Search by order number or customer..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="max-w-sm mb-4"
            />

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order #</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Priority</TableHead>
                                <TableHead>Items</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Est. Ship</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data?.items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                        No orders found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {data?.items.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell>
                                        <Link
                                            to="/orders/$orderId"
                                            params={{ orderId: order.id.toString() }}
                                            className="font-mono font-medium hover:underline text-sm"
                                        >
                                            {order.orderNumber}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-sm">{order.customerName ?? "—"}</TableCell>
                                    <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                                    <TableCell><OrderPriorityBadge priority={order.priority} /></TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{order.itemCount}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(order.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {order.estimatedShippingDate
                                            ? new Date(order.estimatedShippingDate).toLocaleDateString()
                                            : "—"}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {data && data.total > 0 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                    <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {page} of {Math.ceil(data.total / data.perPage)}
                    </span>
                    <Button
                        variant="outline"
                        disabled={page * data.perPage >= data.total}
                        onClick={() => setPage(page + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </PageShell>
    );
}
