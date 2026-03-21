import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../../../lib/trpc";
import { Server, Database, HardDrive, RefreshCw, AlertTriangle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_auth/settings/system")({
    component: SystemDiagnosticsPage,
});

function SystemDiagnosticsPage() {
    const { data: info, isLoading, refetch } = trpc.settings.system.info.useQuery();
    const [clearing, setClearing] = useState(false);

    const clearCacheMutation = trpc.settings.system.clearCache.useMutation({
        onMutate: () => setClearing(true),
        onSettled: () => {
            setClearing(false);
            alert("System cache cleared successfully.");
            refetch();
        }
    });

    if (isLoading) {
        return (
            <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            </div>
        );
    }

    if (!info) return null;

    const uptimeHrs = Math.floor(info.uptime / 3600);
    const uptimeMins = Math.floor((info.uptime % 3600) / 60);

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-gray-900">System Diagnostics</h2>
                    <p className="text-sm text-gray-500">
                        View current application performance and manage volatile state.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        <span className="h-2 w-2 rounded-full bg-green-500"></span>
                        {info.environment}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-blue-50 p-3">
                            <Server className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Node Uptime</p>
                            <p className="text-xl font-bold text-gray-900">{uptimeHrs}h {uptimeMins}m</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-purple-50 p-3">
                            <HardDrive className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Node Memory</p>
                            <p className="text-xl font-bold text-gray-900">
                                {Math.round(info.memoryUsage.rss / 1024 / 1024)} MB
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-green-50 p-3">
                            <Database className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Postgres Size</p>
                            <p className="text-xl font-bold text-gray-900">{info.databaseSize}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg bg-orange-50 p-3">
                            <RefreshCw className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-500">Node Version</p>
                            <p className="text-xl font-bold text-gray-900">{info.nodeVersion}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 px-6 py-4">
                        <h3 className="text-lg font-medium text-gray-900">Postgres Tables</h3>
                    </div>
                    <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                        {info.tableSizes.map((t, idx) => (
                            <li key={idx} className="flex items-center justify-between px-6 py-4">
                                <span className="text-sm font-medium text-gray-900">{String(t.table_name)}</span>
                                <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                    {String(t.row_count)} rows
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                        <h3 className="text-lg font-medium text-red-900">Danger Zone</h3>
                    </div>
                    <p className="text-sm text-red-700 mb-6">
                        System caching ensures maximum performance for inventory and analytics.
                        Clearing the cache forces all next requests to query the live database.
                        Use only if experiencing caching inconsistencies.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm("Are you sure you want to flush all Redis cache?")) {
                                clearCacheMutation.mutate();
                            }
                        }}
                        disabled={clearing}
                        className="w-full flex justify-center items-center gap-2 rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                        {clearing ? "Flushing Cache..." : "Clear Application Cache"}
                    </button>
                </div>
            </div>
        </div>
    );
}
