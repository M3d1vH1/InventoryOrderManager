# Milestone 05 — Disable App-Level Geoblocking

**Priority:** P1
**Depends on:** Milestone 03 (config.ts)
**Blocks:** Nothing

---

## Objective

Remove the IP geolocation middleware from the Express app and replace it with Cloudflare Firewall Rules. This is simpler, faster, and more reliable — Cloudflare blocks at the network edge before requests even reach the app.

---

## Current State

The app uses `geoip-lite` in `server/middlewares/geoblock.ts` to check every request's IP against a country database. Issues:
- Adds latency to every request
- The `geoip-lite` database is 140MB of bundled data
- Fails for IPs behind proxies/VPNs
- Has its own allow-list management API endpoints

---

## Step 1 — Disable the Middleware in `server/index.ts`

Find the geoblocking middleware registration and disable it:

```typescript
// Before:
import { geoblockMiddleware } from './middlewares/geoblock';
if (config.geoblocking.enabled) {
  app.use(geoblockMiddleware);
}

// After (V2): Remove entirely — Cloudflare handles this
// app.use(geoblockMiddleware);  // Moved to Cloudflare Firewall Rules
```

---

## Step 2 — Remove Geoblocking API Routes

In `server/routes.ts`, find and remove these endpoints:

```typescript
// REMOVE these routes — Cloudflare replaces them:
// GET  /geoblocking-status
// GET  /toggle-geoblocking
// POST /add-to-allowlist
// GET  /remove-from-allowlist
```

And remove the associated route files:
- `server/api/geoblocking.ts`
- `server/api/geoblocking-controls.ts`
- `server/api/geoblocking-routes.ts`
- `server/api/geoblock-test.ts`
- `server/api/toggle-geoblock.ts`

---

## Step 3 — Remove `geoip-lite` from `package.json`

```bash
npm uninstall geoip-lite
```

This removes ~140MB of IP geolocation data from the Docker image.

---

## Step 4 — Set Up Cloudflare Firewall Rules

Do this in the Cloudflare dashboard (manual step):

### Rule 1 — Allow Only Greece
```
Expression: (ip.geoip.country ne "GR")
Action: Block
```

### Rule 2 — Allow Your Home/Office IP Regardless of Country
```
Expression: (ip.src eq "YOUR_STATIC_IP") or
            (ip.geoip.country ne "GR")
Action: Skip Rule 1
```

### Rule 3 — Allow Cloudflare Health Checks
```
Expression: (cf.edge.server_ip in {"YOUR_TUNNEL_IPS"})
Action: Skip
```

### Alternative — Use Cloudflare Access (Zero Trust)
For even stronger access control, use Cloudflare Access to require login before reaching the app. But geoblocking alone is fine for this use case.

---

## Step 5 — Update `server/index.ts` Health Check Middleware

Make sure the health check endpoint is always accessible (not blocked by any middleware):

```typescript
// Health check — MUST be first, before any auth/rate-limit middleware
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Then: rate limiting, session, etc.
// But NOT geoblocking (removed)
```

---

## Step 6 — Update ENABLE_GEOBLOCKING Default

In `server/config.ts`:

```typescript
geoblocking: {
  // V2: Always false — handled by Cloudflare
  enabled: false,
},
```

Remove the `ENABLE_GEOBLOCKING` env var check entirely since it's always disabled now.

---

## Verification Checklist

```bash
# 1. Verify geoip-lite is not imported anywhere
grep -rn "geoip-lite\|geoblock\|geoblocking" server/ --include="*.ts"
# Expected: Only comments or docs, no active imports

# 2. Verify Docker image is smaller without geoip-lite
docker build -t amphoreus-test .
docker images amphoreus-test
# Should be ~140MB smaller than before

# 3. Verify health endpoint works without any geoblocking
curl http://localhost:5000/api/health
# Expected: {"status":"ok"}

# 4. Verify removed routes return 404
curl http://localhost:5000/geoblocking-status
# Expected: 404

# 5. In Cloudflare dashboard:
# Test with a VPN set to a non-GR country
# Expected: 403 Forbidden from Cloudflare (before reaching app)
```

---

## Files Modified/Deleted in This Milestone

```
amphoreus-v2/
└── server/
    ├── index.ts                     ← MODIFIED: Remove geoblocking middleware
    ├── routes.ts                    ← MODIFIED: Remove geoblocking routes
    ├── config.ts                    ← MODIFIED: Remove ENABLE_GEOBLOCKING
    └── api/
        ├── geoblocking.ts           ← DELETED
        ├── geoblocking-controls.ts  ← DELETED
        ├── geoblocking-routes.ts    ← DELETED
        ├── geoblock-test.ts         ← DELETED
        └── toggle-geoblock.ts       ← DELETED
```

---

## Next Milestone

→ [MILESTONE_06_DATABASE_SCHEMA.md](./MILESTONE_06_DATABASE_SCHEMA.md) — V2 database schema improvements
