import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CustomerForm } from "../../../components/customers/CustomerForm";
import { PageShell } from "../../../components/layout/PageShell";
import { Button } from "../../../components/ui/button";

export const Route = createFileRoute("/_auth/customers/new")({
    component: NewCustomerPage,
});

function NewCustomerPage() {
    const navigate = useNavigate();
    const { t } = useTranslation("customers");

    return (
        <PageShell
            title={t("new.title")}
            actions={
                <Button variant="outline" onClick={() => navigate({ to: "/customers" })}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t("new.back")}
                </Button>
            }
        >
            <div className="max-w-4xl">
                <CustomerForm
                    onSubmitSuccess={(c) =>
                        navigate({ to: "/customers/$customerId", params: { customerId: c.id.toString() } })
                    }
                />
            </div>
        </PageShell>
    );
}
