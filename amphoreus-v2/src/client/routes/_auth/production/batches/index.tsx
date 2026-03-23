import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc } from "../../../../lib/trpc";
import {
    Layers,
    Plus,
    Search,
    ArrowRight,
    Clock,
    CheckCircle2,
    XCircle,
    PlayCircle
} from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/production/batches/")({
    component: BatchesPage,
});

function BatchesPage() {
    const { t } = useTranslation("production");
    const { data: batches, isLoading } = trpc.production.batches.list.useQuery();

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "planned": return <Clock className="w-3.5 h-3.5 text-blue-500" />;
            case "in_progress": return <PlayCircle className="w-3.5 h-3.5 text-orange-500 animate-pulse" />;
            case "completed": return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
            case "cancelled": return <XCircle className="w-3.5 h-3.5 text-destructive" />;
            default: return null;
        }
    };

    const getStatusBadge = (status: string) => {
        const base = "text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full border";
        switch (status) {
            case "planned": return `${base} bg-blue-50 text-blue-600 border-blue-200`;
            case "in_progress": return `${base} bg-orange-50 text-orange-600 border-orange-200`;
            case "completed": return `${base} bg-green-50 text-green-600 border-green-200`;
            case "cancelled": return `${base} bg-destructive/10 text-destructive border-destructive/20`;
            default: return base;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Layers className="w-6 h-6 text-primary" />
                    {t("batches.title")}
                </h1>
                <Link
                    to="/production/batches/new"
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    {t("batches.scheduleBatch")}
                </Link>
            </div>

            <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50 border-b text-muted-foreground">
                            <tr>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">{t("batches.batchNumber")}</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">{t("batches.recipeProduct")}</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">{t("batches.quantity")}</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">{t("batches.status")}</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">{t("batches.started")}</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px] text-right">{t("batches.action")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {isLoading ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground animate-pulse">{t("batches.retrievingData")}</td></tr>
                            ) : batches?.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">{t("batches.noBatchesScheduled")}</td></tr>
                            ) : (
                                batches?.map((batch) => (
                                    <tr key={batch.id} className="hover:bg-muted/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-foreground group-hover:text-primary transition-colors">{batch.batchNumber}</p>
                                            <p className="text-[10px] text-muted-foreground">{t("batches.id", { id: batch.id.slice(0, 8) })}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-medium">{batch.recipe.name}</p>
                                            <p className="text-xs text-muted-foreground">{batch.recipe.product.name}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-0.5">
                                                <p className="font-bold">{batch.plannedQuantity} <span className="text-[10px] text-muted-foreground font-normal uppercase">{t("batches.planned")}</span></p>
                                                {batch.actualQuantity && <p className="text-[10px] text-green-600 font-bold italic">{t("batches.produced", { actual: batch.actualQuantity })}</p>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                {getStatusIcon(batch.status)}
                                                <span className={getStatusBadge(batch.status)}>{batch.status.replace("_", " ")}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {batch.startedAt ? format(new Date(batch.startedAt), "MMM d, HH:mm") : "-"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-end">
                                                <Link
                                                    to="/production/batches/$batchId"
                                                    params={{ batchId: batch.id }}
                                                    className="p-2 border rounded-lg hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all shadow-sm"
                                                >
                                                    <ArrowRight className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
