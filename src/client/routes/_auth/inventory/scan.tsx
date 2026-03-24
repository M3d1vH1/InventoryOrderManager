import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { trpc } from "../../../lib/trpc";
import { PageShell } from "../../../components/layout/PageShell";
import { CameraScanner } from "../../../components/shared/CameraScanner";
import { useBarcodeScanner } from "../../../lib/useBarcode";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Search, Package } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/inventory/scan")({
    component: ScanPage,
});

function ScanPage() {
    const [code, setCode] = useState("");
    const [lastScanned, setLastScanned] = useState<string>();

    const lookupQuery = trpc.barcode.lookup.useQuery(
        { code: lastScanned! },
        { enabled: !!lastScanned, retry: false }
    );

    const logMutation = trpc.barcode.logScan.useMutation();

    const handleScan = useCallback(
        (barcode: string) => {
            setLastScanned(barcode);
            setCode(barcode);
        },
        []
    );

    // Listen for USB/Bluetooth scanner input
    useBarcodeScanner(handleScan);

    const handleManualLookup = () => {
        if (code.trim()) {
            setLastScanned(code.trim());
        }
    };

    // Log scan result when lookup completes
    useEffect(() => {
        if (lookupQuery.isSuccess && lastScanned && !lookupQuery.isFetching) {
            logMutation.mutate({
                barcode: lastScanned,
                source: "scanner", // Assuming USB wedge or manual since camera isn't explicitly distinguished currently
                context: "lookup",
                productId: lookupQuery.data.found ? lookupQuery.data.product.id : undefined,
                success: lookupQuery.data.found,
            });
        }
    }, [lookupQuery.data, lookupQuery.isFetching, lastScanned]);

    const product = lookupQuery.data?.found ? lookupQuery.data.product : null;

    return (
        <PageShell title="Barcode Scanner">
            <div className="max-w-xl mx-auto space-y-6">
                {/* Camera scanner */}
                <CameraScanner onScan={handleScan} />

                {/* Manual input */}
                <div className="flex gap-2">
                    <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="Enter barcode or SKU..."
                        className="h-12 text-lg font-mono"
                        onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                    />
                    <Button onClick={handleManualLookup} className="h-12 px-6">
                        <Search className="h-5 w-5" />
                    </Button>
                </div>

                <p className="text-sm text-muted-foreground text-center">
                    Scan with camera, USB scanner, or type manually
                </p>

                {/* Result */}
                {lookupQuery.isFetching && (
                    <div className="text-center py-8 text-muted-foreground animate-pulse">
                        Looking up {lastScanned}...
                    </div>
                )}

                {product && !lookupQuery.isFetching && (
                    <Card className="border-green-200">
                        <CardContent className="p-5 space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-xl font-semibold mb-1">{product.name}</h3>
                                    <div className="flex gap-2 text-sm text-muted-foreground">
                                        <span className="font-mono">SKU: {product.sku}</span>
                                        {product.barcode && (
                                            <span className="font-mono">| BC: {product.barcode}</span>
                                        )}
                                    </div>
                                </div>
                                <Badge
                                    variant={product.availableStock > 0 ? "default" : "destructive"}
                                    className="text-sm py-1 px-3"
                                >
                                    {product.availableStock} available
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded-lg border">
                                <div>
                                    <p className="text-muted-foreground">Total Stock</p>
                                    <p className="font-medium text-lg">{product.currentStock}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Reserved Sync</p>
                                    <p className="font-medium text-lg text-orange-600">
                                        {product.reservedStock}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2">
                                {product.category && (
                                    <Badge variant="outline">{product.category.name}</Badge>
                                )}
                                <Button variant="outline" asChild>
                                    <Link to={`/products/$productId`} params={{ productId: product.id.toString() }}>
                                        <Package className="h-4 w-4 mr-2" /> View Product Details
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {lookupQuery.data && !lookupQuery.data.found && !lookupQuery.isFetching && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="p-6 text-center text-red-800 space-y-2">
                            <Search className="h-8 w-8 mx-auto text-red-400 mb-2" />
                            <p className="font-medium text-lg">Product Not Found</p>
                            <p className="text-sm text-red-600/80">
                                No product match found for <code className="font-mono bg-red-100 px-1 py-0.5 rounded">{lastScanned}</code>
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </PageShell>
    );
}
