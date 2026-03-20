import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { trpc } from "../../../lib/trpc";
import { InvoiceList } from "../../../components/suppliers/InvoiceList";
import { RecordPaymentDialog } from "../../../components/suppliers/RecordPaymentDialog";
import { ArrowLeft, Plus, AlertTriangle, Building2, Receipt, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_auth/suppliers/$supplierId")({
    component: SupplierDetailPage,
    errorComponent: ({ error }) => (
        <div className="p-8 text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
            <p className="text-destructive">{error.message}</p>
        </div>
    ),
});

function SupplierDetailPage() {
    const { supplierId } = Route.useParams();
    const navigate = useNavigate();
    const [showAddInvoice, setShowAddInvoice] = useState(false);
    const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
    const [invoiceForm, setInvoiceForm] = useState({
        invoiceNumber: "", amount: "", taxAmount: "0", invoiceDate: "", dueDate: "", notes: "",
    });

    const { data, isLoading } = trpc.suppliers.getById.useQuery({ id: supplierId });
    const utils = trpc.useUtils();

    const addInvoice = trpc.suppliers.invoices.create.useMutation({
        onSuccess: () => {
            utils.suppliers.getById.invalidate();
            setShowAddInvoice(false);
            setInvoiceForm({ invoiceNumber: "", amount: "", taxAmount: "0", invoiceDate: "", dueDate: "", notes: "" });
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-4 p-6">
                {[...Array(3)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}
            </div>
        );
    }

    if (!data) return null;

    const payingInvoice = payingInvoiceId
        ? data.invoices.find((inv) => inv.id === payingInvoiceId)
        : null;

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/suppliers" className="rounded-lg p-2 hover:bg-muted transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-primary" />
                            {data.name}
                        </h1>
                        {data.city && <p className="text-sm text-muted-foreground">{data.city}</p>}
                    </div>
                </div>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Invoiced</p>
                    <p className="mt-1 text-2xl font-bold">€{data.totalInvoiced.toFixed(2)}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Paid</p>
                    <p className="mt-1 text-2xl font-bold text-green-600">€{data.totalPaid.toFixed(2)}</p>
                </div>
                <div className={`rounded-xl border p-4 ${data.outstandingBalance > 0 ? "bg-destructive/10 border-destructive/30" : "bg-card"}`}>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding</p>
                    <p className={`mt-1 text-2xl font-bold ${data.outstandingBalance > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        €{data.outstandingBalance.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Supplier Info */}
            {(data.email || data.phone || data.taxId || data.contactPerson) && (
                <div className="rounded-xl border bg-card p-4 grid grid-cols-2 gap-3 text-sm">
                    {data.contactPerson && <div><span className="text-muted-foreground">Contact: </span>{data.contactPerson}</div>}
                    {data.email && <div><span className="text-muted-foreground">Email: </span><a href={`mailto:${data.email}`} className="text-primary hover:underline">{data.email}</a></div>}
                    {data.phone && <div><span className="text-muted-foreground">Phone: </span>{data.phone}</div>}
                    {data.taxId && <div><span className="text-muted-foreground">Tax ID: </span><code>{data.taxId}</code></div>}
                </div>
            )}

            {/* Invoices */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2"><Receipt className="h-5 w-5" /> Invoices</h2>
                    <button onClick={() => setShowAddInvoice(!showAddInvoice)}
                        className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
                        <Plus className="h-4 w-4" /> Add Invoice
                    </button>
                </div>

                {/* Add Invoice Form */}
                {showAddInvoice && (
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        addInvoice.mutate({
                            supplierId,
                            invoiceNumber: invoiceForm.invoiceNumber,
                            amount: parseFloat(invoiceForm.amount),
                            taxAmount: parseFloat(invoiceForm.taxAmount) || 0,
                            invoiceDate: new Date(invoiceForm.invoiceDate).toISOString(),
                            dueDate: invoiceForm.dueDate ? new Date(invoiceForm.dueDate).toISOString() : undefined,
                            notes: invoiceForm.notes || undefined,
                        });
                    }} className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Invoice Number *</label>
                                <input value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                                    required className="w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Amount (€) *</label>
                                <input type="number" step="0.01" min="0" value={invoiceForm.amount} onChange={(e) => setInvoiceForm((f) => ({ ...f, amount: e.target.value }))}
                                    required className="w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Tax Amount (€)</label>
                                <input type="number" step="0.01" min="0" value={invoiceForm.taxAmount} onChange={(e) => setInvoiceForm((f) => ({ ...f, taxAmount: e.target.value }))}
                                    className="w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Invoice Date *</label>
                                <input type="date" value={invoiceForm.invoiceDate} onChange={(e) => setInvoiceForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                                    required className="w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                                <input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((f) => ({ ...f, dueDate: e.target.value }))}
                                    className="w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={addInvoice.isPending}
                                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                                {addInvoice.isPending ? "Saving…" : "Add Invoice"}
                            </button>
                            <button type="button" onClick={() => setShowAddInvoice(false)}
                                className="rounded-lg border px-4 py-1.5 text-sm hover:bg-muted transition-colors">Cancel</button>
                        </div>
                    </form>
                )}

                <InvoiceList invoices={data.invoices} onSelect={(id) => setPayingInvoiceId(id)} />
            </div>

            {/* Payment Dialog */}
            {payingInvoice && (
                <RecordPaymentDialog
                    invoiceId={payingInvoice.id}
                    invoiceNumber={payingInvoice.invoiceNumber}
                    remainingBalance={payingInvoice.remainingBalance}
                    onClose={() => setPayingInvoiceId(null)}
                    onSuccess={() => setPayingInvoiceId(null)}
                />
            )}
        </div>
    );
}
