# MILESTONE 23 — Table Improvements

**Step:** 23 of 25
**Priority:** P2
**Depends on:** Milestone 15 (Query Optimization — SQL-level pagination)
**Estimated effort:** 2 days

---

## Problem

Several data tables across the app have usability gaps that become severe at scale:

| Table | Issues |
|---|---|
| Customers | No sort, no pagination, fetches all rows, search is client-side only |
| Products | No pagination, fetches all rows (renders everything) |
| Reports | Time range filter does not apply to all charts on the page |
| All tables | Empty states are plain text — no "Clear filters" button, no CTA |
| Slow-Moving Items | Empty state not clearly handled |

These are acceptable issues with 50 rows. With 500+ customers or 1,000+ products they become dealbreakers.

---

## Solution

Five targeted changes:

1. **Customers table** — add server-side pagination, column sort, and a "Export CSV" quick action
2. **Products table** — add server-side pagination with configurable page size
3. **Reports page** — make the time range filter apply to all charts uniformly
4. **All tables** — add a standardised empty state component with contextual CTAs
5. **Remove debug/test routes** from the router (found during review: `/calendar-test`, `/printer-test`, `/settings/logging-test`, `/product-barcode/:id`)

---

## Implementation

### Change 1 — Customers table: pagination + sort

**API changes (already done in Milestone 15):**

`GET /api/customers` should accept:
```
?limit=25&offset=0&sortBy=name&sortDir=asc&search=acme
```
And return:
```json
{
  "success": true,
  "data": [...],
  "pagination": { "total": 142, "limit": 25, "offset": 0 }
}
```

**Frontend — `Customers.tsx`:**

```typescript
// State
const [page, setPage] = useState(0);
const [pageSize] = useState(25);
const [sortBy, setSortBy] = useState<"name" | "city" | "createdAt">("name");
const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
const [search, setSearch] = useState("");
const debouncedSearch = useDebounce(search, 300);

// Query — server-side, not client-side filter
const { data, isLoading } = useQuery({
  queryKey: ["/api/customers", page, pageSize, sortBy, sortDir, debouncedSearch],
  queryFn: () =>
    fetch(`/api/customers?limit=${pageSize}&offset=${page * pageSize}&sortBy=${sortBy}&sortDir=${sortDir}&search=${debouncedSearch}`)
      .then(r => r.json()),
  placeholderData: keepPreviousData, // don't flash blank on page change
});

const customers = data?.data ?? [];
const total = data?.pagination?.total ?? 0;
```

**Sortable column headers:**

```typescript
function SortableHeader({
  label,
  column,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  column: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  onSort: (col: string) => void;
}) {
  const isActive = currentSort === column;
  return (
    <button
      onClick={() => onSort(column)}
      className="flex items-center gap-1 font-semibold text-gray-700 hover:text-gray-900"
    >
      {label}
      {isActive ? (
        currentDir === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
      ) : (
        <ChevronsUpDown className="w-3.5 h-3.5 text-gray-300" />
      )}
    </button>
  );
}

// Sort toggle handler:
function handleSort(column: string) {
  if (sortBy === column) {
    setSortDir(d => d === "asc" ? "desc" : "asc");
  } else {
    setSortBy(column as any);
    setSortDir("asc");
  }
  setPage(0); // reset to first page on sort change
}
```

**Pagination controls (reusable component):**

```typescript
// client/src/components/ui/TablePagination.tsx

export function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, total);

  return (
    <div className="flex items-center justify-between px-2 py-3 border-t border-gray-100">
      <span className="text-sm text-gray-500">
        {start}–{end} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline" size="icon"
          onClick={() => onPageChange(0)}
          disabled={page === 0}
          title="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline" size="icon"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 0}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm px-2 text-gray-600">
          {page + 1} / {totalPages}
        </span>
        <Button
          variant="outline" size="icon"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages - 1}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="outline" size="icon"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={page >= totalPages - 1}
          title="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
```

Use this `TablePagination` component in Customers, Products, and any other table that gains pagination.

### Change 2 — Products table: pagination

Same pattern as Customers. The Products table currently renders all products.

```typescript
// ProductsShopify.tsx
const [page, setPage] = useState(0);
const PAGE_SIZE = 50; // products are browsed more than customers

const { data } = useQuery({
  queryKey: ["/api/products", page, PAGE_SIZE, search, stockFilter, tagFilter],
  queryFn: () =>
    fetch(`/api/products?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}&search=${search}&stock=${stockFilter}&tag=${tagFilter}`)
      .then(r => r.json()),
  placeholderData: keepPreviousData,
});
```

Add `<TablePagination>` at the bottom of the products table/grid.

**Reset page to 0 whenever filters change:**
```typescript
useEffect(() => { setPage(0); }, [search, stockFilter, tagFilter]);
```

### Change 3 — Reports: consistent time range

The `timeRange` state in `Reports.tsx` currently only affects `inventoryTrend` and `ordersTrend` queries. The top-selling products and category breakdown charts always fetch all-time data.

**Fix:** Pass `timeRange` to every query on the page.

```typescript
// Reports.tsx

// BEFORE (broken — some queries ignore timeRange):
const { data: topProducts } = useQuery({
  queryKey: ["/api/reports/top-products"],  // no timeRange
  ...
});

// AFTER (consistent):
const { data: topProducts } = useQuery({
  queryKey: ["/api/reports/top-products", timeRange],
  queryFn: () =>
    fetch(`/api/reports/top-products?range=${timeRange}`).then(r => r.json()),
});
```

Apply the same change to:
- `GET /api/reports/category-breakdown`
- `GET /api/reports/quality-metrics`
- `GET /api/reports/call-log-summary`

Also add a visual label near the time range selector to communicate that it applies to all charts:
```typescript
<div className="flex items-center gap-3">
  <span className="text-sm text-gray-500">All charts showing:</span>
  <Select value={timeRange} onValueChange={setTimeRange}>
    {/* options */}
  </Select>
</div>
```

### Change 4 — Standardised empty state component

Create one reusable empty state that all tables use. It should adapt based on whether the empty is caused by filters (show "Clear filters") or by having no data yet (show "Create first record").

```typescript
// client/src/components/ui/EmptyState.tsx

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-xs">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex gap-3 mt-4">
          {secondaryAction && (
            <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {action && (
            <Button size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Usage examples:**

```typescript
// Customers table — search returns nothing:
{customers.length === 0 && search && (
  <EmptyState
    icon={<Search className="w-5 h-5" />}
    title="No customers found"
    description={`No results for "${search}"`}
    secondaryAction={{ label: "Clear search", onClick: () => setSearch("") }}
  />
)}

// Customers table — no customers at all:
{customers.length === 0 && !search && (
  <EmptyState
    icon={<Users className="w-5 h-5" />}
    title="No customers yet"
    description="Add your first customer to start managing orders."
    action={{ label: "Add Customer", onClick: () => setShowAddDialog(true) }}
  />
)}

// Orders table — filtered view returns nothing:
{orders.length === 0 && statusFilter && (
  <EmptyState
    icon={<Package className="w-5 h-5" />}
    title={`No ${statusFilter} orders`}
    secondaryAction={{ label: "Show all orders", onClick: () => setStatusFilter("") }}
    action={{ label: "New Order", onClick: () => navigate("/orders/new") }}
  />
)}
```

Replace all existing `{!items.length && <div>No items found</div>}` patterns across:
- `Customers.tsx`
- `ProductsShopify.tsx`
- `Orders.tsx`
- `CallLogs.tsx`
- `SlowMovingItems.tsx`
- `Inventory.tsx`

### Change 5 — Remove debug/test routes

In the main router, remove these routes that are accessible to all authenticated users:

```typescript
// client/src/App.tsx — REMOVE these routes:
<Route path="/calendar-test" component={...} />
<Route path="/printer-test" component={...} />
<Route path="/settings/logging-test" component={...} />
<Route path="/product-barcode/:id" component={...} />
```

If any of these pages are still needed for internal dev/QA use, gate them:
```typescript
// Only show in development mode:
{import.meta.env.DEV && (
  <>
    <Route path="/calendar-test" component={...} />
    <Route path="/printer-test" component={...} />
  </>
)}
```

---

## Files to Modify / Create

| File | Change |
|---|---|
| `client/src/pages/Customers.tsx` | Server-side pagination, sortable headers, server-side search |
| `client/src/pages/ProductsShopify.tsx` | Server-side pagination |
| `client/src/pages/Reports.tsx` | Apply `timeRange` to all chart queries |
| `client/src/components/ui/TablePagination.tsx` | **Create new** — reusable pagination controls |
| `client/src/components/ui/EmptyState.tsx` | **Create new** — reusable empty state component |
| `client/src/App.tsx` | Remove debug routes (or gate behind `import.meta.env.DEV`) |
| Multiple table components | Replace inline empty text with `<EmptyState>` |
| `server/routes/customers.ts` | Ensure sort + pagination params are accepted |
| `server/routes/products.ts` | Ensure pagination params are accepted |
| `server/routes/reports.ts` | Ensure all report endpoints accept `?range=` param |

---

## Verification

1. **Customers pagination:** With 60+ customers, the table shows 25 rows. Clicking Next loads rows 26–50. Clicking column header "Name" sorts alphabetically. Clicking again reverses.

2. **Customers search:** Type "acme" in the search box. The browser does NOT filter locally — a new request fires with `?search=acme`. The total row count updates.

3. **Products pagination:** Products table shows 50 rows maximum. `<TablePagination>` appears at the bottom.

4. **Reports time range:** Change the time range selector from "30 days" to "7 days". All charts on the page update — including Top Products and Category Breakdown.

5. **Empty states:** Apply a filter that returns no results on the Customers page. An icon, title, and "Clear search" button appear — not a plain text string.

6. **No debug routes:** Navigate to `/calendar-test` in production. Should get a 404 (or redirect to `/`).

7. **Reports label:** Time range selector has visible text indicating it applies to all charts.

---

## Definition of Done

- [ ] Customers table: server-side pagination (25/page), sortable Name/City/Created columns
- [ ] Products table: server-side pagination (50/page)
- [ ] Reports: time range filter applied to all chart queries (inventoryTrend, ordersTrend, topProducts, categoryBreakdown, qualityMetrics, callLogSummary)
- [ ] `TablePagination` reusable component created and used in Customers and Products
- [ ] `EmptyState` reusable component created
- [ ] `EmptyState` replaces plain-text empty messages in Customers, Products, Orders, CallLogs, Inventory, SlowMovingItems
- [ ] Debug routes removed from production routing or gated behind `import.meta.env.DEV`
