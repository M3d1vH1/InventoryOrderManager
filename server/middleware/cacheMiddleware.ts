import { Request, Response, NextFunction } from 'express';
import { cache, CacheStrategyFactory } from '../utils/cacheManager';
import log from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  keyGenerator?: (req: Request) => string; // Custom key generation
  condition?: (req: Request) => boolean; // Conditional caching
  skipCache?: (req: Request) => boolean; // Skip cache condition
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, prefix: string = ''): string {
  const { method, path, query, user } = req;
  const userId = (user as any)?.id || 'anonymous';
  const queryString = Object.keys(query).length > 0 
    ? JSON.stringify(query) 
    : '';
  
  return `${prefix}:${method}:${path}:${userId}:${queryString}`.replace(/[^a-zA-Z0-9:_-]/g, '_');
}

/**
 * Cache middleware for API responses
 */
export function cacheResponse(options: CacheOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests by default
    if (req.method !== 'GET' && !options.condition?.(req)) {
      return next();
    }

    // Skip cache if condition is met
    if (options.skipCache?.(req)) {
      return next();
    }

    const cacheKey = options.keyGenerator?.(req) || generateCacheKey(req, 'api');
    
    try {
      // Try to get cached response
      const cachedData = await cache.get(cacheKey);
      
      if (cachedData) {
        log.debug(`Cache hit for ${cacheKey}`);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.json(cachedData);
      }

      // Cache miss - intercept response
      log.debug(`Cache miss for ${cacheKey}`);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      // Store original json method
      const originalJson = res.json;

      // Override json method to cache response
      res.json = function(data: any) {
        // Cache the response data
        cache.set(cacheKey, data, options.ttl, options.tags)
          .then(() => {
            log.debug(`Response cached for ${cacheKey}`);
          })
          .catch((error) => {
            log.error('Cache set error:', error);
          });

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      log.error('Cache middleware error:', error);
      // Continue without caching on error
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 */
export function invalidateCache(tags: string[] | ((req: Request) => string[])) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original end method
    const originalEnd = res.end;

    // Override end method to invalidate cache after response
    res.end = function(chunk?: any, encoding?: any) {
      const tagsToInvalidate = typeof tags === 'function' ? tags(req) : tags;
      
      // Invalidate cache asynchronously
      cache.invalidateByTags(tagsToInvalidate)
        .then((deletedCount) => {
          if (deletedCount > 0) {
            log.info(`Invalidated ${deletedCount} cache entries for tags: ${tagsToInvalidate.join(', ')}`);
          }
        })
        .catch((error) => {
          log.error('Cache invalidation error:', error);
        });

      // Call original end method
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}

/**
 * Smart cache middleware that automatically determines caching strategy
 */
export function smartCache(options: {
  ttl?: number;
  tags?: string[];
  invalidateOn?: ('POST' | 'PUT' | 'PATCH' | 'DELETE')[];
}) {
  const { ttl = 300, tags = [], invalidateOn = ['POST', 'PUT', 'PATCH', 'DELETE'] } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Apply cache for GET requests
    if (req.method === 'GET') {
      return cacheResponse({ ttl, tags })(req, res, next);
    }

    // Apply cache invalidation for modifying requests
    if (invalidateOn.includes(req.method as any)) {
      return invalidateCache(tags)(req, res, next);
    }

    next();
  };
}

/**
 * Cache statistics middleware
 */
export function cacheStats() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/cache/stats' && req.method === 'GET') {
      try {
        const stats = cache.getStats ? cache.getStats() : await (cache as any).getStats();
        res.json({
          ...stats,
          timestamp: new Date().toISOString(),
          cacheType: cache.constructor.name
        });
        return;
      } catch (error) {
        log.error('Cache stats error:', error);
        res.status(500).json({ error: 'Failed to get cache stats' });
        return;
      }
    }
    next();
  };
}

/**
 * Cache management middleware
 */
export function cacheManagement() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { path, method } = req;

    // Clear all cache
    if (path === '/api/cache/clear' && method === 'POST') {
      try {
        await cache.clear();
        log.info('Cache cleared via API');
        res.json({ success: true, message: 'Cache cleared successfully' });
        return;
      } catch (error) {
        log.error('Cache clear error:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
        return;
      }
    }

    // Invalidate by tags
    if (path === '/api/cache/invalidate' && method === 'POST') {
      try {
        const { tags } = req.body;
        if (!tags || !Array.isArray(tags)) {
          res.status(400).json({ error: 'Tags array is required' });
          return;
        }

        const deletedCount = await cache.invalidateByTags(tags);
        log.info(`Cache invalidated ${deletedCount} entries for tags: ${tags.join(', ')}`);
        res.json({ 
          success: true, 
          message: `Invalidated ${deletedCount} cache entries`,
          deletedCount 
        });
        return;
      } catch (error) {
        log.error('Cache invalidate error:', error);
        res.status(500).json({ error: 'Failed to invalidate cache' });
        return;
      }
    }

    next();
  };
}