import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import {
    ArrowLeft,
    Calendar,
    Layers,
    PlayCircle,
    AlertTriangle,
    Info
} from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_auth/production/batches/new")({
    component: ScheduleBatchPage,
});

function ScheduleBatchPage() {
    const { t } = useTranslation("production");
    const navigate = useNavigate();
    const [recipeId, setRecipeId] = useState("");
    const [plannedQuantity, setPlannedQuantity] = useState<number>(0);
    const [notes, setNotes] = useState("");

    const { data: recipes } = trpc.production.recipes.list.useQuery();
    const createBatch = trpc.production.batches.create.useMutation({
        onSuccess: (batch) => navigate({ to: "/production/batches/$batchId", params: { batchId: batch.id } })
    });

    const selectedRecipe = recipes?.find(r => r.id === recipeId);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!recipeId) return;
        createBatch.mutate({
            recipeId,
            plannedQuantity,
            notes: notes || undefined
        });
    };

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate({ to: "/production/batches" })} className="p-2 border rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="text-2xl font-bold">{t("batches.new.title")}</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                {t("batches.new.selectRecipe")}
                            </label>
                            <select
                                required
                                value={recipeId}
                                onChange={(e) => setRecipeId(e.target.value)}
                                className="w-full p-3 border rounded-xl bg-background focus:ring-2 focus:ring-primary outline-none text-sm transition-all appearance-none"
                            >
                                <option value="">{t("batches.new.selectRecipePlaceholder")}</option>
                                {recipes?.map(r => (
                                    <option key={r.id} value={r.id}>{t("batches.new.recipeOption", { name: r.name, yield: r.yieldQuantity })}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold flex items-center gap-2">
                                <Layers className="w-4 h-4 text-primary" />
                                {t("batches.new.plannedOutputQuantity")}
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={plannedQuantity}
                                    onChange={(e) => setPlannedQuantity(Number(e.target.value))}
                                    className="w-full p-3 border rounded-xl bg-background focus:ring-2 focus:ring-primary outline-none text-sm transition-all"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground uppercase italic px-2 bg-muted/50 rounded">{t("batches.new.units")}</span>
                            </div>
                        </div>

                        {selectedRecipe && (
                            <div className="p-4 bg-muted/30 border rounded-xl animate-in zoom-in-95 fade-in duration-200">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                                    <Info className="w-3 h-3" />
                                    {t("batches.new.estimatedMaterialConsumption")}
                                </h3>
                                <div className="space-y-2">
                                    {selectedRecipe.ingredients.map(ing => {
                                        const consumption = (ing.quantity * plannedQuantity) / selectedRecipe.yieldQuantity;
                                        const matStatus = ing.rawMaterial.currentStock < consumption;
                                        return (
                                            <div key={ing.id} className="flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground">{ing.rawMaterial.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono">{consumption.toFixed(2)} {ing.unit}</span>
                                                    {matStatus && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-bold">{t("batches.new.notesInstructions")}</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                placeholder={t("batches.new.notesPlaceholder")}
                                className="w-full p-3 border rounded-xl bg-background focus:ring-2 focus:ring-primary outline-none text-sm transition-all resize-none shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-muted/50 border-t flex justify-end">
                        <button
                            type="submit"
                            disabled={createBatch.isPending || !recipeId}
                            className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <PlayCircle className="w-4 h-4" />
                            {createBatch.isPending ? t("batches.new.buttonScheduling") : t("batches.new.buttonCreateBatch")}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
