# Milestone 7 — Customers

| Field | Value |
|-------|-------|
| **Step** | 7 of 12 |
| **Priority** | P1 |
| **Depends on** | Step 5 |
| **Estimated effort** | 1 day |

---

## Goal

Deliver full customer CRUD with search, order history summary on the detail page, and a `QuickCreateCustomerPopover` component that the order form (Step 8) will use to create a customer inline without leaving the page.

---

## Implementation

### 1. tRPC Router — `src/server/routers/customers.ts`

```ts
// src/server/routers/customers.ts
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, ilike, or, sql, desc, asc } from "drizzle-orm";
import { router, protectedProcedure, adminProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { customers, orders } from "../db/schema.js";

const customerInput = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  shippingCompany: z.string().max(100).optional(),
  notes: z.string().optional(),
});

const listInput = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(["name", "city", "createdAt"]).default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const customersRouter = router({
  list: protectedProcedure.input(listInput).query(async ({ input }) => {
    const { page, perPage, search, sortBy, sortDir } = input;
    const offset = (page - 1) * perPage;

    const where = search
      ? or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.phone, `%${search}%`),
          ilike(customers.email, `%${search}%`)
        )
      : undefined;

    const orderCol = customers[sortBy] ?? customers.name;
    const orderFn = sortDir === "desc" ? desc(orderCol) : asc(orderCol);

    const [rows, countResult] = await Promise.all([
      db
        .select()
        .from(customers)
        .where(where)
        .orderBy(orderFn)
        .limit(perPage)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(customers).where(where),
    ]);

    return { items: rows, total: Number(countResult[0].count), page, perPage };
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, input.id),
      });
      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });

      // Order history summary
      const [summary] = await db
        .select({
          orderCount: sql<number>`count(*)`,
          totalRevenue: sql<number>`coalesce(sum(${orders.totalAmount}), 0)`,
          lastOrderDate: sql<string>`max(${orders.createdAt})`,
        })
        .from(orders)
        .where(eq(orders.customerId, input.id));

      // Recent orders
      const recentOrders = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          totalAmount: orders.totalAmount,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.customerId, input.id))
        .orderBy(desc(orders.createdAt))
        .limit(20);

      return {
        ...customer,
        orderCount: Number(summary.orderCount),
        totalRevenue: Number(summary.totalRevenue),
        lastOrderDate: summary.lastOrderDate,
        recentOrders,
      };
    }),

  create: protectedProcedure
    .input(customerInput)
    .mutation(async ({ input }) => {
      const [customer] = await db.insert(customers).values(input).returning();
      return customer;
    }),

  update: protectedProcedure
    .input(customerInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const [updated] = await db
        .update(customers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(customers.id, id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      // Check for existing orders
      const [orderCheck] = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(eq(orders.customerId, input.id));

      if (Number(orderCheck.count) > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete customer with ${orderCheck.count} existing orders. Remove the orders first.`,
        });
      }

      await db.delete(customers).where(eq(customers.id, input.id));
      return { success: true };
    }),
});
```

### 2. Frontend — Customer List Page

```tsx
// src/client/routes/_auth/customers/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageShell } from "@/components/layout/PageShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Plus, ArrowUpDown } from "lucide-react";

export const Route = createFileRoute("/_auth/customers/")({
  component: CustomersPage,
});

function CustomersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"name" | "city" | "createdAt">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data, isLoading } = trpc.customers.list.useQuery({
    page,
    search: search || undefined,
    sortBy,
    sortDir,
  });

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  return (
    <PageShell
      title="Customers"
      actions={
        <Button asChild>
          <Link to="/customers/new"><Plus className="mr-2 h-4 w-4" /> Add Customer</Link>
        </Button>
      }
    >
      <Input
        placeholder="Search by name, phone, or email..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="max-w-sm mb-4"
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => toggleSort("name")} className="cursor-pointer">
                Name <ArrowUpDown className="inline h-3 w-3" />
              </TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead onClick={() => toggleSort("city")} className="cursor-pointer">
                City <ArrowUpDown className="inline h-3 w-3" />
              </TableHead>
              <TableHead>Shipping Co.</TableHead>
              <TableHead onClick={() => toggleSort("createdAt")} className="cursor-pointer">
                Added <ArrowUpDown className="inline h-3 w-3" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((c) => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => {}}>
                <TableCell>
                  <Link to="/customers/$customerId" params={{ customerId: c.id }} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>{c.phone}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{c.city}</TableCell>
                <TableCell>{c.shippingCompany}</TableCell>
                <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data && (
        <div className="flex justify-center gap-2 mt-6">
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="py-2 px-3 text-sm">Page {page} of {Math.ceil(data.total / data.perPage)}</span>
          <Button disabled={page * data.perPage >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </PageShell>
  );
}
```

### 3. QuickCreateCustomerPopover

This is the key reusable component — used from the order creation form (Step 8) so users can create a customer without navigating away.

```tsx
// src/client/components/customers/QuickCreateCustomerPopover.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UserPlus } from "lucide-react";
import { useState } from "react";

const quickSchema = z.object({
  name: z.string().min(1, "Name required"),
  phone: z.string().optional(),
  shippingCompany: z.string().optional(),
});

type QuickCustomerData = z.infer<typeof quickSchema>;

interface Props {
  onCreated: (customer: { id: string; name: string }) => void;
}

export function QuickCreateCustomerPopover({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const form = useForm<QuickCustomerData>({
    resolver: zodResolver(quickSchema),
  });

  const utils = trpc.useUtils();
  const mutation = trpc.customers.create.useMutation({
    onSuccess: (customer) => {
      utils.customers.list.invalidate();
      onCreated({ id: customer.id, name: customer.name });
      form.reset();
      setOpen(false);
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <UserPlus className="mr-1 h-4 w-4" /> New Customer
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="qc-name">Name *</Label>
            <Input id="qc-name" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-red-600 text-xs">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="qc-phone">Phone</Label>
            <Input id="qc-phone" {...form.register("phone")} />
          </div>
          <div>
            <Label htmlFor="qc-shipping">Shipping Company</Label>
            <Input id="qc-shipping" {...form.register("shippingCompany")} />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating..." : "Create Customer"}
          </Button>
          {mutation.error && (
            <p className="text-red-600 text-sm">{mutation.error.message}</p>
          )}
        </form>
      </PopoverContent>
    </Popover>
  );
}
```

---

## Files to Create

| Path | Purpose |
|------|---------|
| `src/server/routers/customers.ts` | tRPC router: CRUD with search and order summary |
| `src/client/routes/_auth/customers/index.tsx` | Customer list page |
| `src/client/routes/_auth/customers/$customerId.tsx` | Customer detail: profile form + order history |
| `src/client/routes/_auth/customers/new.tsx` | Create customer page |
| `src/client/components/customers/CustomerForm.tsx` | Shared create/edit form |
| `src/client/components/customers/QuickCreateCustomerPopover.tsx` | Inline 3-field popover for order form |

---

## Verification

1. **List** — load `/customers`, confirm paginated table renders.
2. **Search** — type a phone number, confirm only matching rows appear.
3. **Sort** — click "City" header, confirm rows reorder. Click again for reverse.
4. **Create** — navigate to `/customers/new`, fill form, submit, confirm redirect to detail page.
5. **Detail** — open a customer with orders, confirm order count, total revenue, and last order date display correctly.
6. **Edit** — change the email field, save, confirm the update persists.
7. **Delete** — attempt to delete a customer with orders, confirm error message. Delete a customer with no orders, confirm success.
8. **QuickCreate** — open the popover, fill 3 fields, submit, confirm the customer is returned and selected in the combobox.

---

## Definition of Done

- [ ] `customers.list` returns paginated, searchable results sorted by name/city/createdAt
- [ ] `customers.getById` returns customer with order history summary (count, total revenue, last order)
- [ ] `customers.delete` blocks deletion when orders exist
- [ ] Customer list page has search, sortable columns, pagination
- [ ] Customer detail page shows profile form and recent orders table
- [ ] `QuickCreateCustomerPopover` creates a customer and returns it to the caller
- [ ] All mutations invalidate relevant queries
- [ ] Loading skeletons display while fetching
