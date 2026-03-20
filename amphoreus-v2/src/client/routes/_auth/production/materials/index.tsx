import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import {
    Package,
    Search,
    Filter,
    ArrowUpDown,
    Plus,
    ChevronRight,
    TrendingUp,
    TrendingDown
} from "lucide-react";

export const Route = createFileRoute("/_auth/production/materials/")({
    component: RawMaterialsPage,
});

function RawMaterialsPage() {
    const [search, setSearch] = useState("");
    const { data: materials, isLoading } = trpc.production.materials.list.useQuery();
    const utils = trpc.useUtils();

    const adjustStock = trpc.production.materials.adjustStock.useMutation({
        onSuccess: () => utils.production.materials.list.invalidate()
    });

    const filteredMaterials = materials?.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.sku.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Package className="w-6 h-6 text-primary" />
                    Raw Materials Inventory
                </h1>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search materials..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 border rounded-lg bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                        />
                    </div>
                    <button className="p-2 border rounded-lg hover:bg-muted transition-colors">
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 border-b text-muted-foreground">
                        <tr>
                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Material / SKU</th>
                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Stock Level</th>
                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Min Stock</th>
                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px]">Unit Cost</th>
                            <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[10px] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {isLoading ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground animate-pulse">Scanning inventory...</td></tr>
                        ) : filteredMaterials?.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground italic">No materials found</td></tr>
                        ) : (
                            filteredMaterials?.map((m) => (
                                <tr key={m.id} className="hover:bg-muted/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors cursor-default">{m.name}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono">{m.sku}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.currentStock <= m.minStockLevel ? "bg-destructive/10 text-destructive border border-destructive/20" : "bg-green-100 text-green-700 border border-green-200"}`}>
                                                {m.currentStock} {m.unit}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground font-medium">
                                        {m.minStockLevel} {m.unit}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">
                                        {m.unitCost ? `€${Number(m.unitCost).toFixed(4)}` : "-"}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    const qty = prompt("Quantity to adjust (+/-):");
                                                    if (qty && !isNaN(parseFloat(qty))) {
                                                        adjustStock.mutate({
                                                            materialId: m.id,
                                                            quantity: parseFloat(qty),
                                                            reason: "correction"
                                                        });
                                                    }
                                                }}
                                                className="p-1.5 rounded bg-muted hover:bg-muted-foreground/10 transition-colors"
                                                title="Adjust Stock"
                                            >
                                                <ArrowUpDown className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
