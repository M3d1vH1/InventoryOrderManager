import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../../lib/trpc";
import { Building2, Plus, Search, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_auth/suppliers/")({
    component: SuppliersPage,
    errorComponent: ({ error }) => {
        const { t } = useTranslation("suppliers");
        return (
            <div className="p-8 text-center">
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
                <p className="text-destructive">{t("index.errorLoad", { message: error.message })}</p>
            </div>
        );
    },
});

function SuppliersPage() {
    const { t } = useTranslation("suppliers");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const perPage = 20;

    const { data, isLoading } = trpc.suppliers.list.useQuery({ search: search || undefined, page, perPage });

    const overdueQuery = trpc.suppliers.invoices.listOverdue.useQuery();

    return (
        <div className="space-y-6 p-6">
            {/* Overdue Banner */}
            {overdueQuery.data && overdueQuery.data.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                        <strong>{overdueQuery.data.length}</strong> {overdueQuery.data.length > 1 ? t("index.overduePlural") : t("index.overdueSingular")}{" "}
                        <Link to="/suppliers" className="underline">{t("index.reviewNow")}</Link>
                    </span>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{t("index.title")}</h1>
                    <p className="text-sm text-muted-foreground">{t("index.subtitle")}</p>
                </div>
                <Link
                    to="/suppliers/new"
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                    <Plus className="h-4 w-4" />
                    {t("index.addBtn")}
                </Link>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    placeholder={t("index.search")}
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Table */}
            <div className="rounded-lg border bg-card overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium">{t("index.thName")}</th>
                            <th className="px-4 py-3 text-left font-medium">{t("index.thCity")}</th>
                            <th className="px-4 py-3 text-left font-medium">{t("index.thPhone")}</th>
                            <th className="px-4 py-3 text-left font-medium">{t("index.thTaxId")}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}><td colSpan={4} className="px-4 py-3"><div className="h-4 w-full animate-pulse rounded bg-muted" /></td></tr>
                            ))
                        ) : data?.items.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                                    <Building2 className="mx-auto mb-2 h-8 w-8 opacity-40" />
                                    {t("index.noFound")}
                                </td>
                            </tr>
                        ) : (
                            data?.items.map((supplier) => (
                                <tr key={supplier.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 font-medium">
                                        <Link to="/suppliers/$supplierId" params={{ supplierId: supplier.id }} className="hover:underline text-primary">
                                            {supplier.name}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{supplier.city ?? t("index.empty")}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{supplier.phone ?? t("index.empty")}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{supplier.taxId ?? t("index.empty")}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {data && data.total > perPage && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{t("index.totalCount", { count: data.total })}</span>
                    <div className="flex gap-2">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                            className="flex items-center gap-1 rounded px-2 py-1 hover:bg-muted disabled:opacity-40">
                            <ChevronLeft className="h-4 w-4" /> {t("index.prev")}
                        </button>
                        <span className="px-2 py-1">{t("index.page", { page })}</span>
                        <button onClick={() => setPage((p) => p + 1)} disabled={page * perPage >= data.total}
                            className="flex items-center gap-1 rounded px-2 py-1 hover:bg-muted disabled:opacity-40">
                            {t("index.next")} <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
