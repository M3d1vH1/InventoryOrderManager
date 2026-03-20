import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CustomerForm } from "../../../components/customers/CustomerForm";
import { PageShell } from "../../../components/layout/PageShell";
import { Button } from "../../../components/ui/button";

export const Route = createFileRoute("/_auth/customers/new")({
    component: NewCustomerPage,
});

function NewCustomerPage() {
    const navigate = useNavigate();

    return (
        <PageShell
            title="Add New Customer"
            actions={
                <Button variant="outline" onClick={() => navigate({ to: "/customers" })}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Customers
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
