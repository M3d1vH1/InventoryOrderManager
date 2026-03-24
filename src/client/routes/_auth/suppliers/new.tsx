import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../../lib/trpc";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_auth/suppliers/new")({
    component: NewSupplierPage,
});

function NewSupplierPage() {
    const { t } = useTranslation("suppliers");
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: "", contactPerson: "", email: "", phone: "",
        address: "", city: "", taxId: "", notes: "",
    });
    const [error, setError] = useState("");

    const create = trpc.suppliers.create.useMutation({
        onSuccess: (supplier) => navigate({ to: "/suppliers/$supplierId", params: { supplierId: supplier.id } }),
        onError: (err) => setError(err.message),
    });

    const field = (label: string, key: keyof typeof form, type = "text", textarea = false) => (
        <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">{label}</label>
            {textarea ? (
                <textarea rows={3} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
            ) : (
                <input type={type} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            )}
        </div>
    );

    return (
        <div className="mx-auto max-w-2xl space-y-6 p-6">
            <div className="flex items-center gap-3">
                <Link to="/suppliers" className="rounded-lg p-2 hover:bg-muted transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">{t("form.newTitle")}</h1>
                    <p className="text-sm text-muted-foreground">{t("form.newSubtitle")}</p>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4" /> {error}
                </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); create.mutate(form); }} className="space-y-4 rounded-lg border bg-card p-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">{field(t("form.companyName"), "name")}</div>
                    {field(t("form.contactPerson"), "contactPerson")}
                    {field(t("form.email"), "email", "email")}
                    {field(t("form.phone"), "phone")}
                    {field(t("form.city"), "city")}
                    {field(t("form.taxId"), "taxId")}
                    <div className="col-span-2">{field(t("form.address"), "address", "text", true)}</div>
                    <div className="col-span-2">{field(t("form.notes"), "notes", "text", true)}</div>
                </div>
                <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={create.isPending || !form.name}
                        className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                        {create.isPending ? t("form.saving") : t("form.createBtn")}
                    </button>
                    <Link to="/suppliers" className="rounded-lg border px-6 py-2 text-sm font-medium hover:bg-muted transition-colors">{t("form.cancel")}</Link>
                </div>
            </form>
        </div>
    );
}
