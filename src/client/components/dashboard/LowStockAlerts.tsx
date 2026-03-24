import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Product {
    id: number;
    name: string;
    sku: string;
    currentStock: number;
    reservedStock: number;
    minStockLevel: number;
}

export function LowStockAlerts({ products }: { products: Product[] }) {
    if (products.length === 0) return null;

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    Low Stock ({products.length})
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
                <div className="divide-y divide-border/50">
                    {products.map((p) => {
                        const available = p.currentStock - p.reservedStock;
                        return (
                            <Link
                                key={p.id}
                                to="/products/$productId"
                                params={{ productId: p.id.toString() }}
                                className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                            >
                                <div className="truncate pr-4">
                                    <p className="text-sm font-medium truncate">{p.name}</p>
                                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.sku}</p>
                                </div>
                                <Badge variant={available <= 0 ? "destructive" : "outline"} className="shrink-0">
                                    {available} left
                                </Badge>
                            </Link>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
