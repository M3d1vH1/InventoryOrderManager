import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { PageShell } from "../../../components/layout/PageShell";
import { ProductCard } from "../../../components/products/ProductCard";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import { LayoutGrid, List, Plus } from "lucide-react";

export const Route = createFileRoute("/_auth/products/")({
    component: ProductsPage,
});

function ProductsPage() {
    const [search, setSearch] = useState("");
    const [categoryId, setCategoryId] = useState<number>();
    const [stockStatus, setStockStatus] = useState<
        "all" | "in_stock" | "low_stock" | "out_of_stock"
    >("all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [page, setPage] = useState(1);

    const { data, isLoading } = trpc.products.list.useQuery({
        page,
        search: search || undefined,
        categoryId,
        stockStatus,
    });

    const { data: categoriesList } = trpc.products.categories.list.useQuery();

    return (
        <PageShell
            title="Products"
            actions={
                <Button asChild>
                    <Link to="/products/new">
                        <Plus className="mr-2 h-4 w-4" /> Add Product
                    </Link>
                </Button>
            }
        >
            {/* Search + Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
                <Input
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                    className="max-w-xs"
                />

                {/* Category filter chips */}
                <div className="flex gap-1 flex-wrap">
                    {categoriesList?.map((cat) => (
                        <Button
                            key={cat.id}
                            size="sm"
                            variant={categoryId === cat.id ? "default" : "outline"}
                            onClick={() => {
                                setCategoryId(categoryId === cat.id ? undefined : cat.id);
                                setPage(1);
                            }}
                        >
                            {cat.name}
                        </Button>
                    ))}
                </div>

                {/* Stock status filter */}
                <div className="flex gap-1">
                    {(["all", "in_stock", "low_stock", "out_of_stock"] as const).map(
                        (s) => (
                            <Button
                                key={s}
                                size="sm"
                                variant={stockStatus === s ? "default" : "outline"}
                                onClick={() => {
                                    setStockStatus(s);
                                    setPage(1);
                                }}
                            >
                                {s.replace(/_/g, " ")}
                            </Button>
                        )
                    )}
                </div>

                {/* View toggle */}
                <div className="ml-auto flex gap-1">
                    <Button
                        size="icon"
                        variant={viewMode === "grid" ? "default" : "ghost"}
                        onClick={() => setViewMode("grid")}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant={viewMode === "list" ? "default" : "ghost"}
                        onClick={() => setViewMode("list")}
                    >
                        <List className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Product grid / list */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-48 rounded-lg" />
                    ))}
                </div>
            ) : (
                <div
                    className={
                        viewMode === "grid"
                            ? "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4"
                            : "flex flex-col gap-2"
                    }
                >
                    {data?.items.map((product) => (
                        <ProductCard key={product.id} product={product} viewMode={viewMode} />
                    ))}
                    {data?.items.length === 0 && (
                        <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg bg-gray-50/50">
                            No products found matching your generic criteria.
                        </div>
                    )}
                </div>
            )}

            {/* Pagination */}
            {data && data.total > 0 && (
                <div className="flex justify-center items-center gap-4 mt-8">
                    <Button
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-gray-600 font-medium">
                        Page {page} of {Math.ceil(data.total / data.perPage)}
                    </span>
                    <Button
                        variant="outline"
                        disabled={page >= Math.ceil(data.total / data.perPage)}
                        onClick={() => setPage(page + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </PageShell>
    );
}
