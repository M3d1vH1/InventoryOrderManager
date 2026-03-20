import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import {
    Plus,
    Trash2,
    Save,
    ArrowLeft,
    Settings,
    AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/_auth/production/recipes/new")({
    component: NewRecipePage,
});

function NewRecipePage() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [productId, setProductId] = useState<number | "">("");
    const [yieldQuantity, setYieldQuantity] = useState<number>(1);
    const [ingredients, setIngredients] = useState<Array<{ rawMaterialId: string, quantity: number, unit: any }>>([]);

    const { data: products } = trpc.products.list.useQuery({ perPage: 100 });
    const { data: materials } = trpc.production.materials.list.useQuery();

    const createRecipe = trpc.production.recipes.create.useMutation({
        onSuccess: () => navigate({ to: "/production/recipes" })
    });

    const addIngredient = () => {
        setIngredients([...ingredients, { rawMaterialId: "", quantity: 0, unit: "kg" }]);
    };

    const removeIngredient = (index: number) => {
        setIngredients(ingredients.filter((_, i) => i !== index));
    };

    const updateIngredient = (index: number, field: string, value: any) => {
        const updated = [...ingredients];
        updated[index] = { ...updated[index], [field]: value };

        // Auto-update unit if rawMaterialId changes
        if (field === "rawMaterialId") {
            const mat = materials?.find(m => m.id === value);
            if (mat) updated[index].unit = mat.unit;
        }

        setIngredients(updated);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (productId === "") return;

        createRecipe.mutate({
            name,
            description,
            productId: Number(productId),
            yieldQuantity,
            ingredients: ingredients.map(i => ({ ...i, quantity: Number(i.quantity) }))
        });
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate({ to: "/production/recipes" })} className="p-2 border rounded-xl hover:bg-muted transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <h1 className="text-2xl font-bold">New Recipe Configuration</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground border-b pb-2">Primary Configuration</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold flex items-center gap-2">
                                Recipe Name
                                <Settings className="w-3 h-3 opacity-50" />
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Organic Extra Virgin 5L Bottling"
                                className="w-full p-3 border rounded-xl bg-background focus:ring-2 focus:ring-primary outline-none text-sm transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold">Finished Product</label>
                            <select
                                required
                                value={productId}
                                onChange={(e) => setProductId(e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-full p-3 border rounded-xl bg-background focus:ring-2 focus:ring-primary outline-none text-sm transition-all appearance-none"
                            >
                                <option value="">Select product to manufactured...</option>
                                {products?.items.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold">Yield Quantity</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={yieldQuantity}
                                    onChange={(e) => setYieldQuantity(Number(e.target.value))}
                                    className="w-full p-3 border rounded-xl bg-background focus:ring-2 focus:ring-primary outline-none text-sm transition-all"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground uppercase">Units</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground italic mt-1">Number of finished products produced by this recipe run.</p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-bold">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                placeholder="Production steps or quality requirements..."
                                className="w-full p-3 border rounded-xl bg-background focus:ring-2 focus:ring-primary outline-none text-sm transition-all resize-none font-sans"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Required Ingredients</h2>
                        <button
                            type="button"
                            onClick={addIngredient}
                            className="text-xs font-bold bg-muted hover:bg-primary/10 hover:text-primary transition-all px-3 py-1.5 rounded-lg flex items-center gap-1.5 border"
                        >
                            <Plus className="w-3 h-3" /> Add Item
                        </button>
                    </div>

                    <div className="space-y-3">
                        {ingredients.length === 0 ? (
                            <div className="py-12 bg-muted/20 rounded-xl border border-dashed flex flex-col items-center gap-2 opacity-60">
                                <AlertCircle className="w-6 h-6" />
                                <p className="text-xs italic">Specify raw materials needed for this yield.</p>
                            </div>
                        ) : (
                            ingredients.map((ing, idx) => (
                                <div key={idx} className="flex gap-3 items-end p-4 border rounded-xl bg-muted/10 group animate-in fade-in slide-in-from-top-1">
                                    <div className="flex-1 space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Material</label>
                                        <select
                                            required
                                            value={ing.rawMaterialId}
                                            onChange={(e) => updateIngredient(idx, "rawMaterialId", e.target.value)}
                                            className="w-full p-2 border rounded-lg bg-background text-xs"
                                        >
                                            <option value="">Select material...</option>
                                            {materials?.map(m => (
                                                <option key={m.id} value={m.id}>{m.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-32 space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Quantity</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.001"
                                                required
                                                value={ing.quantity}
                                                onChange={(e) => updateIngredient(idx, "quantity", e.target.value)}
                                                className="w-full p-2 border rounded-lg bg-background text-xs pr-8"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground">{ing.unit}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeIngredient(idx)}
                                        className="p-2 border rounded-lg text-destructive hover:bg-destructive/10 transition-colors mb-0.5"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="submit"
                        disabled={createRecipe.isPending || ingredients.length === 0}
                        className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {createRecipe.isPending ? "Configuring..." : "Commit Recipe"}
                    </button>
                </div>
            </form>
        </div>
    );
}
