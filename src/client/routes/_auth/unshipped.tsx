import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { PageShell } from "../../components/layout/PageShell";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { format } from "date-fns";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "../../components/ui/skeleton";

export const Route = createFileRoute("/_auth/unshipped" as any)({
    component: UnshippedItemsPage,
});

function UnshippedItemsPage() {
    const { t } = useTranslation("orders");
    const { data: items, isLoading } = trpc.orders.listUnshipped.useQuery();

    return (
        <PageShell title={t("unshippedItems", "Unshipped Items")}>
            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("table.orderNumber", "Order #")}</TableHead>
                            <TableHead>{t("table.customer", "Customer")}</TableHead>
                            <TableHead>{t("table.product", "Product")}</TableHead>
                            <TableHead className="text-center">{t("table.quantity", "Quantity")}</TableHead>
                            <TableHead>{t("table.date", "Date")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                                </TableRow>
                            ))
                        ) : items?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                    No unshipped items found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items?.map((item: any, idx: number) => (
                                <TableRow key={idx}>
                                    <TableCell>
                                        <Link
                                            to="/orders/$orderId"
                                            params={{ orderId: item.orderId.toString() }}
                                            className="font-medium text-blue-600 hover:underline"
                                        >
                                            {item.orderNumber}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{item.customerName}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{item.productName}</span>
                                            <span className="text-xs text-gray-500">{item.sku}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-sm">{item.shippedQuantity} / {item.quantity}</span>
                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                                                {item.remainingQuantity} {t("remaining", "left")}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {format(new Date(item.orderDate), "PP")}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </PageShell>
    );
}
