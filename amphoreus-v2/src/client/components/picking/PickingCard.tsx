import { useState } from "react";
import { trpc } from "../../lib/trpc";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader } from "../ui/card";
import { PickItemDialog } from "./PickItemDialog";
import { CheckCircle, Package, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";

interface PickingOrder {
    id: number;
    orderNumber: string;
    priority: string;
    customer: { name: string };
    totalItems: number;
    pickedItems: number;
    unpickedItems: Array<{
        id: number;
        quantity: number;
        product: { name: string; sku: string; currentStock: number } | null;
    }>;
}

export function PickingCard({ order }: { order: PickingOrder }) {
    const [expanded, setExpanded] = useState(false);
    const [pickingItem, setPickingItem] = useState<{ id: number; qty: number } | null>(null);
    const utils = trpc.useUtils();

    const pickAllMutation = trpc.picking.pickAll.useMutation({
        onSuccess: () => utils.picking.queue.invalidate(),
    });

    const progress = order.totalItems > 0
        ? Math.round((order.pickedItems / order.totalItems) * 100)
        : 0;

    return (
        <Card className={cn(
            order.priority === "urgent" && "border-red-300 bg-red-50/50",
            order.priority === "high" && "border-yellow-300 bg-yellow-50/50",
        )}>
            <CardHeader className="pb-3 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center justify-between">
                    <div>
                        <span className="font-mono font-bold text-lg">{order.orderNumber}</span>
                        <div className="text-muted-foreground text-sm flex items-center gap-2 mt-1">
                            <span>{order.customer.name}</span>
                            {order.priority !== "normal" && (
                                <Badge variant={order.priority === "urgent" ? "destructive" : "default"} className="uppercase text-[10px] px-1.5">
                                    {order.priority}
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-medium bg-muted px-2 py-1 rounded-md">
                            {order.pickedItems} / {order.totalItems} picked
                        </span>
                        <div className="text-muted-foreground mt-1">
                            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </div>
                    </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </CardHeader>

            {expanded && (
                <CardContent className="space-y-4 pt-1">
                    {order.unpickedItems.map((item) => (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-background rounded-lg border shadow-sm gap-4 sm:gap-0">
                            <div className="flex-1">
                                <p className="font-semibold text-base">{item.product?.name ?? "Unknown Product"}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                                    <span>SKU: <span className="font-mono text-foreground">{item.product?.sku}</span></span>
                                    <span>Target: <span className="font-medium text-foreground">{item.quantity}</span> units</span>
                                    <span>Shelf: <span className="font-medium text-foreground">{item.product?.currentStock ?? 0}</span></span>
                                </div>
                            </div>
                            <Button size="lg" className="w-full sm:w-auto h-12" onClick={() => setPickingItem({ id: item.id, qty: item.quantity })}>
                                <CheckCircle className="h-5 w-5 mr-2" /> Pick Item
                            </Button>
                        </div>
                    ))}

                    {order.unpickedItems.length > 1 && (
                        <div className="pt-2 border-t border-dashed mt-2">
                            <Button
                                variant="outline"
                                className="w-full h-12 border-primary/20 hover:bg-primary/5 text-primary"
                                onClick={() => pickAllMutation.mutate({ orderId: order.id })}
                                disabled={pickAllMutation.isPending}
                            >
                                <Package className="h-5 w-5 mr-2" />
                                {pickAllMutation.isPending ? "Picking all..." : "Pick All Remaining Items"}
                            </Button>
                            {pickAllMutation.error && (
                                <p className="text-red-600 text-sm mt-2 text-center">{pickAllMutation.error.message}</p>
                            )}
                        </div>
                    )}

                    {pickingItem && (
                        <PickItemDialog
                            orderItemId={pickingItem.id}
                            defaultQuantity={pickingItem.qty}
                            open={!!pickingItem}
                            onClose={() => setPickingItem(null)}
                        />
                    )}
                </CardContent>
            )}
        </Card>
    );
}
