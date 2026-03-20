import React from "react";
import { format } from "date-fns";

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

const statusConfig: Record<Invoice["status"], { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    partially_paid: { label: "Partial", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    paid: { label: "Paid", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    overdue: { label: "Overdue", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export function InvoiceList({ invoices, onSelect }: InvoiceListProps) {
    if (invoices.length === 0) {
        return (
            <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
                No invoices yet. Add the first invoice for this supplier.
            </div>
        );
    }

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-left font-medium">Due</th>
                        <th className="px-4 py-3 text-right font-medium">Total</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
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
                                    {inv.dueDate ? format(new Date(inv.dueDate), "dd MMM yyyy") : "—"}
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
                                        View
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
