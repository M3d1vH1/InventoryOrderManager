import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../../lib/trpc";
import { PageShell } from "../../../components/layout/PageShell";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { Badge } from "../../../components/ui/badge";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "../../../components/ui/table";
import { Plus, ArrowUpDown } from "lucide-react";

export const Route = createFileRoute("/_auth/customers/")({
    component: CustomersPage,
});

function CustomersPage() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState<"name" | "city" | "createdAt">("name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const { t, i18n } = useTranslation("customers");

    const { data, isLoading } = trpc.customers.list.useQuery({
        page,
        search: search || undefined,
        sortBy,
        sortDir,
    });

    const toggleSort = (col: typeof sortBy) => {
        if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortBy(col); setSortDir("asc"); }
        setPage(1);
    };

    return (
        <PageShell
            title={t("title")}
            actions={
                <Button asChild>
                    <Link to="/customers/new">
                        <Plus className="mr-2 h-4 w-4" /> {t("addCustomer")}
                    </Link>
                </Button>
            }
        >
            <Input
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="max-w-sm mb-4"
            />

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                    ))}
                </div>
            ) : (
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead
                                    onClick={() => toggleSort("name")}
                                    className="cursor-pointer select-none"
                                >
                                    {t("tableCols.name")} <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                </TableHead>
                                <TableHead>{t("tableCols.phone")}</TableHead>
                                <TableHead>{t("tableCols.email")}</TableHead>
                                <TableHead
                                    onClick={() => toggleSort("city")}
                                    className="cursor-pointer select-none"
                                >
                                    {t("tableCols.city")} <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                </TableHead>
                                <TableHead>{t("tableCols.shippingCo")}</TableHead>
                                <TableHead
                                    onClick={() => toggleSort("createdAt")}
                                    className="cursor-pointer select-none"
                                >
                                    {t("tableCols.added")} <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data?.items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        {t("noCustomers")}
                                    </TableCell>
                                </TableRow>
                            )}
                            {data?.items.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell>
                                        <Link
                                            to="/customers/$customerId"
                                            params={{ customerId: c.id.toString() }}
                                            className="font-medium hover:underline"
                                        >
                                            {c.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                                    <TableCell>{c.city ?? "—"}</TableCell>
                                    <TableCell>
                                        {c.shippingCompany ? (
                                            <Badge variant="outline">{c.shippingCompany.toUpperCase()}</Badge>
                                        ) : "—"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {new Date(c.createdAt).toLocaleDateString(i18n.language === "el" ? "el-GR" : "en-GB")}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            {data && data.total > 0 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                    <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        {t("previous")}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        {t("pageCount", { page, total: Math.ceil(data.total / data.perPage) })}
                    </span>
                    <Button
                        variant="outline"
                        disabled={page * data.perPage >= data.total}
                        onClick={() => setPage(page + 1)}
                    >
                        {t("next")}
                    </Button>
                </div>
            )}
        </PageShell>
    );
}
