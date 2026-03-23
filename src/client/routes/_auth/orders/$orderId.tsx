import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../../lib/trpc";
import { PageShell } from "../../../components/layout/PageShell";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { OrderStatusBadge, OrderPriorityBadge } from "../../../components/orders/OrderStatusBadge";
import { OrderTimeline } from "../../../components/orders/OrderTimeline";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../../components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../../../components/ui/dialog";
import { ShipOrderDialog } from "../../../components/orders/ShipOrderDialog";
import { ArrowLeft, XCircle, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_auth/orders/$orderId")({
    component: OrderDetailPage,
});

const VALID_TRANSITIONS: Record<string, Array<{ value: string; labelKey: string }>> = {
    pending: [{ value: "picked", labelKey: "detail.transitions.markPicked" }],
    picked: [
        { value: "partially_shipped", labelKey: "detail.transitions.markPartiallyShipped" },
        { value: "shipped", labelKey: "detail.transitions.markShipped" },
    ],
    partially_shipped: [{ value: "shipped", labelKey: "detail.transitions.markShipped" }],
    shipped: [],
    cancelled: [],
};

function OrderDetailPage() {
    const { orderId } = Route.useParams();
    const numericId = Number(orderId);
    const navigate = useNavigate();
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [shipOpen, setShipOpen] = useState(false);
    const { t, i18n } = useTranslation("orders");

    const { data: order, isLoading, refetch } = trpc.orders.getById.useQuery({ id: numericId });
    const utils = trpc.useUtils();

    const updateStatusMutation = trpc.orders.updateStatus.useMutation({
        onSuccess: () => {
            refetch();
            utils.orders.list.invalidate();
        },
    });

    const cancelMutation = trpc.orders.cancel.useMutation({
        onSuccess: () => {
            setCancelOpen(false);
            refetch();
            utils.orders.list.invalidate();
        },
        onError: (err) => setCancelError(err.message),
    });

    const removeItemMutation = trpc.orders.removeItem.useMutation({
        onSuccess: () => refetch(),
    });

    if (isLoading) {
        return (
            <PageShell title={t("detail.loading")}>
                <div className="space-y-4 max-w-5xl">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-48 w-full rounded-lg" />
                    <Skeleton className="h-64 w-full rounded-lg" />
                </div>
            </PageShell>
        );
    }

    if (!order) {
        return (
            <PageShell title={t("detail.notFoundTitle")}>
                <p className="text-muted-foreground">{t("detail.notFoundMessage")}</p>
                <Button className="mt-4" onClick={() => navigate({ to: "/orders" })}>
                    {t("detail.return")}
                </Button>
            </PageShell>
        );
    }

    const transitions = VALID_TRANSITIONS[order.status] ?? [];
    const canCancel = order.status !== "shipped" && order.status !== "cancelled";

    return (
        <PageShell
            title={order.orderNumber}
            actions={
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => navigate({ to: "/orders" })}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> {t("back")}
                    </Button>
                    {canCancel && (
                        <Button
                            variant="destructive"
                            onClick={() => { setCancelError(null); setCancelOpen(true); }}
                        >
                            <XCircle className="mr-2 h-4 w-4" /> {t("detail.cancelAction")}
                        </Button>
                    )}
                </div>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Order meta */}
                    <div className="bg-white border rounded-xl p-5 shadow-sm space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <OrderStatusBadge status={order.status} />
                            <OrderPriorityBadge priority={order.priority} />
                            {order.customer && (
                                <Link
                                    to="/customers/$customerId"
                                    params={{ customerId: order.customerId.toString() }}
                                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                >
                                    {order.customer.name}
                                    <ChevronRight className="h-3 w-3" />
                                </Link>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">{t("detail.created")}</p>
                                <p>{new Date(order.createdAt).toLocaleString(i18n.language === "el" ? "el-GR" : "en-GB")}</p>
                            </div>
                            {order.estimatedShippingDate && (
                                <div>
                                    <p className="text-muted-foreground text-xs">{t("detail.estimatedShip")}</p>
                                    <p>{new Date(order.estimatedShippingDate).toLocaleDateString(i18n.language === "el" ? "el-GR" : "en-GB")}</p>
                                </div>
                            )}
                        </div>
                        {order.notes && (
                            <p className="text-sm text-muted-foreground border-t pt-3">{order.notes}</p>
                        )}
                    </div>

                    {/* Status transitions */}
                    {transitions.length > 0 && (
                        <div className="flex gap-2">
                            {transitions.map((trans) => (
                                <Button
                                    key={trans.value}
                                    variant="outline"
                                    disabled={updateStatusMutation.isPending}
                                    onClick={() => {
                                        if (trans.value === "shipped" || trans.value === "partially_shipped") {
                                            setShipOpen(true);
                                        } else {
                                            updateStatusMutation.mutate({ id: numericId, status: trans.value as any });
                                        }
                                    }}
                                >
                                    {t(trans.labelKey)}
                                </Button>
                            ))}
                            {updateStatusMutation.error && (
                                <p className="text-red-600 text-sm self-center">
                                    {updateStatusMutation.error.message}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Line items */}
                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                        <div className="px-5 py-3 border-b font-semibold text-sm">{t("detail.lineItems")}</div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t("tableCols.product")}</TableHead>
                                    <TableHead className="text-center">{t("tableCols.qty")}</TableHead>
                                    <TableHead className="text-center">{t("tableCols.picked")}</TableHead>
                                    {order.status === "pending" && <TableHead />}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <p className="font-medium text-sm">{item.product?.name ?? `Product #${item.productId}`}</p>
                                            <p className="text-xs text-muted-foreground">{item.product?.sku}</p>
                                        </TableCell>
                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                        <TableCell className="text-center">
                                            {item.picked ? (
                                                <span className="text-green-600 text-xs font-medium">{t("detail.pickedTrue")}</span>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </TableCell>
                                        {order.status === "pending" && (
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-600"
                                                    disabled={removeItemMutation.isPending}
                                                    onClick={() => removeItemMutation.mutate({ orderItemId: item.id })}
                                                >
                                                    {t("detail.remove")}
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Sidebar: Timeline */}
                <div className="bg-white border rounded-xl p-5 shadow-sm h-fit">
                    <OrderTimeline entries={order.changelogs ?? []} />
                </div>
            </div>

            {/* Cancel Confirmation Dialog */}
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("detail.cancelDialogTitle")}</DialogTitle>
                        <DialogDescription>
                            {t("detail.cancelMessage1")}<strong>{order.orderNumber}</strong>{t("detail.cancelMessage2")}
                        </DialogDescription>
                    </DialogHeader>
                    {cancelError && (
                        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{cancelError}</div>
                    )}
                    <div className="flex justify-end gap-2 mt-2">
                        <Button variant="outline" onClick={() => setCancelOpen(false)}>{t("detail.keepOrder")}</Button>
                        <Button
                            variant="destructive"
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate({ id: numericId })}
                        >
                            {cancelMutation.isPending ? t("detail.cancelling") : t("detail.yesCancel")}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ShipOrderDialog
                orderId={numericId}
                open={shipOpen}
                onOpenChange={setShipOpen}
            />
        </PageShell>
    );
}
