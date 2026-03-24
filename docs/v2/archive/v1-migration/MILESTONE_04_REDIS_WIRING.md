# Milestone 04 — Redis Wiring

**Priority:** P1
**Depends on:** Milestone 03 (config.ts exists with redis config)
**Blocks:** Nothing (performance improvement)

---

## Objective

Wire the already-installed `ioredis` package into `cacheManager.ts` so that when `REDIS_URL` is set, the app uses Redis for caching. When Redis is unavailable, fall back gracefully to the existing in-memory cache. Zero changes to cache consumers (they use the same interface).

---

## Current State Analysis

The codebase already has:
- `ioredis` v5.6.1 installed in package.json
- `server/utils/cacheManager.ts` — cache abstraction layer
- `server/middleware/cacheMiddleware.ts` — HTTP caching middleware
- `server/services/cachedServices.ts` — service-level caching

The current `cacheManager.ts` uses `node-cache` (in-memory). Redis is installed but not wired.

---

## Step 1 — Rewrite `server/utils/cacheManager.ts`

Replace the existing file with a Redis-first implementation that falls back to in-memory:

```typescript
// server/utils/cacheManager.ts
import Redis from 'ioredis';
import NodeCache from 'node-cache';
import { config } from '../config';

// ============================================================
// Cache Interface
// ============================================================
export interface CacheManager {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<void>;
  flush(): Promise<void>;
  isRedis(): boolean;
}

// ============================================================
// Redis Cache Implementation
// ============================================================
class RedisCacheManager implements CacheManager {
  private client: Redis;
  private defaultTtl: number;

  constructor(redisUrl: string, defaultTtl = 300) {
    this.defaultTtl = defaultTtl;
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 200, 2000);
      },
    });

    this.client.on('connect', () => {
      console.log('[cache] Redis connected');
    });

    this.client.on('error', (err) => {
      console.error('[cache] Redis error:', err.message);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const val = await this.client.get(key);
      if (!val) return null;
      return JSON.parse(val) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds = this.defaultTtl): Promise<void> {
    try {
      await this.client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      console.error('[cache] Redis set error:', err);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      console.error('[cache] Redis del error:', err);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err) {
      console.error('[cache] Redis delByPattern error:', err);
    }
  }

  async flush(): Promise<void> {
    try {
      await this.client.flushdb();
    } catch (err) {
      console.error('[cache] Redis flush error:', err);
    }
  }

  isRedis(): boolean {
    return true;
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }
}

// ============================================================
// In-Memory Cache Implementation (Fallback)
// ============================================================
class MemoryCacheManager implements CacheManager {
  private cache: NodeCache;

  constructor(defaultTtl = 300) {
    this.cache = new NodeCache({
      stdTTL: defaultTtl,
      checkperiod: 120,
      useClones: false,
    });
    console.log('[cache] Using in-memory cache (Redis not configured)');
  }

  async get<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key) ?? null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.cache.set(key, value, ttlSeconds ?? 0);
  }

  async del(key: string): Promise<void> {
    this.cache.del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const keys = this.cache.keys().filter(k => regex.test(k));
    this.cache.del(keys);
  }

  async flush(): Promise<void> {
    this.cache.flushAll();
  }

  isRedis(): boolean {
    return false;
  }
}

// ============================================================
// Cache Key Constants
// ============================================================
export const CACHE_KEYS = {
  DASHBOARD_STATS: 'dashboard:stats',
  PRODUCTS_LIST: 'products:list',
  PRODUCTS_LOW_STOCK: 'products:low-stock',
  ORDER_SUMMARY: (id: number) => `orders:summary:${id}`,
  ORDERS_RECENT: 'orders:recent',
  CUSTOMERS_LIST: 'customers:list',
  NOTIFICATION_SETTINGS: 'settings:notifications',
  COMPANY_SETTINGS: 'settings:company',
} as const;

export const CACHE_TTL = {
  DASHBOARD: 60,          // 1 minute
  PRODUCTS: 300,          // 5 minutes
  ORDERS: 30,             // 30 seconds (changes frequently)
  CUSTOMERS: 600,         // 10 minutes
  SETTINGS: 3600,         // 1 hour
} as const;

// ============================================================
// Factory — Create the right cache based on config
// ============================================================
async function createCacheManager(): Promise<CacheManager> {
  if (!config.redis.enabled || !config.redis.url) {
    return new MemoryCacheManager();
  }

  const redisMgr = new RedisCacheManager(config.redis.url);

  try {
    await redisMgr.connect();
    return redisMgr;
  } catch (err) {
    console.warn('[cache] Redis connection failed, falling back to in-memory cache');
    return new MemoryCacheManager();
  }
}

// ============================================================
// Singleton — initialized at startup
// ============================================================
let cacheInstance: CacheManager | null = null;

export async function initCache(): Promise<CacheManager> {
  if (!cacheInstance) {
    cacheInstance = await createCacheManager();
  }
  return cacheInstance;
}

export function getCache(): CacheManager {
  if (!cacheInstance) {
    // Fallback: return sync in-memory if initCache() wasn't called yet
    cacheInstance = new MemoryCacheManager();
  }
  return cacheInstance;
}

// Convenience alias
export const cache = {
  get: <T>(key: string) => getCache().get<T>(key),
  set: <T>(key: string, value: T, ttl?: number) => getCache().set(key, value, ttl),
  del: (key: string) => getCache().del(key),
  delByPattern: (pattern: string) => getCache().delByPattern(pattern),
  flush: () => getCache().flush(),
};

export default cache;
```

---

## Step 2 — Initialize Cache in `server/index.ts`

Add cache initialization before the server starts accepting requests:

```typescript
// In server/index.ts, after imports and config validation:
import { initCache } from './utils/cacheManager';

// During startup:
async function startServer() {
  // Init cache (Redis or fallback to memory)
  await initCache();

  // ... rest of startup
}
```

---

## Step 3 — Update Cache Usage in `server/services/cachedServices.ts`

Replace direct `node-cache` calls with the new `cache` abstraction:

```typescript
// Before (node-cache directly):
import NodeCache from 'node-cache';
const serviceCache = new NodeCache({ stdTTL: 300 });

export async function getCachedDashboardStats() {
  const cached = serviceCache.get('dashboard-stats');
  if (cached) return cached;
  // ...
}

// After (use abstraction):
import { cache, CACHE_KEYS, CACHE_TTL } from '../utils/cacheManager';

export async function getCachedDashboardStats() {
  const cached = await cache.get(CACHE_KEYS.DASHBOARD_STATS);
  if (cached) return cached;

  const stats = await computeDashboardStats();
  await cache.set(CACHE_KEYS.DASHBOARD_STATS, stats, CACHE_TTL.DASHBOARD);
  return stats;
}
```

---

## Step 4 — Cache Invalidation

When data changes, invalidate related caches:

```typescript
// In order creation handler:
await cache.del(CACHE_KEYS.ORDERS_RECENT);
await cache.del(CACHE_KEYS.DASHBOARD_STATS);

// In product stock update:
await cache.del(CACHE_KEYS.PRODUCTS_LIST);
await cache.del(CACHE_KEYS.PRODUCTS_LOW_STOCK);
await cache.del(CACHE_KEYS.DASHBOARD_STATS);

// In settings update:
await cache.del(CACHE_KEYS.NOTIFICATION_SETTINGS);
```

---

## Verification Checklist

```bash
# 1. With Redis running (via docker compose)
docker compose up redis -d
REDIS_URL=redis://:password@localhost:6379 npm run dev
# Expected log: [cache] Redis connected

# 2. Without Redis (fallback)
# Remove/unset REDIS_URL
npm run dev
# Expected log: [cache] Using in-memory cache (Redis not configured)

# 3. With Redis but wrong password (graceful fallback)
REDIS_URL=redis://:wrongpass@localhost:6379 npm run dev
# Expected log: [cache] Redis connection failed, falling back to in-memory cache

# 4. Verify cache keys in Redis
docker compose exec redis redis-cli --pass $REDIS_PASSWORD
> KEYS *
# After loading dashboard: dashboard:stats key should appear
# > GET dashboard:stats
# Should return JSON-encoded stats
```

---

## Files Created/Modified in This Milestone

```
amphoreus-v2/
└── server/
    ├── utils/cacheManager.ts       ← REWRITTEN: Redis + memory fallback
    ├── services/cachedServices.ts  ← MODIFIED: Use new cache abstraction
    └── index.ts                    ← MODIFIED: Call initCache() at startup
```

---

## Next Milestone

→ [MILESTONE_05_GEOBLOCKING.md](./MILESTONE_05_GEOBLOCKING.md) — Disable app-level geoblocking
