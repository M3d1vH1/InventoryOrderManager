import { trpc } from "../../lib/trpc";
import { Link } from "@tanstack/react-router";
import { TrendingDown } from "lucide-react";

export function ReorderAlerts() {
    const { data: alerts } = trpc.inventory.reorderAlerts.useQuery({ limit: 5 }, {
        staleTime: 300_000,
    });

    if (!alerts || alerts.length === 0) return null;

    return (
        <div className="bg-card rounded-xl border border-amber-200 dark:border-amber-900/50 mt-6 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-900/10 rounded-t-xl">
                <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                    <h3 className="text-sm font-semibold text-foreground">Reorder Needed</h3>
                    <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center justify-center">
                        {alerts.length}
                    </span>
                </div>
                <Link to="/products" className="text-xs text-blue-600 hover:underline font-medium">
                    View all →
                </Link>
            </div>
            <ul className="divide-y">
                {alerts.map((alert: any) => (
                    <li key={alert.productId} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                        <span className="text-sm font-medium truncate flex-1 pr-4">{alert.productName}</span>
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-bold ml-2 shrink-0 bg-amber-100/50 dark:bg-amber-900/20 px-2 py-1 rounded">
                            {alert.currentStock} left
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
