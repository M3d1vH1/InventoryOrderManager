# MILESTONE 19 — Sidebar Navigation Fix

**Step:** 19 of 25
**Priority:** P1
**Depends on:** Milestone 12 (Frontend Cleanup)
**Estimated effort:** 1 day

---

## Problem

The sidebar has two critical bugs that cause broken navigation and uncontrolled React state:

### Bug 1: `window.location.href` causes full page reloads

In collapsed/icon-only sidebar mode, clicking a parent nav item (Orders, Inventory, Sales) navigates using `window.location.href` — a full browser navigation. This:
- Reloads the entire React app
- Loses all TanStack Query cache
- Loses any query params (e.g. `?status=pending` on the orders list)
- Bypasses Wouter's router entirely

**Affected lines in `Sidebar.tsx`:** ~122, 209, 304, 362, 439

### Bug 2: Submenu open/close is raw DOM mutation

Submenu expand/collapse is handled by `getElementById + classList.toggle` — imperative DOM manipulation inside React. This means:
- Submenu open state is invisible to React
- The active submenu can show as closed even when the user is on one of its child pages
- No way to control submenus programmatically (e.g. auto-expand based on route)

**Affected lines in `Sidebar.tsx`:** ~117–120, 202–205, 298–301, and similar blocks

### Bug 3: Collapsed sidebar has no flyout — child pages are unreachable

When the sidebar is in icon-only mode, there is no flyout submenu on hover or click. Users have no path to:
- Unshipped Items
- Order Quality
- Inventory Predictions
- Customers
- Call Logs

...without first expanding the sidebar. On small screens where sidebar is always collapsed, these pages are effectively hidden.

### Bug 4: No keyboard navigation

There is no `aria-expanded`, `aria-controls`, keyboard handling (`Enter`/`Space` to open submenu), or focus management on the submenu toggles.

---

## Solution

Refactor `Sidebar.tsx` to:
1. Replace all `window.location.href` calls with Wouter's `navigate()`
2. Replace DOM mutation with `useState` per submenu group
3. Auto-expand the submenu that contains the currently active route on mount
4. Add a flyout popover for collapsed mode (icon-only) — appears on hover, contains the child links
5. Add basic ARIA attributes for accessibility

---

## Implementation

### Step 1 — Add controlled submenu state

Replace the current DOM-toggle pattern with React state. One boolean per collapsible group.

```typescript
// client/src/components/layout/Sidebar.tsx

import { useState, useEffect } from "react";
import { useLocation, useRoute, Link } from "wouter";

// Determine which submenu should be open based on current route
function getDefaultOpenGroups(pathname: string): Record<string, boolean> {
  return {
    orders: ["/orders", "/unshipped-items", "/order-picking", "/order-quality", "/order-errors"].some(p => pathname.startsWith(p)),
    inventory: ["/inventory"].some(p => pathname.startsWith(p)),
    sales: ["/customers", "/call-logs"].some(p => pathname.startsWith(p)),
  };
}

export function Sidebar() {
  const [location] = useLocation();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => getDefaultOpenGroups(location)
  );

  // Auto-expand the correct group when route changes (e.g. browser back)
  useEffect(() => {
    setOpenGroups(prev => ({
      ...prev,
      ...getDefaultOpenGroups(location),
    }));
  }, [location]);

  function toggleGroup(key: string) {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // ...rest of component
}
```

### Step 2 — Replace all `window.location.href` with `navigate`

Search for every occurrence of `window.location.href` in `Sidebar.tsx` and replace with `navigate(path)`.

```typescript
// BEFORE (broken):
onClick={() => { window.location.href = "/orders"; }}

// AFTER (correct):
import { useLocation } from "wouter";
const [, navigate] = useLocation();
// ...
onClick={() => navigate("/orders")}
```

### Step 3 — Replace DOM toggle with controlled rendering

```typescript
// BEFORE (broken):
<button onClick={() => {
  const el = document.getElementById("orders-submenu");
  el?.classList.toggle("hidden");
}}>
  Orders
</button>
<div id="orders-submenu" className="hidden">
  {/* child links */}
</div>

// AFTER (correct):
<button
  onClick={() => toggleGroup("orders")}
  aria-expanded={openGroups.orders}
  aria-controls="orders-submenu"
>
  <FaShoppingCart />
  {!isCollapsed && <span>Orders</span>}
  {!isCollapsed && (
    <ChevronDown
      className={`ml-auto transition-transform ${openGroups.orders ? "rotate-180" : ""}`}
    />
  )}
</button>

{openGroups.orders && !isCollapsed && (
  <div id="orders-submenu" role="group">
    <Link href="/orders">Order Management</Link>
    <Link href="/unshipped-items">Unshipped Items</Link>
    <Link href="/order-picking">Order Picking</Link>
    {(role === "admin" || role === "front_office") && (
      <Link href="/order-quality">Order Quality</Link>
    )}
  </div>
)}
```

### Step 4 — Add flyout menu for collapsed (icon-only) mode

When the sidebar is collapsed, hovering a parent item with children should show a flyout panel with the child links. Use a `Popover` from shadcn/ui or a custom absolutely-positioned panel.

```typescript
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

// For items WITH children in collapsed mode:
{isCollapsed ? (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="nav-icon-button">
          <FaShoppingCart />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="p-0 w-48">
        {/* Flyout panel */}
        <div className="bg-slate-800 rounded-md py-2 shadow-lg">
          <p className="px-3 py-1 text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Orders
          </p>
          <Link href="/orders" className="flyout-link">Order Management</Link>
          <Link href="/unshipped-items" className="flyout-link">Unshipped Items</Link>
          <Link href="/order-picking" className="flyout-link">Order Picking</Link>
          {(role === "admin" || role === "front_office") && (
            <Link href="/order-quality" className="flyout-link">Order Quality</Link>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
) : (
  // normal expanded mode button
)}
```

**Flyout link style (`flyout-link`):**
```css
/* Add to sidebar styles or tailwind class string: */
.flyout-link {
  @apply block px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors;
}
```

### Step 5 — Apply to all three collapsible groups

Repeat the pattern from Steps 3–4 for:
- **Orders** → children: Order Management, Unshipped Items, Order Picking, Order Quality
- **Inventory** → children: Inventory, Inventory Predictions
- **Sales** → children: Customers, Call Logs

### Step 6 — Fix Calendar orphan in sidebar

Move the Calendar link inside a logical group. Options:
- Add it to the top of the Orders group (it shows scheduled shipping dates and follow-ups)
- Or create a standalone "Schedule" section with just Calendar

**Recommended:** Add Calendar as the first child under Orders:
```typescript
// In the Orders submenu group:
<Link href="/calendar">Calendar</Link>
<Link href="/orders">Order Management</Link>
// ...
```

### Step 7 — Clean up ARIA

Add to all submenu toggle buttons:
```typescript
aria-expanded={openGroups.orders}
aria-controls="sidebar-orders-group"
role="button"
```

Add to all submenu containers:
```typescript
id="sidebar-orders-group"
role="group"
aria-label="Orders navigation"
```

---

## Files to Modify

| File | Change |
|---|---|
| `client/src/components/layout/Sidebar.tsx` | Full refactor as described |

No other files need to change. The fix is entirely contained in the Sidebar component.

---

## Verification

After implementation:

1. **Full sidebar mode:** Click Orders toggle → submenu opens/closes without page reload. Navigate to `/order-picking` → Orders submenu is automatically expanded. Click "Unshipped Items" → URL changes without page reload.

2. **Collapsed sidebar mode:** Hover Orders icon → flyout appears with all child links. Click "Order Quality" in flyout → navigates correctly.

3. **Browser back:** Open order detail, press back → you return to the orders list with the sidebar Orders group still expanded.

4. **Role gating:** Log in as `warehouse` role → "Order Quality" does not appear in the sidebar (in either expanded or collapsed mode).

5. **No `window.location.href`:** Run `grep -n "window.location.href" client/src/components/layout/Sidebar.tsx` — should return zero results.

6. **No `getElementById`:** Run `grep -n "getElementById" client/src/components/layout/Sidebar.tsx` — should return zero results.

---

## Definition of Done

- [ ] All `window.location.href` calls replaced with `navigate()`
- [ ] All `getElementById + classList.toggle` replaced with `useState`
- [ ] Active route auto-expands its parent submenu on page load and on route change
- [ ] Collapsed sidebar shows flyout submenu on hover for Orders, Inventory, and Sales groups
- [ ] Calendar link moved into a logical group (Orders or a new Schedule section)
- [ ] Basic ARIA attributes present on all toggles and groups
- [ ] Zero grep matches for `window.location.href` or `getElementById` in Sidebar.tsx
