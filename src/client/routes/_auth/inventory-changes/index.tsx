import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../../lib/trpc";
import { PageShell } from "../../../components/layout/PageShell";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { format } from "date-fns";
import { el } from "date-fns/locale";

export const Route = createFileRoute("/_auth/inventory-changes/")({
    component: InventoryChangesPage,
});

function InventoryChangesPage() {
    const { t } = useTranslation("products");
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [changeType, setChangeType] = useState("all");

    const { data, isLoading } = trpc.products.listHistory.useQuery({
        page,
        perPage: 20,
        search: search || undefined,
        changeType: changeType !== "all" ? changeType : undefined,
    });

    const changeTypes = [
        "all",
        "manual_adjustment",
        "order_shipped",
        "order_cancelled",
        "return_received",
        "stock_received",
        "damaged",
        "cycle_count",
        "reservation",
        "reservation_released",
        "picking"
    ];

    return (
        <PageShell title="Global Stock Changes">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
                <Input
                    placeholder={t("searchPlaceholder", "Search by product name or SKU...")}
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                    className="max-w-xs bg-white"
                />

                <div className="flex gap-2 flex-wrap max-w-2xl bg-white p-1 rounded-md border">
                    {changeTypes.map((type) => (
                        <Button
                            key={type}
                            variant={changeType === type ? "default" : "ghost"}
                            size="sm"
                            onClick={() => {
                                setChangeType(type);
                                setPage(1);
                            }}
                            className="capitalize"
                        >
                            {type === "all" ? "All Changes" : t(`history.types.${type}`, type.replace(/_/g, " "))}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Change</TableHead>
                            <TableHead className="text-center">Before / After</TableHead>
                            <TableHead>Notes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                    Loading inventory changes...
                                </TableCell>
                            </TableRow>
                        ) : data?.items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                    No stock changes found matching your filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.items.map((item) => {
                                const isPositive = item.quantityChanged > 0;
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-sm text-gray-500 whitespace-nowrap">
                                            {format(new Date(item.timestamp), "MMM d, yyyy HH:mm", {
                                                locale: el,
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{item.product.name}</div>
                                            <div className="text-xs text-gray-500 uppercase">{item.product.sku}</div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="capitalize text-sm font-medium text-gray-700">
                                                {t(`history.types.${item.changeType}`, item.changeType.replace(/_/g, " "))}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant={isPositive ? "default" : "destructive"}>
                                                {isPositive ? "+" : ""}
                                                {item.quantityChanged}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-sm font-medium text-gray-600">
                                                {item.previousQuantity} <span className="text-gray-300 mx-1">→</span>{" "}
                                                <span className={isPositive ? "text-emerald-600" : "text-red-500"}>
                                                    {item.newQuantity}
                                                </span>
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                                            {item.notes || "—"}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {data && data.total > 0 && (
                <div className="flex justify-center items-center gap-4 mt-8">
                    <Button
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-gray-600 font-medium">
                        Page {page} of {Math.ceil(data.total / data.perPage)}
                    </span>
                    <Button
                        variant="outline"
                        disabled={page >= Math.ceil(data.total / data.perPage)}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </PageShell>
    );
}
