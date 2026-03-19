import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

let redis: Redis | null = null;

// In-memory fallback when Redis is unavailable
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

function getRedis(): Redis | null {
  if (redis) return redis;

  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 5) {
          logger.warn("Redis connection failed after 5 retries, using in-memory fallback");
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    redis.on("error", (err) => {
      logger.error("Redis error", { error: err.message });
    });

    redis.on("connect", () => {
      logger.info("Redis connected");
    });

    redis.connect().catch(() => {
      logger.warn("Redis unavailable, falling back to in-memory cache");
      redis = null;
    });

    return redis;
  } catch {
    logger.warn("Redis initialization failed, using in-memory cache");
    return null;
  }
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const client = getRedis();

    if (client) {
      try {
        const value = await client.get(key);
        return value ? (JSON.parse(value) as T) : null;
      } catch {
        // Fall through to memory cache
      }
    }

    const entry = memoryCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return JSON.parse(entry.value) as T;
    }
    memoryCache.delete(key);
    return null;
  },

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    const serialized = JSON.stringify(value);
    const client = getRedis();

    if (client) {
      try {
        await client.set(key, serialized, "EX", ttlSeconds);
        return;
      } catch {
        // Fall through to memory cache
      }
    }

    memoryCache.set(key, {
      value: serialized,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  async del(key: string): Promise<void> {
    const client = getRedis();

    if (client) {
      try {
        await client.del(key);
      } catch {
        // ignore
      }
    }

    memoryCache.delete(key);
  },

  async invalidate(pattern: string): Promise<void> {
    const client = getRedis();

    if (client) {
      try {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } catch {
        // ignore
      }
    }

    // In-memory: iterate and match
    for (const key of memoryCache.keys()) {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
      if (regex.test(key)) {
        memoryCache.delete(key);
      }
    }
  },

  async disconnect(): Promise<void> {
    if (redis) {
      await redis.quit();
      redis = null;
    }
    memoryCache.clear();
  },
};

