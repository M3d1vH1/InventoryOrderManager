# Milestone 10 — Shipping Labels

| Field | Value |
|-------|-------|
| **Step** | 10 of 12 |
| **Priority** | P1 |
| **Depends on** | Steps 8, 9 |
| **Estimated effort** | 1.5 days |

---

## Goal

Generate PDF shipping labels for picked orders and support printing to both standard printers (A4 PDF) and CAB thermal label printers (via raw ZPL commands). Each order gets a shipping document record that tracks the label file, shipping method, tracking number, and shipment date. Generating a label transitions the order to `partially_shipped` or `shipped`.

---

## Implementation

### 1. Service Layer — `src/server/services/labelService.ts`

```ts
// src/server/services/labelService.ts
import PDFDocument from "pdfkit";
import { db } from "../db/index.js";
import {
  orders, orderItems, shippingDocuments, customers, products, orderChangelog,
} from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import fs from "fs/promises";
import path from "path";

const LABELS_DIR = path.join(process.cwd(), "data", "labels");

interface GenerateLabelInput {
  orderId: string;
  shippingMethod: "courier" | "post" | "pickup" | "other";
  trackingNumber?: string;
  notes?: string;
  labelFormat: "pdf" | "zpl";
  userId: string;
}

export async function generateShippingLabel(input: GenerateLabelInput) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, input.orderId),
    with: {
      customer: true,
      items: { with: { product: true } },
    },
  });

  if (!order) throw new TRPCError({ code: "NOT_FOUND" });
  if (order.status === "cancelled") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot ship a cancelled order" });
  }

  // Ensure labels directory exists
  await fs.mkdir(LABELS_DIR, { recursive: true });

  const filename = `${order.orderNumber}-${Date.now()}`;
  let filePath: string;

  if (input.labelFormat === "pdf") {
    filePath = path.join(LABELS_DIR, `${filename}.pdf`);
    await generatePdfLabel(order, filePath);
  } else {
    filePath = path.join(LABELS_DIR, `${filename}.zpl`);
    await generateZplLabel(order, filePath);
  }

  // Create shipping document record
  const [doc] = await db.insert(shippingDocuments).values({
    orderId: input.orderId,
    shippingMethod: input.shippingMethod,
    trackingNumber: input.trackingNumber,
    labelFilePath: filePath,
    labelFormat: input.labelFormat,
    notes: input.notes,
    shippedAt: new Date(),
    createdById: input.userId,
  }).returning();

  // Transition order status
  const newStatus = order.status === "picked" ? "shipped" : "partially_shipped";
  await db.update(orders).set({ status: newStatus, updatedAt: new Date() })
    .where(eq(orders.id, input.orderId));

  await db.insert(orderChangelog).values({
    orderId: input.orderId,
    action: "shipped",
    details: `Shipping label generated (${input.labelFormat.toUpperCase()}). Method: ${input.shippingMethod}${input.trackingNumber ? `. Tracking: ${input.trackingNumber}` : ""}`,
    changedById: input.userId,
  });

  return doc;
}

async function generatePdfLabel(
  order: { orderNumber: string; customer: { name: string; address?: string; city?: string; phone?: string }; items: Array<{ quantity: number; product: { name: string; sku: string } }> },
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = require("fs").createWriteStream(outputPath);
    doc.pipe(stream);

    // Company header
    doc.fontSize(18).font("Helvetica-Bold").text("AMPHOREUS", { align: "center" });
    doc.fontSize(10).font("Helvetica").text("Greek Fine Foods Distribution", { align: "center" });
    doc.moveDown(1);

    // Divider
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // Order info
    doc.fontSize(14).font("Helvetica-Bold").text(`Order: ${order.orderNumber}`);
    doc.fontSize(10).font("Helvetica").text(`Date: ${new Date().toLocaleDateString("el-GR")}`);
    doc.moveDown(1);

    // Customer info
    doc.fontSize(12).font("Helvetica-Bold").text("Ship To:");
    doc.fontSize(11).font("Helvetica");
    doc.text(order.customer.name);
    if (order.customer.address) doc.text(order.customer.address);
    if (order.customer.city) doc.text(order.customer.city);
    if (order.customer.phone) doc.text(`Tel: ${order.customer.phone}`);
    doc.moveDown(1);

    // Items table
    doc.fontSize(12).font("Helvetica-Bold").text("Items:");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    for (const item of order.items) {
      doc.text(`  ${item.quantity}x  ${item.product.name}  (${item.product.sku})`);
    }

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

async function generateZplLabel(
  order: { orderNumber: string; customer: { name: string; address?: string; city?: string } },
  outputPath: string,
): Promise<void> {
  // ZPL II format for CAB thermal printers (100mm x 150mm label)
  const zpl = `^XA
^CI28
^FO50,30^A0N,40,40^FD${order.orderNumber}^FS
^FO50,80^A0N,28,28^FD${order.customer.name}^FS
^FO50,115^A0N,24,24^FD${order.customer.address ?? ""}^FS
^FO50,145^A0N,24,24^FD${order.customer.city ?? ""}^FS
^FO50,200^BY3^BCN,80,Y,N,N^FD${order.orderNumber}^FS
^FO50,310^A0N,20,20^FD${new Date().toLocaleDateString("el-GR")}^FS
^XZ`;

  await fs.writeFile(outputPath, zpl, "utf-8");
}

/**
 * Sends ZPL data to a network-attached CAB printer.
 */
export async function printToThermalPrinter(
  filePath: string,
  printerIp: string,
  printerPort: number = 9100,
): Promise<void> {
  const net = await import("net");
  const zplData = await fs.readFile(filePath, "utf-8");

  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(printerPort, printerIp, () => {
      client.write(zplData, () => {
        client.end();
        resolve();
      });
    });
    client.on("error", reject);
    client.setTimeout(5000, () => {
      client.destroy();
      reject(new Error("Printer connection timed out"));
    });
  });
}
```

### 2. tRPC Router — `src/server/routers/shipping.ts`

```ts
// src/server/routers/shipping.ts
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { shippingDocuments } from "../db/schema.js";
import { generateShippingLabel, printToThermalPrinter } from "../services/labelService.js";
import fs from "fs/promises";

export const shippingRouter = router({
  generateLabel: protectedProcedure
    .input(
      z.object({
        orderId: z.string().uuid(),
        shippingMethod: z.enum(["courier", "post", "pickup", "other"]),
        trackingNumber: z.string().optional(),
        notes: z.string().optional(),
        labelFormat: z.enum(["pdf", "zpl"]).default("pdf"),
      })
    )
    .mutation(({ input, ctx }) =>
      generateShippingLabel({ ...input, userId: ctx.user.id })
    ),

  getByOrder: protectedProcedure
    .input(z.object({ orderId: z.string().uuid() }))
    .query(({ input }) =>
      db.select().from(shippingDocuments)
        .where(eq(shippingDocuments.orderId, input.orderId))
    ),

  downloadLabel: protectedProcedure
    .input(z.object({ shippingDocId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [doc] = await db.select().from(shippingDocuments)
        .where(eq(shippingDocuments.id, input.shippingDocId));
      if (!doc) return null;

      const fileBuffer = await fs.readFile(doc.labelFilePath);
      return {
        data: fileBuffer.toString("base64"),
        filename: doc.labelFilePath.split("/").pop(),
        contentType: doc.labelFormat === "pdf" ? "application/pdf" : "text/plain",
      };
    }),

  printThermal: protectedProcedure
    .input(
      z.object({
        shippingDocId: z.string().uuid(),
        printerIp: z.string().ip(),
        printerPort: z.number().int().default(9100),
      })
    )
    .mutation(async ({ input }) => {
      const [doc] = await db.select().from(shippingDocuments)
        .where(eq(shippingDocuments.id, input.shippingDocId));
      if (!doc) return { success: false, error: "Document not found" };
      if (doc.labelFormat !== "zpl") {
        return { success: false, error: "Only ZPL labels can be sent to thermal printers" };
      }

      await printToThermalPrinter(doc.labelFilePath, input.printerIp, input.printerPort);
      return { success: true };
    }),
});
```

### 3. Frontend — Ship Order Dialog

```tsx
// src/client/components/orders/ShipOrderDialog.tsx
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FileText, Printer, Download } from "lucide-react";

export function ShipOrderDialog({
  orderId, open, onOpenChange,
}: {
  orderId: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const [method, setMethod] = useState<"courier" | "post" | "pickup" | "other">("courier");
  const [tracking, setTracking] = useState("");
  const [notes, setNotes] = useState("");
  const [format, setFormat] = useState<"pdf" | "zpl">("pdf");
  const utils = trpc.useUtils();

  const generateMutation = trpc.shipping.generateLabel.useMutation({
    onSuccess: () => {
      utils.orders.getById.invalidate({ id: orderId });
      utils.picking.queue.invalidate();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ship Order</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Shipping Method</label>
            <Select value={method} onValueChange={(v) => setMethod(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="courier">Courier</SelectItem>
                <SelectItem value="post">Post</SelectItem>
                <SelectItem value="pickup">Customer Pickup</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Tracking Number</label>
            <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Optional" />
          </div>

          <div>
            <label className="text-sm font-medium">Label Format</label>
            <div className="flex gap-2 mt-1">
              <Button
                variant={format === "pdf" ? "default" : "outline"}
                onClick={() => setFormat("pdf")}
                size="sm"
              >
                <FileText className="h-4 w-4 mr-1" /> PDF (A4)
              </Button>
              <Button
                variant={format === "zpl" ? "default" : "outline"}
                onClick={() => setFormat("zpl")}
                size="sm"
              >
                <Printer className="h-4 w-4 mr-1" /> ZPL (Thermal)
              </Button>
            </div>
          </div>

          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />

          <Button
            className="w-full"
            onClick={() => generateMutation.mutate({
              orderId, shippingMethod: method, trackingNumber: tracking || undefined,
              notes: notes || undefined, labelFormat: format,
            })}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? "Generating..." : "Generate Label & Ship"}
          </Button>

          {generateMutation.error && (
            <p className="text-red-600 text-sm">{generateMutation.error.message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/services/labelService.ts` | PDF generation (PDFKit), ZPL generation, thermal printing |
| `src/server/routers/shipping.ts` | tRPC router: generateLabel, download, printThermal |
| `src/client/components/orders/ShipOrderDialog.tsx` | Shipping form dialog (method, tracking, format) |
| `data/labels/` | Directory for generated label files (gitignored) |

---

## Verification

1. **Generate PDF** — ship a picked order with PDF format, confirm PDF file created with company header, customer address, item list.
2. **Generate ZPL** — ship with ZPL format, confirm ZPL file created with valid barcode command.
3. **Status transition** — generate label for a picked order, confirm status changes to "shipped".
4. **Download** — call `downloadLabel`, confirm base64 content is returned with correct content type.
5. **Tracking number** — ship with tracking number, confirm it's stored in `shippingDocuments`.
6. **Multiple shipments** — ship an order with `partially_shipped` status again, confirm it transitions to `shipped`.
7. **Cancelled order** — attempt to generate label for cancelled order, confirm error.
8. **Thermal print** — if a CAB printer is on the network, confirm ZPL data is sent to port 9100.
9. **Greek characters** — create a label for a customer with Greek name/address, confirm characters render in PDF (`^CI28` enables UTF-8 in ZPL).
10. **Changelog** — confirm shipping event is recorded in order changelog.

---

## Definition of Done

- [ ] `generateShippingLabel` creates PDF with company branding, customer info, and item list
- [ ] ZPL output includes barcode for order number and supports Greek characters
- [ ] Shipping document record stores method, tracking number, file path, and timestamp
- [ ] Order status transitions correctly (picked → shipped, pending → partially_shipped)
- [ ] Label files are persisted in `data/labels/` directory
- [ ] `downloadLabel` returns base64-encoded file content
- [ ] `printThermal` sends ZPL to network printer with timeout handling
- [ ] Ship Order dialog provides format toggle, method selector, and tracking input
- [ ] Cancelled orders cannot generate labels
- [ ] Shipping events are logged in order changelog
