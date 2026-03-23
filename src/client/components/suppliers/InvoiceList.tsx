import React from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

type Invoice = {
    id: string;
    invoiceNumber: string;
    invoiceDate: string | Date;
    dueDate?: string | Date | null;
    totalAmount: string | number;
    status: "pending" | "partially_paid" | "paid" | "overdue";
};

interface InvoiceListProps {
    invoices: Invoice[];
    onSelect: (id: string) => void;
}

const getStatusConfig = (t: any) => ({
    pending: { label: t("list.statusPending"), className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    partially_paid: { label: t("list.statusPartial"), className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    paid: { label: t("list.statusPaid"), className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    overdue: { label: t("list.statusOverdue"), className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
});

export function InvoiceList({ invoices, onSelect }: InvoiceListProps) {
    const { t } = useTranslation("suppliers");
    const statusConfig = getStatusConfig(t);

    if (invoices.length === 0) {
        return (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
                {t("list.empty")}
            </div>
        );
    }

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium">{t("list.thInv")}</th>
                        <th className="px-4 py-3 text-left font-medium">{t("list.thDate")}</th>
                        <th className="px-4 py-3 text-left font-medium">{t("list.thDue")}</th>
                        <th className="px-4 py-3 text-right font-medium">{t("list.thTotal")}</th>
                        <th className="px-4 py-3 text-left font-medium">{t("list.thStatus")}</th>
                        <th className="px-4 py-3" />
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {invoices.map((inv) => {
                        const cfg = statusConfig[inv.status];
                        return (
                            <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3 font-mono font-medium">{inv.invoiceNumber}</td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {format(new Date(inv.invoiceDate), "dd MMM yyyy")}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                    {inv.dueDate ? format(new Date(inv.dueDate), "dd MMM yyyy") : t("index.empty")}
                                </td>
                                <td className="px-4 py-3 text-right font-medium">
                                    €{Number(inv.totalAmount).toFixed(2)}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
                                        {cfg.label}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => onSelect(inv.id)}
                                        className="text-xs text-primary hover:underline">
                                        {t("list.view")}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
