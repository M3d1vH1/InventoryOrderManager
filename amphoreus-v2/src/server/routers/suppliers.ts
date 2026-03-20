import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, ilike, sql, desc, asc, and, lte } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import {
    suppliers,
    supplierInvoices,
    supplierPayments,
    supplierInvoiceChangelogs,
} from "../db/schema.js";

/* ── Zod Schemas ─────────────────────────────────────── */

const supplierInput = z.object({
    name: z.string().min(1).max(255),
    contactPerson: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    taxId: z.string().optional(),
    notes: z.string().optional(),
});

const invoiceCreateInput = z.object({
    supplierId: z.string().uuid(),
    invoiceNumber: z.string().min(1),
    amount: z.number().min(0),
    taxAmount: z.number().min(0).default(0),
    invoiceDate: z.string().datetime(),
    dueDate: z.string().datetime().optional(),
    notes: z.string().optional(),
});

const paymentCreateInput = z.object({
    invoiceId: z.string().uuid(),
    amount: z.number().min(0.01),
    paymentMethod: z.enum(["bank_transfer", "cash", "check", "other"]),
    paymentDate: z.string().datetime(),
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
});

/* ── Router ──────────────────────────────────────────── */

export const suppliersRouter = router({
    /* ── Supplier CRUD ─────────────────────────────── */

    list: protectedProcedure
        .input(z.object({
            search: z.string().optional(),
            page: z.number().int().min(1).default(1),
            perPage: z.number().int().min(1).max(100).default(20),
        }))
        .query(async ({ input }) => {
            const { page, perPage, search } = input;
            const offset = (page - 1) * perPage;
            const where = search ? ilike(suppliers.name, `%${search}%`) : undefined;

            const [rows, countResult] = await Promise.all([
                db.select().from(suppliers).where(where)
                    .orderBy(asc(suppliers.name))
                    .limit(perPage).offset(offset),
                db.select({ count: sql<number>`count(*)` }).from(suppliers).where(where),
            ]);

            return { items: rows, total: Number(countResult[0].count), page, perPage };
        }),

    getById: protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input }) => {
            const supplier = await db.query.suppliers.findFirst({
                where: eq(suppliers.id, input.id),
            });
            if (!supplier) throw new TRPCError({ code: "NOT_FOUND" });

            const invoiceList = await db.select().from(supplierInvoices)
                .where(eq(supplierInvoices.supplierId, input.id))
                .orderBy(desc(supplierInvoices.createdAt));

            const totalInvoiced = invoiceList.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

            const [{ total: totalPaid }] = await db.select({
                total: sql<number>`COALESCE(SUM(${supplierPayments.amount}), 0)`,
            }).from(supplierPayments)
                .innerJoin(supplierInvoices, eq(supplierPayments.invoiceId, supplierInvoices.id))
                .where(eq(supplierInvoices.supplierId, input.id));

            return {
                ...supplier,
                invoices: invoiceList,
                totalInvoiced,
                totalPaid: Number(totalPaid),
                outstandingBalance: totalInvoiced - Number(totalPaid),
            };
        }),

    create: protectedProcedure
        .input(supplierInput)
        .mutation(async ({ input }) => {
            const data = { ...input, email: input.email === "" ? null : input.email };
            const [supplier] = await db.insert(suppliers).values(data).returning();
            return supplier;
        }),

    update: protectedProcedure
        .input(supplierInput.partial().extend({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
            const { id, email, ...rest } = input;
            const data = { ...rest, email: email === "" ? null : email };
            const [updated] = await db.update(suppliers).set(data)
                .where(eq(suppliers.id, id)).returning();
            if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
            return updated;
        }),

    delete: adminProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
            await db.delete(suppliers).where(eq(suppliers.id, input.id));
            return { success: true };
        }),

    /* ── Invoices ──────────────────────────────────── */

    invoices: router({
        create: protectedProcedure
            .input(invoiceCreateInput)
            .mutation(async ({ input, ctx }) => {
                const totalAmount = input.amount + input.taxAmount;
                const [invoice] = await db.insert(supplierInvoices).values({
                    supplierId: input.supplierId,
                    invoiceNumber: input.invoiceNumber,
                    amount: String(input.amount),
                    taxAmount: String(input.taxAmount),
                    totalAmount: String(totalAmount),
                    invoiceDate: new Date(input.invoiceDate),
                    dueDate: input.dueDate ? new Date(input.dueDate) : null,
                    notes: input.notes,
                    status: "pending",
                    createdById: ctx.user.id,
                }).returning();

                await db.insert(supplierInvoiceChangelogs).values({
                    invoiceId: invoice.id,
                    action: "created",
                    details: `Invoice ${input.invoiceNumber} created for €${totalAmount.toFixed(2)}`,
                    changedById: ctx.user.id,
                });

                return invoice;
            }),

        getById: protectedProcedure
            .input(z.object({ id: z.string().uuid() }))
            .query(async ({ input }) => {
                const invoice = await db.query.supplierInvoices.findFirst({
                    where: eq(supplierInvoices.id, input.id),
                    with: { supplier: true },
                });
                if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

                const paymentList = await db.select().from(supplierPayments)
                    .where(eq(supplierPayments.invoiceId, input.id))
                    .orderBy(desc(supplierPayments.createdAt));

                const totalPaid = paymentList.reduce((sum, p) => sum + Number(p.amount), 0);

                const changelog = await db.select().from(supplierInvoiceChangelogs)
                    .where(eq(supplierInvoiceChangelogs.invoiceId, input.id))
                    .orderBy(desc(supplierInvoiceChangelogs.createdAt));

                return {
                    ...invoice,
                    payments: paymentList,
                    totalPaid,
                    remainingBalance: Number(invoice.totalAmount) - totalPaid,
                    changelog,
                };
            }),

        listOverdue: protectedProcedure.query(async () => {
            return db.select({
                id: supplierInvoices.id,
                invoiceNumber: supplierInvoices.invoiceNumber,
                totalAmount: supplierInvoices.totalAmount,
                dueDate: supplierInvoices.dueDate,
                status: supplierInvoices.status,
                supplierId: supplierInvoices.supplierId,
                supplierName: suppliers.name,
            })
                .from(supplierInvoices)
                .innerJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
                .where(and(
                    eq(supplierInvoices.status, "pending"),
                    lte(supplierInvoices.dueDate, new Date()),
                ))
                .orderBy(asc(supplierInvoices.dueDate));
        }),
    }),

    /* ── Payments ──────────────────────────────────── */

    payments: router({
        create: protectedProcedure
            .input(paymentCreateInput)
            .mutation(async ({ input, ctx }) => {
                return db.transaction(async (tx) => {
                    const [invoice] = await tx.select().from(supplierInvoices)
                        .where(eq(supplierInvoices.id, input.invoiceId));
                    if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

                    const [{ total }] = await tx.select({
                        total: sql<number>`COALESCE(SUM(${supplierPayments.amount}), 0)`,
                    }).from(supplierPayments)
                        .where(eq(supplierPayments.invoiceId, input.invoiceId));

                    const newTotalPaid = Number(total) + input.amount;
                    const invoiceTotal = Number(invoice.totalAmount);

                    if (newTotalPaid > invoiceTotal + 0.001) { // tiny float tolerance
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: `Payment of €${input.amount.toFixed(2)} would exceed invoice total (€${invoiceTotal.toFixed(2)}). Remaining: €${(invoiceTotal - Number(total)).toFixed(2)}`,
                        });
                    }

                    const [payment] = await tx.insert(supplierPayments).values({
                        invoiceId: input.invoiceId,
                        amount: String(input.amount),
                        paymentMethod: input.paymentMethod,
                        paymentDate: new Date(input.paymentDate),
                        referenceNumber: input.referenceNumber,
                        notes: input.notes,
                        createdById: ctx.user.id,
                    }).returning();

                    const newStatus = newTotalPaid >= invoiceTotal - 0.001 ? "paid" : "partially_paid";
                    await tx.update(supplierInvoices)
                        .set({ status: newStatus, updatedAt: new Date() })
                        .where(eq(supplierInvoices.id, input.invoiceId));

                    await tx.insert(supplierInvoiceChangelogs).values({
                        invoiceId: input.invoiceId,
                        action: "payment_recorded",
                        details: `Payment of €${input.amount.toFixed(2)} via ${input.paymentMethod}. Status: ${newStatus}`,
                        changedById: ctx.user.id,
                    });

                    return payment;
                });
            }),
    }),
});
