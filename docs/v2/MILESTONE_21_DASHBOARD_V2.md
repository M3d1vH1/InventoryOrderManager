# MILESTONE 21 — Dashboard V2

**Step:** 21 of 25
**Priority:** P2
**Depends on:** Milestone 15 (Query Optimization), Milestone 06 (Database Schema)
**Estimated effort:** 1.5 days

---

## Problem

The Dashboard has four issues that make it less useful than it should be:

### Issue 1: Production stats are hardcoded mock data

`Production.tsx` passes a hardcoded `quickStats` object to its stat cards:
```typescript
// CURRENT — never changes, always wrong:
const quickStats = {
  materials: { total: 25, lowStock: 3, outOfStock: 1 },
  recipes: { total: 12, active: 8 },
  batches: { total: 45, thisMonth: 8, completed: 37 },
  orders: { total: 28, pending: 5, inProgress: 3, completed: 20 },
};
```

These are placeholder numbers from development. Every installation shows the same fake stats.

### Issue 2: Recent Orders pagination is permanently disabled

In `RecentOrders.tsx`, Previous / Next buttons render but both have `disabled` hardcoded to `true`. This is an incomplete feature that was shipped to production. Users see buttons that do nothing.

### Issue 3: No financial visibility on the Dashboard

The Dashboard QuickStats row covers operations (orders pending, items to pick, shipped today, low stock, calls, errors) but shows nothing about money:
- No outstanding supplier invoices
- No overdue payments
- No total revenue this week/month

Finance staff have no at-a-glance summary anywhere.

### Issue 4: Inventory Predictions exist but are invisible from the Dashboard

There is a full `/inventory-predictions` page with demand forecasting and reorder recommendations. Nothing on the Dashboard links to it or shows whether items need reordering. The insight is buried behind a sidebar link.

---

## Solution

Four targeted changes to `Dashboard.tsx` and its sub-components:

1. **Fix Production stats** — fetch from the existing production API endpoints instead of hardcoding
2. **Fix Recent Orders pagination** — wire up the Previous/Next buttons with `useState` for offset
3. **Add Financial Summary row** — a second stats row with supplier payment data
4. **Add Reorder Alerts widget** — a compact section below Inventory Alerts showing items flagged for reorder

---

## Implementation

### Change 1 — Fix Production stats

The Production API already exists. Replace the hardcoded object with API calls.

**New API endpoint needed (if not existing):** `GET /api/production/stats`
```json
{
  "success": true,
  "data": {
    "materials": { "total": 25, "lowStock": 3, "outOfStock": 1 },
    "recipes": { "total": 12, "active": 8 },
    "batches": { "thisMonth": 8, "completed": 37 },
    "orders": { "pending": 5, "inProgress": 3, "completedThisMonth": 20 }
  }
}
```

If the endpoint doesn't exist, add it to the production routes module (from Milestone 08 routes split).

**In `Production.tsx`:**
```typescript
// REMOVE hardcoded quickStats
// ADD:
const { data: quickStats, isLoading: isLoadingStats } = useQuery({
  queryKey: ["/api/production/stats"],
  queryFn: () => fetch("/api/production/stats").then(r => r.json()).then(r => r.data),
  staleTime: 60_000, // refresh every minute
});

// In JSX — show skeleton while loading:
{isLoadingStats ? (
  <div className="grid grid-cols-4 gap-4">
    {[1,2,3,4].map(i => (
      <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
    ))}
  </div>
) : (
  <ProductionQuickStats stats={quickStats} />
)}
```

### Change 2 — Wire Recent Orders pagination

`RecentOrders.tsx` currently has:
```typescript
// BROKEN — permanently disabled:
<Button disabled>Previous</Button>
<Button disabled>Next</Button>
```

Replace with controlled pagination:

```typescript
// client/src/components/dashboard/RecentOrders.tsx

const PAGE_SIZE = 10;
const [page, setPage] = useState(0);

const { data, isLoading } = useQuery({
  queryKey: ["/api/orders/recent", page],
  queryFn: () =>
    fetch(`/api/orders/recent?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`)
      .then(r => r.json()),
});

const orders = data?.data ?? [];
const total = data?.pagination?.total ?? 0;
const totalPages = Math.ceil(total / PAGE_SIZE);

// In JSX:
<div className="flex items-center justify-between pt-3 border-t">
  <span className="text-xs text-gray-500">
    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
  </span>
  <div className="flex gap-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => setPage(p => p - 1)}
      disabled={page === 0}
    >
      Previous
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setPage(p => p + 1)}
      disabled={page >= totalPages - 1}
    >
      Next
    </Button>
  </div>
</div>
```

**API change:** Ensure `GET /api/orders/recent` accepts `?limit=N&offset=N` and returns a `pagination` object. This should already work after Milestone 15 (Query Optimization) adds SQL-level pagination.

### Change 3 — Financial Summary row

Add a second QuickStats row between the first stats row and the Recent Orders / Inventory Alerts section. This row shows supplier payment data.

**New API endpoint:** `GET /api/supplier-payments/summary` (may already exist for the SupplierPayments dashboard tab — reuse it)

Expected shape:
```json
{
  "success": true,
  "data": {
    "outstandingTotal": 4200.00,
    "overdueTotal": 1100.00,
    "dueSoon": 850.00,
    "dueSoonCount": 3,
    "paidThisMonth": 9400.00
  }
}
```

**New component: `FinancialSummaryRow.tsx`**
```typescript
// client/src/components/dashboard/FinancialSummaryRow.tsx

export function FinancialSummaryRow() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/supplier-payments/summary"],
    queryFn: () => fetch("/api/supplier-payments/summary").then(r => r.json()).then(r => r.data),
    staleTime: 120_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <FinanceStat
        label="Outstanding"
        value={formatCurrency(data?.outstandingTotal ?? 0)}
        icon={<CreditCard className="w-5 h-5 text-blue-500" />}
        href="/supplier-payments"
      />
      <FinanceStat
        label="Overdue"
        value={formatCurrency(data?.overdueTotal ?? 0)}
        icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
        valueClass={data?.overdueTotal > 0 ? "text-red-600" : "text-gray-900"}
        href="/supplier-payments?filter=overdue"
      />
      <FinanceStat
        label="Due in 7 days"
        value={formatCurrency(data?.dueSoon ?? 0)}
        subtext={data?.dueSoonCount ? `${data.dueSoonCount} invoices` : undefined}
        icon={<Clock className="w-5 h-5 text-amber-500" />}
        href="/supplier-payments?filter=due-soon"
      />
      <FinanceStat
        label="Paid this month"
        value={formatCurrency(data?.paidThisMonth ?? 0)}
        icon={<CheckCircle className="w-5 h-5 text-green-500" />}
        href="/supplier-payments?filter=paid"
      />
    </div>
  );
}

function FinanceStat({
  label, value, subtext, icon, href, valueClass = "text-gray-900"
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  href: string;
  valueClass?: string;
}) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(href)}
      className="bg-white rounded-xl border border-gray-200 p-4 text-left
                 hover:border-gray-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      {subtext && <p className="text-xs text-gray-400 mt-0.5">{subtext}</p>}
    </button>
  );
}
```

**Only show this row to `admin` and `front_office` roles.** Warehouse role does not see financial data.

### Change 4 — Reorder Alerts widget

Add a compact widget below `InventoryAlerts` that shows items flagged for reorder by the predictions engine. This creates a visible entry point to the Inventory Predictions page.

**Uses existing endpoint:** `GET /api/inventory-predictions/alerts` or similar — check what the Inventory Predictions page fetches and reuse the same query key.

```typescript
// client/src/components/dashboard/ReorderAlerts.tsx

export function ReorderAlerts() {
  const { data: alerts } = useQuery({
    queryKey: ["/api/inventory-predictions/reorder-alerts"],
    queryFn: () => fetch("/api/inventory-predictions/reorder-alerts?limit=5")
      .then(r => r.json()).then(r => r.data ?? []),
    staleTime: 300_000, // 5 minutes
  });

  if (!alerts?.length) return null; // hide widget if nothing needs reordering

  return (
    <div className="bg-white rounded-xl border border-amber-200 mt-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-800">Reorder Needed</h3>
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        </div>
        <Link href="/inventory-predictions" className="text-xs text-blue-600 hover:underline">
          View all →
        </Link>
      </div>
      <ul className="divide-y divide-gray-50">
        {alerts.slice(0, 5).map(alert => (
          <li key={alert.productId} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-gray-800 truncate">{alert.productName}</span>
            <span className="text-xs text-amber-600 font-medium ml-2 shrink-0">
              {alert.currentStock} left
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Place `<ReorderAlerts />` inside the same column as `<InventoryAlerts />`.

---

## Files to Modify / Create

| File | Change |
|---|---|
| `client/src/pages/Dashboard.tsx` | Add `FinancialSummaryRow`, `ReorderAlerts`; role-gate financial row |
| `client/src/pages/Production.tsx` | Replace hardcoded `quickStats` with API fetch |
| `client/src/components/dashboard/RecentOrders.tsx` | Wire Previous/Next pagination |
| `client/src/components/dashboard/FinancialSummaryRow.tsx` | **Create new** |
| `client/src/components/dashboard/ReorderAlerts.tsx` | **Create new** |
| `server/routes/production.ts` | Add `GET /api/production/stats` if missing |

---

## Verification

1. **Production stats:** Log in, navigate to `/production`. The stats at the top should reflect actual database counts, not always show `25 materials / 12 recipes`.

2. **Pagination:** On the Dashboard, the Recent Orders widget shows 10 rows. Clicking "Next" loads the next 10. The button is disabled on the last page.

3. **Financial row:** Log in as `admin`. The Dashboard shows a second row of stats with Outstanding, Overdue, Due in 7 days, Paid this month — all from real DB data.

4. **Financial row hidden for warehouse:** Log in as `warehouse` role. The financial stats row does not appear.

5. **Reorder alerts:** Set a product's stock below its predicted reorder point via the Inventory page. Reload the Dashboard — the Reorder Needed widget appears with that product listed.

---

## Definition of Done

- [ ] Production page stats are fetched from `/api/production/stats`, not hardcoded
- [ ] Recent Orders Previous/Next buttons function and paginate correctly
- [ ] Financial Summary row visible to admin/front_office on Dashboard
- [ ] Financial Summary row hidden from warehouse role
- [ ] Reorder Alerts widget appears when items need reordering, hidden otherwise
- [ ] All widgets show skeleton/spinner while loading
- [ ] Clicking any financial stat card navigates to the relevant filtered view in Supplier Payments
