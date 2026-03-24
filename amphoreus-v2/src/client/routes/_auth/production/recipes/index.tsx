import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc } from "../../../../lib/trpc";
import {
    ClipboardCheck,
    Plus,
    Search,
    ArrowRight,
    FlaskConical,
    Beaker
} from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/production/recipes/")({
    component: RecipesPage,
});

function RecipesPage() {
    const { t } = useTranslation("production");
    const { data: recipes, isLoading } = trpc.production.recipes.list.useQuery();

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ClipboardCheck className="w-6 h-6 text-primary" />
                    {t("recipes.title")}
                </h1>
                <Link
                    to="/production/recipes/new"
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    {t("recipes.configureRecipe")}
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    [...Array(6)].map((_, i) => (
                        <div key={i} className="h-48 border rounded-xl bg-muted/20 animate-pulse" />
                    ))
                ) : recipes?.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                        <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="italic">{t("recipes.noRecipesConfigured")}</p>
                    </div>
                ) : (
                    recipes?.map((recipe) => (
                        <div key={recipe.id} className="bg-card border rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all group p-5 flex flex-col justify-between h-48">
                            <div className="space-y-3">
                                <div className="flex justify-between items-start">
                                    <div className="p-2 bg-primary/10 rounded-lg group-hover:scale-110 transition-transform">
                                        <Beaker className="w-5 h-5 text-primary" />
                                    </div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-muted rounded text-muted-foreground">
                                        {t("recipes.yieldUnits", { yield: recipe.yieldQuantity })}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{recipe.name}</h3>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{recipe.description || t("recipes.noDescription")}</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t flex items-center justify-between">
                                <p className="text-[10px] text-muted-foreground font-medium">
                                    {t("recipes.ingredientsCount", { count: recipe.ingredients.length })}
                                </p>
                                <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                                    {t("recipes.configure")} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
