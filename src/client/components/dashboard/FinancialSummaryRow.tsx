import { useLocation, useNavigate } from "@tanstack/react-router";
import { trpc } from "../../lib/trpc";
import { CreditCard, AlertTriangle, Clock, CheckCircle } from "lucide-react";

export function FinancialSummaryRow() {
    const { data: user } = trpc.auth.me.useQuery();

    // Only visible to admin and front_office
    if (!user || user.role === "warehouse") return null;

    const { data, isLoading } = trpc.suppliers.payments.summary.useQuery(undefined, {
        staleTime: 120_000,
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-28 bg-muted animate-pulse rounded-lg" />
                ))}
            </div>
        );
    }

    const {
        outstandingTotal = 0,
        overdueTotal = 0,
        dueSoon = 0,
        dueSoonCount = 0,
        paidThisMonth = 0,
    } = data || {};

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <FinanceStat
                label="Outstanding Balance"
                value={`€${outstandingTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<CreditCard className="w-5 h-5 text-blue-500" />}
                href="/suppliers"
            />
            <FinanceStat
                label="Overdue Invoices"
                value={`€${overdueTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                valueClass={overdueTotal > 0 ? "text-red-600 dark:text-red-500" : "text-foreground"}
                href="/suppliers"
            />
            <FinanceStat
                label="Due in Next 7 Days"
                value={`€${dueSoon.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtext={dueSoonCount > 0 ? `${dueSoonCount} invoices` : undefined}
                icon={<Clock className="w-5 h-5 text-amber-500" />}
                href="/suppliers"
            />
            <FinanceStat
                label="Paid This Month"
                value={`€${paidThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<CheckCircle className="w-5 h-5 text-green-500" />}
                href="/suppliers"
            />
        </div>
    );
}

function FinanceStat({
    label, value, subtext, icon, href, valueClass = "text-foreground"
}: {
    label: string;
    value: string;
    subtext?: string;
    icon: React.ReactNode;
    href: string;
    valueClass?: string;
}) {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate({ to: href })}
            className="bg-card rounded-lg border p-4 text-left hover:border-primary/50 hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-sm text-muted-foreground font-medium">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
            {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
        </button>
    );
}
