import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductForm } from "../../../components/products/ProductForm";
import { PageShell } from "../../../components/layout/PageShell";
import { Button } from "../../../components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_auth/products/new")({
    component: NewProductPage,
});

function NewProductPage() {
    const navigate = useNavigate();

    return (
        <PageShell
            title="Add New Product"
            actions={
                <Button
                    variant="outline"
                    onClick={() => navigate({ to: "/products" })}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
                </Button>
            }
        >
            <div className="max-w-4xl">
                <ProductForm
                    onSubmitSuccess={() => {
                        navigate({ to: "/products" });
                    }}
                />
            </div>
        </PageShell>
    );
}
