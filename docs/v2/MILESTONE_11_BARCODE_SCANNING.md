# Milestone 11 — Barcode Scanning

| Field | Value |
|-------|-------|
| **Step** | 11 of 12 |
| **Priority** | P1 |
| **Depends on** | Steps 6, 9 |
| **Estimated effort** | 1 day |

---

## Goal

Enable barcode scanning in the browser using the device camera (for tablets) and USB/Bluetooth barcode scanners (keyboard-wedge mode). Scanning a barcode can trigger three workflows: (1) look up a product by barcode/SKU, (2) add a product to the current order, (3) confirm a pick in the picking queue. All scan events are logged for audit.

---

## Implementation

### 1. Barcode Scanner Hook — `src/client/lib/useBarcode.ts`

```ts
// src/client/lib/useBarcode.ts
import { useEffect, useRef, useCallback } from "react";

/**
 * Detects barcode scanner input (keyboard-wedge mode).
 * USB/Bluetooth scanners type characters rapidly and end with Enter.
 * This hook distinguishes scanner input from normal typing by speed.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const bufferRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "Enter" && bufferRef.current.length >= 3) {
        onScan(bufferRef.current.trim());
        bufferRef.current = "";
        e.preventDefault();
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;

        // Reset buffer after 100ms of inactivity (human typing is slower)
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = "";
        }, 100);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onScan]);
}
```

### 2. Camera Scanner Component — `src/client/components/shared/CameraScanner.tsx`

```tsx
// src/client/components/shared/CameraScanner.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff } from "lucide-react";

interface Props {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export function CameraScanner({ onScan, enabled = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(enabled);
  const [error, setError] = useState<string>();
  const readerRef = useRef<BrowserMultiFormatReader>();

  const startScanning = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
        if (result) {
          onScan(result.getText());
        }
      });
      setActive(true);
      setError(undefined);
    } catch (err) {
      setError("Camera access denied or unavailable");
      setActive(false);
    }
  }, [onScan]);

  const stopScanning = useCallback(() => {
    readerRef.current?.reset();
    setActive(false);
  }, []);

  useEffect(() => {
    return () => { readerRef.current?.reset(); };
  }, []);

  return (
    <div className="space-y-2">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          className={active ? "w-full h-full object-cover" : "hidden"}
        />
        {!active && (
          <div className="flex items-center justify-center h-full text-white/60">
            <CameraOff className="h-8 w-8" />
          </div>
        )}
        {/* Scanning overlay crosshair */}
        {active && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-white/50 rounded-lg" />
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <Button
        variant="outline"
        onClick={active ? stopScanning : startScanning}
        className="w-full"
      >
        <Camera className="h-4 w-4 mr-2" />
        {active ? "Stop Camera" : "Start Camera Scanner"}
      </Button>
    </div>
  );
}
```

### 3. tRPC Router — `src/server/routers/barcode.ts`

```ts
// src/server/routers/barcode.ts
import { z } from "zod";
import { eq, or, ilike } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { products, barcodeScanLogs } from "../db/schema.js";

export const barcodeRouter = router({
  lookup: protectedProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ input }) => {
      const product = await db.query.products.findFirst({
        where: or(
          eq(products.barcode, input.code),
          eq(products.sku, input.code),
        ),
        with: { category: true },
      });

      return product
        ? {
            found: true as const,
            product: {
              ...product,
              availableStock: product.currentStock - product.reservedStock,
            },
          }
        : { found: false as const, code: input.code };
    }),

  logScan: protectedProcedure
    .input(
      z.object({
        barcode: z.string(),
        source: z.enum(["camera", "scanner", "manual"]),
        context: z.enum(["lookup", "picking", "order", "inventory"]),
        productId: z.string().uuid().optional(),
        success: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await db.insert(barcodeScanLogs).values({
        barcode: input.barcode,
        source: input.source,
        context: input.context,
        productId: input.productId,
        success: input.success,
        scannedById: ctx.user.id,
      });
      return { logged: true };
    }),
});
```

### 4. Frontend — Barcode Lookup Page

```tsx
// src/client/routes/_auth/inventory/scan.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { PageShell } from "@/components/layout/PageShell";
import { CameraScanner } from "@/components/shared/CameraScanner";
import { useBarcodeScanner } from "@/lib/useBarcode";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Package } from "lucide-react";

export const Route = createFileRoute("/_auth/inventory/scan")({
  component: ScanPage,
});

function ScanPage() {
  const [code, setCode] = useState("");
  const [lastScanned, setLastScanned] = useState<string>();

  const lookupQuery = trpc.barcode.lookup.useQuery(
    { code: lastScanned! },
    { enabled: !!lastScanned }
  );

  const logMutation = trpc.barcode.logScan.useMutation();

  const handleScan = useCallback((barcode: string) => {
    setLastScanned(barcode);
    setCode(barcode);
  }, []);

  // Listen for USB/Bluetooth scanner input
  useBarcodeScanner(handleScan);

  const handleManualLookup = () => {
    if (code.trim()) {
      setLastScanned(code.trim());
    }
  };

  // Log scan result when lookup completes
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
            onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
          />
          <Button onClick={handleManualLookup}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Scan with camera, USB scanner, or type manually
        </p>

        {/* Result */}
        {lookupQuery.isLoading && (
          <div className="text-center py-8 text-muted-foreground">Looking up...</div>
        )}

        {product && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{product.name}</h3>
                <Badge variant={product.availableStock > 0 ? "default" : "destructive"}>
                  {product.availableStock} available
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
              {product.barcode && (
                <p className="text-sm text-muted-foreground">Barcode: {product.barcode}</p>
              )}
              <div className="flex gap-4 text-sm">
                <span>Total stock: {product.currentStock}</span>
                <span>Reserved: {product.reservedStock}</span>
              </div>
              {product.category && (
                <Badge variant="outline">{product.category.name}</Badge>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/products/${product.id}`}>
                    <Package className="h-4 w-4 mr-1" /> View Product
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {lookupQuery.data && !lookupQuery.data.found && (
          <div className="text-center py-8 text-muted-foreground">
            No product found for code: <code className="font-mono">{lastScanned}</code>
          </div>
        )}
      </div>
    </PageShell>
  );
}
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/client/lib/useBarcode.ts` | Hook for USB/Bluetooth scanner detection (keyboard-wedge) |
| `src/client/components/shared/CameraScanner.tsx` | Camera-based barcode scanner using @zxing/browser |
| `src/server/routers/barcode.ts` | tRPC router: barcode lookup and scan logging |
| `src/client/routes/_auth/inventory/scan.tsx` | Barcode scan page with camera + manual input |

---

## Dependencies

```json
{
  "@zxing/browser": "^0.1.5",
  "@zxing/library": "^0.21.3"
}
```

---

## Verification

1. **Camera scan** — open `/inventory/scan` on a tablet, start camera, hold a barcode up, confirm product card appears.
2. **USB scanner** — with a USB barcode scanner connected, scan a product barcode, confirm lookup triggers automatically.
3. **Manual input** — type a SKU and press Enter, confirm product found.
4. **Not found** — scan an unknown barcode, confirm "not found" message with the scanned code.
5. **Scan log** — verify `barcodeScanLogs` table records every scan with source, context, and success flag.
6. **Integration with picking** — on the picking page, scan a product barcode, confirm the matching item is highlighted or auto-picked.
7. **Multiple formats** — scan EAN-13, Code128, QR code, confirm all decode correctly.
8. **Camera permissions** — deny camera access, confirm error message and graceful fallback to manual input.
9. **Input focus guard** — with cursor in a text input, scan a barcode, confirm scanner hook does not intercept (only active outside inputs).
10. **Mobile layout** — open scan page on narrow viewport, confirm camera viewfinder and results are usable.

---

## Definition of Done

- [ ] Camera scanner decodes barcodes using @zxing/browser with live video feed
- [ ] USB/Bluetooth scanner hook detects rapid keypresses and triggers lookup
- [ ] Manual barcode/SKU input with Enter key triggers lookup
- [ ] `barcode.lookup` searches both `barcode` and `sku` columns
- [ ] Product card shows name, SKU, barcode, stock levels, and category
- [ ] All scan events logged to `barcodeScanLogs` with source and context
- [ ] Camera scanner shows crosshair overlay and handles permission denial gracefully
- [ ] Scanner hook ignores input when focus is in a text field
- [ ] Works on tablet viewport (768px) with touch-friendly controls
