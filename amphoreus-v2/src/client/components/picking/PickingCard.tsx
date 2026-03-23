import { useState, useRef, useEffect } from "react";
import { trpc } from "../../lib/trpc";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card, CardHeader, CardContent } from "../ui/card";
import { PickItemCard } from "./PickItemCard";
import { PickProgress } from "./PickProgress";
import { CheckCircle, ChevronDown, ChevronUp, Barcode, Loader2 } from "lucide-react";
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
    const [localPickedIds, setLocalPickedIds] = useState<Set<number>>(new Set());
    const [initialItems, setInitialItems] = useState<typeof order.unpickedItems>([]);

    const utils = trpc.useUtils();
    const barcodeInputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation("picking");

    const pickItemMutation = trpc.picking.pickItem.useMutation({
        onSuccess: (_, variables) => {
            playPickSound();
            setLocalPickedIds((prev) => {
                const next = new Set(prev);
                next.add(variables.orderItemId);
                return next;
            });
            // We intentionally do NOT invalidate the queue here so the card stays on screen
        },
    });

    const markOrderPickedMutation = trpc.picking.pickAll.useMutation({
        onSuccess: () => {
            setExpanded(false);
            utils.picking.queue.invalidate();
        }
    });

    // Capture the initial items when first expanded so they don't disappear if tRPC refetches
    // while we are actively picking. localPickedIds is also reset only on open.
    useEffect(() => {
        if (expanded) {
            setInitialItems(order.unpickedItems);
            setLocalPickedIds(new Set());
            // Auto-focus barcode scanner
            setTimeout(() => {
                barcodeInputRef.current?.focus();
            }, 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expanded]); // intentionally omit order.unpickedItems — changes while picking must not reset state

    // Derived states
    const itemsToDisplay = expanded ? initialItems : order.unpickedItems;
    const currentPickedCount = order.pickedItems + localPickedIds.size;
    const allItemsPicked = currentPickedCount >= order.totalItems;

    function playPickSound() {
        try {
            const ctx = new window.AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);       // A5
            osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.1); // D6
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } catch {
            // ignore — AudioContext not available
        }
    }

    const handlePick = (item: typeof itemsToDisplay[0]) => {
        if (localPickedIds.has(item.id) || pickItemMutation.isPending) return;
        pickItemMutation.mutate({
            orderItemId: item.id,
            pickedQuantity: item.quantity,
            hasQualityIssues: false,
        });
    };

    const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.trim().toLowerCase();
        if (!val) return;

        // Find matching item by SKU
        const match = itemsToDisplay.find(i => i.product?.sku?.toLowerCase() === val);
        if (match) {
            // Scroll to view & highlight
            const el = document.getElementById(`pick-item-${match.id}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("ring-4", "ring-primary");
                setTimeout(() => el.classList.remove("ring-4", "ring-primary"), 1500);
            }
            e.target.value = ""; // clear input
        }
    };

    const handleMarkOrderPicked = () => {
        // Technically pickAll safely skips already picked items and marks the order if 100% done
        markOrderPickedMutation.mutate({ orderId: order.id });
    };

    return (
        <Card className={cn(
            "overflow-hidden transition-all duration-300",
            order.priority === "urgent" && "border-red-300 bg-red-50/10 dark:bg-red-900/10",
            order.priority === "high" && "border-yellow-300 bg-yellow-50/10 dark:bg-yellow-900/10",
            expanded && "shadow-lg border-primary/20",
            allItemsPicked && expanded && "pb-24" // Extra padding to ensure scroll clears the sticky button
        )}>
            <CardHeader className="p-4 cursor-pointer select-none" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-start justify-between">
                    <div>
                        <span className="font-mono font-bold text-lg leading-none">{order.orderNumber}</span>
                        <div className="text-muted-foreground text-sm flex items-center gap-2 mt-1.5">
                            <span className="font-medium text-foreground">{order.customer.name}</span>
                            {order.priority !== "normal" && (
                                <Badge variant={order.priority === "urgent" ? "destructive" : "default"} className="uppercase text-[10px] px-1.5 h-4">
                                    {order.priority}
                                </Badge>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-sm font-semibold bg-muted px-2.5 py-1 rounded-md text-foreground">
                            {t("card.pickedRatio", { current: currentPickedCount, total: order.totalItems })}
                        </span>
                        <div className="text-muted-foreground mt-1 bg-muted/50 p-1.5 rounded-full">
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                    </div>
                </div>
            </CardHeader>

            {expanded && (
                <CardContent className="p-4 pt-0 border-t bg-muted/10 relative">
                    <div className="py-4">
                        <PickProgress total={order.totalItems} picked={currentPickedCount} />

                        {/* Barcode scanner promotion */}
                        <div className="mb-5">
                            <label className="block text-sm font-semibold text-foreground mb-1.5">
                                {t("card.scanPrompt")}
                            </label>
                            <div className="relative shadow-sm rounded-xl">
                                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input
                                    ref={barcodeInputRef}
                                    type="text"
                                    inputMode="none"
                                    placeholder={t("card.scanPlaceholder")}
                                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-input focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none text-base bg-background transition-colors"
                                    onChange={handleBarcodeInput}
                                />
                            </div>
                        </div>

                        {/* Pick list */}
                        <div className="space-y-3">
                            {itemsToDisplay.map((item) => (
                                <PickItemCard
                                    key={item.id}
                                    item={{
                                        id: item.id,
                                        productName: item.product?.name ?? t("card.unknownProduct"),
                                        sku: item.product?.sku,
                                        quantity: item.quantity,
                                        location: undefined, // Add location to schema if needed
                                        isPicked: localPickedIds.has(item.id)
                                    }}
                                    onPick={() => handlePick(item)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Complete Order Sticky Button */}
                    {allItemsPicked && (
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50 animate-in slide-in-from-bottom-6 duration-300">
                            <div className="max-w-4xl mx-auto">
                                <Button
                                    onClick={handleMarkOrderPicked}
                                    className="w-full h-14 text-base font-bold bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20 transition-all hover:scale-[1.02]"
                                    disabled={markOrderPickedMutation.isPending}
                                >
                                    {markOrderPickedMutation.isPending ? (
                                        <Loader2 className="animate-spin w-5 h-5 mr-2" />
                                    ) : (
                                        <CheckCircle className="w-5 h-5 mr-2" />
                                    )}
                                    {t("card.completeOrderBtn", { order: order.orderNumber })}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
