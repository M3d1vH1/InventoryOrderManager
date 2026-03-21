import { z } from "zod";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import {
    calendarEvents, orders, productionBatches,
    supplierInvoices, customers, suppliers,
} from "../db/schema.js";

export interface CalendarEvent {
    id: string;
    title: string;
    description?: string | null;
    start: Date;
    end: Date | null;
    type: string;
    color: string;
    allDay: boolean;
    referenceId?: string | number | null;
    referenceType?: string | null;
}

const typeColors: Record<string, string> = {
    custom: "#6b7280",
    shipping: "#3b82f6",
    production: "#8b5cf6",
    follow_up: "#f59e0b",
    invoice_due: "#ef4444",
};

export const calendarRouter = router({
    getEvents: protectedProcedure
        .input(z.object({
            from: z.string().datetime(),
            to: z.string().datetime(),
            types: z.array(z.enum([
                "custom", "shipping", "production", "follow_up", "invoice_due",
            ])).optional(),
        }))
        .query(async ({ input }) => {
            const fromDate = new Date(input.from);
            const toDate = new Date(input.to);
            const events: CalendarEvent[] = [];

            // 1. Custom events
            if (!input.types || input.types.includes("custom")) {
                const customEvents = await db.select().from(calendarEvents)
                    .where(and(
                        gte(calendarEvents.startDate, fromDate),
                        lte(calendarEvents.startDate, toDate),
                    ));
                events.push(...customEvents.map((e) => ({
                    id: e.id,
                    title: e.title,
                    description: e.description,
                    start: e.startDate,
                    end: e.endDate,
                    type: e.eventType,
                    color: e.color ?? typeColors[e.eventType],
                    allDay: e.allDay,
                    referenceId: e.referenceId,
                    referenceType: e.referenceType,
                })));
            }

            // 2. Order shipping deadlines
            if (!input.types || input.types.includes("shipping")) {
                const shippingDeadlines = await db.select({
                    id: orders.id,
                    orderNumber: orders.orderNumber,
                    estimatedShippingDate: orders.estimatedShippingDate,
                    customerName: customers.name,
                    status: orders.status,
                })
                    .from(orders)
                    .leftJoin(customers, eq(orders.customerId, customers.id))
                    .where(and(
                        sql`${orders.estimatedShippingDate} IS NOT NULL`,
                        gte(orders.estimatedShippingDate, fromDate),
                        lte(orders.estimatedShippingDate, toDate),
                        sql`${orders.status} NOT IN ('shipped', 'cancelled')`,
                    ));

                events.push(...shippingDeadlines.map((o) => ({
                    id: `ship-${o.id}`,
                    title: `Ship: ${o.orderNumber} (${o.customerName ?? "Unknown"})`,
                    description: `Status: ${o.status}`,
                    start: o.estimatedShippingDate!,
                    end: o.estimatedShippingDate!,
                    type: "shipping" as const,
                    color: o.status === "pending" ? "#ef4444" : "#3b82f6",
                    allDay: true,
                    referenceId: o.id,
                    referenceType: "order" as const,
                })));
            }

            // 3. Production batch schedules
            if (!input.types || input.types.includes("production")) {
                const batches = await db.select().from(productionBatches)
                    .where(and(
                        sql`${productionBatches.status} IN ('planned', 'in_progress')`,
                        gte(productionBatches.createdAt, fromDate),
                        lte(productionBatches.createdAt, toDate),
                    ));

                events.push(...batches.map((b) => ({
                    id: `batch-${b.id}`,
                    title: `Production: ${b.batchNumber}`,
                    description: `Status: ${b.status}, Qty: ${b.plannedQuantity}`,
                    start: b.startedAt ?? b.createdAt,
                    end: b.completedAt ?? b.createdAt,
                    type: "production" as const,
                    color: "#8b5cf6",
                    allDay: false,
                    referenceId: b.id,
                    referenceType: "batch" as const,
                })));
            }

            // 4. Supplier invoice due dates
            if (!input.types || input.types.includes("invoice_due")) {
                const invoiceDues = await db.select({
                    invoice: supplierInvoices,
                    supplierName: suppliers.name,
                })
                    .from(supplierInvoices)
                    .innerJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
                    .where(and(
                        sql`${supplierInvoices.dueDate} IS NOT NULL`,
                        sql`${supplierInvoices.status} IN ('pending', 'partially_paid')`,
                        gte(supplierInvoices.dueDate, fromDate),
                        lte(supplierInvoices.dueDate, toDate),
                    ));

                events.push(...invoiceDues.map((d) => ({
                    id: `inv-${d.invoice.id}`,
                    title: `Due: ${d.invoice.invoiceNumber} (${d.supplierName})`,
                    description: `Amount: €${d.invoice.totalAmount}`,
                    start: d.invoice.dueDate!,
                    end: d.invoice.dueDate!,
                    type: "invoice_due" as const,
                    color: "#ef4444",
                    allDay: true,
                    referenceId: d.invoice.id,
                    referenceType: "invoice" as const,
                })));
            }

            // Note: follow_up events depend on the CRM callLogs table (future milestone)

            return events.sort(
                (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
            );
        }),

    createEvent: protectedProcedure
        .input(z.object({
            title: z.string().min(1).max(255),
            description: z.string().optional(),
            startDate: z.string().datetime(),
            endDate: z.string().datetime().optional(),
            allDay: z.boolean().default(false),
            color: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const [event] = await db.insert(calendarEvents).values({
                title: input.title,
                description: input.description,
                startDate: new Date(input.startDate),
                endDate: input.endDate ? new Date(input.endDate) : null,
                eventType: "custom",
                allDay: input.allDay,
                color: input.color,
                createdById: ctx.user.id,
            }).returning();
            return event;
        }),

    deleteEvent: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
            await db.delete(calendarEvents).where(eq(calendarEvents.id, input.id));
            return { deleted: true };
        }),
});
