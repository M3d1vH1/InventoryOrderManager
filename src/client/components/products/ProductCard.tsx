import { Link } from "@tanstack/react-router";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";

// Assuming a simplified Product interface matches the output of the query
interface Product {
    id: number;
    name: string;
    sku: string;
    categoryName: string | null;
    currentStock: number;
    reservedStock: number;
    minStockLevel: number;
    imageUrl?: string | null;
}

function stockColor(available: number, min: number) {
    if (available <= 0) return "bg-red-100 text-red-800";
    if (available <= min) return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
}

export function ProductCard({
    product,
    viewMode,
}: {
    product: Product;
    viewMode: "grid" | "list";
}) {
    const available = product.currentStock - product.reservedStock;

    return (
        <Link
            to="/products/$productId"
            params={{ productId: product.id.toString() }}
            className={cn(
                "border rounded-lg p-4 hover:shadow-md transition-shadow bg-white flex",
                viewMode === "list" ? "items-center gap-4 flex-row" : "flex-col gap-3"
            )}
        >
            {product.imageUrl ? (
                <img
                    src={product.imageUrl}
                    alt={product.name}
                    className={cn(
                        "object-cover rounded bg-gray-50",
                        viewMode === "list" ? "h-16 w-16" : "h-40 w-full"
                    )}
                />
            ) : (
                <div
                    className={cn(
                        "bg-gray-100 rounded flex items-center justify-center text-gray-400 font-medium text-xl uppercase",
                        viewMode === "list" ? "h-16 w-16" : "h-40 w-full"
                    )}
                >
                    {product.name.charAt(0)}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate text-gray-900">{product.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{product.sku}</p>
                <div className="mt-2 text-xs">
                    {product.categoryName && (
                        <Badge variant="outline" className="mr-2">
                            {product.categoryName}
                        </Badge>
                    )}
                </div>
            </div>
            <div className={cn(viewMode === "grid" ? "mt-auto pt-3" : "ml-auto")}>
                <Badge
                    className={cn(
                        "pointer-events-none transition-colors border-transparent",
                        stockColor(available, product.minStockLevel)
                    )}
                >
                    {available} available
                </Badge>
            </div>
        </Link>
    );
}
