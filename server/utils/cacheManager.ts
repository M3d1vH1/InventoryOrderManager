import NodeCache from 'node-cache';
import Redis from 'ioredis';
import log from './logger';

export interface CacheConfig {
  defaultTTL: number; // Time to live in seconds
  checkPeriod: number; // Check period for expired keys in seconds
  maxKeys: number; // Maximum number of keys in cache
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  hitRate: number;
  memoryUsage?: string;
}

// Default cache configuration
const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 300, // 5 minutes
  checkPeriod: 60, // Check every minute
  maxKeys: 1000
};

export class InMemoryCacheManager {
  private cache: NodeCache;
  private stats: { hits: number; misses: number };
  private tagMap: Map<string, Set<string>>; // tag -> set of cache keys

  constructor(config: Partial<CacheConfig> = {}) {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    this.cache = new NodeCache({
      stdTTL: finalConfig.defaultTTL,
      checkperiod: finalConfig.checkPeriod,
      maxKeys: finalConfig.maxKeys,
      useClones: false // Better performance for read-only data
    });

    this.stats = { hits: 0, misses: 0 };
    this.tagMap = new Map();

    // Set up event listeners for cache management
    this.cache.on('expired', (key: string) => {
      this.cleanupTags(key);
      log.debug(`Cache key expired: ${key}`);
    });

    this.cache.on('del', (key: string) => {
      this.cleanupTags(key);
    });
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = this.cache.get<T>(key);
      
      if (data !== undefined) {
        this.stats.hits++;
        log.debug(`Cache hit for key: ${key}`);
        return data;
      }
      
      this.stats.misses++;
      log.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      log.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set data in cache with optional TTL and tags
   */
  async set<T>(key: string, data: T, ttl?: number, tags: string[] = []): Promise<boolean> {
    try {
      const success = this.cache.set(key, data, ttl || DEFAULT_CONFIG.defaultTTL);
      
      if (success) {
        // Update tag mapping
        tags.forEach(tag => {
          if (!this.tagMap.has(tag)) {
            this.tagMap.set(tag, new Set());
          }
          this.tagMap.get(tag)!.add(key);
        });
        
        log.debug(`Cache set for key: ${key}, TTL: ${ttl || DEFAULT_CONFIG.defaultTTL}s, Tags: ${tags.join(', ')}`);
      }
      
      return success;
    } catch (error) {
      log.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete specific key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const deleted = this.cache.del(key);
      if (deleted > 0) {
        this.cleanupTags(key);
        log.debug(`Cache key deleted: ${key}`);
        return true;
      }
      return false;
    } catch (error) {
      log.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Invalidate all keys with specific tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let deletedCount = 0;
    
    try {
      for (const tag of tags) {
        const keys = this.tagMap.get(tag);
        if (keys) {
          keys.forEach(key => {
            if (this.cache.del(key) > 0) {
              deletedCount++;
            }
          });
          this.tagMap.delete(tag);
        }
      }
      
      log.info(`Cache invalidated ${deletedCount} keys for tags: ${tags.join(', ')}`);
      return deletedCount;
    } catch (error) {
      log.error('Cache invalidate by tags error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      this.cache.flushAll();
      this.tagMap.clear();
      this.stats = { hits: 0, misses: 0 };
      log.info('Cache cleared completely');
    } catch (error) {
      log.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const keys = this.cache.keys().length;
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
      : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      keys,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    };
  }

  /**
   * Get all cache keys (for debugging)
   */
  getKeys(): string[] {
    return this.cache.keys();
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * Clean up tag mappings when a key is removed
   */
  private cleanupTags(key: string): void {
    this.tagMap.forEach((keys, tag) => {
      if (keys.has(key)) {
        keys.delete(key);
        if (keys.size === 0) {
          this.tagMap.delete(tag);
        }
      }
    });
  }
}

export class RedisCacheManager {
  private redis: Redis;
  private stats: { hits: number; misses: number };

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

    this.stats = { hits: 0, misses: 0 };

    this.redis.on('connect', () => {
      log.info('Redis cache connected');
    });

    this.redis.on('error', (error) => {
      log.error('Redis cache error:', error);
    });
  }

  /**
   * Get data from Redis cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      
      if (data) {
        this.stats.hits++;
        log.debug(`Redis cache hit for key: ${key}`);
        return JSON.parse(data);
      }
      
      this.stats.misses++;
      log.debug(`Redis cache miss for key: ${key}`);
      return null;
    } catch (error) {
      log.error('Redis get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set data in Redis cache
   */
  async set<T>(key: string, data: T, ttl?: number, tags: string[] = []): Promise<boolean> {
    try {
      const serialized = JSON.stringify(data);
      
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }

      // Store tag mappings
      if (tags.length > 0) {
        const pipeline = this.redis.pipeline();
        tags.forEach(tag => {
          pipeline.sadd(`tag:${tag}`, key);
          if (ttl) {
            pipeline.expire(`tag:${tag}`, ttl + 60); // Tag expires slightly after data
          }
        });
        await pipeline.exec();
      }
      
      log.debug(`Redis cache set for key: ${key}, TTL: ${ttl || 'none'}s, Tags: ${tags.join(', ')}`);
      return true;
    } catch (error) {
      log.error('Redis set error:', error);
      return false;
    }
  }

  /**
   * Delete specific key from Redis
   */
  async delete(key: string): Promise<boolean> {
    try {
      const deleted = await this.redis.del(key);
      if (deleted > 0) {
        log.debug(`Redis cache key deleted: ${key}`);
        return true;
      }
      return false;
    } catch (error) {
      log.error('Redis delete error:', error);
      return false;
    }
  }

  /**
   * Invalidate all keys with specific tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let deletedCount = 0;
    
    try {
      const pipeline = this.redis.pipeline();
      
      for (const tag of tags) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        if (keys.length > 0) {
          pipeline.del(...keys);
          deletedCount += keys.length;
        }
        pipeline.del(`tag:${tag}`);
      }
      
      await pipeline.exec();
      log.info(`Redis cache invalidated ${deletedCount} keys for tags: ${tags.join(', ')}`);
      return deletedCount;
    } catch (error) {
      log.error('Redis invalidate by tags error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
      this.stats = { hits: 0, misses: 0 };
      log.info('Redis cache cleared completely');
    } catch (error) {
      log.error('Redis clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'Unknown';
      
      const dbSize = await this.redis.dbsize();
      const hitRate = this.stats.hits + this.stats.misses > 0 
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
        : 0;

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys: dbSize,
        hitRate: Math.round(hitRate * 100) / 100,
        memoryUsage
      };
    } catch (error) {
      log.error('Redis stats error:', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys: 0,
        hitRate: 0,
        memoryUsage: 'Unknown'
      };
    }
  }

  /**
   * Check if key exists in Redis
   */
  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      log.error('Redis has error:', error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// Cache strategy factory
export class CacheStrategyFactory {
  private static inMemoryCache: InMemoryCacheManager;
  private static redisCache: RedisCacheManager;

  static getInMemoryCache(config?: Partial<CacheConfig>): InMemoryCacheManager {
    if (!this.inMemoryCache) {
      this.inMemoryCache = new InMemoryCacheManager(config);
    }
    return this.inMemoryCache;
  }

  static getRedisCache(redisUrl?: string): RedisCacheManager {
    if (!this.redisCache) {
      this.redisCache = new RedisCacheManager(redisUrl);
    }
    return this.redisCache;
  }

  static getOptimalCache(preferRedis: boolean = false): InMemoryCacheManager | RedisCacheManager {
    if (preferRedis && process.env.REDIS_URL) {
      return this.getRedisCache();
    }
    return this.getInMemoryCache();
  }
}

// Export default cache instance
export const cache = CacheStrategyFactory.getOptimalCache();