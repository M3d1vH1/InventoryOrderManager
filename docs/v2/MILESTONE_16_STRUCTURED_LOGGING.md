# Milestone 16 — Structured Logging

**Priority:** P2
**Depends on:** Milestone 02 (Clean build), Milestone 13 (Auth hardening)
**Blocks:** Milestone 09 (CI/CD — want clean logs before going live)
**Execution order:** Run AFTER Milestone 13, BEFORE Milestone 08 (routes split)

---

## Objective

Replace 165+ `console.log` calls in production code with the existing Winston structured logger. Sanitize sensitive data from error logs. Add a request correlation ID so log entries for a single request can be traced end-to-end.

The Winston logger and request logger middleware already exist in V1 (`server/utils/logger.ts`, `server/middlewares/requestLogger.ts`) but are only used in new code. The old `routes.ts` and `storage.postgresql.ts` use raw `console.*` which produces unstructured, unsearchable output.

---

## Problem Summary

| Issue | Impact |
|---|---|
| 165+ `console.log` in `routes.ts` | Logs are unstructured — can't filter by level or field in production |
| `console.log` in `storage.postgresql.ts` | Database query context lost in noise |
| `req.body` logged wholesale on errors | Login requests log plaintext passwords |
| Startup logs `process.env.*` | Risk of accidentally logging secrets |
| No request correlation ID | Can't trace a single request across multiple log entries |

---

## Step 1 — Audit Existing Logger

**File:** `server/utils/logger.ts`

The existing Winston logger. Confirm it has the following, or update it:

```typescript
// server/utils/logger.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format: isDev
    ? winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}] ${message}${metaStr}`;
        })
      )
    : winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()  // Structured JSON in production (for log aggregation)
      ),
  transports: [
    new winston.transports.Console(),
    // Only write to file in production:
    ...(isDev ? [] : [
      new DailyRotateFile({
        filename: 'logs/app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        maxSize: '20m',
      }),
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '30d',
      }),
    ]),
  ],
});
```

---

## Step 2 — Add Request Correlation ID Middleware

**File:** `server/middlewares/requestLogger.ts`

Add a correlation ID to every request so log entries can be grouped:

```typescript
// server/middlewares/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

// Augment Express Request to carry correlation ID
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  req.correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
      : res.statusCode >= 400 ? 'warn'
      : 'info';

    logger[level]('HTTP request', {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      userAgent: req.headers['user-agent'],
    });
  });

  next();
}
```

**Apply in `server/index.ts`:**
```typescript
import { correlationIdMiddleware, requestLogger } from './middlewares/requestLogger';

app.use(correlationIdMiddleware);
app.use(requestLogger);
```

---

## Step 3 — Sanitize Error Logs (Remove Passwords from Logs)

**File:** `server/middlewares/errorHandler.ts`

The current error handler logs the full `req.body`, which includes plaintext passwords on login requests.

```typescript
// BEFORE (~line 47):
body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,

// AFTER — strip sensitive fields before logging:
const SENSITIVE_FIELDS = ['password', 'currentPassword', 'newPassword', 'token', 'secret', 'key'];

function sanitizeBody(body: Record<string, any>): Record<string, any> {
  if (!body || typeof body !== 'object') return body;
  return Object.fromEntries(
    Object.entries(body).map(([k, v]) => [
      k,
      SENSITIVE_FIELDS.some(f => k.toLowerCase().includes(f)) ? '[REDACTED]' : v
    ])
  );
}

// In the error handler:
logger.error('Unhandled error', {
  correlationId: req.correlationId,
  method: req.method,
  path: req.path,
  status: statusCode,
  error: {
    message: err.message,
    name: err.name,
    stack: isDev ? err.stack : undefined,  // No stack traces to client in prod
  },
  body: req.body ? sanitizeBody(req.body) : undefined,
});
```

---

## Step 4 — Replace `console.log` in `routes.ts`

Run this replacement across the codebase. The goal is not to log less — it's to log through Winston so entries are structured and filterable.

```bash
# Count before:
grep -c "console\.log\|console\.error\|console\.warn" server/routes.ts
```

**Pattern to apply throughout:**

```typescript
// BEFORE:
console.log('Order created:', order.id);
console.error('Error fetching products:', error);

// AFTER:
import { logger } from './utils/logger';

logger.info('Order created', { orderId: order.id });
logger.error('Error fetching products', { error: error.message });
```

**For route handlers, include the correlation ID:**
```typescript
logger.info('Order status updated', {
  correlationId: req.correlationId,
  orderId: id,
  newStatus: status,
  userId,
});
```

**Key replacements in `routes.ts`:**

| Old | New |
|---|---|
| `console.log('Order created:', ...)` | `logger.info('Order created', { orderId })` |
| `console.error('Error:', error)` | `logger.error('Route error', { error: error.message, path: req.path })` |
| `console.log('Slack notification sent')` | `logger.info('Slack notification sent', { orderId })` |
| `console.log('Email sent to:', email)` | `logger.info('Email sent', { recipient: email })` — do NOT log email content |
| `console.log('User logged in:', username)` | `logger.info('User authenticated', { username })` — do NOT log password |

---

## Step 5 — Replace `console.log` in `storage.postgresql.ts`

```typescript
// BEFORE (common pattern in storage):
console.log('Getting order:', id);
console.error('Error getting order:', error);

// AFTER:
import { logger } from '../utils/logger';

logger.debug('Getting order', { orderId: id });
logger.error('Database error', { operation: 'getOrder', orderId: id, error: error.message });
```

`logger.debug` is used for storage layer — debug logs are suppressed in production (`LOG_LEVEL=info`) but visible in development.

---

## Step 6 — Clean Up Startup Logging

**File:** `server/index.ts`

```typescript
// BEFORE (risky pattern):
console.log('Environment variables at startup:', {
  APP_URL: process.env.APP_URL || 'Not set',
  ...
});

// AFTER — log only non-sensitive config:
logger.info('Server starting', {
  nodeEnv: process.env.NODE_ENV,
  port: PORT,
  appUrl: process.env.APP_URL,
  redisEnabled: !!process.env.REDIS_URL,
  // NEVER log: DATABASE_URL, SESSION_SECRET, SMTP_PASS, API keys
});
```

---

## Step 7 — Add Log Level to `.env.example`

```bash
# Logging
# Options: error, warn, info, debug (default: info in prod, debug in dev)
LOG_LEVEL=info
```

---

## Verification

```bash
# 1. Start app in production mode
NODE_ENV=production npm run start

# 2. Make a request and verify JSON logs:
curl -s http://localhost:5000/api/health
# Expected log output (JSON in prod):
# {"level":"info","message":"HTTP request","method":"GET","path":"/api/health","status":200,"duration_ms":3}

# 3. Trigger a login and verify password is NOT in logs:
curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"mypassword"}'
# Check logs — should see:
# {"level":"info","message":"User authenticated","username":"admin"}
# Should NOT see: "mypassword" anywhere in logs

# 4. Trigger a 500 error and verify stack trace not exposed to client:
# (cause an error somehow)
# Client response: {"success":false,"message":"Internal server error"}
# Server log: {"level":"error","message":"Unhandled error","error":{"message":"..."}}

# 5. Count remaining console.log calls (target: 0 in production code):
grep -c "console\.log" server/routes.ts
grep -c "console\.log" server/storage.postgresql.ts
```

---

## Files Modified in This Milestone

```
amphoreus-v2/
├── server/
│   ├── utils/
│   │   └── logger.ts                  ← MODIFIED: Ensure format + transports correct
│   ├── middlewares/
│   │   ├── requestLogger.ts           ← MODIFIED: Add correlationId + sanitize body
│   │   └── errorHandler.ts            ← MODIFIED: Sanitize body, use logger not console
│   ├── routes.ts                      ← MODIFIED: Replace 165+ console.* with logger
│   ├── storage.postgresql.ts          ← MODIFIED: Replace console.* with logger
│   └── index.ts                       ← MODIFIED: Clean startup log, apply middlewares
└── .env.example                       ← MODIFIED: Add LOG_LEVEL
```

---

## Next Milestone

→ [MILESTONE_08_ROUTES_SPLIT.md](./MILESTONE_08_ROUTES_SPLIT.md) — Split monolithic routes.ts into domain modules
