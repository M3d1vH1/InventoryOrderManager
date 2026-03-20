import PDFDocument from "pdfkit";
import { db } from "../db/index.js";
import {
    orders,
    shippingDocuments,
    orderChangelogs,
} from "../db/schema.js";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import fs from "fs/promises";
import path from "path";

const LABELS_DIR = path.join(process.cwd(), "data", "labels");

interface GenerateLabelInput {
    orderId: number;
    trackingNumber?: string;
    notes?: string;
    labelFormat: "pdf" | "zpl";
    userId: number;
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
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot ship a cancelled order",
        });
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
    const [doc] = await db
        .insert(shippingDocuments)
        .values({
            orderId: input.orderId,
            documentPath: filePath,
            documentType: input.labelFormat,
            trackingNumber: input.trackingNumber,
            notes: input.notes,
            uploadDate: new Date(),
        })
        .returning();

    // Transition order status
    const isFullyPicked = order.items.every((i) => i.pickedAt !== null);
    const newStatus = isFullyPicked ? "shipped" : "partially_shipped";

    await db
        .update(orders)
        .set({ status: newStatus })
        .where(eq(orders.id, input.orderId));

    await db.insert(orderChangelogs).values({
        orderId: input.orderId,
        action: "status_changed",
        notes: `Shipping label generated (${input.labelFormat.toUpperCase()}).${input.trackingNumber ? ` Tracking: ${input.trackingNumber}` : ""
            }`,
        userId: input.userId,
    });

    return doc;
}

async function generatePdfLabel(
    order: any, // Typed loosely here since Drizzle inference is complex
    outputPath: string
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
        if (order.customer.state) doc.text(order.customer.state);
        if (order.customer.postalCode) doc.text(order.customer.postalCode);
        if (order.customer.phone) doc.text(`Tel: ${order.customer.phone}`);
        doc.moveDown(1);

        // Items table
        doc.fontSize(12).font("Helvetica-Bold").text("Items:");
        doc.moveDown(0.3);
        doc.fontSize(10).font("Helvetica");
        for (const item of order.items) {
            doc.text(`  ${item.quantity}x  ${item.product?.name ?? "Unknown"}  (${item.product?.sku ?? "N/A"})`);
        }

        doc.end();
        stream.on("finish", resolve);
        stream.on("error", reject);
    });
}

async function generateZplLabel(order: any, outputPath: string): Promise<void> {
    // ZPL II format for thermal printers (100mm x 150mm label)
    const zpl = `^XA
^CI28
^FO50,30^A0N,40,40^FD${order.orderNumber}^FS
^FO50,80^A0N,28,28^FD${order.customer.name}^FS
^FO50,115^A0N,24,24^FD${order.customer.address ?? ""}^FS
^FO50,145^A0N,24,24^FD${order.customer.city ?? ""} ${order.customer.postalCode ?? ""}^FS
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
    printerPort: number = 9100
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
