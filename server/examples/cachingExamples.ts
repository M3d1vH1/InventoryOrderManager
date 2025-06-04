import { Express, Request, Response } from 'express';
import { cacheResponse, invalidateCache, smartCache, cacheStats, cacheManagement } from '../middleware/cacheMiddleware';
import { CachedServices } from '../services/cachedServices';
import { DatabaseStorage } from '../storage.postgresql';
import log from '../utils/logger';

/**
 * Comprehensive Caching Implementation Examples
 * This demonstrates practical caching strategies for warehouse management API endpoints
 */

export function setupCachingExamples(app: Express, storage: DatabaseStorage) {
  const cachedServices = new CachedServices(storage);

  // Global cache middleware for statistics and management
  app.use(cacheStats());
  app.use(cacheManagement());

  /**
   * Example 1: Simple Response Caching for Application Settings
   * Cache duration: 10 minutes (600 seconds)
   * Use case: Settings rarely change, safe to cache longer
   */
  app.get('/api/settings/cached', 
    cacheResponse({ 
      ttl: 600, // 10 minutes
      tags: ['settings', 'app-config'] 
    }),
    async (req: Request, res: Response) => {
      try {
        log.info('Fetching application settings (with caching)');
        const settings = await cachedServices.getApplicationSettings();
        res.json(settings);
      } catch (error) {
        log.error('Error fetching cached settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
      }
    }
  );

  /**
   * Example 2: Product Categories with Smart Caching
   * Cache duration: 30 minutes for GET, invalidate on POST/PUT/DELETE
   * Use case: Categories change infrequently, but need immediate updates
   */
  app.use('/api/categories/cached', 
    smartCache({ 
      ttl: 1800, // 30 minutes
      tags: ['categories', 'products'],
      invalidateOn: ['POST', 'PUT', 'PATCH', 'DELETE']
    })
  );

  app.get('/api/categories/cached', async (req: Request, res: Response) => {
    try {
      log.info('Fetching product categories (with smart caching)');
      const categories = await cachedServices.getProductCategories();
      res.json(categories);
    } catch (error) {
      log.error('Error fetching cached categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  /**
   * Example 3: Dashboard Statistics with Short-Term Caching
   * Cache duration: 2 minutes (120 seconds)
   * Use case: Frequently changing data that benefits from brief caching
   */
  app.get('/api/dashboard/stats/cached',
    cacheResponse({ 
      ttl: 120, // 2 minutes
      tags: ['dashboard', 'stats'] 
    }),
    async (req: Request, res: Response) => {
      try {
        log.info('Fetching dashboard stats (with short-term caching)');
        const stats = await cachedServices.getDashboardStats();
        res.json(stats);
      } catch (error) {
        log.error('Error fetching cached dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
      }
    }
  );

  /**
   * Example 4: Low Stock Products with Conditional Caching
   * Cache duration: 5 minutes, skip cache for admin users
   * Use case: Critical inventory data with role-based cache control
   */
  app.get('/api/inventory/low-stock/cached',
    cacheResponse({ 
      ttl: 300, // 5 minutes
      tags: ['inventory', 'products', 'low-stock'],
      skipCache: (req: Request) => {
        // Skip cache for admin users to get real-time data
        const user = req.user as any;
        return user?.role === 'admin';
      }
    }),
    async (req: Request, res: Response) => {
      try {
        log.info('Fetching low stock products (with conditional caching)');
        const products = await cachedServices.getLowStockProducts();
        res.json(products);
      } catch (error) {
        log.error('Error fetching cached low stock products:', error);
        res.status(500).json({ error: 'Failed to fetch low stock products' });
      }
    }
  );

  /**
   * Example 5: User-Specific Caching for Permissions
   * Cache duration: 15 minutes, user-specific cache keys
   * Use case: User permissions that vary by user but don't change frequently
   */
  app.get('/api/user/permissions/cached',
    cacheResponse({ 
      ttl: 900, // 15 minutes
      tags: ['permissions'],
      keyGenerator: (req: Request) => {
        const user = req.user as any;
        return `permissions:user:${user?.id || 'anonymous'}`;
      }
    }),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        if (!user?.id) {
          return res.status(401).json({ error: 'User not authenticated' });
        }

        log.info(`Fetching user permissions for ${user.id} (with user-specific caching)`);
        const permissions = await cachedServices.getUserPermissions(user.id);
        res.json(permissions);
      } catch (error) {
        log.error('Error fetching cached user permissions:', error);
        res.status(500).json({ error: 'Failed to fetch user permissions' });
      }
    }
  );

  /**
   * Example 6: Recent Orders with Pagination Caching
   * Cache duration: 3 minutes, varies by limit parameter
   * Use case: Recent orders list with different pagination requirements
   */
  app.get('/api/orders/recent/cached',
    cacheResponse({ 
      ttl: 180, // 3 minutes
      tags: ['orders', 'recent'],
      keyGenerator: (req: Request) => {
        const limit = req.query.limit || '10';
        const user = req.user as any;
        return `orders:recent:${limit}:user:${user?.id || 'anonymous'}`;
      }
    }),
    async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        log.info(`Fetching recent orders (limit: ${limit}) with caching`);
        const orders = await cachedServices.getRecentOrders(limit);
        res.json(orders);
      } catch (error) {
        log.error('Error fetching cached recent orders:', error);
        res.status(500).json({ error: 'Failed to fetch recent orders' });
      }
    }
  );

  /**
   * Example 7: Cache Invalidation on Data Updates
   * Demonstrates how to invalidate specific cache tags when data changes
   */
  app.post('/api/products/cached',
    invalidateCache(['products', 'categories', 'inventory']),
    async (req: Request, res: Response) => {
      try {
        log.info('Creating new product (with cache invalidation)');
        // Simulate product creation
        const product = await storage.createProduct(req.body);
        
        // The invalidateCache middleware will automatically clear related cache entries
        res.status(201).json(product);
      } catch (error) {
        log.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
      }
    }
  );

  /**
   * Example 8: Manual Cache Control Endpoints
   * Administrative endpoints for cache management
   */
  app.post('/api/cache/warm', async (req: Request, res: Response) => {
    try {
      log.info('Warming cache with frequently accessed data');
      await cachedServices.warmCache();
      res.json({ success: true, message: 'Cache warmed successfully' });
    } catch (error) {
      log.error('Cache warming error:', error);
      res.status(500).json({ error: 'Failed to warm cache' });
    }
  });

  /**
   * Example 9: Cache Health Check
   * Monitor cache performance and health
   */
  app.get('/api/cache/health', async (req: Request, res: Response) => {
    try {
      const stats = await cachedServices.getCacheStats();
      const health = {
        status: 'healthy',
        cacheStats: stats,
        recommendations: []
      };

      // Add performance recommendations
      if (stats.hitRate < 50) {
        health.recommendations.push('Low cache hit rate - consider increasing TTL values');
      }
      if (stats.keys > 800) {
        health.recommendations.push('High number of cache keys - consider cache cleanup');
      }

      res.json(health);
    } catch (error) {
      log.error('Cache health check error:', error);
      res.status(500).json({ 
        status: 'unhealthy', 
        error: 'Failed to get cache health status' 
      });
    }
  });

  /**
   * Example 10: Event-Based Cache Invalidation
   * Demonstrates how to invalidate cache based on specific business events
   */
  app.post('/api/orders/ship/:id',
    invalidateCache((req: Request) => {
      // Dynamically determine cache tags to invalidate based on the order
      return ['orders', 'recent', 'dashboard', 'stats'];
    }),
    async (req: Request, res: Response) => {
      try {
        const orderId = parseInt(req.params.id);
        log.info(`Shipping order ${orderId} (with event-based cache invalidation)`);
        
        // Update order status to shipped
        const order = await storage.updateOrder(orderId, { status: 'shipped' });
        
        // Cache invalidation happens automatically via middleware
        res.json(order);
      } catch (error) {
        log.error('Error shipping order:', error);
        res.status(500).json({ error: 'Failed to ship order' });
      }
    }
  );

  log.info('Caching examples setup completed - 10 practical caching patterns implemented');
}