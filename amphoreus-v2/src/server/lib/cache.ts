import { createClient, type RedisClientType } from "redis";
import { env } from "./env.js";
import { logger } from "./logger.js";

let redis: RedisClientType | null = null;

export async function initRedis(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) {
    logger.warn("REDIS_URL not set. Running without cache.");
    return null;
  }

  try {
    redis = createClient({ url: env.REDIS_URL });

    redis.on("error", (err) => logger.error("Redis error", { error: err.message }));
    redis.on("connect", () => logger.info("Redis connected"));
    redis.on("reconnecting", () => logger.warn("Redis reconnecting..."));

    await redis.connect();
    return redis;
  } catch (err) {
    logger.error("Failed to connect to Redis during init", { error: (err as Error).message });
    redis = null;
    return null; // Don't crash the app if Redis is down
  }
}

export function getRedis(): RedisClientType | null {
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
    const cachedValue = await redis.get(key);
    if (cachedValue) {
      return JSON.parse(cachedValue) as T;
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
      await redis.del(keys); // Delete the cached items
      await redis.del(`tag:${tag}`); // Delete the tag set
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
 * Clear all application cache (preserving sessions if they were on the same DB, though usually separate).
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
