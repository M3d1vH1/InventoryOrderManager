import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { shippingDocuments } from "../db/schema.js";
import {
    generateShippingLabel,
    printToThermalPrinter,
} from "../services/labelService.js";
import fs from "fs/promises";

export const shippingRouter = router({
    generateLabel: protectedProcedure
        .input(
            z.object({
                orderId: z.number().int(),
                carrier: z.string().optional(),
                trackingNumber: z.string().optional(),
                notes: z.string().optional(),
                labelFormat: z.enum(["pdf", "zpl"]).default("pdf"),
            })
        )
        .mutation(({ input, ctx }) =>
            generateShippingLabel({ ...input, userId: ctx.user.id })
        ),

    getByOrder: protectedProcedure
        .input(z.object({ orderId: z.number().int() }))
        .query(({ input }) =>
            db
                .select()
                .from(shippingDocuments)
                .where(eq(shippingDocuments.orderId, input.orderId))
        ),

    downloadLabel: protectedProcedure
        .input(z.object({ shippingDocId: z.number().int() }))
        .query(async ({ input }) => {
            const [doc] = await db
                .select()
                .from(shippingDocuments)
                .where(eq(shippingDocuments.id, input.shippingDocId));
            if (!doc) return null;

            const fileBuffer = await fs.readFile(doc.documentPath);
            return {
                data: fileBuffer.toString("base64"),
                filename: doc.documentPath.split("/").pop() ?? "label",
                contentType:
                    doc.documentType === "pdf" ? "application/pdf" : "text/plain",
            };
        }),

    printThermal: protectedProcedure
        .input(
            z.object({
                shippingDocId: z.number().int(),
                printerIp: z.string().ip(),
                printerPort: z.number().int().default(9100),
            })
        )
        .mutation(async ({ input }) => {
            const [doc] = await db
                .select()
                .from(shippingDocuments)
                .where(eq(shippingDocuments.id, input.shippingDocId));
            if (!doc) return { success: false, error: "Document not found" };
            if (doc.documentType !== "zpl") {
                return {
                    success: false,
                    error: "Only ZPL labels can be sent to thermal printers",
                };
            }

            await printToThermalPrinter(
                doc.documentPath,
                input.printerIp,
                input.printerPort
            );
            return { success: true };
        }),
});
