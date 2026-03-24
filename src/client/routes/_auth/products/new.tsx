import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProductForm } from "../../../components/products/ProductForm";
import { PageShell } from "../../../components/layout/PageShell";
import { Button } from "../../../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/products/new")({
    component: NewProductPage,
});

function NewProductPage() {
    const navigate = useNavigate();
    const { t } = useTranslation("products");

    return (
        <PageShell
            title={t("new.title")}
            actions={
                <Button
                    variant="outline"
                    onClick={() => navigate({ to: "/products" })}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t("new.back")}
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
