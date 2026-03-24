import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../lib/trpc";
import { useState } from "react";
import { ChevronDown, RefreshCw, Box, AlertTriangle } from "lucide-react";
import { SeasonalChart } from "../../../components/inventory/SeasonalChart";
import { StockoutAlertBanner } from "../../../components/inventory/StockoutAlertBanner";

export const Route = createFileRoute("/_auth/inventory/predictions")({
    component: PredictionsPage,
});

function PredictionsPage() {
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const { data: user } = trpc.auth.me.useQuery();
    const isAdmin = user?.role === "admin" || user?.role === "front_office";

    const utils = trpc.useUtils();
    const { data: predictions, isFetching } = trpc.predictions.getAll.useQuery();

    const { mutate: recalculate, isPending: isRecalculating } = trpc.predictions.recalculate.useMutation({
        onSuccess: () => {
            utils.predictions.getAll.invalidate();
        }
    });

    const criticalCount = predictions?.filter(p => p.daysUntilStockout <= 7 && p.daysUntilStockout >= 0)?.length || 0;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Box className="w-6 h-6 text-blue-600" />
                        Inventory Predictions
                    </h1>
                    <p className="text-gray-500 mt-1">AI-assisted demand forecasting and optimal reorder levels.</p>
                </div>

                {isAdmin && (
                    <button
                        onClick={() => recalculate()}
                        disabled={isRecalculating}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
                        {isRecalculating ? "Recalculating..." : "Recalculate Models"}
                    </button>
                )}
            </div>

            <StockoutAlertBanner criticalCount={criticalCount} />

            <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 border-b">
                            <tr>
                                <th className="p-4 font-medium">Product</th>
                                <th className="p-4 font-medium text-right">Available</th>
                                <th className="p-4 font-medium text-right">Daily Demand</th>
                                <th className="p-4 font-medium text-right">Runway</th>
                                <th className="p-4 font-medium text-right">Reorder Qty</th>
                                <th className="p-4 font-medium text-center">Confidence</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isFetching && !predictions ? (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-gray-500">Loading forecasts...</td>
                                </tr>
                            ) : predictions?.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-gray-500">No predictions available. Run calculation first.</td>
                                </tr>
                            ) : predictions?.map(item => {
                                const isCritical = item.daysUntilStockout <= 7 && item.daysUntilStockout >= 0;
                                const isWarning = item.daysUntilStockout > 7 && item.daysUntilStockout <= 14;

                                return (
                                    <React.Fragment key={item.productId}>
                                        <tr
                                            className="hover:bg-gray-50 transition-colors cursor-pointer group"
                                            onClick={() => setExpandedId(expandedId === item.productId ? null : item.productId)}
                                        >
                                            <td className="p-4 font-medium flex items-center gap-3">
                                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === item.productId ? 'rotate-180' : ''}`} />
                                                {item.productName}
                                            </td>
                                            <td className="p-4 text-right tabular-nums">{item.availableStock}</td>
                                            <td className="p-4 text-right text-gray-600 tabular-nums">{item.avgDailyDemand > 0 ? item.avgDailyDemand.toFixed(2) : '-'}</td>
                                            <td className="p-4 text-right">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                          ${item.daysUntilStockout === 999 ? 'bg-gray-100 text-gray-600' :
                                                        isCritical ? 'bg-red-100 text-red-700' :
                                                            isWarning ? 'bg-amber-100 text-amber-800' :
                                                                'bg-green-100 text-green-700'}`}
                                                >
                                                    {isCritical && <AlertTriangle className="w-3 h-3" />}
                                                    {item.daysUntilStockout === 999 ? '999+d' : `${item.daysUntilStockout}d`}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-medium text-blue-800 tabular-nums">
                                                {item.suggestedReorderQty > 0 ? `+${item.suggestedReorderQty}` : '-'}
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="w-16 h-2 bg-gray-100 rounded-full mx-auto overflow-hidden">
                                                    <div
                                                        className={`h-full ${item.confidence > 0.8 ? 'bg-green-500' : item.confidence > 0.4 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                        style={{ width: `${item.confidence * 100}%` }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedId === item.productId && (
                                            <tr className="bg-slate-50 border-b shadow-inner">
                                                <td colSpan={6} className="p-0">
                                                    <div className="px-6 py-6 border-l-4 border-blue-500">
                                                        <h4 className="text-sm font-semibold text-gray-800 mb-2">12-Month Demand Multiplier</h4>
                                                        <SeasonalChartWrapper productId={item.productId} />
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function SeasonalChartWrapper({ productId }: { productId: number }) {
    const { data, isFetching } = trpc.predictions.getSeasonalPatterns.useQuery({ productId });

    if (isFetching) return <div className="h-40 flex items-center justify-center text-sm text-gray-500">Loading seasonal data...</div>;
    if (!data?.length) return <div className="h-40 flex items-center justify-center text-sm text-gray-500">Not enough history to model season.</div>;

    return <SeasonalChart data={data} />;
}
