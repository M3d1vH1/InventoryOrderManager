import { MapPin, CheckCircle } from "lucide-react";

export interface PickItemCardProps {
    item: {
        id: number;
        productName: string;
        sku?: string;
        quantity: number;
        location?: string;
        isPicked: boolean;
    };
    onPick: () => void;
}

export function PickItemCard({ item, onPick }: PickItemCardProps) {
    return (
        <div
            id={`pick-item-${item.id}`}
            className={`
                flex flex-col p-4 rounded-xl border transition-all duration-300
                ${item.isPicked
                    ? "border-green-300 bg-green-50 shadow-none opacity-80"
                    : "border-gray-200 bg-card shadow-sm"
                }
            `}
        >
            {/* Top row: product name + quantity */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className={`text-base font-semibold leading-snug ${item.isPicked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {item.productName}
                    </p>
                    {item.sku && (
                        <p className="text-xs text-muted-foreground mt-0.5">SKU: {item.sku}</p>
                    )}
                </div>
                <div className="shrink-0 text-right">
                    <span className="text-2xl font-bold text-foreground">{item.quantity}</span>
                    <span className="text-xs text-muted-foreground block">pcs</span>
                </div>
            </div>

            {/* Bin location — prominent */}
            {item.location && (
                <div className="mt-3 flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg px-3 py-2 border border-yellow-200 dark:border-yellow-900/50">
                    <MapPin className="w-4 h-4 text-yellow-600 dark:text-yellow-500 shrink-0" />
                    <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-400 tracking-wide">
                        {item.location}
                    </span>
                </div>
            )}

            {/* Pick button — full width, large tap target */}
            <button
                onClick={onPick}
                disabled={item.isPicked}
                className={`
                    mt-3 w-full h-12 rounded-lg font-semibold text-sm transition-all
                    touch-manipulation focus:outline-none focus:ring-2 focus:ring-primary/50
                    active:scale-[0.98]
                    ${item.isPicked
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default"
                        : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                    }
                `}
            >
                {item.isPicked ? (
                    <span className="flex items-center justify-center gap-2">
                        <CheckCircle className="w-5 h-5" /> Picked ✓
                    </span>
                ) : (
                    "Mark as Picked"
                )}
            </button>
        </div>
    );
}
