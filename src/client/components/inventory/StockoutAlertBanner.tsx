import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface StockoutAlertBannerProps {
    criticalCount: number;
}

export function StockoutAlertBanner({ criticalCount }: StockoutAlertBannerProps) {
    if (criticalCount === 0) return null;
    return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-200">Immediate Action Required</h3>
                <p className="text-sm mt-0.5">
                    {criticalCount} {criticalCount === 1 ? 'product is' : 'products are'} predicted to stockout in less than 7 days.
                </p>
            </div>
            <Link
                to="/inventory/predictions"
                className="text-sm whitespace-nowrap font-medium text-red-900 dark:text-red-100 bg-red-100 dark:bg-red-800/50 px-4 py-2 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors mt-2 sm:mt-0 w-full sm:w-auto text-center"
            >
                View Forecasts
            </Link>
        </div>
    );
}
