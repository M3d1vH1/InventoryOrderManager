import { createFileRoute, Link } from "@tanstack/react-router";
import { trpc } from "../../../lib/trpc";
import {
    Factory,
    Package,
    Layers,
    AlertCircle,
    ArrowRight,
    ClipboardCheck,
    Plus
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_auth/production/")({
    component: ProductionDashboard,
});

function ProductionDashboard() {
    const { data: batches, isLoading: batchesLoading } = trpc.production.batches.list.useQuery({
        status: "in_progress"
    });
    const { data: materials, isLoading: materialsLoading } = trpc.production.materials.list.useQuery();

    const lowStockMaterials = materials?.filter((m: any) => m.currentStock <= m.minStockLevel) ?? [];
    const activeBatchesCount = batches?.length ?? 0;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Factory className="w-6 h-6 text-primary" />
                    Production Dashboard
                </h1>
                <Link
                    to="/production/batches/new"
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Start New Batch
                </Link>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card p-6 rounded-xl border shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Active Batches</p>
                            <h3 className="text-2xl font-bold">{activeBatchesCount}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-card p-6 rounded-xl border shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-100 rounded-lg text-orange-600">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Low Stock Materials</p>
                            <h3 className="text-2xl font-bold">{lowStockMaterials.length}</h3>
                        </div>
                    </div>
                </div>

                <div className="bg-card p-6 rounded-xl border shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-lg text-green-600">
                            <ClipboardCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Quality Checks Today</p>
                            <h3 className="text-2xl font-bold">0</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Batches Section */}
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                        <h2 className="font-semibold flex items-center gap-2">
                            <Layers className="w-4 h-4" />
                            Active Batches
                        </h2>
                        <Link to="/production/batches" className="text-xs text-primary hover:underline">View All</Link>
                    </div>
                    <div className="divide-y">
                        {batchesLoading ? (
                            <div className="p-8 text-center text-muted-foreground">Loading batches...</div>
                        ) : activeBatchesCount === 0 ? (
                            <div className="p-8 text-center text-muted-foreground italic">No batches in progress</div>
                        ) : (
                            batches?.map((batch) => (
                                <Link
                                    key={batch.id}
                                    to="/production/batches/$batchId"
                                    params={{ batchId: batch.id }}
                                    className="p-4 flex justify-between items-center hover:bg-muted/50 transition-colors group"
                                >
                                    <div className="space-y-1">
                                        <p className="font-medium group-hover:text-primary transition-colors">{batch.batchNumber}</p>
                                        <p className="text-xs text-muted-foreground">{batch.recipe.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold">{batch.plannedQuantity} Units</p>
                                        <p className="text-xs text-muted-foreground">
                                            Started: {batch.startedAt ? format(new Date(batch.startedAt), "HH:mm") : "-"}
                                        </p>
                                    </div>
                                    <ArrowRight className="w-4 h-4 ml-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                {/* Material Alerts Section */}
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                        <h2 className="font-semibold flex items-center gap-2 text-destructive">
                            <AlertCircle className="w-4 h-4" />
                            Stock Alerts
                        </h2>
                        <Link to="/production/materials" className="text-xs text-primary hover:underline">Manage All</Link>
                    </div>
                    <div className="divide-y">
                        {materialsLoading ? (
                            <div className="p-8 text-center text-muted-foreground">Checking stock levels...</div>
                        ) : lowStockMaterials.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground italic">All material levels healthy</div>
                        ) : (
                            lowStockMaterials.map((material: any) => (
                                <div key={material.id} className="p-4 flex justify-between items-center">
                                    <div className="space-y-1">
                                        <p className="font-medium">{material.name}</p>
                                        <p className="text-xs text-muted-foreground">SKU: {material.sku}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-destructive">
                                            {material.currentStock} / {material.minStockLevel} {material.unit}
                                        </p>
                                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground italic">Critical Level</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Navigation Links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Material Ledger", to: "/production/materials", icon: Package },
                    { label: "Recipes Book", to: "/production/recipes", icon: ClipboardCheck },
                    { label: "Batch History", to: "/production/batches", icon: Layers },
                    { label: "Inventory Home", to: "/products", icon: Package },
                ].map((item) => (
                    <Link
                        key={item.label}
                        to={item.to}
                        className="p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/50 transition-all flex flex-col items-center gap-2 text-center"
                    >
                        <item.icon className="w-5 h-5 text-primary" />
                        <span className="text-xs font-medium">{item.label}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
