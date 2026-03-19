# MILESTONE 20 — Warehouse Picking UX (Mobile-First)

**Step:** 20 of 25
**Priority:** P1
**Depends on:** Milestone 19 (Sidebar Fix), Milestone 07 (Stock Picking Race Condition Fix)
**Estimated effort:** 2 days

---

## Problem

`OrderPicking.tsx` and its `PickList` child component render a standard shadcn `<Table>` designed for desktop screens. Warehouse workers use this page on a tablet or mobile device while physically moving through the warehouse. The current UI has:

- Small table rows with 10+ columns — illegible on a 10" tablet at arm's length
- Tiny checkboxes as the primary action — impossible to tap accurately with gloves
- Product name truncated to fit a narrow column
- Bin/location shown in a small secondary column — must be scanned visually
- No visual progress indicator per order (how many items remain?)
- Barcode scan input is a small text field in the toolbar — not obvious on mobile
- No tactile/audio feedback when an item is marked as picked
- No loading skeleton — page appears blank while orders load

This page is the most physically-used page in the warehouse every day. It should be optimised for that context first.

---

## Solution

Replace the table-based pick list with a **card-per-item layout** that is:
- Touch-optimised (minimum 48px tap targets)
- Glanceable (product name, bin location, and quantity in large text)
- Progressive (visual count of items picked vs. remaining)
- Audio-confirming (a short success beep when an item is marked picked — using the existing Web Audio API pattern)
- Skeleton-loading (never shows a blank page)

The barcode scanner stays but is promoted to the top of the page with a large input field.

---

## Implementation

### Step 1 — Skeleton loading state

The page currently shows nothing while `isLoadingOrders` is true. Add a skeleton:

```typescript
// client/src/pages/OrderPicking.tsx

if (isLoadingOrders) {
  return (
    <div className="p-4 space-y-4">
      <div className="h-12 bg-gray-200 rounded-lg animate-pulse" />
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
```

### Step 2 — Order selection screen

When no specific order is selected (route is `/order-picking`), show a list of pending orders as large cards instead of a table:

```typescript
// Order selection card (not table row)
function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border-2 border-gray-200
                 hover:border-blue-400 active:border-blue-600 active:bg-blue-50
                 p-4 transition-all touch-manipulation"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-bold text-gray-900">
          #{order.orderNumber}
        </span>
        <PriorityBadge priority={order.priority} />
      </div>
      <div className="text-sm text-gray-600">{order.customerName}</div>
      <div className="mt-3 flex items-center gap-4 text-sm">
        <span className="font-medium">{totalItems} items</span>
        <span className="text-gray-400">•</span>
        <span className="text-gray-500">
          {format(new Date(order.createdAt), "dd MMM, HH:mm")}
        </span>
      </div>
    </button>
  );
}
```

### Step 3 — Pick list: card-per-item layout

Replace `<Table>` entirely. Each line item becomes a large card:

```typescript
// client/src/components/picking/PickItemCard.tsx

interface PickItemCardProps {
  item: OrderItem;
  isPicked: boolean;
  onPick: () => void;
}

export function PickItemCard({ item, isPicked, onPick }: PickItemCardProps) {
  return (
    <div
      className={`
        rounded-xl border-2 p-4 transition-all duration-200
        ${isPicked
          ? "border-green-400 bg-green-50 opacity-70"
          : "border-gray-200 bg-white shadow-sm"
        }
      `}
    >
      {/* Top row: product name + quantity */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-base font-semibold leading-snug ${isPicked ? "line-through text-gray-400" : "text-gray-900"}`}>
            {item.productName}
          </p>
          {item.sku && (
            <p className="text-xs text-gray-400 mt-0.5">SKU: {item.sku}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="text-2xl font-bold text-gray-900">{item.quantity}</span>
          <span className="text-xs text-gray-400 block">pcs</span>
        </div>
      </div>

      {/* Bin location — prominent */}
      {item.location && (
        <div className="mt-3 flex items-center gap-2 bg-yellow-50 rounded-lg px-3 py-2">
          <MapPin className="w-4 h-4 text-yellow-600 shrink-0" />
          <span className="text-sm font-semibold text-yellow-800 tracking-wide">
            {item.location}
          </span>
        </div>
      )}

      {/* Pick button — full width, large tap target */}
      <button
        onClick={onPick}
        disabled={isPicked}
        className={`
          mt-3 w-full h-12 rounded-lg font-semibold text-sm transition-all
          touch-manipulation active:scale-95
          ${isPicked
            ? "bg-green-100 text-green-600 cursor-default"
            : "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
          }
        `}
      >
        {isPicked ? (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle className="w-5 h-5" /> Picked
          </span>
        ) : (
          "Mark as Picked"
        )}
      </button>
    </div>
  );
}
```

### Step 4 — Progress indicator

At the top of the active pick list, show a clear progress bar:

```typescript
function PickProgress({ total, picked }: { total: number; picked: number }) {
  const pct = total === 0 ? 0 : Math.round((picked / total) * 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">Progress</span>
        <span className="text-sm font-bold text-gray-900">{picked} / {total} items</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {picked === total && total > 0 && (
        <p className="mt-2 text-center text-sm font-semibold text-green-600">
          All items picked! ✓
        </p>
      )}
    </div>
  );
}
```

### Step 5 — Barcode scanner promotion

Move the barcode scan input to the top of the pick list page (not buried in a toolbar). Make it tall and obvious:

```typescript
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Scan barcode to find item
  </label>
  <div className="relative">
    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
    <input
      ref={barcodeInputRef}
      type="text"
      inputMode="none"     // prevent software keyboard — physical scanner only
      placeholder="Scan item barcode..."
      className="w-full h-12 pl-10 pr-4 rounded-xl border-2 border-gray-200
                 focus:border-blue-500 focus:outline-none text-base bg-white"
      onChange={handleBarcodeInput}
    />
  </div>
</div>
```

When a barcode is scanned and matches an item, scroll that item card into view and briefly highlight it:

```typescript
function highlightItem(itemId: number) {
  const el = document.getElementById(`pick-item-${itemId}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-blue-500");
    setTimeout(() => el.classList.remove("ring-2", "ring-blue-500"), 1500);
  }
}
```

### Step 6 — Audio feedback on pick

Use the existing Web Audio API pattern (already in `NotificationContext`) to play a short success beep when an item is marked picked:

```typescript
function playPickSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);       // A5
    osc.frequency.setValueAtTime(1174, ctx.currentTime + 0.1); // D6
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // ignore — AudioContext not available
  }
}
```

Call `playPickSound()` inside `onPick` after the API call succeeds.

### Step 7 — "Complete Order" button

After all items are picked, show a prominent CTA to finalize the order. This replaces the small "Mark as Picked" button that was buried in the toolbar:

```typescript
{allItemsPicked && (
  <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg z-10">
    <Button
      onClick={handleMarkOrderPicked}
      className="w-full h-14 text-base font-bold bg-green-600 hover:bg-green-700"
      disabled={isMarkingPicked}
    >
      {isMarkingPicked ? (
        <Loader2 className="animate-spin mr-2" />
      ) : (
        <CheckCircle className="mr-2" />
      )}
      Complete Order #{orderNumber}
    </Button>
  </div>
)}
```

Offset the bottom of the scrollable list by `pb-24` when this button is visible.

---

## Files to Modify / Create

| File | Change |
|---|---|
| `client/src/pages/OrderPicking.tsx` | Add skeleton, refactor order selection list, wire new components |
| `client/src/components/picking/PickItemCard.tsx` | **Create new** — card-per-item component |
| `client/src/components/picking/PickProgress.tsx` | **Create new** — progress bar component |

Keep `PickList` component if it is referenced from other pages. Otherwise it can be replaced entirely.

---

## What NOT to Change

- API calls, mutation logic, and barcode scanning logic are correct — only the rendering layer changes
- Role-based access control stays as-is (warehouse role can already access this page)
- The existing barcode scanner `ref` and `onChange` handler can be reused, just moved to a better-positioned input

---

## Verification

After implementation:

1. **Load test on mobile viewport (375px wide):** All item cards are fully readable. The "Mark as Picked" button is at least 48px tall and full-width.

2. **Barcode scan:** Focus the barcode input, type a product barcode. The matching item card scrolls into view and is highlighted for 1.5 seconds.

3. **Pick item:** Tap "Mark as Picked" on an item. The card turns green, shows "Picked ✓", the progress bar advances, and a short double-beep plays.

4. **Complete order:** Pick all items. A sticky green "Complete Order #XXX" button appears at the bottom. Tapping it fires the existing mark-as-picked mutation and navigates back to the order list.

5. **Loading state:** Refresh the page. For 200–500ms while orders load, skeleton cards appear instead of a blank page.

6. **No table elements:** `grep -n "<Table\|<TableRow\|<TableCell" client/src/pages/OrderPicking.tsx` — should return zero results.

---

## Definition of Done

- [ ] Page shows skeleton while loading (never blank)
- [ ] Order selection screen uses large cards, not a data table
- [ ] Pick list uses `PickItemCard` — card-per-item layout
- [ ] Bin location shown in yellow highlighted block within each card
- [ ] "Mark as Picked" button is full-width, minimum 48px height
- [ ] Progress bar visible at top of pick list showing X / Y items
- [ ] Barcode scanner input is prominent (top of page, large field)
- [ ] Audio feedback (double beep) on successful item pick
- [ ] "Complete Order" sticky button appears when all items are picked
- [ ] All layouts verified at 375px (mobile) and 768px (tablet) viewports
