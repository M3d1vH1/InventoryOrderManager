import { formatDistanceToNow } from "date-fns";
import { Badge } from "../../components/ui/badge";
import { useTranslation } from "react-i18next";

interface InventoryChange {
    id: number;
    quantityChanged: number;
    changeType: string;
    notes: string | null;
    timestamp: Date | string; // Handle trpc serialization generically
}

export function InventoryHistory({
    changes,
}: {
    changes: InventoryChange[];
}) {
    const { t, i18n } = useTranslation("products");
    if (changes.length === 0) {
        return <p className="text-sm text-muted-foreground">{t("history.empty")}</p>;
    }

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">{t("history.title")}</h3>
            <div className="border-l-2 border-gray-100 ml-3 space-y-4">
                {changes.map((c) => {
                    const isPositive = c.quantityChanged > 0;
                    return (
                        <div key={c.id} className="relative pl-6 py-1">
                            <span
                                className="absolute left-[-5px] top-3 h-2 w-2 rounded-full border border-white"
                                style={{
                                    backgroundColor: isPositive ? "#10b981" : "#ef4444",
                                }}
                            />
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <div className="flex items-center gap-3">
                                    <Badge variant={isPositive ? "default" : "destructive"}>
                                        {isPositive ? "+" : ""}
                                        {c.quantityChanged}
                                    </Badge>
                                    <span className="text-sm font-medium text-gray-700 capitalize">
                                        {t(`history.types.${c.changeType}`, c.changeType.replace(/_/g, " "))}
                                    </span>
                                </div>
                                {c.notes && (
                                    <span className="text-sm text-gray-500 max-w-[200px] truncate sm:max-w-xs">
                                        — {c.notes}
                                    </span>
                                )}
                                <span className="sm:ml-auto text-xs text-gray-400">
                                    {formatDistanceToNow(new Date(c.timestamp), {
                                        addSuffix: true,
                                    })}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
