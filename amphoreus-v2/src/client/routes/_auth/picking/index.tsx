import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { trpc } from "../../../lib/trpc";
import { PageShell } from "../../../components/layout/PageShell";
import { PickingCard } from "../../../components/picking/PickingCard";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";
import { PackageOpen, AlertOctagon } from "lucide-react";

export const Route = createFileRoute("/_auth/picking/")({
    component: PickingPage,
});

function PickingPage() {
    const { t } = useTranslation("picking");
    const { data: queue, isLoading, isError, error } = trpc.picking.queue.useQuery(undefined, {
        refetchInterval: 10_000, // Auto-refresh every 10s
        staleTime: 5_000,
    });

    const urgentCount = queue?.filter((o) => o.priority === "urgent").length ?? 0;

    return (
        <PageShell title={t("title")}>
            <div className="max-w-4xl mx-auto pb-20">
                {isError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex gap-3 text-red-800">
                        <AlertOctagon className="h-5 w-5 shrink-0" />
                        <p className="text-sm">{t("errorLoading", { message: error.message })}</p>
                    </div>
                )}

                {urgentCount > 0 && (
                    <div className="bg-red-50 border border-red-300 rounded-lg p-3.5 mb-6 flex items-center gap-3 shadow-sm">
                        <Badge variant="destructive" className="px-2.5 py-1 text-xs">
                            {t("urgentBadge", { count: urgentCount })}
                        </Badge>
                        <span className="text-sm font-medium text-red-800">
                            {urgentCount === 1 ? t("urgentSingular") : t("urgentPlural")}
                        </span>
                    </div>
                )}

                {isLoading ? (
                    <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-32 w-full rounded-xl" />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-5">
                        {queue?.map((order) => (
                            <PickingCard key={order.id} order={order} />
                        ))}
                        {queue?.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/30 rounded-2xl border border-dashed mt-8">
                                <PackageOpen className="h-12 w-12 mb-4 text-muted-foreground/50" />
                                <h3 className="text-lg font-medium text-foreground mb-1">{t("emptySearchTitle")}</h3>
                                <p className="text-sm">{t("emptySearchDesc")}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </PageShell>
    );
}
