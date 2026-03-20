import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Trash2, ClipboardList } from "lucide-react";
import { trpc } from "../../../lib/trpc";
import { PageShell } from "../../../components/layout/PageShell";
import { CustomerForm } from "../../../components/customers/CustomerForm";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Badge } from "../../../components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../../components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "../../../components/ui/dialog";

export const Route = createFileRoute("/_auth/customers/$customerId")({
    component: CustomerDetailPage,
});

const STATUS_COLORS: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    shipped: "bg-green-100 text-green-800",
    delivered: "bg-green-200 text-green-900",
    cancelled: "bg-red-100 text-red-800",
    on_hold: "bg-gray-100 text-gray-700",
};

function CustomerDetailPage() {
    const { customerId } = Route.useParams();
    const numericId = Number(customerId);
    const navigate = useNavigate();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const { data: customer, isLoading } = trpc.customers.getById.useQuery({ id: numericId });
    const utils = trpc.useUtils();

    const deleteMutation = trpc.customers.delete.useMutation({
        onSuccess: () => {
            utils.customers.list.invalidate();
            navigate({ to: "/customers" });
        },
        onError: (err) => setDeleteError(err.message),
    });

    if (isLoading) {
        return (
            <PageShell title="Loading...">
                <div className="space-y-4 max-w-5xl">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-64 w-full rounded-lg" />
                    <Skeleton className="h-48 w-full rounded-lg" />
                </div>
            </PageShell>
        );
    }

    if (!customer) {
        return (
            <PageShell title="Customer Not Found">
                <p className="text-muted-foreground">This customer could not be found.</p>
                <Button className="mt-4" onClick={() => navigate({ to: "/customers" })}>
                    Return to Customers
                </Button>
            </PageShell>
        );
    }

    return (
        <PageShell
            title={customer.name}
            actions={
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => navigate({ to: "/customers" })}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={() => { setDeleteError(null); setDeleteOpen(true); }}
                    >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                </div>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
                {/* Edit Form */}
                <div className="lg:col-span-2">
                    <CustomerForm
                        initialData={customer}
                        onSubmitSuccess={() => {
                            utils.customers.getById.invalidate({ id: numericId });
                        }}
                    />
                </div>

                {/* Order Summary Sidebar */}
                <div className="space-y-4">
                    <div className="bg-white border rounded-xl p-5 shadow-sm">
                        <h3 className="font-semibold text-base flex items-center gap-2 mb-4">
                            <ClipboardList className="h-4 w-4 text-blue-600" /> Order Summary
                        </h3>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground text-sm">Total Orders</span>
                                <span className="font-bold text-lg">{customer.orderCount}</span>
                            </div>
                            {customer.lastOrderDate && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground text-sm">Last Order</span>
                                    <span className="text-sm font-medium">
                                        {new Date(customer.lastOrderDate).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {customer.recentOrders.length > 0 && (
                        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                            <div className="px-5 py-3 border-b">
                                <h3 className="font-semibold text-sm">Recent Orders</h3>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs">Order #</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                        <TableHead className="text-xs">Date</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customer.recentOrders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="text-xs font-mono">
                                                {order.orderNumber}
                                            </TableCell>
                                            <TableCell>
                                                <span
                                                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
                                                        }`}
                                                >
                                                    {order.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Customer</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{customer.name}</strong>? This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {deleteError && (
                        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                            {deleteError}
                        </div>
                    )}
                    <div className="flex justify-end gap-2 mt-2">
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate({ id: numericId })}
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </PageShell>
    );
}
