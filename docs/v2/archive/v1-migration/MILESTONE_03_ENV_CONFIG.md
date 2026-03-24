# Milestone 03 — Environment Configuration

**Priority:** P0
**Depends on:** Milestone 01
**Blocks:** Milestone 04+

---

## Objective

Establish a clean, complete environment variable system for all deployment targets (local dev, Docker on Mac Mini). All secrets are gitignored. The app fails fast with clear errors if required env vars are missing.

---

## Step 1 — Create `.env.example`

This file IS committed to git. It documents every env var with safe placeholder values:

```bash
# .env.example
# Copy this to .env.production (Mac Mini) or .env.local (dev)
# NEVER commit .env.production or .env.local to git

# ============================================================
# APPLICATION
# ============================================================
NODE_ENV=production
PORT=5000
APP_URL=https://yourdomain.com

# ============================================================
# DATABASE
# ============================================================
# PostgreSQL connection string
# Docker Compose: postgresql://amphoreus:CHANGE_ME@postgres:5432/amphoreus
# Local dev: postgresql://localhost:5432/amphoreus
DATABASE_URL=postgresql://amphoreus:CHANGE_ME@postgres:5432/amphoreus

# DB pool settings
DB_MAX_CONNECTIONS=20

# ============================================================
# REDIS
# ============================================================
# Docker Compose: redis://:REDIS_PASSWORD@redis:6379
REDIS_URL=redis://:CHANGE_ME@redis:6379
REDIS_PASSWORD=CHANGE_ME

# ============================================================
# SECURITY
# ============================================================
# Session secret — must be at least 64 random characters
# Generate: openssl rand -base64 48
SESSION_SECRET=CHANGE_ME_USE_OPENSSL_RAND

# ============================================================
# STORAGE
# ============================================================
# Path where uploaded files (product images, labels, etc.) are stored
# Docker: /app/storage (mounted volume)
# Local dev: ./storage (relative to project root)
STORAGE_PATH=/app/storage

# ============================================================
# CLOUDFLARE TUNNEL
# ============================================================
# Get this from Cloudflare dashboard after creating a tunnel
TUNNEL_TOKEN=CHANGE_ME

# ============================================================
# DOCKER COMPOSE VOLUMES
# ============================================================
# Absolute path on Mac Mini where Docker volume data is stored
# Example: /Users/yourname/amphoreus-data
DATA_PATH=/Users/yourname/amphoreus-data

# ============================================================
# SLACK NOTIFICATIONS
# ============================================================
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/CHANGE_ME
SLACK_FINANCE_WEBHOOK_URL=https://hooks.slack.com/services/CHANGE_ME

# ============================================================
# DATABASE PASSWORD (for Docker Compose postgres service)
# ============================================================
DB_PASSWORD=CHANGE_ME

# ============================================================
# GEOBLOCKING
# ============================================================
# Set to false — geoblocking is handled by Cloudflare in V2
ENABLE_GEOBLOCKING=false
VERBOSE_LOGGING=false

# ============================================================
# STRIPE (if used)
# ============================================================
STRIPE_SECRET_KEY=sk_live_CHANGE_ME
STRIPE_PUBLISHABLE_KEY=pk_live_CHANGE_ME

# ============================================================
# EMAIL (SMTP)
# ============================================================
# Configured via app UI, but can be pre-seeded here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=CHANGE_ME
SMTP_PASS=CHANGE_ME
```

---

## Step 2 — Create `.env.production` Template

This file is gitignored but committed as an EXAMPLE structure.
The actual production file lives only on the Mac Mini.

```bash
# On Mac Mini, create: ~/amphoreus-v2/.env.production
# This file stays on the Mac Mini, NEVER in git

NODE_ENV=production
PORT=5000
APP_URL=https://[YOUR_DOMAIN]

# Database
DATABASE_URL=postgresql://amphoreus:[DB_PASSWORD]@postgres:5432/amphoreus
DB_PASSWORD=[STRONG_PASSWORD]
DB_MAX_CONNECTIONS=20

# Redis
REDIS_URL=redis://:[REDIS_PASSWORD]@redis:6379
REDIS_PASSWORD=[STRONG_PASSWORD]

# Security
SESSION_SECRET=[64_RANDOM_CHARS]

# Storage
STORAGE_PATH=/app/storage
DATA_PATH=/Users/[YOUR_USERNAME]/amphoreus-data

# Cloudflare
TUNNEL_TOKEN=[FROM_CLOUDFLARE_DASHBOARD]

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/[YOUR_WEBHOOK]
SLACK_FINANCE_WEBHOOK_URL=https://hooks.slack.com/services/[YOUR_WEBHOOK]

# Geoblocking
ENABLE_GEOBLOCKING=false
VERBOSE_LOGGING=false
```

---

## Step 3 — Add Startup Validation to `server/index.ts`

Add env var validation that runs before anything else. The app should refuse to start if critical vars are missing:

```typescript
// server/config.ts — NEW FILE
// Add this file and import it at the TOP of server/index.ts

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'NODE_ENV',
] as const;

const OPTIONAL_ENV_VARS = [
  'REDIS_URL',
  'SLACK_WEBHOOK_URL',
  'SLACK_FINANCE_WEBHOOK_URL',
  'STORAGE_PATH',
  'APP_URL',
] as const;

function validateEnvironment() {
  const missing: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nCopy .env.example to .env.production and fill in the values.');
    process.exit(1);
  }

  // Warn about optional vars
  for (const varName of OPTIONAL_ENV_VARS) {
    if (!process.env[varName]) {
      console.warn(`⚠️  Optional env var not set: ${varName}`);
    }
  }

  // Validate session secret length
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    console.error('❌ SESSION_SECRET must be at least 32 characters');
    process.exit(1);
  }
}

export const config = {
  port: parseInt(process.env.PORT || '5000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  isProd: process.env.NODE_ENV === 'production',

  database: {
    url: process.env.DATABASE_URL!,
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  },

  redis: {
    url: process.env.REDIS_URL || null,
    enabled: !!process.env.REDIS_URL,
  },

  app: {
    url: process.env.APP_URL || `http://localhost:5000`,
    storagePath: process.env.STORAGE_PATH || path.join(process.cwd(), 'storage'),
  },

  session: {
    secret: process.env.SESSION_SECRET!,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || null,
    financeWebhookUrl: process.env.SLACK_FINANCE_WEBHOOK_URL || null,
  },

  geoblocking: {
    enabled: process.env.ENABLE_GEOBLOCKING === 'true',
  },

  logging: {
    verbose: process.env.VERBOSE_LOGGING === 'true',
  },
} as const;

// Run validation immediately when this module loads
validateEnvironment();

export default config;
```

Then at the top of `server/index.ts`:
```typescript
// First import — validates environment before anything else
import config from './config';
```

---

## Step 4 — Update `drizzle.config.ts`

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.production' });
dotenv.config({ path: '.env.local' });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for drizzle-kit');
}

export default {
  schema: './shared/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;
```

---

## Step 5 — Create Local Dev `.env` for Development

```bash
# .env.local (gitignored, for local development)
NODE_ENV=development
PORT=5000
APP_URL=http://localhost:5000

# Local PostgreSQL (Docker for dev or local install)
DATABASE_URL=postgresql://amphoreus:devpassword@localhost:5432/amphoreus_dev

# Redis (optional in dev, falls back to in-memory)
# REDIS_URL=redis://localhost:6379

SESSION_SECRET=dev-secret-not-for-production-use-32chars-min

STORAGE_PATH=./storage

ENABLE_GEOBLOCKING=false
VERBOSE_LOGGING=true
```

---

## Verification Checklist

```bash
# 1. Verify no hardcoded secrets in source code
grep -rn "hooks.slack.com\|sk_live_\|postgresql://.*:.*@" \
  server/ client/ shared/ \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules

# 2. Verify .env files are gitignored
git check-ignore .env .env.local .env.production
# Expected: All three should be printed (meaning they're ignored)

# 3. Verify startup validation works
DATABASE_URL="" SESSION_SECRET="" node dist/index.js
# Expected: Error message listing missing vars, then exit 1

# 4. Verify normal startup
# (with valid .env.local)
npm run dev
# Expected: Server starts, no env var warnings for critical vars
```

---

## Files Created/Modified in This Milestone

```
amphoreus-v2/
├── .env.example                 ← NEW: Complete env var documentation
├── .gitignore                   ← MODIFIED: Ensure .env.production is ignored
├── drizzle.config.ts            ← MODIFIED: Load .env files properly
└── server/
    ├── config.ts                ← NEW: Central config + validation
    └── index.ts                 ← MODIFIED: Import config first
```

---

## Next Milestone

→ [MILESTONE_04_REDIS_WIRING.md](./MILESTONE_04_REDIS_WIRING.md) — Wire Redis into cacheManager
