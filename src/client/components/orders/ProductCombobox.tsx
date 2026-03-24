import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown } from "lucide-react";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "../ui/popover";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

interface Product {
    id: number;
    name: string;
    sku: string;
    availableStock: number;
}

interface Props {
    onSelect: (product: Product) => void;
    excludeIds?: number[];
}

export function ProductCombobox({ onSelect, excludeIds = [] }: Props) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const { t } = useTranslation("orders");

    const { data, isLoading } = trpc.products.list.useQuery({
        search: search || undefined,
        perPage: 30,
        stockStatus: "in_stock",
    });

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal" type="button">
                    {t("components.productAdd")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[28rem] p-0">
                <div className="p-2 border-b">
                    <Input
                        placeholder={t("components.productSearch")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8"
                    />
                </div>
                <div className="max-h-60 overflow-y-auto">
                    {isLoading && (
                        <p className="text-sm text-muted-foreground p-3">{t("components.productLoading")}</p>
                    )}
                    {!isLoading && data?.items.length === 0 && (
                        <p className="text-sm text-muted-foreground p-3">{t("components.productNone")}</p>
                    )}
                    {data?.items
                        .filter((p) => !excludeIds.includes(p.id))
                        .map((p) => (
                            <button
                                key={p.id}
                                className="flex w-full items-center gap-3 px-3 py-2 hover:bg-accent text-sm disabled:opacity-40"
                                disabled={p.availableStock <= 0}
                                onClick={() => {
                                    onSelect({
                                        id: p.id,
                                        name: p.name,
                                        sku: p.sku,
                                        availableStock: p.availableStock,
                                    });
                                    setOpen(false);
                                    setSearch("");
                                }}
                            >
                                <div className="flex-1 text-left">
                                    <p className="font-medium">{p.name}</p>
                                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                                </div>
                                <Badge
                                    variant={p.availableStock > 0 ? "default" : "destructive"}
                                    className="text-xs"
                                >
                                    {t("components.productAvail", { avail: p.availableStock })}
                                </Badge>
                            </button>
                        ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
