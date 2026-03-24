import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../../lib/trpc";
import { PageShell } from "../../../components/layout/PageShell";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../../components/ui/select";
import { LineItemEditor } from "../../../components/orders/LineItemEditor";
import { CustomerCombobox } from "../../../components/orders/CustomerCombobox";
import { QuickCreateCustomerPopover } from "../../../components/customers/QuickCreateCustomerPopover";
import { UnshippedSuggestions } from "../../../components/orders/UnshippedSuggestions";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_auth/orders/new")({
    component: NewOrderPage,
});

interface LineItem {
    productId: number;
    productName: string;
    sku: string;
    quantity: number;
    available: number;
}

function NewOrderPage() {
    const navigate = useNavigate();
    const [customerId, setCustomerId] = useState<number | null>(null);
    const [priority, setPriority] = useState<"normal" | "high" | "urgent">("normal");
    const [notes, setNotes] = useState("");
    const [area, setArea] = useState("");
    const [estimatedDate, setEstimatedDate] = useState("");
    const [items, setItems] = useState<LineItem[]>([]);
    const { t } = useTranslation("orders");

    const createMutation = trpc.orders.create.useMutation({
        onSuccess: (order) => {
            navigate({ to: "/orders/$orderId", params: { orderId: order.id.toString() } });
        },
    });

    const canSubmit =
        !!customerId &&
        items.length > 0 &&
        items.every((i) => i.quantity <= i.available) &&
        !createMutation.isPending;

    const handleSubmit = () => {
        if (!customerId) return;
        createMutation.mutate({
            customerId,
            priority,
            notes: notes || undefined,
            area: area || undefined,
            estimatedShippingDate: estimatedDate || undefined,
            items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        });
    };

    const addSuggestedItem = (product: { id: number; name: string; sku: string; availableStock: number }, quantity: number) => {
        if (items.some((i) => i.productId === product.id)) return;
        setItems([
            ...items,
            {
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                quantity: Math.min(quantity, product.availableStock),
                available: product.availableStock,
            },
        ]);
    };

    return (
        <PageShell
            title={t("newOrder")}
            actions={
                <Button variant="outline" onClick={() => navigate({ to: "/orders" })}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t("back")}
                </Button>
            }
        >
            <div className="max-w-3xl space-y-6">
                {/* Customer */}
                <div className="space-y-2">
                    <Label>{t("form.customer")}</Label>
                    <div className="flex items-center gap-2">
                        <CustomerCombobox
                            value={customerId}
                            onChange={(id) => setCustomerId(id)}
                        />
                        <QuickCreateCustomerPopover
                            onCreated={(c) => setCustomerId(c.id)}
                        />
                    </div>
                </div>

                {/* Suggestions */}
                {customerId && (
                    <UnshippedSuggestions
                        customerId={customerId}
                        onAdd={addSuggestedItem}
                        alreadyAddedIds={items.map((i) => i.productId)}
                    />
                )}

                {/* Priority */}
                <div className="space-y-2">
                    <Label>{t("form.priority")}</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                        <SelectTrigger className="w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="normal">{t("form.priorities.normal")}</SelectItem>
                            <SelectItem value="high">{t("form.priorities.high")}</SelectItem>
                            <SelectItem value="urgent">{t("form.priorities.urgent")}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Line items */}
                <div className="space-y-2">
                    <Label>{t("form.items")}</Label>
                    <LineItemEditor items={items} onChange={setItems} />
                </div>

                {/* Estimated shipping date */}
                <div className="space-y-2">
                    <Label>{t("form.estShipDate")}</Label>
                    <Input
                        type="date"
                        value={estimatedDate}
                        onChange={(e) => setEstimatedDate(e.target.value)}
                        className="w-48"
                    />
                </div>

                {/* Area */}
                <div className="space-y-2">
                    <Label>{t("form.area", "Shipping Area")}</Label>
                    <Input
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className="w-full"
                        placeholder="e.g. North Zone, Local Delivery"
                    />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <Label>{t("form.notes")}</Label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder={t("form.notesPlaceholder")}
                    />
                </div>

                {/* Error display */}
                {createMutation.error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800 text-sm">
                        {createMutation.error.message}
                    </div>
                )}

                {/* Submit */}
                <div className="flex justify-end">
                    <Button onClick={handleSubmit} disabled={!canSubmit} size="lg">
                        {createMutation.isPending ? t("form.creating") : t("form.create")}
                    </Button>
                </div>
            </div>
        </PageShell>
    );
}
