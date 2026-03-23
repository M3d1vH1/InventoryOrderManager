import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Box } from "lucide-react";
import { trpc } from "../../../lib/trpc";
import { PageShell } from "../../../components/layout/PageShell";
import { ProductForm } from "../../../components/products/ProductForm";
import { StockAdjustmentDialog } from "../../../components/products/StockAdjustmentDialog";
import { InventoryHistory } from "../../../components/products/InventoryHistory";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";

export const Route = createFileRoute("/_auth/products/$productId")({
    component: ProductDetailPage,
});

function ProductDetailPage() {
    const { productId } = Route.useParams();
    const numericId = Number(productId);
    const navigate = useNavigate();
    const [adjustmentOpen, setAdjustmentOpen] = useState(false);
    const { t } = useTranslation("products");

    const { data: product, isLoading } = trpc.products.getById.useQuery({
        id: numericId,
    });

    if (isLoading) {
        return (
            <PageShell title={t("detail.loading")}>
                <div className="space-y-6 max-w-5xl">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-4">
                            <Skeleton className="h-96 w-full rounded-lg" />
                        </div>
                        <Skeleton className="h-96 w-full rounded-lg" />
                    </div>
                </div>
            </PageShell>
        );
    }

    if (!product) {
        return (
            <PageShell title={t("detail.notFoundTitle")}>
                <p className="text-gray-500">{t("detail.notFoundMessage")}</p>
                <Button className="mt-4" onClick={() => navigate({ to: "/products" })}>
                    {t("detail.return")}
                </Button>
            </PageShell>
        );
    }

    return (
        <PageShell
            title={product.name}
            actions={
                <Button variant="outline" onClick={() => navigate({ to: "/products" })}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t("detail.back")}
                </Button>
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl">
                {/* Main Details & Edit form */}
                <div className="md:col-span-2 space-y-6">
                    <ProductForm
                        initialData={product}
                        onSubmitSuccess={() => {
                            // Stay on page after edit, notify user, or invalidating happens automatically
                        }}
                    />
                </div>

                {/* Inventory Sidebar Sidebar */}
                <div className="space-y-6">
                    <div className="bg-white border rounded-xl p-6 shadow-sm">
                        <h3 className="font-semibold text-lg border-b pb-4 mb-4 flex items-center">
                            <Box className="w-5 h-5 mr-2 text-blue-600" /> {t("detail.inventoryTitle")}
                        </h3>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">{t("detail.availableStock")}</span>
                                <span className="text-2xl font-bold">
                                    {product.availableStock}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">{t("detail.currentOnHand")}</span>
                                <span className="font-medium">{product.currentStock}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-b pb-4">
                                <span className="text-gray-500">{t("detail.reservedOrders")}</span>
                                <span className="font-medium text-amber-600">
                                    {product.reservedStock}
                                </span>
                            </div>

                            <div className="pt-2">
                                <Button
                                    className="w-full"
                                    variant="secondary"
                                    onClick={() => setAdjustmentOpen(true)}
                                >
                                    {t("detail.adjustStockBtn")}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border rounded-xl p-6 shadow-sm">
                        <InventoryHistory changes={product.inventoryHistory} />
                    </div>
                </div>
            </div>

            <StockAdjustmentDialog
                productId={numericId}
                open={adjustmentOpen}
                onOpenChange={setAdjustmentOpen}
            />
        </PageShell>
    );
}
