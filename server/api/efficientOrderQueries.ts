import { Request, Response } from 'express';
import { eq, desc, asc, and, inArray, sql } from 'drizzle-orm';
import { storage } from '../storage';
import { orders, orderItems, products, categories, users } from '@shared/schema';
import log from '../utils/logger';

/**
 * Efficient order queries to prevent N+1 problems
 * Working implementation using your existing storage patterns
 */

export interface EfficientOrderDetails {
  order: {
    id: number;
    orderNumber: string;
    customerName: string;
    orderDate: Date;
    status: string;
    priority?: string;
    createdBy?: {
      id: number;
      fullName: string;
    };
  };
  items: Array<{
    id: number;
    quantity: number;
    product: {
      id: number;
      name: string;
      sku: string;
      category: string;
    };
  }>;
  performanceInfo: {
    queryCount: number;
    executionTime: number;
  };
}

/**
 * Efficient orders listing - prevents N+1 by using strategic queries
 */
export async function getEfficientOrdersList(req: Request, res: Response) {
  const startTime = Date.now();
  let queryCount = 0;

  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;

    // Step 1: Get orders efficiently (1 query)
    queryCount++;
    const ordersQuery = storage.db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerName: orders.customerName,
        orderDate: orders.orderDate,
        status: orders.status,
        priority: orders.priority,
        createdById: orders.createdById,
      })
      .from(orders);

    // Apply status filter if provided
    const ordersResult = status 
      ? await ordersQuery.where(eq(orders.status, status as any)).limit(limit)
      : await ordersQuery.limit(limit);

    if (ordersResult.length === 0) {
      return res.json({
        orders: [],
        performance: {
          queryCount,
          executionTime: Date.now() - startTime,
          optimization: 'No orders found'
        }
      });
    }

    // Step 2: Batch load order items for all orders (1 query)
    queryCount++;
    const orderIds = ordersResult.map(order => order.id);
    const orderItemsResult = await storage.db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        quantity: orderItems.quantity,
      })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));

    // Step 3: Batch load products for all items (1 query)
    queryCount++;
    const productIds = [...new Set(orderItemsResult.map(item => item.productId))];
    const productsResult = productIds.length > 0 
      ? await storage.db
          .select({
            id: products.id,
            name: products.name,
            sku: products.sku,
            categoryId: products.categoryId,
          })
          .from(products)
          .where(inArray(products.id, productIds))
      : [];

    // Step 4: Batch load categories (1 query)
    queryCount++;
    const categoryIds = [...new Set(productsResult.map(product => product.categoryId))];
    const categoriesResult = categoryIds.length > 0
      ? await storage.db
          .select({
            id: categories.id,
            name: categories.name,
          })
          .from(categories)
          .where(inArray(categories.id, categoryIds))
      : [];

    // Step 5: Get user details for order creators (1 query)
    queryCount++;
    const userIds = [...new Set(ordersResult.map(order => order.createdById))];
    const usersResult = await storage.db
      .select({
        id: users.id,
        fullName: users.fullName,
      })
      .from(users)
      .where(inArray(users.id, userIds));

    // Combine results efficiently
    const categoryMap = new Map(categoriesResult.map(cat => [cat.id, cat.name]));
    const productMap = new Map(productsResult.map(prod => ({
      ...prod,
      categoryName: categoryMap.get(prod.categoryId) || 'Unknown'
    })).map(prod => [prod.id, prod]));
    const userMap = new Map(usersResult.map(user => [user.id, user]));

    const efficientOrders = ordersResult.map(order => {
      const orderItemsForOrder = orderItemsResult
        .filter(item => item.orderId === order.id)
        .map(item => {
          const product = productMap.get(item.productId);
          return {
            id: item.id,
            quantity: item.quantity,
            product: {
              id: item.productId,
              name: product?.name || 'Unknown Product',
              sku: product?.sku || 'N/A',
              category: product?.categoryName || 'Unknown Category',
            }
          };
        });

      const creator = userMap.get(order.createdById);

      return {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          orderDate: order.orderDate,
          status: order.status,
          priority: order.priority || undefined,
          createdBy: creator ? {
            id: creator.id,
            fullName: creator.fullName,
          } : undefined,
        },
        items: orderItemsForOrder,
        itemCount: orderItemsForOrder.length,
        totalQuantity: orderItemsForOrder.reduce((sum, item) => sum + item.quantity, 0),
      };
    });

    const executionTime = Date.now() - startTime;

    log.info(`Efficient orders query: ${ordersResult.length} orders with ${orderItemsResult.length} items in ${executionTime}ms using ${queryCount} queries`);

    res.json({
      orders: efficientOrders,
      performance: {
        queryCount,
        executionTime,
        optimization: `Prevented N+1 problem: ${queryCount} queries instead of ${1 + ordersResult.length * 3}+`
      }
    });

  } catch (error) {
    log.error('Error in efficient orders query:', error);
    res.status(500).json({ error: 'Failed to fetch orders efficiently' });
  }
}

/**
 * Efficient single order with full details
 */
export async function getEfficientOrderDetails(req: Request, res: Response) {
  const startTime = Date.now();
  let queryCount = 0;

  try {
    const orderId = parseInt(req.params.id);

    if (!orderId) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    // Step 1: Get order with creator in single query (1 query)
    queryCount++;
    const orderResult = await storage.db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerName: orders.customerName,
        orderDate: orders.orderDate,
        status: orders.status,
        priority: orders.priority,
        notes: orders.notes,
        createdById: orders.createdById,
        creatorName: users.fullName,
        creatorUsername: users.username,
      })
      .from(orders)
      .leftJoin(users, eq(orders.createdById, users.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderResult.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult[0];

    // Step 2: Get order items with products and categories in single query (1 query)
    queryCount++;
    const orderItemsWithDetails = await storage.db
      .select({
        itemId: orderItems.id,
        quantity: orderItems.quantity,
        shipped_quantity: orderItems.shipped_quantity,
        productId: products.id,
        productName: products.name,
        productSku: products.sku,
        currentStock: products.currentStock,
        categoryId: categories.id,
        categoryName: categories.name,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(orderItems.orderId, orderId));

    const executionTime = Date.now() - startTime;

    const result = {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        orderDate: order.orderDate,
        status: order.status,
        priority: order.priority,
        notes: order.notes,
        createdBy: order.creatorName ? {
          id: order.createdById,
          fullName: order.creatorName,
          username: order.creatorUsername,
        } : null,
      },
      items: orderItemsWithDetails.map(item => ({
        id: item.itemId,
        quantity: item.quantity,
        shipped_quantity: item.shipped_quantity || 0,
        product: {
          id: item.productId,
          name: item.productName,
          sku: item.productSku,
          currentStock: item.currentStock,
          category: {
            id: item.categoryId,
            name: item.categoryName,
          }
        }
      })),
      performance: {
        queryCount,
        executionTime,
        optimization: `${queryCount} queries instead of ${1 + orderItemsWithDetails.length * 2}+`
      }
    };

    log.info(`Efficient single order query: Order ${orderId} with ${orderItemsWithDetails.length} items in ${executionTime}ms using ${queryCount} queries`);

    res.json(result);

  } catch (error) {
    log.error('Error in efficient single order query:', error);
    res.status(500).json({ error: 'Failed to fetch order details efficiently' });
  }
}

/**
 * Efficient customer order history with aggregated data
 */
export async function getEfficientCustomerHistory(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    const customerName = decodeURIComponent(req.params.customerName);
    const limit = parseInt(req.query.limit as string) || 20;

    // Single aggregated query for customer order history (1 query)
    const customerHistory = await storage.db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        orderDate: orders.orderDate,
        status: orders.status,
        itemCount: sql<number>`COUNT(DISTINCT ${orderItems.id})`.as('item_count'),
        totalQuantity: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`.as('total_quantity'),
      })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .where(eq(orders.customerName, customerName))
      .groupBy(orders.id, orders.orderNumber, orders.orderDate, orders.status)
      .orderBy(desc(orders.orderDate))
      .limit(limit);

    const executionTime = Date.now() - startTime;

    log.info(`Customer history query: ${customerHistory.length} orders for ${customerName} in ${executionTime}ms using 1 query`);

    res.json({
      customerName,
      orders: customerHistory,
      performance: {
        queryCount: 1,
        executionTime,
        optimization: 'Single aggregated query with grouping instead of multiple queries'
      }
    });

  } catch (error) {
    log.error('Error in efficient customer history query:', error);
    res.status(500).json({ error: 'Failed to fetch customer history efficiently' });
  }
}

/**
 * Efficient inventory summary by category
 */
export async function getEfficientInventorySummary(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    // Single aggregated query for inventory summary (1 query)
    const inventorySummary = await storage.db
      .select({
        categoryId: categories.id,
        categoryName: categories.name,
        totalProducts: sql<number>`COUNT(${products.id})`.as('total_products'),
        totalStock: sql<number>`COALESCE(SUM(${products.currentStock}), 0)`.as('total_stock'),
        lowStockProducts: sql<number>`COUNT(CASE WHEN ${products.currentStock} <= ${products.minStockLevel} THEN 1 END)`.as('low_stock_products'),
        averageStock: sql<number>`COALESCE(AVG(${products.currentStock}), 0)`.as('average_stock'),
      })
      .from(categories)
      .leftJoin(products, eq(categories.id, products.categoryId))
      .groupBy(categories.id, categories.name)
      .orderBy(asc(categories.name));

    const executionTime = Date.now() - startTime;

    log.info(`Inventory summary query: ${inventorySummary.length} categories in ${executionTime}ms using 1 query`);

    res.json({
      summary: inventorySummary,
      performance: {
        queryCount: 1,
        executionTime,
        optimization: 'Single aggregated query for all category statistics'
      }
    });

  } catch (error) {
    log.error('Error in efficient inventory summary query:', error);
    res.status(500).json({ error: 'Failed to fetch inventory summary efficiently' });
  }
}