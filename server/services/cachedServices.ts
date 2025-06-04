import { cache } from '../utils/cacheManager';
import { log } from '../utils/logger';
import { DatabaseStorage } from '../storage.postgresql';

/**
 * Cached service layer for frequently accessed data
 */
export class CachedServices {
  private storage: DatabaseStorage;

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
  }

  /**
   * Get application settings with caching
   */
  async getApplicationSettings(): Promise<any> {
    const cacheKey = 'app:settings:all';
    
    try {
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        log.debug('Application settings served from cache');
        return cached;
      }

      // Fetch from database
      log.debug('Fetching application settings from database');
      const [emailSettings, companySettings, notificationSettings] = await Promise.all([
        this.storage.getEmailSettings(),
        this.storage.getCompanySettings(),
        this.storage.getNotificationSettings()
      ]);

      const settings = {
        email: emailSettings,
        company: companySettings,
        notifications: notificationSettings,
        timestamp: new Date().toISOString()
      };

      // Cache for 10 minutes with settings tag
      await cache.set(cacheKey, settings, 600, ['settings', 'app-config']);
      
      return settings;
    } catch (error) {
      log.error('Error getting application settings:', error);
      throw error;
    }
  }

  /**
   * Get product categories with caching
   */
  async getProductCategories(): Promise<any[]> {
    const cacheKey = 'products:categories:all';
    
    try {
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        log.debug('Product categories served from cache');
        return cached;
      }

      // Fetch from database
      log.debug('Fetching product categories from database');
      const categories = await this.storage.getCategories();

      // Cache for 30 minutes with categories tag
      await cache.set(cacheKey, categories, 1800, ['categories', 'products']);
      
      return categories;
    } catch (error) {
      log.error('Error getting product categories:', error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics with short-term caching
   */
  async getDashboardStats(): Promise<any> {
    const cacheKey = 'dashboard:stats:current';
    
    try {
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        log.debug('Dashboard stats served from cache');
        return cached;
      }

      // Fetch from database
      log.debug('Fetching dashboard stats from database');
      const stats = await this.storage.getDashboardStats();

      // Cache for 2 minutes with dashboard tag (frequently changing data)
      await cache.set(cacheKey, stats, 120, ['dashboard', 'stats']);
      
      return stats;
    } catch (error) {
      log.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get low stock products with caching
   */
  async getLowStockProducts(): Promise<any[]> {
    const cacheKey = 'products:low-stock:current';
    
    try {
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        log.debug('Low stock products served from cache');
        return cached;
      }

      // Fetch from database
      log.debug('Fetching low stock products from database');
      const products = await this.storage.getLowStockProducts();

      // Cache for 5 minutes with inventory tag
      await cache.set(cacheKey, products, 300, ['inventory', 'products', 'low-stock']);
      
      return products;
    } catch (error) {
      log.error('Error getting low stock products:', error);
      throw error;
    }
  }

  /**
   * Get user permissions with caching
   */
  async getUserPermissions(userId: number): Promise<any[]> {
    const cacheKey = `user:${userId}:permissions`;
    
    try {
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        log.debug(`User permissions for ${userId} served from cache`);
        return cached;
      }

      // Fetch from database
      log.debug(`Fetching user permissions for ${userId} from database`);
      const permissions = await this.storage.getUserPermissions(userId);

      // Cache for 15 minutes with user-specific tag
      await cache.set(cacheKey, permissions, 900, ['permissions', `user:${userId}`]);
      
      return permissions;
    } catch (error) {
      log.error(`Error getting user permissions for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get recent orders with caching
   */
  async getRecentOrders(limit: number = 10): Promise<any[]> {
    const cacheKey = `orders:recent:${limit}`;
    
    try {
      // Try cache first
      const cached = await cache.get(cacheKey);
      if (cached) {
        log.debug('Recent orders served from cache');
        return cached;
      }

      // Fetch from database
      log.debug('Fetching recent orders from database');
      const orders = await this.storage.getRecentOrders(limit);

      // Cache for 3 minutes with orders tag (moderately changing data)
      await cache.set(cacheKey, orders, 180, ['orders', 'recent']);
      
      return orders;
    } catch (error) {
      log.error('Error getting recent orders:', error);
      throw error;
    }
  }

  /**
   * Invalidate cache when data changes
   */
  async invalidateSettingsCache(): Promise<void> {
    try {
      await cache.invalidateByTags(['settings', 'app-config']);
      log.info('Settings cache invalidated');
    } catch (error) {
      log.error('Error invalidating settings cache:', error);
    }
  }

  async invalidateProductsCache(): Promise<void> {
    try {
      await cache.invalidateByTags(['products', 'categories', 'inventory']);
      log.info('Products cache invalidated');
    } catch (error) {
      log.error('Error invalidating products cache:', error);
    }
  }

  async invalidateOrdersCache(): Promise<void> {
    try {
      await cache.invalidateByTags(['orders', 'dashboard', 'stats']);
      log.info('Orders cache invalidated');
    } catch (error) {
      log.error('Error invalidating orders cache:', error);
    }
  }

  async invalidateUserCache(userId: number): Promise<void> {
    try {
      await cache.invalidateByTags([`user:${userId}`, 'permissions']);
      log.info(`User ${userId} cache invalidated`);
    } catch (error) {
      log.error(`Error invalidating user ${userId} cache:`, error);
    }
  }

  /**
   * Warm frequently accessed cache entries
   */
  async warmCache(): Promise<void> {
    try {
      log.info('Warming cache with frequently accessed data');
      
      // Warm cache in parallel
      await Promise.all([
        this.getApplicationSettings(),
        this.getProductCategories(),
        this.getDashboardStats(),
        this.getLowStockProducts(),
        this.getRecentOrders()
      ]);
      
      log.info('Cache warming completed');
    } catch (error) {
      log.error('Cache warming failed:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    try {
      const stats = cache.getStats ? cache.getStats() : await (cache as any).getStats();
      return {
        ...stats,
        cacheType: cache.constructor.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log.error('Error getting cache stats:', error);
      throw error;
    }
  }
}