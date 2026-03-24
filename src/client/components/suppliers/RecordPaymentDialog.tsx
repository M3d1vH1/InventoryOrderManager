import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../lib/trpc";
import { AlertTriangle, X } from "lucide-react";

interface RecordPaymentDialogProps {
    invoiceId: string;
    invoiceNumber: string;
    remainingBalance: number;
    onClose: () => void;
    onSuccess: () => void;
}

export function RecordPaymentDialog({
    invoiceId, invoiceNumber, remainingBalance, onClose, onSuccess,
}: RecordPaymentDialogProps) {
    const [form, setForm] = useState({
        amount: "",
        paymentMethod: "bank_transfer" as "bank_transfer" | "cash" | "check" | "other",
        paymentDate: new Date().toISOString().slice(0, 10),
        referenceNumber: "",
        notes: "",
    });
    const [error, setError] = useState("");
    const { t } = useTranslation("suppliers");

    const utils = trpc.useUtils();
    const create = trpc.suppliers.payments.create.useMutation({
        onSuccess: () => {
            utils.suppliers.getById.invalidate();
            onSuccess();
            onClose();
        },
        onError: (err) => setError(err.message),
    });

    const amount = parseFloat(form.amount) || 0;
    const exceedsBalance = amount > remainingBalance + 0.001;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || exceedsBalance) return;
        create.mutate({
            invoiceId,
            amount,
            paymentMethod: form.paymentMethod,
            paymentDate: new Date(form.paymentDate).toISOString(),
            referenceNumber: form.referenceNumber || undefined,
            notes: form.notes || undefined,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold">{t("payment.title")}</h2>
                        <p className="text-sm text-muted-foreground">{t("payment.subtitle", { number: invoiceNumber, remaining: remainingBalance.toFixed(2) })}</p>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium">{t("payment.amount")}</label>
                        <input type="number" step="0.01" min="0.01" max={remainingBalance}
                            value={form.amount}
                            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${exceedsBalance ? "border-destructive" : ""}`} />
                        {exceedsBalance && <p className="text-xs text-destructive">{t("payment.exceeds", { remaining: remainingBalance.toFixed(2) })}</p>}
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium">{t("payment.method")}</label>
                        <select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as typeof form.paymentMethod }))}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                            <option value="bank_transfer">{t("payment.bank")}</option>
                            <option value="cash">{t("payment.cash")}</option>
                            <option value="check">{t("payment.check")}</option>
                            <option value="other">{t("payment.other")}</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium">{t("payment.date")}</label>
                        <input type="date" value={form.paymentDate}
                            onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium">{t("payment.ref")}</label>
                        <input type="text" value={form.referenceNumber}
                            onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                            placeholder={t("payment.refPlaceholder")}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={create.isPending || !amount || exceedsBalance}
                            className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                            {create.isPending ? t("form.saving") : t("payment.recordBtn")}
                        </button>
                        <button type="button" onClick={onClose}
                            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">
                            {t("form.cancel")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
