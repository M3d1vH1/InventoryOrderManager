# MILESTONE 22 — Order Form Streamline

**Step:** 22 of 25
**Priority:** P2
**Depends on:** Milestone 19 (Sidebar Fix), Milestone 14 (API Standardization)
**Estimated effort:** 2 days

---

## Problem

The order creation flow has three structural issues that increase cognitive load and reduce reliability.

### Issue 1: Order form lives inside the Header component

`Header.tsx` contains a full-screen custom overlay that renders `OrderForm`. This means:
- **No URL change** when the form opens — browser Back doesn't close it, deep links are impossible
- **No focus trap** — focus can escape the modal to elements underneath
- **No `<Dialog>` primitive** — it's a hand-rolled overlay with a custom close button
- The form is opened by a button in the Header that says "New Order" — the user is still on whatever page they were on, which is confusing
- Refreshing the page closes the form silently

### Issue 2: "Create New Customer" is embedded inside the Order Form

When a user types a customer name that doesn't exist in the combobox, a 12-field sub-form expands inline:
- Name, VAT number, full address (street, city, state, postal, country), email, phone, contact person, preferred shipping company, billing company, notes
- The user is midway through creating an order and now must supply complete company details before they can continue
- Filling in a VAT number, billing company, and Greek state field is not what a warehouse operator wants to do when placing an order

### Issue 3: Two render contexts for the same form

`OrderForm` is rendered in two places:
- `Header.tsx` — for creating new orders (full-screen overlay)
- `Orders.tsx` — for editing existing orders (inside a dialog)

The form handles both modes via an `isEditing` prop, creating an implicit two-mode component. Any bug fix or field change must be tested in both contexts.

---

## Solution

### Part A — Route the New Order form to `/orders/new`

Instead of opening a modal from the Header, navigate to `/orders/new`. The Order form becomes a full page. This gives:
- A proper URL (shareable, browser-back works)
- Normal page load/unload lifecycle
- No need for an overlay or focus trap

### Part B — Replace the inline customer creation with a "Quick Create" popover

When a user types a name not in the customer combobox, show a small popover with only 3 fields:
- Customer Name (pre-filled with what they typed)
- Phone number
- Shipping Company (the only field typically needed at order time)

After saving, the new customer appears selected in the combobox. The full customer profile can be completed later from the Customers page.

---

## Implementation

### Part A — New route: `/orders/new`

**Step 1 — Add route in router**

```typescript
// client/src/App.tsx (or wherever routes are defined)
<Route path="/orders/new" component={lazy(() => import("./pages/OrderNew"))} />
```

**Step 2 — Create `OrderNew.tsx` page**

```typescript
// client/src/pages/OrderNew.tsx
import { useLocation } from "wouter";
import { OrderForm } from "@/components/orders/OrderForm";
import { PageHeader } from "@/components/layout/PageHeader";

export default function OrderNew() {
  const [, navigate] = useLocation();

  function handleSuccess(orderId: number) {
    navigate(`/orders/${orderId}`);
  }

  function handleCancel() {
    navigate("/orders");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <PageHeader title="New Order" backHref="/orders" />
      <OrderForm
        mode="create"
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </div>
  );
}
```

**Step 3 — Update Header "New Order" button**

```typescript
// client/src/components/layout/Header.tsx

// BEFORE:
<Button onClick={() => setIsOrderFormOpen(true)}>New Order</Button>

// AFTER:
import { useLocation } from "wouter";
const [, navigate] = useLocation();
<Button onClick={() => navigate("/orders/new")}>New Order</Button>
```

Remove the `isOrderFormOpen` state, the overlay `<div>`, and the embedded `<OrderForm>` from `Header.tsx` entirely.

**Step 4 — Update Orders.tsx edit flow**

The edit flow should remain as a Dialog (editing an existing order doesn't need a full page). `OrderForm` in edit mode stays inside `Orders.tsx` wrapped in a proper `<Dialog>` from shadcn/ui.

Ensure `OrderForm` accepts a `mode` prop:
```typescript
interface OrderFormProps {
  mode: "create" | "edit";
  orderId?: number;          // required when mode === "edit"
  initialData?: Partial<Order>; // pre-fills the form when editing
  onSuccess: (orderId: number) => void;
  onCancel: () => void;
}
```

### Part B — Quick Create Customer popover

**Step 1 — Detect "not found" state in customer combobox**

The customer combobox already has a search input. When the typed value doesn't match any customer, show a "Create [name]" option at the bottom of the dropdown list:

```typescript
// Inside the customer combobox CommandEmpty or end of CommandList:
{inputValue.trim().length > 1 && (
  <CommandItem
    value="__create_new__"
    onSelect={() => setShowQuickCreate(true)}
    className="text-blue-600 font-medium"
  >
    <Plus className="w-4 h-4 mr-2" />
    Create "{inputValue}" as new customer
  </CommandItem>
)}
```

**Step 2 — Quick Create popover (3 fields only)**

```typescript
// client/src/components/orders/QuickCreateCustomerPopover.tsx

interface QuickCreateCustomerPopoverProps {
  initialName: string;
  onCreated: (customer: Customer) => void;
  onClose: () => void;
}

export function QuickCreateCustomerPopover({
  initialName,
  onCreated,
  onClose,
}: QuickCreateCustomerPopoverProps) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { name: initialName, phone: "", shippingCompany: "" },
  });

  const createCustomer = useMutation({
    mutationFn: (data) =>
      fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()).then(r => r.data),
    onSuccess: (customer) => {
      onCreated(customer);
      onClose();
    },
  });

  return (
    <div className="absolute z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-80 top-full mt-1 left-0">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">Quick Create Customer</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit(data => createCustomer.mutate(data))} className="space-y-3">
        <div>
          <Label>Customer Name *</Label>
          <Input {...register("name", { required: true })} placeholder="Company or person name" />
          {errors.name && <p className="text-xs text-red-500 mt-1">Name is required</p>}
        </div>

        <div>
          <Label>Phone</Label>
          <Input {...register("phone")} placeholder="+30 210 000 0000" type="tel" />
        </div>

        <div>
          <Label>Shipping Company</Label>
          <Input {...register("shippingCompany")} placeholder="e.g. ACS, ELTA" />
        </div>

        <p className="text-xs text-gray-400">
          Complete the customer profile later from the Customers page.
        </p>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" size="sm" className="flex-1" disabled={createCustomer.isPending}>
            {createCustomer.isPending ? "Saving..." : "Create & Select"}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

**Step 3 — Wire into the order form's customer combobox**

```typescript
// In OrderForm's customer combobox section:

const [showQuickCreate, setShowQuickCreate] = useState(false);
const [customerSearchValue, setCustomerSearchValue] = useState("");

// After customer is quick-created:
function handleCustomerCreated(customer: Customer) {
  setValue("customerId", customer.id);    // set form field
  setCustomerSearchValue(customer.name);  // show in combobox display
  queryClient.invalidateQueries({ queryKey: ["/api/customers"] }); // refresh customer list
}
```

**Step 4 — Remove the old inline customer creation sub-form**

Delete all code in `OrderForm.tsx` that:
- Renders a `showNewCustomerForm` state
- Renders the 12-field inline customer form (`name`, `vat`, `address`, `city`, `state`, `postal`, `country`, `email`, `phone`, `contactPerson`, `shippingCompany`, `billingCompany`, `notes`)

This is the largest simplification. The sub-form should be replaced entirely by the Quick Create popover above.

---

## Files to Modify / Create

| File | Change |
|---|---|
| `client/src/pages/OrderNew.tsx` | **Create new** — full-page order creation route |
| `client/src/components/orders/OrderForm.tsx` | Add `mode` prop, remove inline customer sub-form, wire Quick Create popover |
| `client/src/components/orders/QuickCreateCustomerPopover.tsx` | **Create new** |
| `client/src/components/layout/Header.tsx` | Remove overlay + `OrderForm` embed; replace button with `navigate("/orders/new")` |
| `client/src/App.tsx` | Add `/orders/new` route |

---

## What NOT to Change

- Order form fields themselves (line items, product search, dates, priority, notes) stay as-is
- Edit order flow in `Orders.tsx` stays as a Dialog — only create flow moves to a full page
- Customer API endpoints stay unchanged
- The Quick Create popover only POSTs to `/api/customers` — same endpoint as the full customer form

---

## Verification

1. **New Order button:** Click "New Order" in the header. Browser URL changes to `/orders/new`. The page title shows "New Order". Browser Back returns to the previous page.

2. **Quick Create:** In the order form, type a name that doesn't exist in the customer list. "Create 'X' as new customer" appears in the dropdown. Clicking it opens a 3-field popover. Filling and saving selects the new customer in the order form.

3. **No inline sub-form:** The order form at `/orders/new` does not expand to show 12 customer fields at any point. `grep -n "showNewCustomerForm\|vatNumber\|billingCompany" client/src/components/orders/OrderForm.tsx` should return zero results.

4. **Edit order still works:** Clicking "Edit" on an order in `Orders.tsx` opens the order in a Dialog (not a page navigation). All existing edit functionality is preserved.

5. **Header is clean:** `grep -n "isOrderFormOpen\|OrderForm" client/src/components/layout/Header.tsx` should return zero results.

---

## Definition of Done

- [ ] `/orders/new` route exists and renders the order form as a full page
- [ ] "New Order" header button navigates to `/orders/new` (no overlay)
- [ ] Order form has `mode: "create" | "edit"` prop
- [ ] Inline 12-field customer sub-form removed from `OrderForm.tsx`
- [ ] Quick Create Customer popover implemented (3 fields: name, phone, shipping company)
- [ ] Quick Create correctly selects the new customer in the order form after save
- [ ] Edit order flow in `Orders.tsx` still works via Dialog unchanged
- [ ] Header.tsx has no `OrderForm` import or overlay state
