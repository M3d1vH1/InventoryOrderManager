import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ShoppingCart, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface UnshippedItem {
    id: number;
    productId: number;
    productName: string;
    sku: string;
    remainingQuantity: number;
    availableStock: number;
}

interface Props {
    customerId: number;
    onAdd: (product: { id: number; name: string; sku: string; availableStock: number }, quantity: number) => void;
    alreadyAddedIds: number[];
}

export function UnshippedSuggestions({ customerId, onAdd, alreadyAddedIds }: Props) {
    const { t } = useTranslation("orders");
    const { data: suggestions, isLoading } = trpc.orders.listUnshippedByCustomer.useQuery(
        { customerId },
        { enabled: !!customerId }
    );

    if (isLoading || !suggestions || suggestions.length === 0) return null;

    const filteredSuggestions = suggestions.filter(
        (s) => !alreadyAddedIds.includes(s.productId) && s.availableStock > 0
    );

    if (filteredSuggestions.length === 0) return null;

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                <ShoppingCart className="h-4 w-4" />
                {t("suggestions.title", "Suggested Items (Unshipped)")}
            </div>
            <p className="text-xs text-amber-800">
                {t("suggestions.description", "The following items were not fully shipped in previous orders and are now in stock:")}
            </p>
            <div className="flex flex-wrap gap-2">
                {filteredSuggestions.map((item) => (
                    <div
                        key={item.id}
                        className="bg-white border border-amber-200 rounded-md p-2 flex items-center gap-3 shadow-sm"
                    >
                        <div className="flex-1">
                            <p className="text-sm font-medium">{item.productName}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px] h-4">
                                    {item.remainingQuantity} {t("remaining", "unshipped")}
                                </Badge>
                                <span className="text-[10px] text-green-600 font-medium">
                                    {item.availableStock} {t("inStock", "in stock")}
                                </span>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-amber-700 hover:text-amber-800 hover:bg-amber-100"
                            onClick={() => onAdd({
                                id: item.productId,
                                name: item.productName,
                                sku: item.sku,
                                availableStock: item.availableStock
                            }, item.remainingQuantity)}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
