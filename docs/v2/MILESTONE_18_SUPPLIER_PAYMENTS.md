# Milestone 18 — Supplier Payments & Invoices

| Field | Value |
|-------|-------|
| **Step** | 18 of 25 |
| **Priority** | P2 |
| **Depends on** | Steps 1–5 |
| **Estimated effort** | 2 days |

---

## Goal

Deliver supplier management, invoice tracking, and payment recording. Each supplier has invoices (received goods/services) and payments (money sent to the supplier). The system tracks outstanding balances, payment history, and generates audit trails via changelogs. This is the accounts payable side of the business.

---

## Implementation

### 1. Database Schema (from Milestone 02)

```
suppliers
  - id, name, contact_person, email, phone, address, city, tax_id, notes, created_at

supplier_invoices
  - id, supplier_id (FK), invoice_number, amount, tax_amount, total_amount,
    invoice_date, due_date, status (pending/partially_paid/paid/overdue),
    notes, created_by_id (FK users), created_at, updated_at

supplier_payments
  - id, invoice_id (FK), amount, payment_method (bank_transfer/cash/check/other),
    payment_date, reference_number, notes, created_by_id (FK users), created_at

supplier_invoice_changelogs
  - id, invoice_id (FK), action, details, changed_by_id (FK users), created_at

supplier_payment_changelogs
  - id, payment_id (FK), action, details, changed_by_id (FK users), created_at
```

### 2. tRPC Router — `src/server/routers/suppliers.ts`

```ts
// src/server/routers/suppliers.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, ilike, sql, desc, asc, and, lte } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import {
  suppliers, supplierInvoices, supplierPayments,
  supplierInvoiceChangelogs, supplierPaymentChangelogs,
} from "../db/schema.js";

export const suppliersRouter = router({
  /* ── Supplier CRUD ─────────────────────────────────── */

  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      perPage: z.number().int().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const { page, perPage, search } = input;
      const offset = (page - 1) * perPage;
      const where = search
        ? ilike(suppliers.name, `%${search}%`)
        : undefined;

      const [rows, countResult] = await Promise.all([
        db.select().from(suppliers).where(where)
          .orderBy(asc(suppliers.name))
          .limit(perPage).offset(offset),
        db.select({ count: sql<number>`count(*)` })
          .from(suppliers).where(where),
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

      // Get outstanding balance
      const invoices = await db.select().from(supplierInvoices)
        .where(eq(supplierInvoices.supplierId, input.id))
        .orderBy(desc(supplierInvoices.createdAt));

      const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);

      const payments = await db.select({
        total: sql<number>`COALESCE(SUM(${supplierPayments.amount}), 0)`,
      }).from(supplierPayments)
        .innerJoin(supplierInvoices, eq(supplierPayments.invoiceId, supplierInvoices.id))
        .where(eq(supplierInvoices.supplierId, input.id));

      const totalPaid = Number(payments[0].total);

      return {
        ...supplier,
        invoices,
        totalInvoiced,
        totalPaid,
        outstandingBalance: totalInvoiced - totalPaid,
      };
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      contactPerson: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      taxId: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const [supplier] = await db.insert(suppliers).values(input).returning();
      return supplier;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      contactPerson: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      taxId: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const [updated] = await db.update(suppliers).set(data)
        .where(eq(suppliers.id, id)).returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  /* ── Invoices ──────────────────────────────────────── */

  invoices: router({
    create: protectedProcedure
      .input(z.object({
        supplierId: z.string().uuid(),
        invoiceNumber: z.string().min(1),
        amount: z.number().min(0),
        taxAmount: z.number().min(0).default(0),
        invoiceDate: z.string().datetime(),
        dueDate: z.string().datetime().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const totalAmount = input.amount + input.taxAmount;
        const [invoice] = await db.insert(supplierInvoices).values({
          ...input,
          totalAmount,
          invoiceDate: new Date(input.invoiceDate),
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
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

        const payments = await db.select().from(supplierPayments)
          .where(eq(supplierPayments.invoiceId, input.id))
          .orderBy(desc(supplierPayments.createdAt));

        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

        const changelog = await db.select().from(supplierInvoiceChangelogs)
          .where(eq(supplierInvoiceChangelogs.invoiceId, input.id))
          .orderBy(desc(supplierInvoiceChangelogs.createdAt));

        return {
          ...invoice,
          payments,
          totalPaid,
          remainingBalance: Number(invoice.totalAmount) - totalPaid,
          changelog,
        };
      }),

    listOverdue: protectedProcedure.query(async () => {
      return db.select({
        invoice: supplierInvoices,
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

  /* ── Payments ──────────────────────────────────────── */

  payments: router({
    create: protectedProcedure
      .input(z.object({
        invoiceId: z.string().uuid(),
        amount: z.number().min(0.01),
        paymentMethod: z.enum(["bank_transfer", "cash", "check", "other"]),
        paymentDate: z.string().datetime(),
        referenceNumber: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return db.transaction(async (tx) => {
          const [invoice] = await tx.select().from(supplierInvoices)
            .where(eq(supplierInvoices.id, input.invoiceId));
          if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });

          // Calculate total paid including this payment
          const [{ total }] = await tx.select({
            total: sql<number>`COALESCE(SUM(${supplierPayments.amount}), 0)`,
          }).from(supplierPayments)
            .where(eq(supplierPayments.invoiceId, input.invoiceId));

          const newTotalPaid = Number(total) + input.amount;
          if (newTotalPaid > Number(invoice.totalAmount)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Payment of €${input.amount} would exceed invoice total (€${invoice.totalAmount}). Remaining: €${Number(invoice.totalAmount) - Number(total)}`,
            });
          }

          const [payment] = await tx.insert(supplierPayments).values({
            ...input,
            paymentDate: new Date(input.paymentDate),
            createdById: ctx.user.id,
          }).returning();

          // Update invoice status
          const newStatus = newTotalPaid >= Number(invoice.totalAmount) ? "paid" : "partially_paid";
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
```

### 3. Frontend Pages

```tsx
// src/client/routes/_auth/suppliers/index.tsx — Supplier list with search
// src/client/routes/_auth/suppliers/$supplierId.tsx — Detail: invoices, payments, balance
// src/client/routes/_auth/suppliers/new.tsx — Create supplier form
// src/client/components/suppliers/InvoiceList.tsx — Invoice table with status badges
// src/client/components/suppliers/RecordPaymentDialog.tsx — Payment form dialog
// src/client/components/suppliers/OverdueInvoicesBanner.tsx — Dashboard alert for overdue invoices
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/routers/suppliers.ts` | tRPC router: supplier CRUD, invoices, payments |
| `src/client/routes/_auth/suppliers/index.tsx` | Supplier list page |
| `src/client/routes/_auth/suppliers/$supplierId.tsx` | Supplier detail with invoices and payments |
| `src/client/routes/_auth/suppliers/new.tsx` | Create supplier form |
| `src/client/components/suppliers/InvoiceList.tsx` | Invoice table with status and balance |
| `src/client/components/suppliers/RecordPaymentDialog.tsx` | Record payment form |
| `src/client/components/suppliers/OverdueInvoicesBanner.tsx` | Overdue invoice alert |

---

## Verification

1. **Supplier CRUD** — create, edit, list, search suppliers.
2. **Invoice creation** — create invoice with amount and tax, confirm `totalAmount` = amount + tax.
3. **Record payment** — record a partial payment, confirm invoice status changes to `partially_paid`.
4. **Full payment** — pay remaining balance, confirm status changes to `paid`.
5. **Overpayment guard** — attempt to pay more than remaining balance, confirm error.
6. **Outstanding balance** — view supplier detail, confirm balance = total invoiced - total paid.
7. **Overdue invoices** — create invoice with past due date, confirm it appears in overdue list.
8. **Changelog** — create invoice and record payment, confirm all actions logged.
9. **Payment methods** — record payments via different methods, confirm stored correctly.
10. **Audit trail** — view invoice detail, confirm full changelog with timestamps.

---

## Definition of Done

- [ ] Supplier CRUD with search and pagination
- [ ] Invoice creation with automatic total calculation (amount + tax)
- [ ] Payment recording with overpayment prevention
- [ ] Invoice status auto-transitions: pending → partially_paid → paid
- [ ] Outstanding balance calculated per supplier (total invoiced - total paid)
- [ ] Overdue invoices query returns invoices past due date
- [ ] All invoice and payment mutations create changelog entries
- [ ] Supplier detail page shows invoices, payments, and balance summary
- [ ] Record payment dialog validates amount against remaining balance
