import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, like, desc, asc, and, or, lte, gt, sql, inArray } from 'drizzle-orm';
import { pool, initDatabase } from './db';
import { 
  users, type User, type InsertUser,
  products, type Product, type InsertProduct,
  orders, type Order, type InsertOrder,
  orderItems, type OrderItem, type InsertOrderItem,
  customers, type Customer, type InsertCustomer,
  shippingDocuments, type ShippingDocument, type InsertShippingDocument,
  categories, type Category, type InsertCategory,
  orderChangelogs, type OrderChangelog, type InsertOrderChangelog,
  tags, type Tag, type InsertTag,
  productTags, type ProductTag,
  unshippedItems, type UnshippedItem, type InsertUnshippedItem,
  emailSettings, type EmailSettings, type InsertEmailSettings,
  companySettings, type CompanySettings, type InsertCompanySettings,
  notificationSettings, type NotificationSettings, type InsertNotificationSettings
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
  
  // Tag methods
  async getTag(id: number): Promise<Tag | undefined> {
    const result = await this.db.select().from(tags).where(eq(tags.id, id));
    return result[0];
  }
  
  async getTagByName(name: string): Promise<Tag | undefined> {
    const result = await this.db.select().from(tags).where(eq(tags.name, name));
    return result[0];
  }
  
  async getAllTags(): Promise<Tag[]> {
    return await this.db.select().from(tags);
  }
  
  async createTag(insertTag: InsertTag): Promise<Tag> {
    const tagData = {
      ...insertTag,
      color: insertTag.color || null
    };
    const [tag] = await this.db.insert(tags).values(tagData).returning();
    return tag;
  }
  
  async updateTag(id: number, tagUpdate: Partial<InsertTag>): Promise<Tag | undefined> {
    const tagData = {
      ...tagUpdate,
      color: tagUpdate.color || null
    };
    
    const [updatedTag] = await this.db
      .update(tags)
      .set(tagData)
      .where(eq(tags.id, id))
      .returning();
    return updatedTag;
  }
  
  async deleteTag(id: number): Promise<boolean> {
    // First delete all product tag associations
    await this.db.delete(productTags).where(eq(productTags.tagId, id));
    // Then delete the tag itself
    const result = await this.db.delete(tags).where(eq(tags.id, id)).returning();
    return result.length > 0;
  }
  
  async getProductTags(productId: number): Promise<Tag[]> {
    // Join productTags with tags to get the actual tag data
    const result = await this.db
      .select()
      .from(productTags)
      .innerJoin(tags, eq(productTags.tagId, tags.id))
      .where(eq(productTags.productId, productId));
      
    // Extract just the tag data from the join result
    return result.map(row => row.tags);
  }
  
  async addTagToProduct(productId: number, tagId: number): Promise<void> {
    // Check if the relation already exists
    const existing = await this.db
      .select()
      .from(productTags)
      .where(and(
        eq(productTags.productId, productId),
        eq(productTags.tagId, tagId)
      ));
    
    // Only insert if it doesn't exist
    if (existing.length === 0) {
      await this.db.insert(productTags).values({ productId, tagId });
    }
  }
  
  async removeTagFromProduct(productId: number, tagId: number): Promise<void> {
    await this.db
      .delete(productTags)
      .where(and(
        eq(productTags.productId, productId),
        eq(productTags.tagId, tagId)
      ));
  }
  
  async updateProductTags(productId: number, tagIds: number[]): Promise<void> {
    // Begin a transaction
    await this.db.transaction(async (tx) => {
      // Delete all existing tag associations for this product
      await tx.delete(productTags).where(eq(productTags.productId, productId));
      
      // Add the new tag associations
      if (tagIds.length > 0) {
        const tagValues = tagIds.map(tagId => ({ productId, tagId }));
        await tx.insert(productTags).values(tagValues);
      }
    });
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
    // Since the category system has been removed from the UI, we always set a default categoryId
    // but the database still has a NOT NULL constraint on it
    
    try {
      // Always set default categoryId of 1 (for 'widgets')
      const productWithCategory = {
        ...insertProduct,
        categoryId: 1 // Set default categoryId to 1
      };
      
      console.log('Attempting to create product with data:', JSON.stringify(productWithCategory, null, 2));
      
      // Use the Drizzle ORM's built-in insert method instead of raw SQL
      // This handles arrays and all special types automatically
      const [insertedProduct] = await this.db
        .insert(products)
        .values({
          name: productWithCategory.name,
          sku: productWithCategory.sku,
          categoryId: productWithCategory.categoryId,
          minStockLevel: productWithCategory.minStockLevel,
          currentStock: productWithCategory.currentStock,
          description: productWithCategory.description || null,
          barcode: productWithCategory.barcode || null,
          location: productWithCategory.location || null,
          unitsPerBox: productWithCategory.unitsPerBox || null,
          imagePath: productWithCategory.imagePath || null,
          tags: productWithCategory.tags || []
        })
        .returning();
      
      console.log('Product created successfully:', insertedProduct);
      return insertedProduct;
    } catch (error) {
      console.error('Error creating product:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  }
  
  async updateProduct(id: number, productUpdate: Partial<InsertProduct>): Promise<Product | undefined> {
    try {
      // Regular update without special handling for category
      const [updatedProduct] = await this.db
        .update(products)
        .set(productUpdate)
        .where(eq(products.id, id))
        .returning();
      return updatedProduct;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
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
    try {
      let conditions = [];
      
      // Add search condition if query provided using case-insensitive ILIKE for better Unicode support
      if (query) {
        conditions.push(
          or(
            sql`${products.name} ILIKE ${'%' + query + '%'}`,
            sql`${products.sku} ILIKE ${'%' + query + '%'}`
          )
        );
      }
      
      // Note: Category filtering has been removed as part of the simplified system
      // The category parameter is retained for backward compatibility but is ignored
      
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
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
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
  
  async getOrdersByCustomer(customerName: string): Promise<Order[]> {
    try {
      // Use case-insensitive exact match with the ILIKE operator for better Unicode support
      return await this.db
        .select()
        .from(orders)
        .where(sql`LOWER(${orders.customerName}) = LOWER(${customerName})`)
        .orderBy(desc(orders.orderDate));
    } catch (error) {
      console.error('Error getting orders by customer:', error);
      return [];
    }
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
  
  async deleteOrder(id: number): Promise<boolean> {
    try {
      // First check if the order exists
      const existingOrder = await this.getOrder(id);
      if (!existingOrder) return false;
      
      // 1. Delete related order items
      await this.db.delete(orderItems).where(eq(orderItems.orderId, id));
      
      // 2. Delete shipping documents if any
      await this.db.delete(shippingDocuments).where(eq(shippingDocuments.orderId, id));
      
      // 3. Delete order changelogs
      await this.db.delete(orderChangelogs).where(eq(orderChangelogs.orderId, id));
      
      // 4. Delete unshipped items related to this order
      await this.db.delete(unshippedItems).where(eq(unshippedItems.orderId, id));
      
      // 5. Finally delete the order itself
      await this.db.delete(orders).where(eq(orders.id, id));
      
      // We succeeded if we get here (no exceptions)
      return true;
    } catch (error) {
      console.error('Error deleting order:', error);
      return false;
    }
  }
  
  // Order Item methods
  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return await this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
  }
  
  async addOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    try {
      // First insert the order item in the order_items table
      const [orderItem] = await this.db
        .insert(orderItems)
        .values(insertOrderItem)
        .returning();
      
      // Get the product details
      const product = await this.getProduct(orderItem.productId);
      if (!product) {
        console.error(`Product with ID ${orderItem.productId} not found`);
        return orderItem;
      }
      
      // Get the order details to get customer info
      const order = await this.getOrder(orderItem.orderId);
      if (!order) {
        console.error(`Order with ID ${orderItem.orderId} not found`);
        return orderItem;
      }
      
      // Check if we have enough stock
      if (product.currentStock >= orderItem.quantity) {
        // We have enough stock, just reduce it
        const updatedStock = product.currentStock - orderItem.quantity;
        await this.updateProduct(product.id, { currentStock: updatedStock });
        console.log(`Product ${product.name} stock reduced from ${product.currentStock} to ${updatedStock}`);
      } else {
        // We don't have enough stock, implement partial fulfillment
        const availableQuantity = product.currentStock;
        const unshippedQuantity = orderItem.quantity - availableQuantity;
        
        // Reduce stock to zero (ship whatever we have)
        if (availableQuantity > 0) {
          await this.updateProduct(product.id, { currentStock: 0 });
          console.log(`Product ${product.name} stock reduced from ${product.currentStock} to 0`);
        }
        
        // Add the remaining quantity to unshipped_items for later fulfillment
        if (unshippedQuantity > 0) {
          // Get the order data needed for unshipped item
          const orderNumber = order.orderNumber;
          
          // Look up the customer ID from the customer name
          let customerId: string | undefined;
          try {
            const customer = await this.db.select().from(customers).where(eq(customers.name, order.customerName)).limit(1);
            if (customer.length > 0) {
              customerId = customer[0].id.toString();
              console.log(`Found customer ID ${customerId} for customer ${order.customerName}`);
            } else {
              console.log(`No customer found with name ${order.customerName}, creating unshipped item without customerId`);
            }
          } catch (err) {
            console.warn(`Error finding customer by name: ${err}`);
          }
          
          const unshippedItem = await this.addUnshippedItem({
            orderId: orderItem.orderId,
            productId: orderItem.productId,
            quantity: unshippedQuantity,
            customerName: order.customerName,
            customerId: customerId,
            originalOrderNumber: orderNumber,
            notes: `Partially fulfilled. Original order requested ${orderItem.quantity}, shipped ${availableQuantity}, remaining: ${unshippedQuantity}.`
          });
          
          console.log(`Added unshipped item for ${unshippedQuantity} units of product ${product.name}`);
        }
      }
      
      return orderItem;
    } catch (error) {
      console.error("Error in addOrderItem:", error);
      throw error;
    }
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
    
    // Simple SQL-based search for better Unicode character support
    try {
      console.log(`Searching customers with query: ${query}`);
      
      // Use ILIKE operator which is case-insensitive and works well with Unicode
      return await this.db
        .select()
        .from(customers)
        .where(
          or(
            sql`${customers.name} ILIKE ${'%' + query + '%'}`,
            sql`COALESCE(${customers.vatNumber}, '') ILIKE ${'%' + query + '%'}`,
            sql`COALESCE(${customers.email}, '') ILIKE ${'%' + query + '%'}`,
            sql`COALESCE(${customers.contactPerson}, '') ILIKE ${'%' + query + '%'}`
          )
        );
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
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
    // Since the category system has been removed, we'll return a simplified view
    // of product data, showing all products under a single "General" category
    
    const allProducts = await this.getAllProducts();
    
    // Return a single entry for all products
    return [{
      name: "All Products",
      value: allProducts.length
    }];
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
    let totalValue = 0;
    
    // Since categories are removed, we'll use a single category
    const productCount = allProducts.length;
    
    // Calculate total inventory value
    for (const product of allProducts) {
      const productValue = product.currentStock * averagePrice;
      totalValue += productValue;
    }
    
    // Return a simplified report with a single category
    const categoryBreakdown = [{
      category: 'All Products',
      productCount,
      totalValue,
      percentageOfTotal: 100 // Single category = 100%
    }];
    
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

  // Unshipped items methods
  async getUnshippedItem(id: number): Promise<UnshippedItem | undefined> {
    try {
      const results = await this.db.select().from(unshippedItems)
        .where(eq(unshippedItems.id, id));
      
      return results[0];
    } catch (error) {
      console.error("Error getting unshipped item:", error);
      return undefined;
    }
  }
  
  async getUnshippedItems(customerId?: string): Promise<UnshippedItem[]> {
    try {
      // Create base query
      const query = this.db.select()
        .from(unshippedItems);
      
      // Add customer filter if specified
      if (customerId) {
        return await query
          .where(eq(unshippedItems.customerId, customerId));
      }
      
      // Return all unshipped items
      return await query;
    } catch (error) {
      console.error("Error getting unshipped items:", error);
      return [];
    }
  }

  async getUnshippedItemsByOrder(orderId: number): Promise<UnshippedItem[]> {
    try {
      return await this.db.select()
        .from(unshippedItems)
        .where(eq(unshippedItems.orderId, orderId));
    } catch (error) {
      console.error(`Error getting unshipped items for order ${orderId}:`, error);
      return [];
    }
  }

  async addUnshippedItem(item: InsertUnshippedItem): Promise<UnshippedItem> {
    try {
      const [newItem] = await this.db.insert(unshippedItems)
        .values(item)
        .returning();
      return newItem;
    } catch (error) {
      console.error("Error adding unshipped item:", error);
      throw error;
    }
  }

  async authorizeUnshippedItems(ids: number[], userId: number): Promise<void> {
    try {
      await this.db.update(unshippedItems)
        .set({ 
          authorized: true,
          authorizedById: userId,
          authorizedAt: new Date() // Use the ORM for this instead of raw SQL
        })
        .where(inArray(unshippedItems.id, ids));
    } catch (error) {
      console.error("Error authorizing unshipped items:", error);
      throw error;
    }
  }

  async markUnshippedItemsAsShipped(ids: number[], newOrderId: number): Promise<void> {
    try {
      await this.db.update(unshippedItems)
        .set({ 
          shipped: true, 
          shippedInOrderId: newOrderId
        })
        .where(inArray(unshippedItems.id, ids));
        
      // Use raw SQL for setting shipped_at since it's not in the schema object
      await this.db.execute(
        sql`UPDATE unshipped_items SET shipped_at = NOW() WHERE id IN (${ids.join(',')})`
      );
    } catch (error) {
      console.error("Error marking unshipped items as shipped:", error);
      throw error;
    }
  }

  async getUnshippedItemsForAuthorization(): Promise<UnshippedItem[]> {
    try {
      return await this.db.select()
        .from(unshippedItems)
        .where(and(
          eq(unshippedItems.authorized, false),
          eq(unshippedItems.shipped, false)
        ));
    } catch (error) {
      console.error("Error getting unshipped items for authorization:", error);
      return [];
    }
  }

  // Email Settings methods
  async getEmailSettings(): Promise<EmailSettings | undefined> {
    try {
      // Order by ID ascending to always get the lowest ID (first created record)
      const settings = await this.db.select()
        .from(emailSettings)
        .orderBy(asc(emailSettings.id))
        .limit(1);
      
      return settings.length > 0 ? settings[0] : undefined;
    } catch (error) {
      console.error("Error getting email settings:", error);
      return undefined;
    }
  }
  
  // Company Settings methods
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    try {
      // Order by ID ascending to always get the lowest ID (first created record)
      const settings = await this.db.select()
        .from(companySettings)
        .orderBy(asc(companySettings.id))
        .limit(1);
      
      return settings.length > 0 ? settings[0] : undefined;
    } catch (error) {
      console.error("Error getting company settings:", error);
      return undefined;
    }
  }
  
  async updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings | undefined> {
    try {
      const existingSettings = await this.getCompanySettings();
      
      if (!existingSettings) {
        // Create new settings
        console.log("Creating new company settings:", JSON.stringify(settings));
        
        const [newSettings] = await this.db.insert(companySettings)
          .values({
            companyName: settings.companyName || 'Warehouse Systems Inc.',
            email: settings.email || 'info@warehousesys.com',
            phone: settings.phone || '',
            address: settings.address || '',
            logoPath: settings.logoPath || '',
            updatedAt: new Date(),
          })
          .returning();
          
        return newSettings;
      } else {
        // Create an update object with all fields that are not undefined
        const updateObject: Record<string, any> = {
          updatedAt: new Date()
        };
        
        // Explicitly set each field if it's provided in settings
        if (settings.companyName !== undefined) updateObject.companyName = settings.companyName;
        if (settings.email !== undefined) updateObject.email = settings.email;
        if (settings.phone !== undefined) updateObject.phone = settings.phone;
        if (settings.address !== undefined) updateObject.address = settings.address;
        if (settings.logoPath !== undefined) updateObject.logoPath = settings.logoPath;
        
        // Log the update for debugging
        console.log("Updating company settings with:", JSON.stringify(updateObject));
        
        // Update existing settings with explicit where clause
        const [updatedSettings] = await this.db.update(companySettings)
          .set(updateObject)
          .where(eq(companySettings.id, existingSettings.id))
          .returning();
        
        console.log("Company settings updated successfully, ID:", updatedSettings.id);
        return updatedSettings;
      }
    } catch (error) {
      console.error("Error updating company settings:", error);
      return undefined;
    }
  }
  
  // Notification Settings methods
  async getNotificationSettings(): Promise<NotificationSettings | undefined> {
    try {
      // Order by ID ascending to always get the lowest ID (first created record)
      const settings = await this.db.select()
        .from(notificationSettings)
        .orderBy(asc(notificationSettings.id))
        .limit(1);
      
      return settings.length > 0 ? settings[0] : undefined;
    } catch (error) {
      console.error("Error getting notification settings:", error);
      return undefined;
    }
  }
  
  async updateNotificationSettings(settings: Partial<InsertNotificationSettings>): Promise<NotificationSettings | undefined> {
    try {
      const existingSettings = await this.getNotificationSettings();
      
      if (!existingSettings) {
        // Create new settings
        console.log("Creating new notification settings:", JSON.stringify(settings));
        
        const [newSettings] = await this.db.insert(notificationSettings)
          .values({
            lowStockAlerts: settings.lowStockAlerts ?? true,
            orderConfirmation: settings.orderConfirmation ?? true,
            shippingUpdates: settings.shippingUpdates ?? true,
            dailyReports: settings.dailyReports ?? false,
            weeklyReports: settings.weeklyReports ?? true,
            soundEnabled: settings.soundEnabled ?? true,
            updatedAt: new Date(),
          })
          .returning();
          
        return newSettings;
      } else {
        // Create an update object with all fields that are not undefined
        const updateObject: Record<string, any> = {
          updatedAt: new Date()
        };
        
        // Explicitly set each field if it's provided in settings
        if (settings.lowStockAlerts !== undefined) updateObject.lowStockAlerts = settings.lowStockAlerts;
        if (settings.orderConfirmation !== undefined) updateObject.orderConfirmation = settings.orderConfirmation;
        if (settings.shippingUpdates !== undefined) updateObject.shippingUpdates = settings.shippingUpdates;
        if (settings.dailyReports !== undefined) updateObject.dailyReports = settings.dailyReports;
        if (settings.weeklyReports !== undefined) updateObject.weeklyReports = settings.weeklyReports;
        if (settings.soundEnabled !== undefined) updateObject.soundEnabled = settings.soundEnabled;
        
        // Log the update for debugging
        console.log("Updating notification settings with:", JSON.stringify(updateObject));
        
        // Update existing settings with explicit where clause
        const [updatedSettings] = await this.db.update(notificationSettings)
          .set(updateObject)
          .where(eq(notificationSettings.id, existingSettings.id))
          .returning();
        
        console.log("Notification settings updated successfully, ID:", updatedSettings.id);
        return updatedSettings;
      }
    } catch (error) {
      console.error("Error updating notification settings:", error);
      return undefined;
    }
  }
  
  async updateEmailSettings(settings: Partial<InsertEmailSettings>): Promise<EmailSettings | undefined> {
    try {
      const existingSettings = await this.getEmailSettings();
      
      if (!existingSettings) {
        // Create new settings
        console.log("Creating new email settings:", JSON.stringify({
          ...settings,
          authPass: settings.authPass ? "******" : undefined
        }));
        
        const [newSettings] = await this.db.insert(emailSettings)
          .values({
            host: settings.host || 'smtp.gmail.com',
            port: settings.port || 587,
            secure: settings.secure ?? false,
            authUser: settings.authUser || '',
            authPass: settings.authPass || '',
            fromEmail: settings.fromEmail || '',
            companyName: settings.companyName || 'Warehouse Management System',
            enableNotifications: settings.enableNotifications ?? true,
            updatedAt: new Date(),
          })
          .returning();
          
        return newSettings;
      } else {
        // Create an update object with all fields that are not undefined
        const updateObject: Record<string, any> = {
          updatedAt: new Date()
        };
        
        // Explicitly set each field if it's provided in settings
        if (settings.host !== undefined) updateObject.host = settings.host;
        if (settings.port !== undefined) updateObject.port = settings.port;
        if (settings.secure !== undefined) updateObject.secure = settings.secure;
        if (settings.enableNotifications !== undefined) updateObject.enableNotifications = settings.enableNotifications;
        if (settings.companyName !== undefined) updateObject.companyName = settings.companyName;
        if (settings.fromEmail !== undefined) updateObject.fromEmail = settings.fromEmail;
        if (settings.authUser !== undefined) updateObject.authUser = settings.authUser;
        
        // Only update password if provided
        if (settings.authPass !== undefined && settings.authPass !== '') {
          updateObject.authPass = settings.authPass;
        }
        
        // Log the update for debugging
        console.log("Updating email settings with:", JSON.stringify({
          ...updateObject,
          authPass: updateObject.authPass ? "******" : "(unchanged)"
        }));
        
        // Update existing settings with explicit where clause
        const [updatedSettings] = await this.db.update(emailSettings)
          .set(updateObject)
          .where(eq(emailSettings.id, existingSettings.id))
          .returning();
        
        console.log("Email settings updated successfully, ID:", updatedSettings.id);
        return updatedSettings;
      }
    } catch (error) {
      console.error("Error updating email settings:", error);
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