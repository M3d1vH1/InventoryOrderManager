# Milestone 23 — Calendar & Scheduling

| Field | Value |
|-------|-------|
| **Step** | 23 of 25 |
| **Priority** | P3 |
| **Depends on** | Steps 8, 20 |
| **Estimated effort** | 1 day |

---

## Goal

Add a calendar view that aggregates events from across the system: order shipping deadlines, production batch schedules, CRM follow-up reminders, and supplier invoice due dates. This gives managers a single timeline of everything happening in the business. Users can also create custom calendar events for meetings, deliveries, or notes.

---

## Implementation

### 1. Database Schema

```
calendar_events
  - id, title, description, start_date, end_date,
    event_type (custom/shipping/production/follow_up/invoice_due),
    reference_id (polymorphic — order_id, batch_id, etc.),
    reference_type (order/batch/call_log/invoice),
    color, all_day (boolean),
    created_by_id (FK users), created_at
```

### 2. tRPC Router — `src/server/routers/calendar.ts`

```ts
// src/server/routers/calendar.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, gte, lte, sql, between } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import {
  calendarEvents, orders, productionBatches, callLogs,
  supplierInvoices, customers, suppliers,
} from "../db/schema.js";

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

      // 1. Custom events from calendar_events table
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
          title: `Ship: ${o.orderNumber} (${o.customerName})`,
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

      // 4. CRM follow-up reminders
      if (!input.types || input.types.includes("follow_up")) {
        const followUps = await db.select().from(callLogs)
          .where(and(
            sql`${callLogs.followUpDate} IS NOT NULL`,
            eq(callLogs.followUpCompleted, false),
            gte(callLogs.followUpDate, fromDate),
            lte(callLogs.followUpDate, toDate),
          ));

        events.push(...followUps.map((f) => ({
          id: `follow-${f.id}`,
          title: `Follow-up call`,
          description: f.notes,
          start: f.followUpDate!,
          end: f.followUpDate!,
          type: "follow_up" as const,
          color: "#f59e0b",
          allDay: true,
          referenceId: f.id,
          referenceType: "call_log" as const,
        })));
      }

      // 5. Supplier invoice due dates
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

      return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }),

  createEvent: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      startDate: z.string().datetime(),
      endDate: z.string().datetime().optional(),
      allDay: z.boolean().default(false),
      color: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [event] = await db.insert(calendarEvents).values({
        ...input,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        eventType: "custom",
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

const typeColors: Record<string, string> = {
  custom: "#6b7280",
  shipping: "#3b82f6",
  production: "#8b5cf6",
  follow_up: "#f59e0b",
  invoice_due: "#ef4444",
};

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start: Date;
  end: Date | null;
  type: string;
  color: string;
  allDay: boolean;
  referenceId?: string | null;
  referenceType?: string | null;
}
```

### 3. Frontend Page

```tsx
// src/client/routes/_auth/calendar/index.tsx
// - Month view grid with colored event dots/bars
// - Week view with time slots
// - Event type filter toggles (shipping, production, follow-up, invoice, custom)
// - Click event → navigate to reference (order, batch, invoice, etc.)
// - "Add Event" button for custom events
// - Month navigation (prev/next arrows, "Today" button)
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/routers/calendar.ts` | tRPC router: aggregated events, custom event CRUD |
| `src/client/routes/_auth/calendar/index.tsx` | Calendar page (month + week view) |
| `src/client/components/calendar/CalendarGrid.tsx` | Month grid component |
| `src/client/components/calendar/WeekView.tsx` | Week view with time slots |
| `src/client/components/calendar/EventChip.tsx` | Colored event chip |
| `src/client/components/calendar/AddEventDialog.tsx` | Custom event creation dialog |

---

## Verification

1. **Month view** — navigate to calendar, confirm events from all sources appear on correct dates.
2. **Shipping deadlines** — create an order with estimated shipping date, confirm it appears on calendar.
3. **Follow-up reminders** — log a call with follow-up date, confirm it appears as a yellow event.
4. **Invoice due dates** — create a supplier invoice with due date, confirm it appears as a red event.
5. **Production batches** — create a batch, confirm it appears as a purple event.
6. **Custom events** — create a custom event, confirm it appears on the calendar.
7. **Type filters** — toggle event types on/off, confirm only selected types are shown.
8. **Event click** — click a shipping event, confirm navigation to the order detail page.
9. **Month navigation** — click prev/next, confirm events load for the new month.
10. **Delete event** — delete a custom event, confirm it disappears.

---

## Definition of Done

- [ ] Calendar aggregates events from orders, production, CRM, suppliers, and custom entries
- [ ] Month view grid shows colored event dots/bars on correct dates
- [ ] Week view shows events in time slots
- [ ] Event type filter toggles for each source
- [ ] Clicking an event navigates to the source record (order, batch, invoice, call log)
- [ ] Custom event CRUD for meetings, notes, and deadlines
- [ ] Month navigation with Today button
- [ ] Each event type has a distinct color
- [ ] Events sorted chronologically within each day
- [ ] Only relevant events shown (non-shipped orders, unpaid invoices, incomplete follow-ups)
