import { eq, sql, desc, asc, and, or, inArray } from 'drizzle-orm';
import { db } from '../storage.postgresql';
import { orders, orderItems, products, customers, categories, users, shippingDocuments } from '@shared/schema';
import log from '../utils/logger';

/**
 * Efficient Drizzle ORM queries to prevent N+1 query problems
 * This service provides optimized query patterns for fetching related data
 */

export interface OrderWithDetails {
  id: number;
  orderNumber: string;
  customerName: string;
  orderDate: Date;
  status: string;
  priority?: string;
  area?: string;
  notes?: string;
  estimatedShippingDate?: Date;
  actualShippingDate?: Date;
  createdById: number;
  createdBy?: {
    id: number;
    username: string;
    fullName: string;
  };
  orderItems: Array<{
    id: number;
    quantity: number;
    shipped_quantity: number;
    shipping_status: string;
    hasQualityIssues: boolean;
    product: {
      id: number;
      name: string;
      sku: string;
      barcode?: string;
      currentStock: number;
      minStockLevel: number;
      location?: string;
      category: {
        id: number;
        name: string;
        description?: string;
      };
    };
  }>;
  shippingDocument?: {
    id: number;
    documentType: string;
    trackingNumber?: string;
    documentPath: string;
  };
}

export class EfficientQueryService {
  /**
   * Fetch orders with all related data using optimal queries
   * Prevents N+1 problems by using joins and subqueries
   */
  async getOrdersWithDetails(options: {
    limit?: number;
    offset?: number;
    status?: string;
    customerName?: string;
    orderBy?: 'date' | 'priority' | 'status';
    orderDirection?: 'asc' | 'desc';
  } = {}): Promise<OrderWithDetails[]> {
    const {
      limit = 50,
      offset = 0,
      status,
      customerName,
      orderBy = 'date',
      orderDirection = 'desc'
    } = options;

    try {
      // Step 1: Fetch orders with creator information using single join
      let orderQuery = db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          customerName: orders.customerName,
          orderDate: orders.orderDate,
          status: orders.status,
          priority: orders.priority,
          area: orders.area,
          notes: orders.notes,
          estimatedShippingDate: orders.estimatedShippingDate,
          actualShippingDate: orders.actualShippingDate,
          createdById: orders.createdById,
          hasShippingDocument: orders.hasShippingDocument,
          createdBy: {
            id: users.id,
            username: users.username,
            fullName: users.fullName,
          }
        })
        .from(orders)
        .leftJoin(users, eq(orders.createdById, users.id));

      // Apply filters
      const conditions = [];
      if (status) {
        conditions.push(eq(orders.status, status as any));
      }
      if (customerName) {
        conditions.push(sql`${orders.customerName} ILIKE ${`%${customerName}%`}`);
      }

      if (conditions.length > 0) {
        orderQuery = orderQuery.where(and(...conditions));
      }

      // Apply ordering
      const orderColumn = orderBy === 'date' ? orders.orderDate 
                        : orderBy === 'priority' ? orders.priority 
                        : orders.status;
      
      orderQuery = orderQuery.orderBy(
        orderDirection === 'asc' ? asc(orderColumn) : desc(orderColumn)
      );

      // Apply pagination
      const ordersResult = await orderQuery.limit(limit).offset(offset);

      if (ordersResult.length === 0) {
        return [];
      }

      // Extract order IDs for related queries
      const orderIds = ordersResult.map(order => order.id);

      // Step 2: Fetch all order items with products and categories in single query
      const orderItemsWithProducts = await db
        .select({
          orderItemId: orderItems.id,
          orderId: orderItems.orderId,
          quantity: orderItems.quantity,
          shipped_quantity: orderItems.shipped_quantity,
          shipping_status: orderItems.shipping_status,
          hasQualityIssues: orderItems.hasQualityIssues,
          productId: products.id,
          productName: products.name,
          productSku: products.sku,
          productBarcode: products.barcode,
          productCurrentStock: products.currentStock,
          productMinStockLevel: products.minStockLevel,
          productLocation: products.location,
          categoryId: categories.id,
          categoryName: categories.name,
          categoryDescription: categories.description,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(inArray(orderItems.orderId, orderIds));

      // Step 3: Fetch shipping documents for orders (if any)
      const shippingDocsResult = await db
        .select({
          orderId: shippingDocuments.orderId,
          id: shippingDocuments.id,
          documentType: shippingDocuments.documentType,
          trackingNumber: shippingDocuments.trackingNumber,
          documentPath: shippingDocuments.documentPath,
        })
        .from(shippingDocuments)
        .where(inArray(shippingDocuments.orderId, orderIds));

      // Step 4: Combine results efficiently
      const ordersWithDetails: OrderWithDetails[] = ordersResult.map(order => {
        // Find order items for this order
        const orderItemsForOrder = orderItemsWithProducts
          .filter(item => item.orderId === order.id)
          .map(item => ({
            id: item.orderItemId,
            quantity: item.quantity,
            shipped_quantity: item.shipped_quantity || 0,
            shipping_status: item.shipping_status || 'pending',
            hasQualityIssues: item.hasQualityIssues || false,
            product: {
              id: item.productId,
              name: item.productName,
              sku: item.productSku,
              barcode: item.productBarcode,
              currentStock: item.productCurrentStock,
              minStockLevel: item.productMinStockLevel,
              location: item.productLocation,
              category: {
                id: item.categoryId,
                name: item.categoryName,
                description: item.categoryDescription,
              }
            }
          }));

        // Find shipping document for this order
        const shippingDoc = shippingDocsResult.find(doc => doc.orderId === order.id);

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          orderDate: order.orderDate,
          status: order.status,
          priority: order.priority,
          area: order.area,
          notes: order.notes,
          estimatedShippingDate: order.estimatedShippingDate,
          actualShippingDate: order.actualShippingDate,
          createdById: order.createdById,
          createdBy: order.createdBy.id ? {
            id: order.createdBy.id,
            username: order.createdBy.username,
            fullName: order.createdBy.fullName,
          } : undefined,
          orderItems: orderItemsForOrder,
          shippingDocument: shippingDoc ? {
            id: shippingDoc.id,
            documentType: shippingDoc.documentType,
            trackingNumber: shippingDoc.trackingNumber,
            documentPath: shippingDoc.documentPath,
          } : undefined,
        };
      });

      log.info(`Efficiently fetched ${ordersWithDetails.length} orders with details using 3 queries instead of ${ordersWithDetails.length * 3 + 1} queries`);
      
      return ordersWithDetails;

    } catch (error) {
      log.error('Error fetching orders with details:', error);
      throw new Error('Failed to fetch orders with details');
    }
  }

  /**
   * Fetch single order with all related data efficiently
   */
  async getOrderWithDetails(orderId: number): Promise<OrderWithDetails | null> {
    try {
      // Use the same efficient pattern for single order
      const result = await this.getOrdersWithDetails({
        limit: 1,
        offset: 0
      });

      const order = result.find(o => o.id === orderId);
      return order || null;

    } catch (error) {
      log.error(`Error fetching order ${orderId} with details:`, error);
      throw new Error('Failed to fetch order with details');
    }
  }

  /**
   * Fetch products with categories efficiently
   * Useful for product listings with category information
   */
  async getProductsWithCategories(options: {
    limit?: number;
    offset?: number;
    categoryId?: number;
    lowStock?: boolean;
  } = {}) {
    const { limit = 50, offset = 0, categoryId, lowStock } = options;

    try {
      let query = db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          barcode: products.barcode,
          currentStock: products.currentStock,
          minStockLevel: products.minStockLevel,
          location: products.location,
          imagePath: products.imagePath,
          category: {
            id: categories.id,
            name: categories.name,
            description: categories.description,
            color: categories.color,
          }
        })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id));

      // Apply filters
      const conditions = [];
      if (categoryId) {
        conditions.push(eq(products.categoryId, categoryId));
      }
      if (lowStock) {
        conditions.push(sql`${products.currentStock} <= ${products.minStockLevel}`);
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const result = await query
        .orderBy(asc(products.name))
        .limit(limit)
        .offset(offset);

      log.info(`Fetched ${result.length} products with categories using single JOIN query`);
      return result;

    } catch (error) {
      log.error('Error fetching products with categories:', error);
      throw new Error('Failed to fetch products with categories');
    }
  }

  /**
   * Fetch customer order history efficiently
   * Prevents N+1 when showing customer's order list
   */
  async getCustomerOrderHistory(customerName: string, limit: number = 20) {
    try {
      // Single query to get orders with item counts and total quantities
      const result = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          orderDate: orders.orderDate,
          status: orders.status,
          priority: orders.priority,
          estimatedShippingDate: orders.estimatedShippingDate,
          actualShippingDate: orders.actualShippingDate,
          itemCount: sql<number>`COUNT(DISTINCT ${orderItems.id})`.as('item_count'),
          totalQuantity: sql<number>`SUM(${orderItems.quantity})`.as('total_quantity'),
        })
        .from(orders)
        .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
        .where(eq(orders.customerName, customerName))
        .groupBy(orders.id)
        .orderBy(desc(orders.orderDate))
        .limit(limit);

      log.info(`Fetched order history for customer ${customerName} using single aggregated query`);
      return result;

    } catch (error) {
      log.error(`Error fetching customer order history for ${customerName}:`, error);
      throw new Error('Failed to fetch customer order history');
    }
  }

  /**
   * Get inventory summary with category grouping
   * Efficient aggregation query for dashboard
   */
  async getInventorySummaryByCategory() {
    try {
      const result = await db
        .select({
          categoryId: categories.id,
          categoryName: categories.name,
          totalProducts: sql<number>`COUNT(${products.id})`.as('total_products'),
          totalStock: sql<number>`SUM(${products.currentStock})`.as('total_stock'),
          lowStockProducts: sql<number>`COUNT(CASE WHEN ${products.currentStock} <= ${products.minStockLevel} THEN 1 END)`.as('low_stock_products'),
          averageStock: sql<number>`AVG(${products.currentStock})`.as('average_stock'),
        })
        .from(categories)
        .leftJoin(products, eq(categories.id, products.categoryId))
        .groupBy(categories.id, categories.name)
        .orderBy(asc(categories.name));

      log.info('Fetched inventory summary by category using single aggregated query');
      return result;

    } catch (error) {
      log.error('Error fetching inventory summary by category:', error);
      throw new Error('Failed to fetch inventory summary');
    }
  }

  /**
   * Get order fulfillment statistics
   * Efficient query for order processing metrics
   */
  async getOrderFulfillmentStats(days: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await db
        .select({
          status: orders.status,
          orderCount: sql<number>`COUNT(*)`.as('order_count'),
          totalItems: sql<number>`SUM(COALESCE(item_counts.item_count, 0))`.as('total_items'),
          avgItemsPerOrder: sql<number>`AVG(COALESCE(item_counts.item_count, 0))`.as('avg_items_per_order'),
        })
        .from(orders)
        .leftJoin(
          db.select({
            orderId: orderItems.orderId,
            itemCount: sql<number>`COUNT(*)`.as('item_count')
          })
          .from(orderItems)
          .groupBy(orderItems.orderId)
          .as('item_counts'),
          eq(orders.id, sql`item_counts.order_id`)
        )
        .where(sql`${orders.orderDate} >= ${cutoffDate}`)
        .groupBy(orders.status);

      log.info(`Fetched order fulfillment stats for last ${days} days using single query with subquery`);
      return result;

    } catch (error) {
      log.error('Error fetching order fulfillment stats:', error);
      throw new Error('Failed to fetch order fulfillment statistics');
    }
  }

  /**
   * Get products frequently ordered together
   * Useful for recommendation systems
   */
  async getFrequentlyOrderedTogether(productId: number, limit: number = 5) {
    try {
      const result = await db
        .select({
          productId: sql<number>`other_items.product_id`.as('product_id'),
          productName: products.name,
          productSku: products.sku,
          coOccurrenceCount: sql<number>`COUNT(*)`.as('co_occurrence_count'),
        })
        .from(orderItems)
        .innerJoin(
          orderItems.as('other_items'),
          and(
            eq(orderItems.orderId, sql`other_items.order_id`),
            sql`other_items.product_id != ${productId}`
          )
        )
        .innerJoin(products, eq(sql`other_items.product_id`, products.id))
        .where(eq(orderItems.productId, productId))
        .groupBy(sql`other_items.product_id`, products.name, products.sku)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(limit);

      log.info(`Found products frequently ordered with product ${productId} using single complex query`);
      return result;

    } catch (error) {
      log.error(`Error fetching frequently ordered together for product ${productId}:`, error);
      throw new Error('Failed to fetch frequently ordered products');
    }
  }
}

// Export singleton instance
export const efficientQueries = new EfficientQueryService();