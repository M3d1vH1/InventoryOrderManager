# Milestone 13 — Redis Caching

| Field | Value |
|-------|-------|
| **Step** | 13 of 25 |
| **Priority** | P2 |
| **Depends on** | Steps 1–3 |
| **Estimated effort** | 1 day |

---

## Goal

Wire Redis as a caching layer for frequently-accessed, rarely-changed data: product catalog, category lists, customer lists, and dashboard stats. Provide a cache wrapper with automatic TTL, tag-based invalidation, and graceful fallback to direct DB queries if Redis is unavailable.

---

## Implementation

### 1. Redis Connection — `src/server/lib/cache.ts`

```ts
// src/server/lib/cache.ts
import { createClient, type RedisClientType } from "redis";
import { env } from "./env.js";
import { logger } from "./logger.js";

let redis: RedisClientType;

export async function initRedis(): Promise<RedisClientType> {
  redis = createClient({ url: env.REDIS_URL });

  redis.on("error", (err) => logger.error("Redis error", { error: err.message }));
  redis.on("connect", () => logger.info("Redis connected"));
  redis.on("reconnecting", () => logger.warn("Redis reconnecting..."));

  await redis.connect();
  return redis;
}

export function getRedis(): RedisClientType {
  return redis;
}

/**
 * Cache wrapper with automatic JSON serialization and TTL.
 * Falls back to the fetcher function if Redis is unavailable.
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { ttl?: number; tags?: string[] } = {},
): Promise<T> {
  const { ttl = 300, tags = [] } = options; // Default 5 min TTL

  try {
    if (!redis?.isReady) {
      return fetcher();
    }

    // Check cache
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    // Fetch and cache
    const result = await fetcher();
    await redis.setEx(key, ttl, JSON.stringify(result));

    // Store tag → key mappings for invalidation
    for (const tag of tags) {
      await redis.sAdd(`tag:${tag}`, key);
    }

    return result;
  } catch (err) {
    logger.warn("Cache error, falling back to DB", { key, error: (err as Error).message });
    return fetcher();
  }
}

/**
 * Invalidate all cache entries associated with a tag.
 * E.g., invalidateTag("products") clears all product-related caches.
 */
export async function invalidateTag(tag: string): Promise<void> {
  try {
    if (!redis?.isReady) return;

    const keys = await redis.sMembers(`tag:${tag}`);
    if (keys.length > 0) {
      await redis.del(keys);
      await redis.del(`tag:${tag}`);
    }
  } catch (err) {
    logger.warn("Cache invalidation error", { tag, error: (err as Error).message });
  }
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateKey(key: string): Promise<void> {
  try {
    if (!redis?.isReady) return;
    await redis.del(key);
  } catch (err) {
    logger.warn("Cache key invalidation error", { key, error: (err as Error).message });
  }
}

/**
 * Clear all application cache (preserving sessions).
 */
export async function clearAppCache(): Promise<number> {
  try {
    if (!redis?.isReady) return 0;

    const keys = await redis.keys("cache:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }
    // Also clear tags
    const tagKeys = await redis.keys("tag:*");
    if (tagKeys.length > 0) {
      await redis.del(tagKeys);
    }
    return keys.length;
  } catch {
    return 0;
  }
}
```

### 2. Cache Integration in Routers

```ts
// Example: caching product list queries
// In src/server/routers/products.ts — modify the list procedure:

import { cached, invalidateTag } from "../lib/cache.js";

// In the list query:
list: protectedProcedure.input(listInput).query(async ({ input }) => {
  const cacheKey = `cache:products:list:${JSON.stringify(input)}`;

  return cached(cacheKey, async () => {
    // ... existing query logic ...
  }, { ttl: 120, tags: ["products"] });
}),

// In mutations that modify products:
create: protectedProcedure.input(productCreateInput).mutation(async ({ input, ctx }) => {
  const result = await /* ... existing logic ... */;
  await invalidateTag("products");
  return result;
}),
```

```ts
// Cache strategy per entity:
// - products.list          → cache 2 min, tag "products"
// - products.categories    → cache 10 min, tag "categories"
// - products.tags          → cache 10 min, tag "tags"
// - customers.list         → cache 2 min, tag "customers"
// - dashboard.stats        → cache 30 sec, tag "dashboard"
// - dashboard.lowStock     → cache 1 min, tag "products"
// - dashboard.ordersTrend  → cache 5 min, tag "orders"
```

### 3. Cache Admin Endpoint

```ts
// Add to settings or admin router:
clearCache: adminProcedure.mutation(async () => {
  const cleared = await clearAppCache();
  return { cleared, message: `Cleared ${cleared} cache entries` };
}),
```

### 4. Docker Compose — Redis Service

Already configured in Milestone 01:
```yaml
# docker-compose.yml (excerpt)
redis:
  image: redis:7-alpine
  restart: unless-stopped
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 3s
    retries: 5
```

---

## Cache Key Naming Convention

```
cache:{entity}:{operation}:{hash}
  - cache:products:list:abc123
  - cache:categories:all
  - cache:dashboard:stats
  - cache:customers:list:def456

tag:{entity}
  - tag:products     → set of all product-related cache keys
  - tag:categories   → set of all category-related cache keys
  - tag:dashboard    → set of all dashboard-related cache keys
```

---

## Files to Create/Modify

| Path | Purpose |
|------|---------|
| `src/server/lib/cache.ts` | Redis client, `cached()` wrapper, tag invalidation |
| `src/server/routers/products.ts` | Add caching to list/categories/tags queries |
| `src/server/routers/customers.ts` | Add caching to list query |
| `src/server/routers/dashboard.ts` | Add caching to stats/lowStock/trend queries |

---

## Verification

1. **Cache hit** — query products list twice, confirm second request is served from Redis (check logs or Redis MONITOR).
2. **Cache miss** — query with new parameters, confirm DB hit and cache population.
3. **Invalidation** — create a product, confirm `tag:products` entries are cleared and next list query hits DB.
4. **Tag invalidation** — update a product, confirm all product-related caches are invalidated.
5. **TTL expiry** — set a short TTL (10s), wait, confirm cache expired and refetched.
6. **Redis down** — stop Redis container, confirm app continues to work (falls back to DB).
7. **Redis reconnect** — restart Redis container, confirm caching resumes without app restart.
8. **Clear cache** — call admin `clearCache`, confirm all `cache:*` keys deleted.
9. **Dashboard performance** — compare dashboard load time with cache warm vs cold.
10. **Memory limit** — confirm Redis `maxmemory-policy allkeys-lru` evicts old entries.

---

## Definition of Done

- [ ] `cached()` wrapper handles get/set with automatic JSON serialization and TTL
- [ ] Tag-based invalidation clears related cache entries on mutations
- [ ] Graceful fallback to DB queries when Redis is unavailable
- [ ] Product list, categories, tags, customer list, and dashboard stats are cached
- [ ] Mutations invalidate relevant tags
- [ ] Admin endpoint to clear all application cache
- [ ] Cache key naming follows `cache:{entity}:{operation}:{hash}` convention
- [ ] Redis connection errors are logged but do not crash the application
- [ ] Redis health check configured in Docker Compose
