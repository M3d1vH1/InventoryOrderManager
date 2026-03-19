# Milestone 16 — Cloudflare Tunnel + Go-Live

| Field | Value |
|-------|-------|
| **Step** | 16 of 25 |
| **Priority** | P1 |
| **Depends on** | Steps 1–12 |
| **Estimated effort** | 0.5 days |

---

## Goal

Expose the V2 application to the internet via Cloudflare Tunnel (zero open ports on the Mac Mini). Configure DNS, SSL (automatic via Cloudflare), WAF geoblocking (Greece + Cyprus only), and security headers. This is the production networking layer — no nginx, no port forwarding, no certificate management.

---

## Implementation

### 1. Cloudflare Tunnel Container — `docker-compose.yml`

```yaml
# Add to docker-compose.yml services:
cloudflared:
  image: cloudflare/cloudflared:latest
  restart: unless-stopped
  command: tunnel --no-autoupdate run
  environment:
    TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
  depends_on:
    app:
      condition: service_healthy
  networks:
    - internal
```

### 2. Cloudflare Tunnel Configuration

Configure via Cloudflare dashboard or `cloudflared` CLI:

```yaml
# Tunnel config (managed via Cloudflare dashboard)
# Route: app.amphoreus.com → http://app:3000
# - The tunnel connects to the internal Docker network
# - No ports exposed to the host
# - SSL termination at Cloudflare edge (Full Strict mode)
```

**Dashboard setup steps:**
1. Zero Trust → Networks → Tunnels → Create Tunnel
2. Name: `amphoreus-v2`
3. Install connector: use Docker (token in env var)
4. Add public hostname:
   - Domain: `app.amphoreus.com`
   - Service: `http://app:3000`
   - TLS: Origin certificate verification ON

### 3. Cloudflare WAF — Geoblocking

```
# Cloudflare WAF Rule (via dashboard or API):
# Rule name: "Block non-GR/CY traffic"
# Expression:
(not ip.geoip.country in {"GR" "CY"})
# Action: Block

# Exception: Allow GitHub Actions webhooks
# Expression:
(ip.geoip.country in {"US"} and http.user_agent contains "GitHub-Hookshot")
# Action: Allow (placed before block rule)
```

### 4. Security Headers — Hono Middleware

```ts
// src/server/middleware/security.ts
import type { MiddlewareHandler } from "hono";

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self';"
  );

  // HSTS handled by Cloudflare (Always Use HTTPS + HSTS enabled)
};
```

```ts
// Register in src/server/index.ts:
import { securityHeaders } from "./middleware/security.js";
app.use("*", securityHeaders);
```

### 5. Production Environment Variables

```bash
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://amphoreus:${DB_PASSWORD}@postgres:5432/amphoreus
REDIS_URL=redis://redis:6379
CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_TOKEN}
SESSION_SECRET=${SESSION_SECRET}
APP_URL=https://app.amphoreus.com
```

### 6. Production Docker Compose Override

```yaml
# docker-compose.prod.yml
services:
  app:
    restart: unless-stopped
    environment:
      NODE_ENV: production
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  postgres:
    restart: unless-stopped

  redis:
    restart: unless-stopped

  cloudflared:
    restart: unless-stopped
```

### 7. Go-Live Checklist Script — `scripts/go-live-check.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_URL="${APP_URL:-https://app.amphoreus.com}"

echo "=== Amphoreus V2 Go-Live Checklist ==="
echo ""

# 1. Docker containers
echo "1. Docker containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}" | grep -E "Up|running" && echo "   ✅ All containers running" || echo "   ❌ Some containers down"

# 2. Database connectivity
echo ""
echo "2. Database:"
docker compose exec -T postgres pg_isready -U amphoreus && echo "   ✅ PostgreSQL ready" || echo "   ❌ PostgreSQL not ready"

# 3. Redis connectivity
echo ""
echo "3. Redis:"
docker compose exec -T redis redis-cli ping | grep -q PONG && echo "   ✅ Redis responding" || echo "   ❌ Redis not responding"

# 4. Health endpoint
echo ""
echo "4. Health check:"
curl -sf "$APP_URL/api/health" | python3 -m json.tool && echo "   ✅ Health check passed" || echo "   ❌ Health check failed"

# 5. SSL certificate
echo ""
echo "5. SSL:"
curl -sf -o /dev/null -w "   Certificate: %{ssl_verify_result}\n   Protocol: %{http_version}\n" "$APP_URL" && echo "   ✅ SSL valid" || echo "   ❌ SSL issues"

# 6. Backup
echo ""
echo "6. Backup:"
ls -lt /opt/amphoreus-v2/backups/amphoreus_*.sql.gz 2>/dev/null | head -1 && echo "   ✅ Backups exist" || echo "   ⚠️  No backups found"

echo ""
echo "=== Checklist complete ==="
```

---

## Files to Create/Modify

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Add `cloudflared` service |
| `docker-compose.prod.yml` | Production overrides (restart, logging) |
| `src/server/middleware/security.ts` | Security headers middleware |
| `.env.production` | Production environment template |
| `scripts/go-live-check.sh` | Pre-launch verification script |

---

## Cloudflare Settings Checklist

| Setting | Value |
|---------|-------|
| SSL/TLS Mode | Full (Strict) |
| Always Use HTTPS | ON |
| HSTS | Enabled (max-age 31536000, includeSubDomains) |
| Minimum TLS Version | 1.2 |
| HTTP/2 | ON |
| Brotli Compression | ON |
| WAF Geoblocking | GR + CY only (with GitHub webhook exception) |
| Bot Fight Mode | ON |

---

## Verification

1. **Tunnel connectivity** — `docker compose logs cloudflared`, confirm tunnel established.
2. **External access** — visit `https://app.amphoreus.com` from a Greek IP, confirm app loads.
3. **Geoblocking** — use a VPN from a non-GR/CY country, confirm 403 blocked.
4. **SSL** — confirm browser shows valid certificate (Cloudflare-issued).
5. **Security headers** — check response headers with `curl -I`, confirm all security headers present.
6. **CSP** — confirm Content-Security-Policy allows app assets but blocks external scripts.
7. **Health check** — `curl https://app.amphoreus.com/api/health`, confirm 200 response.
8. **Zero open ports** — `nmap` the Mac Mini's public IP, confirm no ports exposed.
9. **Restart recovery** — reboot Mac Mini, confirm all containers auto-restart and tunnel reconnects.
10. **Go-live script** — run `scripts/go-live-check.sh`, confirm all checks pass.

---

## Definition of Done

- [ ] Cloudflare Tunnel container runs in Docker Compose and auto-restarts
- [ ] Application accessible via HTTPS at production domain
- [ ] WAF geoblocking restricts access to Greece and Cyprus
- [ ] Security headers (CSP, X-Frame-Options, etc.) applied to all responses
- [ ] SSL is Full (Strict) with HSTS enabled
- [ ] No ports exposed on the Mac Mini (zero-port architecture)
- [ ] Production Docker Compose overrides configure restart policies and log rotation
- [ ] Go-live checklist script validates all infrastructure components
- [ ] Containers auto-restart after host reboot
