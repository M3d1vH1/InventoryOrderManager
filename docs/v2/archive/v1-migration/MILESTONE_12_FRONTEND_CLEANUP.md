# Milestone 12 — Frontend Cleanup

**Priority:** P3
**Depends on:** Milestone 02 (Clean build), Milestone 07 (Bug fixes)
**Blocks:** Nothing (polish)

---

## Objective

Remove debug/test pages that were left in from development, fix known frontend issues, and clean up any Replit-specific UI artifacts.

---

## What Gets Cleaned Up

1. **Debug test endpoints** — API routes without auth (`/api/test-slack`, etc.)
2. **Console.log statements** — Developer noise in production logs
3. **Dead imports** — Unused Replit plugin imports after Milestone 02
4. **Health endpoint** — Confirm it exists and returns proper shape
5. **Error boundaries** — Ensure the frontend doesn't white-screen on API errors

---

## Step 1 — Remove Unauthenticated Debug Routes

In `server/routes.ts` (or the split `server/routes/` modules after Milestone 08), remove any routes that:
- Don't have authentication middleware
- Were added for testing and never removed
- Expose internal system state

```bash
# Find them:
grep -n "test-\|/debug\|/dev-\|test_" server/routes.ts
```

**Routes to remove:**
```typescript
// REMOVE these (examples — verify in actual file):
app.get('/api/test-slack', async (req, res) => { ... });
app.get('/api/debug-session', (req, res) => { ... });
app.post('/api/test-email', async (req, res) => { ... });
```

Any debug route that should stay must be gated behind `isAuthenticated` and a role check:
```typescript
// If keeping for admin use, at minimum:
app.get('/api/debug/session', isAuthenticated, hasRole('admin'), (req, res) => {
  res.json({ user: req.user });
});
```

---

## Step 2 — Add `/api/health` Endpoint

The CI/CD pipeline (Milestone 09) depends on this endpoint. Verify it exists and returns the right shape:

```typescript
// In server/index.ts or server/routes/index.ts — should already exist:
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

If it doesn't exist, add it **before** the authentication middleware so it's publicly accessible (required for Docker health checks and CI/CD polling).

---

## Step 3 — Remove Console.log Noise

Find and remove debug console.log calls that would pollute production logs:

```bash
# Find console.log in server code (keep console.error — those are real errors)
grep -rn "console\.log" server/ --include="*.ts" | grep -v "node_modules"
```

**Keep:**
- `console.error(...)` — real errors
- `console.warn(...)` — warnings worth knowing

**Remove:**
- `console.log('DEBUG:', ...)` — debug traces
- `console.log('testing:', ...)` — development leftovers
- `console.log(JSON.stringify(req.body))` — request logging (use proper middleware instead)

**Replace with no-op or structured logger if needed:**
```typescript
// server/utils/logger.ts (simple wrapper)
const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (msg: string, data?: any) => {
    if (isDev) console.log(`[INFO] ${msg}`, data ?? '');
  },
  error: (msg: string, err?: any) => {
    console.error(`[ERROR] ${msg}`, err ?? '');
  },
  warn: (msg: string, data?: any) => {
    console.warn(`[WARN] ${msg}`, data ?? '');
  },
};
```

---

## Step 4 — Frontend Error Boundary

Prevent white-screen-of-death when an API call fails unexpectedly.

**Check if `client/src/App.tsx` has an error boundary.** If not, add one:

```tsx
// client/src/components/ErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('React ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Wrap app in `client/src/main.tsx`:**
```tsx
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

---

## Step 5 — Remove Dead Client-Side Code

```bash
# Find any Replit-specific imports in client code that survived Milestone 02
grep -rn "@replit" client/src/ --include="*.tsx" --include="*.ts"
# Expected: no results

# Find TODO/FIXME comments that indicate known broken code
grep -rn "TODO\|FIXME\|HACK\|XXX" client/src/ --include="*.tsx" | head -20
```

Address any `FIXME` items that affect production functionality. Leave `TODO` items that are enhancement ideas.

---

## Step 6 — Verify TypeScript Compiles Clean

```bash
# Run type check — should produce 0 errors
npm run typecheck

# If errors exist, fix them before shipping
# Common post-cleanup errors:
# - "Property 'x' does not exist" (after removing Replit types)
# - "Cannot find module" (after removing @replit/* packages)
```

---

## Step 7 — Test the Full Flow

Manual smoke test after all cleanup:

```bash
# Start dev server
npm run dev

# In browser, test:
# 1. Login page loads
# 2. Can log in with test credentials
# 3. Dashboard loads with real data
# 4. Products page: can view, search, edit a product
# 5. Orders page: can view, create an order
# 6. Images: product images display correctly (not broken)
# 7. No console errors in browser devtools
```

---

## Files Modified in This Milestone

```
amphoreus-v2/
├── server/
│   ├── routes.ts (or routes/*.ts)   ← MODIFIED: Remove debug routes
│   ├── index.ts                      ← MODIFIED: Verify /api/health exists
│   └── utils/
│       └── logger.ts                 ← OPTIONAL NEW: Structured logger
└── client/
    ├── src/
    │   ├── main.tsx                  ← MODIFIED: Wrap with ErrorBoundary
    │   └── components/
    │       └── ErrorBoundary.tsx     ← NEW: Error boundary component
    └── ...
```

---

## Milestone Complete When

- [ ] `npm run typecheck` produces zero errors
- [ ] `npm run dev` starts without warnings about missing modules
- [ ] No unauthenticated debug endpoints exist
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] Browser console shows no errors on main pages
- [ ] All product images display correctly

---

## This Is the Last Milestone

With Milestone 12 complete, the V2 system is fully deployed and production-ready:

```
✅ M01 — Docker infrastructure
✅ M02 — Replit artifacts removed
✅ M03 — Environment config + validation
✅ M04 — Redis cache wired
✅ M05 — Geoblocking moved to Cloudflare
✅ M06 — Database schema hardened
✅ M07 — Critical bugs fixed
✅ M08 — Routes split into domain modules
✅ M09 — CI/CD push-to-deploy
✅ M10 — Automated nightly backups
✅ M11 — Data migrated from Replit
✅ M12 — Frontend cleaned up
```
