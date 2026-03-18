# MILESTONE 25 — Notification Persistence & Financial Alerts

**Step:** 25 of 25
**Priority:** P3
**Depends on:** Milestone 13 (Auth Hardening), Milestone 06 (Database Schema)
**Estimated effort:** 1.5 days

---

## Problem

### Issue 1: Notifications are wiped on every page refresh

`NotificationContext` stores the notification list in React state only:
```typescript
const [notifications, setNotifications] = useState<Notification[]>([]);
```

Every page reload resets this to an empty array. Consequences:
- A low-stock alert fires while the user is on another tab → they come back and refresh → alert is gone, they never see it
- Overdue supplier payment warning disappears on refresh
- The notification bell count resets to 0 on every page load — users never accumulate unread alerts between sessions

### Issue 2: No financial alerts

The notification system only surfaces operational events (order status changes, scan results). There are no alerts for:
- A supplier invoice is overdue (past due date, still unpaid)
- A supplier invoice is due in 3 days
- A supplier payment was just recorded

The Finance/Admin user has no proactive visibility into payment obligations unless they actively visit the Supplier Payments page.

### Issue 3: `console.log('Payment summary data:', paymentSummary)` in production

`SupplierPayments.tsx` line 26 logs the entire payment summary object to the browser console. This should be removed.

---

## Solution

1. **Persist notifications to localStorage** — notifications survive page refresh for the current browser session
2. **Add server-side notification endpoint** — `GET /api/notifications` returns recent system events for the logged-in user; the frontend syncs on load
3. **Add financial alert polling** — check for overdue/due-soon invoices every 5 minutes and inject into the notification context
4. **Remove the console.log** from SupplierPayments.tsx

---

## Implementation

### Change 1 — Persist notifications to localStorage

The `NotificationContext` manages notifications in memory. Add a `useLocalStorage` sync layer so the list persists across refreshes.

```typescript
// client/src/contexts/NotificationContext.tsx

const STORAGE_KEY = "wms_notifications_v1";
const MAX_STORED = 50; // keep last 50 notifications

// Load initial state from localStorage:
const [notifications, setNotifications] = useState<AppNotification[]>(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
});

// Persist to localStorage whenever notifications change:
useEffect(() => {
  try {
    // Only keep the last MAX_STORED, and only persist non-transient ones
    const toStore = notifications.slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // ignore — quota exceeded or private browsing
  }
}, [notifications]);
```

**Important:** Don't persist `type: "scan"` (barcode scan results) or other transient events. Add a `persistent: boolean` field to the `AppNotification` type:

```typescript
interface AppNotification {
  id: string;
  type: "info" | "success" | "warning" | "error" | "scan";
  title: string;
  message?: string;
  timestamp: string;
  read: boolean;
  href?: string;        // optional link for click-through
  persistent: boolean;  // NEW — if false, not stored in localStorage
}
```

Only store `persistent: true` notifications.

**Add "Clear all" to notification dropdown:**

```typescript
function clearAllNotifications() {
  setNotifications([]);
  localStorage.removeItem(STORAGE_KEY);
}
```

### Change 2 — Server-side notification endpoint

Add a lightweight notifications table to the database schema and API.

**Schema (add to `migrations/`):**

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
  title         TEXT NOT NULL,
  message       TEXT,
  href          TEXT,
  read          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read)
  WHERE read = false;

-- Auto-cleanup: keep only last 200 notifications per user
CREATE OR REPLACE FUNCTION cleanup_old_notifications() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM notifications
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM notifications
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 200
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cleanup_notifications
AFTER INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION cleanup_old_notifications();
```

**API endpoints:**

```typescript
// GET /api/notifications — returns recent notifications for the logged-in user
router.get("/api/notifications", isAuthenticated, async (req, res) => {
  const userId = req.user!.id;
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json({ success: true, data: notifications });
});

// POST /api/notifications/:id/read — mark one as read
router.post("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(
      eq(notificationsTable.id, Number(req.params.id)),
      eq(notificationsTable.userId, req.user!.id),
    ));
  res.json({ success: true });
});

// POST /api/notifications/read-all — mark all as read
router.post("/api/notifications/read-all", isAuthenticated, async (req, res) => {
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, req.user!.id));
  res.json({ success: true });
});
```

**Frontend sync on load:**

```typescript
// In NotificationContext — fetch server notifications on mount and merge with localStorage:
const { data: serverNotifications } = useQuery({
  queryKey: ["/api/notifications"],
  queryFn: () => fetch("/api/notifications").then(r => r.json()).then(r => r.data ?? []),
  staleTime: 60_000,
});

useEffect(() => {
  if (!serverNotifications) return;
  setNotifications(prev => {
    const existingIds = new Set(prev.map(n => n.id));
    const newOnes = serverNotifications
      .filter(n => !existingIds.has(String(n.id)))
      .map(n => ({
        ...n,
        id: String(n.id),
        persistent: true,
      }));
    return [...newOnes, ...prev].slice(0, MAX_STORED);
  });
}, [serverNotifications]);
```

### Change 3 — Financial alert polling

Add a background polling query in the App root (or in `NotificationContext`) that checks for overdue/due-soon invoices every 5 minutes and creates in-app notifications.

```typescript
// client/src/contexts/NotificationContext.tsx

// Poll for financial alerts — admin and front_office roles only
const { data: paymentAlerts } = useQuery({
  queryKey: ["/api/supplier-payments/alerts"],
  queryFn: () =>
    fetch("/api/supplier-payments/alerts").then(r => r.json()).then(r => r.data),
  refetchInterval: 5 * 60 * 1000, // every 5 minutes
  enabled: role === "admin" || role === "front_office",
});

useEffect(() => {
  if (!paymentAlerts) return;

  paymentAlerts.overdueInvoices?.forEach(invoice => {
    const id = `invoice-overdue-${invoice.id}`;
    if (!notifications.find(n => n.id === id)) {
      addNotification({
        id,
        type: "error",
        title: "Invoice Overdue",
        message: `Invoice ${invoice.invoiceNumber} from ${invoice.supplierName} — €${invoice.amount} due ${formatDate(invoice.dueDate)}`,
        href: "/supplier-payments?filter=overdue",
        persistent: true,
      });
    }
  });

  paymentAlerts.dueSoonInvoices?.forEach(invoice => {
    const id = `invoice-due-soon-${invoice.id}`;
    if (!notifications.find(n => n.id === id)) {
      addNotification({
        id,
        type: "warning",
        title: "Payment Due Soon",
        message: `Invoice ${invoice.invoiceNumber} from ${invoice.supplierName} — €${invoice.amount} due ${formatDate(invoice.dueDate)}`,
        href: "/supplier-payments",
        persistent: true,
      });
    }
  });
}, [paymentAlerts]);
```

**New API endpoint: `GET /api/supplier-payments/alerts`**

```typescript
// Returns invoices that are overdue or due within 3 days
router.get("/api/supplier-payments/alerts", isAuthenticated, async (req, res) => {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [overdueInvoices, dueSoonInvoices] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        supplierName: suppliers.name,
        amount: invoices.amount,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .leftJoin(suppliers, eq(invoices.supplierId, suppliers.id))
      .where(and(
        eq(invoices.status, "pending"),
        lt(invoices.dueDate, now),
      )),

    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        supplierName: suppliers.name,
        amount: invoices.amount,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .leftJoin(suppliers, eq(invoices.supplierId, suppliers.id))
      .where(and(
        eq(invoices.status, "pending"),
        gte(invoices.dueDate, now),
        lte(invoices.dueDate, threeDaysFromNow),
      )),
  ]);

  res.json({ success: true, data: { overdueInvoices, dueSoonInvoices } });
});
```

### Change 4 — Remove console.log from SupplierPayments.tsx

```typescript
// SupplierPayments.tsx line ~26 — REMOVE:
console.log('Payment summary data:', paymentSummary);
```

Run `grep -rn "console.log" client/src/` after this change and remove any other stray logs found in the process.

---

## Files to Modify / Create

| File | Change |
|---|---|
| `client/src/contexts/NotificationContext.tsx` | Add localStorage persistence, server sync on load, financial alert polling |
| `client/src/pages/SupplierPayments.tsx` | Remove `console.log` on line ~26 |
| `server/routes/notifications.ts` | **Create new** — GET list, POST read, POST read-all |
| `server/routes/supplierPayments.ts` | Add GET `/alerts` endpoint |
| `shared/schema.ts` | Add `notifications` table definition |
| `migrations/` | Add migration for notifications table + cleanup trigger |

---

## Verification

1. **localStorage persistence:** Open the app, trigger a low-stock alert (or manually call `addNotification`). Refresh the page. The notification bell still shows the unread count. The notification is visible in the dropdown.

2. **Server sync:** Log in on a different browser/device. The notification bell loads recent notifications from the server on first load (if any exist).

3. **Financial alerts:** Create a supplier invoice with a due date in the past with status "pending". Wait up to 5 minutes (or force a refetch). A red "Invoice Overdue" notification appears in the bell dropdown. Clicking it navigates to `/supplier-payments?filter=overdue`.

4. **Due-soon alerts:** Create an invoice due in 2 days. A yellow "Payment Due Soon" notification appears.

5. **Role gating:** Log in as `warehouse` role. No financial alerts appear (polling is disabled for warehouse role).

6. **No console.log:** Open browser DevTools → Console. Navigate to Supplier Payments. No "Payment summary data:" log appears.

7. **Clear all:** Click "Clear all" in the notification dropdown. All notifications are removed from the dropdown and from localStorage.

---

## Definition of Done

- [ ] Notifications persist across page refresh via localStorage
- [ ] Only `persistent: true` notifications are stored in localStorage
- [ ] Server-side `notifications` table created with cleanup trigger
- [ ] `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` endpoints implemented and auth-gated
- [ ] `NotificationContext` fetches server notifications on mount and merges with localStorage state
- [ ] Financial alert polling queries `GET /api/supplier-payments/alerts` every 5 minutes for admin/front_office roles
- [ ] Overdue invoices create `type: "error"` notifications
- [ ] Due-in-3-days invoices create `type: "warning"` notifications
- [ ] Deduplication: same invoice does not generate duplicate notifications on each poll cycle
- [ ] Warehouse role does not receive financial alerts
- [ ] `console.log('Payment summary data:', ...)` removed from `SupplierPayments.tsx`
- [ ] No other stray `console.log` calls remain in `client/src/`
