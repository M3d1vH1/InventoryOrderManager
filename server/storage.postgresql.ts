import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, like, desc, and, or, lte, gt } from 'drizzle-orm';
import { pool, initDatabase } from './db';
import { 
  users, type User, type InsertUser,
  products, type Product, type InsertProduct,
  orders, type Order, type InsertOrder,
  orderItems, type OrderItem, type InsertOrderItem,
  customers, type Customer, type InsertCustomer,
  shippingDocuments, type ShippingDocument, type InsertShippingDocument,
  categories, type Category, type InsertCategory,
  orderChangelogs, type OrderChangelog, type InsertOrderChangelog
} from "@shared/schema";
import { IStorage } from "./storage";
import { log } from './vite';

export class DatabaseStorage implements IStorage {
  private db;

  constructor(dbInstance: ReturnType<typeof drizzle>) {
    this.db = dbInstance;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db.insert(users).values(insertUser).returning();
    return user;
  }
  
  async updateUserLastLogin(id: number): Promise<User | undefined> {
    const [user] = await this.db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users);
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await this.db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const result = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return result.length > 0;
  }
  
  // Category methods
  async getCategory(id: number): Promise<Category | undefined> {
    const result = await this.db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }
  
  async getCategoryByName(name: string): Promise<Category | undefined> {
    const result = await this.db.select().from(categories).where(eq(categories.name, name));
    return result[0];
  }
  
  async getAllCategories(): Promise<Category[]> {
    return await this.db.select().from(categories);
  }
  
  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    // Ensure color is null instead of undefined
    const categoryData = {
      ...insertCategory,
      color: insertCategory.color || null
    };
    const [category] = await this.db.insert(categories).values(categoryData).returning();
    return category;
  }
  
  async updateCategory(id: number, categoryUpdate: Partial<InsertCategory>): Promise<Category | undefined> {
    // Ensure color is null instead of undefined
    const categoryData = {
      ...categoryUpdate,
      color: categoryUpdate.color || null
    };
    
    const [updatedCategory] = await this.db
      .update(categories)
      .set(categoryData)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }
  
  async deleteCategory(id: number): Promise<boolean> {
    const result = await this.db.delete(categories).where(eq(categories.id, id)).returning();
    return result.length > 0;
  }

  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    const result = await this.db.select().from(products).where(eq(products.id, id));
    return result[0];
  }
  
  async getProductBySku(sku: string): Promise<Product | undefined> {
    const result = await this.db.select().from(products).where(eq(products.sku, sku));
    return result[0];
  }
  
  async getAllProducts(): Promise<Product[]> {
    return await this.db.select().from(products);
  }
  
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await this.db.insert(products).values(insertProduct).returning();
    return product;
  }
  
  async updateProduct(id: number, productUpdate: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updatedProduct] = await this.db
      .update(products)
      .set(productUpdate)
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    const result = await this.db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }
  
  async getLowStockProducts(): Promise<Product[]> {
    return await this.db
      .select()
      .from(products)
      .where(lte(products.currentStock, products.minStockLevel));
  }
  
  async searchProducts(query: string, category?: string, stockStatus?: string): Promise<Product[]> {
    let conditions = [];
    
    // Add search condition if query provided
    if (query) {
      const lowerQuery = `%${query.toLowerCase()}%`;
      conditions.push(
        or(
          like(products.name, lowerQuery),
          like(products.sku, lowerQuery)
        )
      );
    }
    
    // Add category filter if provided
    if (category && category !== 'all') {
      try {
        // Get category ID from categories table
        const categoryResult = await this.db.select().from(categories).where(eq(categories.name, category)).limit(1);
        if (categoryResult.length > 0) {
          conditions.push(eq(products.categoryId, categoryResult[0].id));
        }
      } catch (error) {
        console.error('Error filtering by category:', error);
      }
    }
    
    // Add stock status filter if provided
    if (stockStatus) {
      switch(stockStatus) {
        case 'in-stock':
          conditions.push(gt(products.currentStock, products.minStockLevel));
          break;
        case 'low-stock':
          conditions.push(
            and(
              gt(products.currentStock, 0),
              lte(products.currentStock, products.minStockLevel)
            )
          );
          break;
        case 'out-stock':
          conditions.push(eq(products.currentStock, 0));
          break;
      }
    }
    
    // Execute query with conditions
    if (conditions.length > 0) {
      return await this.db
        .select()
        .from(products)
        .where(and(...conditions));
    } else {
      return await this.getAllProducts();
    }
  }
  
  // Order methods
  async getOrder(id: number): Promise<Order | undefined> {
    const result = await this.db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }
  
  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const result = await this.db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return result[0];
  }
  
  async getAllOrders(): Promise<Order[]> {
    return await this.db.select().from(orders);
  }
  
  async getRecentOrders(limit: number): Promise<Order[]> {
    return await this.db
      .select()
      .from(orders)
      .orderBy(desc(orders.orderDate))
      .limit(limit);
  }
  
  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    // Generate order number format: ORD-XXXX
    const allOrders = await this.getAllOrders();
    const nextId = allOrders.length > 0 ? Math.max(...allOrders.map(o => o.id)) + 1 : 1;
    const orderNumber = `ORD-${String(nextId).padStart(4, '0')}`;
    
    const [order] = await this.db
      .insert(orders)
      .values({
        ...insertOrder,
        orderNumber,
        orderDate: insertOrder.orderDate || new Date()
      })
      .returning();
    
    // Add changelog entry
    await this.addOrderChangelog({
      orderId: order.id,
      userId: insertOrder.createdById,
      action: 'create',
      changes: { ...order },
      previousValues: {},
      notes: "Order created"
    });
    
    return order;
  }
  
  // Shipping Document methods
  async getShippingDocument(orderId: number): Promise<ShippingDocument | undefined> {
    const result = await this.db
      .select()
      .from(shippingDocuments)
      .where(eq(shippingDocuments.orderId, orderId));
    
    return result[0];
  }
  
  async addShippingDocument(document: InsertShippingDocument): Promise<ShippingDocument> {
    // Insert the document - make sure we're consistent with schema by using undefined for optional notes
    const documentToInsert = {
      ...document,
      notes: document.notes ?? undefined
    };
    
    const [shippingDocument] = await this.db
      .insert(shippingDocuments)
      .values(documentToInsert)
      .returning();
    
    // Update the order to indicate it has a shipping document
    await this.db
      .update(orders)
      .set({ hasShippingDocument: true })
      .where(eq(orders.id, document.orderId));
    
    return shippingDocument;
  }
  
  async updateShippingDocument(id: number, document: Partial<InsertShippingDocument>): Promise<ShippingDocument | undefined> {
    const [updatedDocument] = await this.db
      .update(shippingDocuments)
      .set(document)
      .where(eq(shippingDocuments.id, id))
      .returning();
    
    return updatedDocument;
  }

  async updateOrderStatus(
    id: number, 
    status: 'pending' | 'picked' | 'shipped' | 'cancelled',
    documentInfo?: {documentPath: string, documentType: string, notes?: string},
    updatedById?: number
  ): Promise<Order | undefined> {
    // Get the existing order first to track what's changing
    const existingOrder = await this.getOrder(id);
    if (!existingOrder) return undefined;
    
    // Track the previous values
    const previousValues = { ...existingOrder };
    
    // If status is 'shipped' and document info is provided, add shipping document
    if (status === 'shipped' && documentInfo) {
      await this.addShippingDocument({
        orderId: id,
        documentPath: documentInfo.documentPath,
        documentType: documentInfo.documentType,
        notes: documentInfo.notes || undefined
      });
    }
    
    // Update the status and lastUpdated
    const now = new Date();
    const [updatedOrder] = await this.db
      .update(orders)
      .set({ 
        status,
        lastUpdated: now 
      })
      .where(eq(orders.id, id))
      .returning();
    
    // Add changelog entry if we have a user ID
    if (updatedById) {
      await this.addOrderChangelog({
        orderId: id,
        userId: updatedById,
        action: 'status_change',
        changes: { status, lastUpdated: now },
        previousValues: previousValues,
        notes: `Order status changed to ${status}${documentInfo ? ' with document' : ''}`
      });
    }
    
    return updatedOrder;
  }

  async updateOrder(id: number, orderData: Partial<InsertOrder>, updatedById?: number): Promise<Order | undefined> {
    // Get the existing order to track changes
    const existingOrder = await this.getOrder(id);
    if (!existingOrder) return undefined;
    
    // Track the previous values
    const previousValues = { ...existingOrder };
    
    // Add last updated timestamp
    const updateWithTimestamp = { 
      ...orderData,
      lastUpdated: new Date()
    };
    
    // Add updatedById if provided
    if (updatedById) {
      (updateWithTimestamp as any).updatedById = updatedById;
    }
    
    // Update the order
    const [updatedOrder] = await this.db
      .update(orders)
      .set(updateWithTimestamp)
      .where(eq(orders.id, id))
      .returning();
    
    // Add changelog entry if we have a user ID
    if (updatedById) {
      await this.addOrderChangelog({
        orderId: id,
        userId: updatedById,
        action: 'update',
        changes: { ...orderData },
        previousValues: previousValues,
        notes: "Order updated"
      });
    }
    
    return updatedOrder;
  }
  
  // Order Item methods
  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
  }
  
  async addOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    // First insert the order item
    const [orderItem] = await this.db
      .insert(orderItems)
      .values(insertOrderItem)
      .returning();
    
    // Then reduce the product stock
    const product = await this.getProduct(orderItem.productId);
    if (product) {
      const updatedStock = Math.max(0, product.currentStock - orderItem.quantity);
      await this.updateProduct(product.id, { currentStock: updatedStock });
    }
    
    return orderItem;
  }
  
  // Customer methods
  async getCustomer(id: number): Promise<Customer | undefined> {
    const result = await this.db.select().from(customers).where(eq(customers.id, id));
    return result[0];
  }
  
  async getCustomerByVatNumber(vatNumber: string): Promise<Customer | undefined> {
    const result = await this.db.select().from(customers).where(eq(customers.vatNumber, vatNumber));
    return result[0];
  }
  
  async getAllCustomers(): Promise<Customer[]> {
    return await this.db.select().from(customers);
  }
  
  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await this.db
      .insert(customers)
      .values(insertCustomer)
      .returning();
    
    return customer;
  }
  
  async updateCustomer(id: number, customerUpdate: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updatedCustomer] = await this.db
      .update(customers)
      .set(customerUpdate)
      .where(eq(customers.id, id))
      .returning();
    
    return updatedCustomer;
  }
  
  async deleteCustomer(id: number): Promise<boolean> {
    const result = await this.db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
  }
  
  async searchCustomers(query: string): Promise<Customer[]> {
    if (!query) return this.getAllCustomers();
    
    const lowerQuery = `%${query.toLowerCase()}%`;
    return await this.db
      .select()
      .from(customers)
      .where(
        or(
          like(customers.name, lowerQuery),
          like(customers.vatNumber || '', lowerQuery),
          like(customers.email || '', lowerQuery),
          like(customers.contactPerson || '', lowerQuery)
        )
      );
  }
  
  // Stats methods
  async getDashboardStats(): Promise<{
    pendingOrders: number;
    itemsToPick: number;
    shippedToday: number;
    lowStockItems: number;
  }> {
    // Count pending orders
    const pendingOrdersResult = await this.db
      .select()
      .from(orders)
      .where(eq(orders.status, 'pending'));
    
    const pendingOrders = pendingOrdersResult.length;
    
    // Get today's start date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Count shipped today orders
    const shippedTodayResult = await this.db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.status, 'shipped'),
          gt(orders.orderDate, today)
        )
      );
    
    const shippedToday = shippedTodayResult.length;
    
    // Count items to pick (from pending orders)
    const pendingOrderIds = pendingOrdersResult.map(order => order.id);
    
    let itemsToPick = 0;
    if (pendingOrderIds.length > 0) {
      // For each pending order, get its items and sum the quantities
      for (const orderId of pendingOrderIds) {
        const items = await this.getOrderItems(orderId);
        for (const item of items) {
          itemsToPick += item.quantity;
        }
      }
    }
    
    // Count low stock items
    const lowStockItemsResult = await this.getLowStockProducts();
    const lowStockItems = lowStockItemsResult.length;
    
    return {
      pendingOrders,
      itemsToPick,
      shippedToday,
      lowStockItems
    };
  }

  // Advanced Analytics Methods
  async getInventoryTrendData(weeks: number = 6): Promise<{
    name: string;
    inStock: number;
    lowStock: number;
    outOfStock: number;
  }[]> {
    // In a real system, we would query historical data
    // For now, we'll use the current data as the latest week
    // and generate some realistic sample data for previous weeks
    const currentProducts = await this.getAllProducts();
    const totalProducts = currentProducts.length;
    
    // Calculate actual current figures
    const inStock = currentProducts.filter(p => p.currentStock > p.minStockLevel).length;
    const lowStock = currentProducts.filter(p => p.currentStock > 0 && p.currentStock <= p.minStockLevel).length;
    const outOfStock = currentProducts.filter(p => p.currentStock === 0).length;
    
    const result = [];
    
    // Add actual data for the current week
    result.push({
      name: `Week ${weeks}`,
      inStock,
      lowStock,
      outOfStock
    });
    
    // Generate realistic variations for historical weeks
    for (let i = weeks - 2; i >= 0; i--) {
      // Base values on current stats with some randomness
      const baseInStock = Math.floor(inStock * (0.85 + Math.random() * 0.3));
      const baseLowStock = Math.floor(lowStock * (0.85 + Math.random() * 0.3));
      const baseOutOfStock = Math.floor(outOfStock * (0.85 + Math.random() * 0.3));
      
      // Ensure values add up to total products
      const historicalInStock = Math.max(0, baseInStock);
      const historicalLowStock = Math.max(0, baseLowStock);
      const historicalOutOfStock = Math.max(0, baseOutOfStock);
      
      // Adjust to ensure total matches
      const total = historicalInStock + historicalLowStock + historicalOutOfStock;
      const adjustedInStock = historicalInStock + (totalProducts - total);
      
      result.unshift({
        name: `Week ${i + 1}`,
        inStock: adjustedInStock,
        lowStock: historicalLowStock,
        outOfStock: historicalOutOfStock
      });
    }
    
    return result;
  }

  async getOrdersTrendData(months: number = 6): Promise<{
    name: string;
    pending: number;
    picked: number;
    shipped: number;
    cancelled: number;
  }[]> {
    // Get current month's data from actual orders
    const allOrders = await this.getAllOrders();
    
    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Count orders by status for the current month
    const currentMonthOrders = allOrders.filter(order => {
      const orderDate = new Date(order.orderDate);
      return orderDate.getMonth() === currentMonth && 
             orderDate.getFullYear() === currentYear;
    });
    
    const pending = currentMonthOrders.filter(o => o.status === 'pending').length;
    const picked = currentMonthOrders.filter(o => o.status === 'picked').length;
    const shipped = currentMonthOrders.filter(o => o.status === 'shipped').length;
    const cancelled = currentMonthOrders.filter(o => o.status === 'cancelled').length;
    
    const result = [];
    
    // Add current month's data
    result.push({
      name: this.getMonthName(currentMonth),
      pending,
      picked,
      shipped,
      cancelled
    });
    
    // Generate historical data for previous months
    for (let i = 1; i < months; i++) {
      const monthIndex = (currentMonth - i + 12) % 12;
      
      // Generate slightly varying numbers based on current month
      const historicalPending = Math.max(0, Math.floor(pending * (0.7 + Math.random() * 0.6)));
      const historicalPicked = Math.max(0, Math.floor(picked * (0.7 + Math.random() * 0.6)));
      const historicalShipped = Math.max(0, Math.floor(shipped * (0.7 + Math.random() * 0.6)));
      const historicalCancelled = Math.max(0, Math.floor(cancelled * (0.7 + Math.random() * 0.6)));
      
      result.unshift({
        name: this.getMonthName(monthIndex),
        pending: historicalPending,
        picked: historicalPicked,
        shipped: historicalShipped,
        cancelled: historicalCancelled
      });
    }
    
    return result;
  }

  private getMonthName(monthIndex: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex];
  }

  async getProductCategoryData(): Promise<{
    name: string;
    value: number;
  }[]> {
    const allProducts = await this.getAllProducts();
    const allCategories = await this.getAllCategories();
    
    // Create a map of categoryId to category name
    const categoryMap = new Map<number, string>();
    for (const category of allCategories) {
      categoryMap.set(category.id, category.name);
    }
    
    // Group products by category
    const categoryCount = new Map<string, number>();
    
    for (const product of allProducts) {
      // Get category name from map, or use 'Unknown' if not found
      const categoryName = categoryMap.get(product.categoryId) || 'Unknown';
      categoryCount.set(categoryName, (categoryCount.get(categoryName) || 0) + 1);
    }
    
    // Convert to required format
    const result = Array.from(categoryCount.entries()).map(([name, value]) => ({
      name,
      value
    }));
    
    return result;
  }

  async getTopSellingProducts(limit: number = 5): Promise<{
    id: number;
    name: string;
    sku: string;
    soldQuantity: number;
  }[]> {
    // Get all order items
    const allOrderItems = await this.db.select().from(orderItems);
    
    // Group by product ID and count quantities
    const productSales = new Map<number, number>();
    
    for (const item of allOrderItems) {
      const productId = item.productId;
      productSales.set(productId, (productSales.get(productId) || 0) + item.quantity);
    }
    
    // Get product details for top selling products
    const topProductIds = Array.from(productSales.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
    
    const result = [];
    
    for (const id of topProductIds) {
      const product = await this.getProduct(id);
      if (product) {
        result.push({
          id,
          name: product.name,
          sku: product.sku,
          soldQuantity: productSales.get(id) || 0
        });
      }
    }
    
    return result;
  }

  async getInventoryValueReport(): Promise<{
    totalValue: number;
    categoryBreakdown: {
      category: string;
      productCount: number;
      totalValue: number;
      percentageOfTotal: number;
    }[];
  }> {
    // For this demo, we'll use a fixed average price per product 
    // In a real system, there would be a price field in the products table
    const averagePrice = 35.99;
    
    const allProducts = await this.getAllProducts();
    const allCategories = await this.getAllCategories();
    let totalValue = 0;
    
    // Create a map of categoryId to category name
    const categoryMap = new Map<number, string>();
    for (const category of allCategories) {
      categoryMap.set(category.id, category.name);
    }
    
    // Group products by category
    const categoryData = new Map<string, { 
      productCount: number;
      totalValue: number; 
    }>();
    
    for (const product of allProducts) {
      const categoryName = categoryMap.get(product.categoryId) || 'Uncategorized';
      const productValue = product.currentStock * averagePrice;
      totalValue += productValue;
      
      const currentData = categoryData.get(categoryName) || { productCount: 0, totalValue: 0 };
      categoryData.set(categoryName, {
        productCount: currentData.productCount + 1,
        totalValue: currentData.totalValue + productValue
      });
    }
    
    // Convert to required format
    const categoryBreakdown = Array.from(categoryData.entries()).map(([category, data]) => ({
      category,
      productCount: data.productCount,
      totalValue: data.totalValue,
      percentageOfTotal: totalValue > 0 ? (data.totalValue / totalValue) * 100 : 0
    }));
    
    return {
      totalValue,
      categoryBreakdown
    };
  }

  async getPickingEfficiencyReport(): Promise<{
    averagePickingTimeMinutes: number;
    pickingEfficiency: {
      date: string;
      ordersProcessed: number;
      avgTimeMinutes: number;
    }[];
  }> {
    // In a real system, we would have timestamp data for when orders are created
    // and when they are marked as picked, allowing us to calculate actual efficiency
    // For now, we'll simulate this data
    
    // Generate some realistic picking efficiency data for the last 7 days
    const pickingEfficiency = [];
    const averageTimeMinutes = 12; // Baseline average time
    
    // Get current date
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Generate a random number of orders processed (between 5 and 20)
      const ordersProcessed = 5 + Math.floor(Math.random() * 15);
      
      // Generate a time that varies slightly from the average
      const avgTimeMinutes = Math.max(5, averageTimeMinutes + (Math.random() * 6 - 3));
      
      // Format date as YYYY-MM-DD
      const formattedDate = date.toISOString().split('T')[0];
      
      pickingEfficiency.push({
        date: formattedDate,
        ordersProcessed,
        avgTimeMinutes
      });
    }
    
    // Calculate overall average
    const totalOrders = pickingEfficiency.reduce((sum, day) => sum + day.ordersProcessed, 0);
    const weightedTime = pickingEfficiency.reduce(
      (sum, day) => sum + (day.avgTimeMinutes * day.ordersProcessed), 
      0
    );
    
    const averagePickingTimeMinutes = totalOrders > 0 ? weightedTime / totalOrders : averageTimeMinutes;
    
    return {
      averagePickingTimeMinutes,
      pickingEfficiency
    };
  }
  
  // Order Changelog methods
  async getOrderChangelogs(orderId: number): Promise<OrderChangelog[]> {
    try {
      const results = await this.db.select().from(orderChangelogs)
        .where(eq(orderChangelogs.orderId, orderId))
        .orderBy(desc(orderChangelogs.timestamp));
      
      return results;
    } catch (error) {
      console.error('Error getting order changelogs:', error);
      return [];
    }
  }
  
  async addOrderChangelog(changelog: InsertOrderChangelog): Promise<OrderChangelog> {
    try {
      const result = await this.db.insert(orderChangelogs)
        .values({
          ...changelog,
          timestamp: new Date(),
          changes: changelog.changes || {},
          previousValues: changelog.previousValues || {},
          notes: changelog.notes || null
        })
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error adding order changelog:', error);
      throw error;
    }
  }
  
  async getOrderChangelogById(id: number): Promise<OrderChangelog | undefined> {
    try {
      const results = await this.db.select().from(orderChangelogs)
        .where(eq(orderChangelogs.id, id));
      
      return results[0];
    } catch (error) {
      console.error('Error getting order changelog by ID:', error);
      return undefined;
    }
  }
}

// This will be initialized when the server starts
export let db: ReturnType<typeof drizzle>;
export let storage: DatabaseStorage;

export async function initStorage() {
  try {
    // Initialize database connection
    db = await initDatabase();
    
    // Create the storage instance
    storage = new DatabaseStorage(db);
    
    // Log success
    log('Database storage initialized successfully', 'database');
    
    return storage;
  } catch (error) {
    log(`Failed to initialize database storage: ${error instanceof Error ? error.message : String(error)}`, 'database');
    
    // Instead of failing completely, we'll re-throw the error to let useDatabase() in storage.ts
    // handle the fallback to in-memory storage
    throw error;
  }
}