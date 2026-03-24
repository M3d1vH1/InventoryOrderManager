import { AlertTriangle, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ProductCombobox } from "./ProductCombobox";

interface LineItem {
    productId: number;
    productName: string;
    sku: string;
    quantity: number;
    available: number;
}

interface Props {
    items: LineItem[];
    onChange: (items: LineItem[]) => void;
}

export function LineItemEditor({ items, onChange }: Props) {
    const { t } = useTranslation("orders");

    const addItem = (product: { id: number; name: string; sku: string; availableStock: number }) => {
        if (items.some((i) => i.productId === product.id)) return; // no dupes
        onChange([
            ...items,
            {
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                quantity: 1,
                available: product.availableStock,
            },
        ]);
    };

    const updateQuantity = (idx: number, qty: number) => {
        const next = [...items];
        next[idx] = { ...next[idx], quantity: Math.max(1, qty) };
        onChange(next);
    };

    const removeItem = (idx: number) => {
        onChange(items.filter((_, i) => i !== idx));
    };

    return (
        <div className="space-y-3">
            <ProductCombobox
                onSelect={addItem}
                excludeIds={items.map((i) => i.productId)}
            />

            {items.length > 0 && (
                <div className="border rounded-md divide-y">
                    {items.map((item, idx) => (
                        <div key={item.productId} className="flex items-center gap-3 p-3">
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.productName}</p>
                                <p className="text-xs text-muted-foreground">{item.sku}</p>
                                {item.quantity > item.available && (
                                    <span className="text-red-600 text-xs flex items-center gap-1 mt-0.5">
                                        <AlertTriangle className="h-3 w-3" />
                                        {t("components.lineItemExceeds", { qty: item.available })}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">
                                    {t("components.lineItemAvail")}: <span className="font-medium">{item.available}</span>
                                </p>
                                <Input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => updateQuantity(idx, parseInt(e.target.value) || 1)}
                                    className="w-20 text-center h-8"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    className="h-8 w-8 text-red-500 hover:text-red-600"
                                    onClick={() => removeItem(idx)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {items.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">
                    {t("components.lineItemNone")}
                </p>
            )}
        </div>
    );
}
