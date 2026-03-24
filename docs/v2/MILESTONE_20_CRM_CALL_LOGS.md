# Milestone 20 — CRM & Call Logs

| Field | Value |
|-------|-------|
| **Step** | 20 of 25 |
| **Priority** | P2 |
| **Depends on** | Step 7 |
| **Estimated effort** | 1.5 days |

---

## Goal

Build a lightweight CRM for tracking prospective customers (leads) and logging calls with both existing customers and prospects. Each call log records the outcome, follow-up date, and notes. The system surfaces overdue follow-ups and provides a call history view per customer.

---

## Implementation

### 1. Database Schema (from Milestone 02)

```
prospective_customers
  - id, company_name, contact_name, email, phone, address, city,
    source (referral/website/cold_call/exhibition/other),
    status (new/contacted/qualified/proposal/won/lost),
    notes, assigned_to_id (FK users), created_at, updated_at

call_logs
  - id, customer_id (FK customers, nullable), prospective_customer_id (FK, nullable),
    called_by_id (FK users), call_date, duration_minutes,
    outcome (answered/no_answer/voicemail/busy/callback_requested),
    notes, follow_up_date, follow_up_completed, created_at

call_outcomes (optional — predefined outcome templates)
  - id, name, description, requires_follow_up, created_at
```

### 2. tRPC Router — `src/server/routers/crm.ts`

```ts
// src/server/routers/crm.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, lte, sql, desc, asc, ilike, isNull, or } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { prospectiveCustomers, callLogs, customers } from "../db/schema.js";

export const crmRouter = router({
  /* ── Prospective Customers (Leads) ─────────────────── */

  prospects: router({
    list: protectedProcedure
      .input(z.object({
        status: z.enum(["new", "contacted", "qualified", "proposal", "won", "lost"]).optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        const { page, perPage, status, search } = input;
        const offset = (page - 1) * perPage;

        const conditions = [];
        if (status) conditions.push(eq(prospectiveCustomers.status, status));
        if (search) {
          conditions.push(or(
            ilike(prospectiveCustomers.companyName, `%${search}%`),
            ilike(prospectiveCustomers.contactName, `%${search}%`),
          ));
        }

        const where = conditions.length ? and(...conditions) : undefined;

        const [rows, countResult] = await Promise.all([
          db.select().from(prospectiveCustomers).where(where)
            .orderBy(desc(prospectiveCustomers.createdAt))
            .limit(perPage).offset(offset),
          db.select({ count: sql<number>`count(*)` })
            .from(prospectiveCustomers).where(where),
        ]);

        return { items: rows, total: Number(countResult[0].count), page, perPage };
      }),

    create: protectedProcedure
      .input(z.object({
        companyName: z.string().min(1),
        contactName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        source: z.enum(["referral", "website", "cold_call", "exhibition", "other"]).default("other"),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const [prospect] = await db.insert(prospectiveCustomers).values({
          ...input,
          status: "new",
          assignedToId: ctx.user.id,
        }).returning();
        return prospect;
      }),

    updateStatus: protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        status: z.enum(["new", "contacted", "qualified", "proposal", "won", "lost"]),
      }))
      .mutation(async ({ input }) => {
        const [updated] = await db.update(prospectiveCustomers)
          .set({ status: input.status, updatedAt: new Date() })
          .where(eq(prospectiveCustomers.id, input.id))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }),

    convertToCustomer: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        return db.transaction(async (tx) => {
          const [prospect] = await tx.select().from(prospectiveCustomers)
            .where(eq(prospectiveCustomers.id, input.id));
          if (!prospect) throw new TRPCError({ code: "NOT_FOUND" });

          // Create customer from prospect data
          const [customer] = await tx.insert(customers).values({
            name: prospect.companyName,
            contactName: prospect.contactName,
            email: prospect.email,
            phone: prospect.phone,
            address: prospect.address,
            city: prospect.city,
          }).returning();

          // Mark prospect as won
          await tx.update(prospectiveCustomers)
            .set({ status: "won", updatedAt: new Date() })
            .where(eq(prospectiveCustomers.id, input.id));

          return customer;
        });
      }),
  }),

  /* ── Call Logs ─────────────────────────────────────── */

  calls: router({
    list: protectedProcedure
      .input(z.object({
        customerId: z.string().uuid().optional(),
        prospectiveCustomerId: z.string().uuid().optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        const { page, perPage, customerId, prospectiveCustomerId } = input;
        const offset = (page - 1) * perPage;

        const conditions = [];
        if (customerId) conditions.push(eq(callLogs.customerId, customerId));
        if (prospectiveCustomerId) conditions.push(eq(callLogs.prospectiveCustomerId, prospectiveCustomerId));
        const where = conditions.length ? and(...conditions) : undefined;

        const rows = await db.select().from(callLogs).where(where)
          .orderBy(desc(callLogs.callDate))
          .limit(perPage).offset(offset);

        return rows;
      }),

    create: protectedProcedure
      .input(z.object({
        customerId: z.string().uuid().optional(),
        prospectiveCustomerId: z.string().uuid().optional(),
        callDate: z.string().datetime().default(() => new Date().toISOString()),
        durationMinutes: z.number().int().min(0).optional(),
        outcome: z.enum(["answered", "no_answer", "voicemail", "busy", "callback_requested"]),
        notes: z.string().optional(),
        followUpDate: z.string().datetime().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!input.customerId && !input.prospectiveCustomerId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Must specify either a customer or prospective customer",
          });
        }

        const [log] = await db.insert(callLogs).values({
          ...input,
          callDate: new Date(input.callDate),
          followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
          followUpCompleted: false,
          calledById: ctx.user.id,
        }).returning();

        // Auto-update prospect status if first contact
        if (input.prospectiveCustomerId && input.outcome === "answered") {
          await db.update(prospectiveCustomers)
            .set({ status: "contacted", updatedAt: new Date() })
            .where(and(
              eq(prospectiveCustomers.id, input.prospectiveCustomerId),
              eq(prospectiveCustomers.status, "new"),
            ));
        }

        return log;
      }),

    completeFollowUp: protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const [updated] = await db.update(callLogs)
          .set({ followUpCompleted: true })
          .where(eq(callLogs.id, input.id))
          .returning();
        if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
        return updated;
      }),

    overdueFollowUps: protectedProcedure.query(async ({ ctx }) => {
      return db.select({
        callLog: callLogs,
        customerName: customers.name,
        prospectName: prospectiveCustomers.companyName,
      })
        .from(callLogs)
        .leftJoin(customers, eq(callLogs.customerId, customers.id))
        .leftJoin(prospectiveCustomers, eq(callLogs.prospectiveCustomerId, prospectiveCustomers.id))
        .where(and(
          eq(callLogs.followUpCompleted, false),
          lte(callLogs.followUpDate, new Date()),
          sql`${callLogs.followUpDate} IS NOT NULL`,
        ))
        .orderBy(asc(callLogs.followUpDate));
    }),
  }),
});
```

### 3. Frontend Pages

```
src/client/routes/_auth/crm/
  ├── index.tsx           — CRM dashboard: pipeline view, overdue follow-ups
  ├── prospects/
  │   ├── index.tsx       — Prospect list with status filter (Kanban optional)
  │   └── $prospectId.tsx — Prospect detail: call history, status, convert button
  └── calls/
      └── index.tsx       — Call log feed with filters
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/routers/crm.ts` | tRPC router: prospects, call logs, follow-ups |
| `src/client/routes/_auth/crm/index.tsx` | CRM dashboard with pipeline and follow-ups |
| `src/client/routes/_auth/crm/prospects/index.tsx` | Prospect list with status filters |
| `src/client/routes/_auth/crm/prospects/$prospectId.tsx` | Prospect detail with call history |
| `src/client/routes/_auth/crm/calls/index.tsx` | Call log feed |
| `src/client/components/crm/LogCallDialog.tsx` | Quick call logging dialog |
| `src/client/components/crm/ProspectPipeline.tsx` | Visual pipeline (new → won/lost) |
| `src/client/components/crm/FollowUpReminders.tsx` | Overdue follow-up list |

---

## Verification

1. **Prospect CRUD** — create, list, search, filter by status.
2. **Status pipeline** — move prospect through new → contacted → qualified → proposal → won.
3. **Convert to customer** — convert a "won" prospect, confirm customer record created and prospect marked as won.
4. **Log call** — log a call to a customer, confirm call log created with outcome and notes.
5. **Auto-status update** — log an "answered" call to a "new" prospect, confirm status changes to "contacted".
6. **Follow-up** — log a call with follow-up date, confirm it appears in overdue list after the date passes.
7. **Complete follow-up** — mark a follow-up as completed, confirm it disappears from overdue list.
8. **Call history** — view customer/prospect detail, confirm all call logs listed chronologically.
9. **Overdue follow-ups** — confirm overdue list shows only incomplete follow-ups past their date.
10. **Validation** — attempt to create a call log without customer or prospect, confirm error.

---

## Definition of Done

- [ ] Prospective customer CRUD with status pipeline (new → contacted → qualified → proposal → won/lost)
- [ ] Call logging for both existing customers and prospects
- [ ] Call outcomes tracked (answered, no_answer, voicemail, busy, callback_requested)
- [ ] Follow-up dates with overdue tracking
- [ ] Auto-update prospect status to "contacted" on first answered call
- [ ] Convert prospect to customer (creates customer record, marks prospect as won)
- [ ] Overdue follow-ups query surfaces calls needing attention
- [ ] CRM dashboard with pipeline summary and follow-up reminders
- [ ] Call history viewable per customer and per prospect
