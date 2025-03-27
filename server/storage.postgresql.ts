import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, like, desc, asc, and, or, lte, gt, sql, inArray, count, gte, lt } from 'drizzle-orm';
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
  notificationSettings, type NotificationSettings, type InsertNotificationSettings,
  rolePermissions, type RolePermission, type InsertRolePermission,
  orderQuality, type OrderQuality, type InsertOrderQuality,
  inventoryChanges, type InventoryChange, type InsertInventoryChange,
  callLogs, type CallLog, type InsertCallLog,
  callOutcomes, type CallOutcome, type InsertCallOutcome,
  prospectiveCustomers, type ProspectiveCustomer, type InsertProspectiveCustomer
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
  
  async updateProduct(id: number, productUpdate: Partial<InsertProduct>, userId?: number): Promise<Product | undefined> {
    try {
      // Check if this is a stock update - if currentStock is being changed
      const stockBeingUpdated = productUpdate.currentStock !== undefined;
      
      // If stock is being updated, also update the lastStockUpdate timestamp
      let updateData = { ...productUpdate };
      
      if (stockBeingUpdated) {
        console.log(`Updating stock level for product ${id} to ${productUpdate.currentStock}, updating lastStockUpdate timestamp`);
        updateData.lastStockUpdate = new Date();

        // Get the current product to track inventory change
        const currentProduct = await this.getProduct(id);
        if (!currentProduct) {
          throw new Error(`Product with ID ${id} not found`);
        }

        // Perform the update operation
        const [updatedProduct] = await this.db
          .update(products)
          .set(updateData)
          .where(eq(products.id, id))
          .returning();
        
        // Track the inventory change if userId is provided
        if (userId && currentProduct.currentStock !== productUpdate.currentStock) {
          try {
            const quantityChanged = productUpdate.currentStock! - currentProduct.currentStock;
            const changeType = quantityChanged > 0 ? 'stock_replenishment' : 'manual_adjustment';
            
            await this.addInventoryChange({
              productId: id,
              userId: userId,
              changeType: changeType,
              previousQuantity: currentProduct.currentStock,
              newQuantity: productUpdate.currentStock!,
              quantityChanged: quantityChanged,
              notes: 'Stock updated via product update'
            });
            
            console.log(`Inventory change recorded for product ${id}: ${currentProduct.currentStock} → ${productUpdate.currentStock}`);
          } catch (inventoryError) {
            console.error('Error recording inventory change:', inventoryError);
            // Continue with the product update even if inventory tracking fails
          }
        }
        
        return updatedProduct;
      } else {
        // Regular update without stock change
        const [updatedProduct] = await this.db
          .update(products)
          .set(updateData)
          .where(eq(products.id, id))
          .returning();
        
        return updatedProduct;
      }
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
  
  async getSlowMovingProducts(dayThreshold: number = 60): Promise<Product[]> {
    // Calculate the date threshold
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - dayThreshold);
    
    try {
      // Query products that haven't been restocked for X days or have never been updated
      // Include category name in the results
      const query = this.db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          barcode: products.barcode,
          categoryId: products.categoryId,
          category: sql`(SELECT name FROM categories WHERE id = ${products.categoryId})`.as('category'),
          description: products.description,
          minStockLevel: products.minStockLevel,
          currentStock: products.currentStock,
          location: products.location,
          unitsPerBox: products.unitsPerBox,
          imagePath: products.imagePath,
          tags: products.tags,
          lastStockUpdate: products.lastStockUpdate
        })
        .from(products)
        .where(
          or(
            // Products with lastStockUpdate older than the threshold
            and(
              sql`${products.lastStockUpdate} IS NOT NULL`,
              sql`${products.lastStockUpdate} < ${thresholdDate.toISOString()}`
            ),
            // Products with no lastStockUpdate (legacy or new products)
            sql`${products.lastStockUpdate} IS NULL`
          )
        )
        .orderBy(sql`COALESCE(${products.lastStockUpdate}, '1970-01-01')`);
      
      const result = await query;
      return result;
    } catch (error) {
      console.error('Error getting slow moving products:', error);
      // If there's an issue with the new field, return an empty array
      // rather than crashing the application
      return [];
    }
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
        // Use order's createdById as userId for inventory tracking
        const userId = order.createdById;
        await this.updateProduct(product.id, { currentStock: updatedStock }, userId);
        console.log(`Product ${product.name} stock reduced from ${product.currentStock} to ${updatedStock}`);
      } else {
        // We don't have enough stock, implement partial fulfillment
        const availableQuantity = product.currentStock;
        const unshippedQuantity = orderItem.quantity - availableQuantity;
        
        // Reduce stock to zero (ship whatever we have)
        if (availableQuantity > 0) {
          // Use order's createdById as userId for inventory tracking
          const userId = order.createdById;
          await this.updateProduct(product.id, { currentStock: 0 }, userId);
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
    callsYesterday: number;
    errorsPerFiftyOrders: number;
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
    
    // Get yesterday's start date
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
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
    
    // Count calls from yesterday
    const callsYesterdayResult = await this.db
      .select()
      .from(callLogs)
      .where(
        and(
          gte(callLogs.callDate, yesterday),
          lt(callLogs.callDate, today)
        )
      );
    
    const callsYesterday = callsYesterdayResult.length;
    
    // Calculate errors per 50 orders ratio
    const allOrdersCount = await this.db
      .select({ count: count() })
      .from(orders);
    
    const totalOrders = allOrdersCount[0]?.count || 0;
    
    const orderErrorsCount = await this.db
      .select({ count: count() })
      .from(orderQuality);
    
    const totalErrors = orderErrorsCount[0]?.count || 0;
    
    // Calculate errors per 50 orders
    const errorsPerFiftyOrders = totalOrders > 0 
      ? (totalErrors / totalOrders) * 50 
      : 0;
    
    return {
      pendingOrders,
      itemsToPick,
      shippedToday,
      lowStockItems,
      callsYesterday,
      errorsPerFiftyOrders
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

  // Order Error methods
  async getOrderErrors(orderId?: number): Promise<OrderQuality[]> {
    try {
      if (orderId) {
        return await this.db
          .select()
          .from(orderQuality)
          .where(eq(orderQuality.orderId, orderId))
          .orderBy(desc(orderQuality.reportDate));
      } else {
        return await this.db
          .select()
          .from(orderQuality)
          .orderBy(desc(orderQuality.reportDate));
      }
    } catch (error) {
      console.error('Error getting order quality records:', error);
      return [];
    }
  }

  async getOrderQuality(id: number): Promise<OrderQuality | undefined> {
    try {
      const result = await this.db
        .select()
        .from(orderQuality)
        .where(eq(orderQuality.id, id));
      return result[0];
    } catch (error) {
      console.error(`Error getting order quality record #${id}:`, error);
      return undefined;
    }
  }

  async createOrderError(error: InsertOrderQuality): Promise<OrderQuality> {
    try {
      // Insert the order quality record
      const [qualityRecord] = await this.db
        .insert(orderQuality)
        .values(error)
        .returning();
      
      // Add a changelog entry for this quality report
      await this.addOrderChangelog({
        orderId: error.orderId,
        userId: error.reportedById,
        action: 'error_report',
        notes: `Quality issue reported: ${error.errorType} - ${error.description.substring(0, 100)}${error.description.length > 100 ? '...' : ''}`,
        changes: {
          errorType: error.errorType,
          description: error.description,
          affectedProductIds: error.affectedProductIds || []
        }
      });
      
      return qualityRecord;
    } catch (error) {
      console.error('Error creating order quality record:', error);
      throw error;
    }
  }

  async updateOrderError(id: number, error: Partial<InsertOrderQuality>): Promise<OrderQuality | undefined> {
    try {
      const [updatedRecord] = await this.db
        .update(orderQuality)
        .set(error)
        .where(eq(orderQuality.id, id))
        .returning();
      return updatedRecord;
    } catch (error) {
      console.error(`Error updating order quality record #${id}:`, error);
      return undefined;
    }
  }

  async resolveOrderError(id: number, userId: number, resolution: { rootCause?: string, preventiveMeasures?: string }): Promise<OrderQuality | undefined> {
    try {
      // Update the quality issue as resolved
      const [resolvedRecord] = await this.db
        .update(orderQuality)
        .set({
          resolved: true,
          resolvedById: userId,
          resolvedDate: new Date(),
          rootCause: resolution.rootCause || null,
          preventiveMeasures: resolution.preventiveMeasures || null
        })
        .where(eq(orderQuality.id, id))
        .returning();
      
      if (resolvedRecord) {
        // Add a changelog entry for the resolution
        await this.addOrderChangelog({
          orderId: resolvedRecord.orderId,
          userId: userId,
          action: 'update',
          notes: `Quality issue #${id} marked as resolved`,
          changes: { 
            resolved: true,
            rootCause: resolution.rootCause,
            preventiveMeasures: resolution.preventiveMeasures 
          }
        });
      }
      
      return resolvedRecord;
    } catch (error) {
      console.error(`Error resolving order quality record #${id}:`, error);
      return undefined;
    }
  }

  async getErrorStats(period: number = 90): Promise<{
    totalErrors: number,
    totalShippedOrders: number,
    errorRate: number,
    errorsByType: { type: string, count: number }[],
    trending: { date: string, errorRate: number }[]
  }> {
    try {
      // Calculate start date for the period
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);
      
      // Get total quality issues for the period
      const errorsResult = await this.db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(orderQuality)
        .where(sql`${orderQuality.reportDate} >= ${startDate.toISOString()}`);
      
      const totalErrors = errorsResult[0]?.count || 0;
      
      // Get total shipped orders for the period
      const ordersResult = await this.db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.status, 'shipped'),
            sql`${orders.orderDate} >= ${startDate.toISOString()}`
          )
        );
      
      const totalShippedOrders = ordersResult[0]?.count || 0;
      
      // Calculate error rate per 100 orders
      const errorRate = totalShippedOrders > 0 
        ? Math.round((totalErrors / totalShippedOrders) * 100 * 100) / 100 
        : 0;
      
      // Get errors by type
      const errorsByTypeResult = await this.db
        .select({
          type: orderQuality.errorType,
          count: sql<number>`count(*)`,
        })
        .from(orderQuality)
        .where(sql`${orderQuality.reportDate} >= ${startDate.toISOString()}`)
        .groupBy(orderQuality.errorType)
        .orderBy(sql<number>`count(*)`)
        .execute();
      
      const errorsByType = errorsByTypeResult.map(row => ({
        type: row.type,
        count: row.count
      }));
      
      // Get trending data - calculate weekly error rates
      const weeksInPeriod = Math.ceil(period / 7);
      const trending: { date: string, errorRate: number }[] = [];
      
      for (let i = 0; i < weeksInPeriod; i++) {
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 7);
        
        // Count quality issues for the week
        const weeklyErrorsResult = await this.db
          .select({
            count: sql<number>`count(*)`,
          })
          .from(orderQuality)
          .where(
            and(
              sql`${orderQuality.reportDate} >= ${weekStart.toISOString()}`,
              sql`${orderQuality.reportDate} < ${weekEnd.toISOString()}`
            )
          );
        
        // Count shipped orders for the week
        const weeklyOrdersResult = await this.db
          .select({
            count: sql<number>`count(*)`,
          })
          .from(orders)
          .where(
            and(
              eq(orders.status, 'shipped'),
              sql`${orders.orderDate} >= ${weekStart.toISOString()}`,
              sql`${orders.orderDate} < ${weekEnd.toISOString()}`
            )
          );
        
        const weeklyErrors = weeklyErrorsResult[0]?.count || 0;
        const weeklyOrders = weeklyOrdersResult[0]?.count || 0;
        
        // Calculate weekly error rate per 100 orders
        const weeklyErrorRate = weeklyOrders > 0 
          ? Math.round((weeklyErrors / weeklyOrders) * 100 * 100) / 100 
          : 0;
        
        trending.push({
          date: weekStart.toISOString().split('T')[0], // Format as YYYY-MM-DD
          errorRate: weeklyErrorRate
        });
      }
      
      // Return complete stats
      return {
        totalErrors,
        totalShippedOrders,
        errorRate,
        errorsByType,
        trending: trending.reverse() // Show oldest to newest
      };
    } catch (error) {
      console.error('Error generating quality statistics:', error);
      // Return empty data structure if error occurs
      return {
        totalErrors: 0,
        totalShippedOrders: 0,
        errorRate: 0,
        errorsByType: [],
        trending: []
      };
    }
  }

  async adjustInventoryForError(errorId: number, adjustments: { productId: number, quantity: number }[]): Promise<boolean> {
    try {
      // Get the quality record
      const qualityRecord = await this.getOrderQuality(errorId);
      if (!qualityRecord) {
        throw new Error(`Quality record #${errorId} not found`);
      }
      
      // Transaction to handle inventory adjustments
      await this.db.transaction(async (tx) => {
        // Update each product's inventory
        for (const adjustment of adjustments) {
          const product = await tx
            .select()
            .from(products)
            .where(eq(products.id, adjustment.productId));
          
          if (product.length === 0) {
            throw new Error(`Product #${adjustment.productId} not found`);
          }
          
          // Calculate new stock level
          const currentStock = product[0].currentStock;
          const newStock = currentStock + adjustment.quantity; // Can be negative for removal
          
          // Update stock
          await tx
            .update(products)
            .set({ 
              currentStock: newStock,
              lastStockUpdate: new Date()
            })
            .where(eq(products.id, adjustment.productId));
        }
        
        // Mark quality issue as having inventory adjusted
        await tx
          .update(orderQuality)
          .set({ inventoryAdjusted: true })
          .where(eq(orderQuality.id, errorId));
        
        // Add changelog entry for this adjustment
        await tx
          .insert(orderChangelogs)
          .values({
            orderId: qualityRecord.orderId,
            userId: qualityRecord.reportedById, // Using the same user who reported the issue
            action: 'update',
            notes: `Inventory adjusted for quality issue #${errorId}`,
            changes: { 
              adjustments: adjustments.map(adj => ({
                productId: adj.productId,
                quantityChange: adj.quantity
              }))
            }
          });
      });
      
      return true;
    } catch (error) {
      console.error(`Error adjusting inventory for quality issue #${errorId}:`, error);
      return false;
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
  
  async cleanupDuplicateEmailSettings(): Promise<void> {
    try {
      // Get all email settings
      const allSettings = await this.db.select()
        .from(emailSettings)
        .orderBy(asc(emailSettings.id));
        
      // If more than one record exists, keep the oldest (lowest ID) and delete the rest
      if (allSettings.length > 1) {
        console.log(`Found ${allSettings.length} email settings records, cleaning up duplicates...`);
        
        const lowestId = allSettings[0].id;
        
        // Delete all records except the one with the lowest ID
        const result = await this.db.delete(emailSettings)
          .where(sql`${emailSettings.id} > ${lowestId}`);
          
        console.log(`Cleaned up ${allSettings.length - 1} duplicate email settings records`);
      }
    } catch (error) {
      console.error("Error cleaning up duplicate email settings:", error);
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
  
  async cleanupDuplicateCompanySettings(): Promise<void> {
    try {
      // Get all company settings
      const allSettings = await this.db.select()
        .from(companySettings)
        .orderBy(asc(companySettings.id));
        
      // If more than one record exists, keep the oldest (lowest ID) and delete the rest
      if (allSettings.length > 1) {
        console.log(`Found ${allSettings.length} company settings records, cleaning up duplicates...`);
        
        const lowestId = allSettings[0].id;
        
        // Delete all records except the one with the lowest ID
        const result = await this.db.delete(companySettings)
          .where(sql`${companySettings.id} > ${lowestId}`);
          
        console.log(`Cleaned up ${allSettings.length - 1} duplicate company settings records`);
      }
    } catch (error) {
      console.error("Error cleaning up duplicate company settings:", error);
    }
  }
  
  async updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings | undefined> {
    try {
      // First clean up any duplicate records
      await this.cleanupDuplicateCompanySettings();
      
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
  
  async cleanupDuplicateNotificationSettings(): Promise<void> {
    try {
      // Get all notification settings
      const allSettings = await this.db.select()
        .from(notificationSettings)
        .orderBy(asc(notificationSettings.id));
        
      // If more than one record exists, keep the oldest (lowest ID) and delete the rest
      if (allSettings.length > 1) {
        console.log(`Found ${allSettings.length} notification settings records, cleaning up duplicates...`);
        
        const lowestId = allSettings[0].id;
        
        // Delete all records except the one with the lowest ID
        const result = await this.db.delete(notificationSettings)
          .where(sql`${notificationSettings.id} > ${lowestId}`);
          
        console.log(`Cleaned up ${allSettings.length - 1} duplicate notification settings records`);
      }
    } catch (error) {
      console.error("Error cleaning up duplicate notification settings:", error);
    }
  }
  
  async updateNotificationSettings(settings: Partial<InsertNotificationSettings>): Promise<NotificationSettings | undefined> {
    try {
      // First clean up any duplicate records
      await this.cleanupDuplicateNotificationSettings();
      
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
      // First clean up any duplicate records
      await this.cleanupDuplicateEmailSettings();
      
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

  // Role Permissions methods
  async getRolePermissions(role: string): Promise<RolePermission[]> {
    try {
      // Get all permissions for this role
      const permissions = await this.db
        .select()
        .from(rolePermissions)
        .where(eq(rolePermissions.role, role as any));
        
      if (permissions.length === 0) {
        // If no permissions found, initialize default ones
        await this.initDefaultRolePermissions(role);
        
        // Fetch again after initialization
        return await this.db
          .select()
          .from(rolePermissions)
          .where(eq(rolePermissions.role, role as any));
      }
      
      return permissions;
    } catch (error) {
      console.error(`Error getting permissions for role ${role}:`, error);
      return [];
    }
  }
  
  async getAllRolePermissions(): Promise<RolePermission[]> {
    try {
      // Get all role permissions
      const allPermissions = await this.db
        .select()
        .from(rolePermissions);
        
      if (allPermissions.length === 0) {
        // If no permissions found, initialize default ones for all roles
        await this.initDefaultRolePermissions();
        
        // Fetch again after initialization
        return await this.db
          .select()
          .from(rolePermissions);
      }
      
      return allPermissions;
    } catch (error) {
      console.error('Error getting all role permissions:', error);
      return [];
    }
  }
  
  async updateRolePermission(role: string, permission: string, enabled: boolean): Promise<RolePermission | undefined> {
    try {
      // Check if this permission exists for this role
      const existingPermission = await this.db
        .select()
        .from(rolePermissions)
        .where(and(
          eq(rolePermissions.role, role as any),
          eq(rolePermissions.permission, permission as any)
        ));
      
      if (existingPermission.length === 0) {
        // Create new permission
        const [newPermission] = await this.db
          .insert(rolePermissions)
          .values({
            role: role as any,
            permission: permission as any,
            enabled,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
          
        console.log(`Created new permission: ${role}:${permission} = ${enabled}`);
        return newPermission;
      } else {
        // Update existing permission
        const [updatedPermission] = await this.db
          .update(rolePermissions)
          .set({ 
            enabled,
            updatedAt: new Date()
          })
          .where(and(
            eq(rolePermissions.role, role as any),
            eq(rolePermissions.permission, permission as any)
          ))
          .returning();
          
        console.log(`Updated permission: ${role}:${permission} = ${enabled}`);
        return updatedPermission;
      }
    } catch (error) {
      console.error(`Error updating permission ${role}:${permission}:`, error);
      return undefined;
    }
  }
  
  async checkPermission(role: string, permission: string): Promise<boolean> {
    try {
      // Admin always has all permissions
      if (role === 'admin') {
        return true;
      }
      
      // Check if this permission exists for this role
      const permissions = await this.db
        .select()
        .from(rolePermissions)
        .where(and(
          eq(rolePermissions.role, role as any),
          eq(rolePermissions.permission, permission as any)
        ));
      
      if (permissions.length === 0) {
        // Permission doesn't exist, initialize it with default value
        // and return the default
        await this.initDefaultRolePermissions(role, [permission]);
        
        // Fetch the newly created permission
        const newPermissions = await this.db
          .select()
          .from(rolePermissions)
          .where(and(
            eq(rolePermissions.role, role as any),
            eq(rolePermissions.permission, permission as any)
          ));
          
        return newPermissions.length > 0 ? newPermissions[0].enabled : false;
      }
      
      // Return the enabled status of the permission
      return permissions[0].enabled;
    } catch (error) {
      console.error(`Error checking permission ${role}:${permission}:`, error);
      return false; // Default to denying access on error
    }
  }
  
  // Helper method to create default role permissions
  private async initDefaultRolePermissions(specificRole?: string, specificPermissions?: string[]): Promise<void> {
    try {
      const allPermissions = [
        'view_dashboard', 'view_products', 'edit_products', 
        'view_customers', 'edit_customers', 'view_orders', 'create_orders', 
        'edit_orders', 'delete_orders', 'view_reports', 'order_picking',
        'view_unshipped_items', 'authorize_unshipped_items', 'view_settings',
        'edit_settings', 'view_users', 'edit_users', 'view_email_templates',
        'edit_email_templates'
      ];
      
      // If specific permissions are provided, only initialize those
      const permissionsToInit = specificPermissions || allPermissions;
      
      // Default permissions for each role
      const defaultPermissions: Record<string, string[]> = {
        'admin': allPermissions, // Admin has all permissions
        'manager': [
          'view_dashboard', 'view_products', 'edit_products', 
          'view_customers', 'edit_customers', 'view_orders', 'create_orders', 
          'edit_orders', 'view_reports', 'order_picking',
          'view_unshipped_items', 'authorize_unshipped_items'
        ],
        'front_office': [
          'view_dashboard', 'view_products', 
          'view_customers', 'edit_customers', 'view_orders', 'create_orders',
          'view_unshipped_items', 'authorize_unshipped_items'
        ],
        'warehouse': [
          'view_dashboard', 'view_products', 
          'view_orders', 'order_picking',
          'view_unshipped_items'
        ]
      };
      
      // Determine which roles to initialize
      const rolesToInit = specificRole 
        ? [specificRole] 
        : ['admin', 'manager', 'front_office', 'warehouse'];
      
      // Create default permissions for each role
      for (const role of rolesToInit) {
        for (const permission of permissionsToInit) {
          const enabled = defaultPermissions[role].includes(permission);
          
          // Check if the permission already exists
          const existing = await this.db
            .select()
            .from(rolePermissions)
            .where(and(
              eq(rolePermissions.role, role as any),
              eq(rolePermissions.permission, permission as any)
            ));
          
          if (existing.length === 0) {
            // Create new permission with default value
            await this.db
              .insert(rolePermissions)
              .values({
                role: role as any,
                permission: permission as any,
                enabled,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            
            console.log(`Initialized default permission: ${role}:${permission} = ${enabled}`);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing default role permissions:', error);
    }
  }

  // Inventory Change Methods
  async getInventoryChanges(productId?: number): Promise<InventoryChange[]> {
    try {
      let query = this.db
        .select()
        .from(inventoryChanges)
        .orderBy(desc(inventoryChanges.timestamp));
      
      if (productId) {
        query = query.where(eq(inventoryChanges.productId, productId));
      }
      
      return await query;
    } catch (error) {
      console.error("Error fetching inventory changes:", error);
      return [];
    }
  }
  
  async getInventoryChange(id: number): Promise<InventoryChange | undefined> {
    try {
      const results = await this.db
        .select()
        .from(inventoryChanges)
        .where(eq(inventoryChanges.id, id))
        .limit(1);
      
      return results.length > 0 ? results[0] : undefined;
    } catch (error) {
      console.error("Error fetching inventory change:", error);
      return undefined;
    }
  }
  
  async addInventoryChange(change: InsertInventoryChange): Promise<InventoryChange> {
    try {
      const [newChange] = await this.db
        .insert(inventoryChanges)
        .values(change)
        .returning();
      
      return newChange;
    } catch (error) {
      console.error("Error adding inventory change:", error);
      throw error;
    }
  }
  
  async getRecentInventoryChanges(limit: number): Promise<InventoryChange[]> {
    try {
      return await this.db
        .select()
        .from(inventoryChanges)
        .orderBy(desc(inventoryChanges.timestamp))
        .limit(limit);
    } catch (error) {
      console.error("Error fetching recent inventory changes:", error);
      return [];
    }
  }
  
  async getInventoryChangesByType(changeType: string): Promise<InventoryChange[]> {
    try {
      return await this.db
        .select()
        .from(inventoryChanges)
        .where(eq(inventoryChanges.changeType, changeType as any))
        .orderBy(desc(inventoryChanges.timestamp));
    } catch (error) {
      console.error("Error fetching inventory changes by type:", error);
      return [];
    }
  }

  // Call Logs methods
  async getCallLog(id: number): Promise<CallLog | undefined> {
    try {
      const result = await this.db.select().from(callLogs).where(eq(callLogs.id, id));
      return result[0];
    } catch (error) {
      console.error("Error fetching call log:", error);
      return undefined;
    }
  }
  
  async getAllCallLogs(dateFrom?: string, dateTo?: string): Promise<CallLog[]> {
    try {
      let query = this.db.select().from(callLogs);
      
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        query = query.where(sql`${callLogs.callDate} >= ${fromDate.toISOString()}`);
      }
      
      if (dateTo) {
        const toDate = new Date(dateTo);
        query = query.where(sql`${callLogs.callDate} <= ${toDate.toISOString()}`);
      }
      
      return await query.orderBy(desc(callLogs.callDate));
    } catch (error) {
      console.error("Error fetching all call logs:", error);
      return [];
    }
  }
  
  async getCallLogsByCustomer(customerId: number): Promise<CallLog[]> {
    try {
      return await this.db
        .select()
        .from(callLogs)
        .where(eq(callLogs.customerId, customerId))
        .orderBy(desc(callLogs.callDate));
    } catch (error) {
      console.error("Error fetching call logs by customer:", error);
      return [];
    }
  }
  
  async getScheduledCalls(userId?: number): Promise<CallLog[]> {
    try {
      let query = this.db
        .select()
        .from(callLogs)
        .where(eq(callLogs.callStatus, 'scheduled'));
      
      if (userId) {
        query = query.where(
          or(
            eq(callLogs.userId, userId),
            eq(callLogs.followupAssignedTo, userId)
          )
        );
      }
      
      return await query.orderBy(asc(callLogs.callDate));
    } catch (error) {
      console.error("Error fetching scheduled calls:", error);
      return [];
    }
  }
  
  async getCallLogsRequiringFollowup(): Promise<CallLog[]> {
    try {
      return await this.db
        .select()
        .from(callLogs)
        .where(eq(callLogs.callStatus, 'needs_followup'))
        .orderBy(asc(callLogs.followupDate));
    } catch (error) {
      console.error("Error fetching calls requiring followup:", error);
      return [];
    }
  }
  
  async searchCallLogs(query: string): Promise<CallLog[]> {
    try {
      const lowercaseQuery = `%${query.toLowerCase()}%`;
      return await this.db
        .select()
        .from(callLogs)
        .where(
          or(
            sql`LOWER(${callLogs.contactName}) LIKE ${lowercaseQuery}`,
            sql`LOWER(${callLogs.companyName}) LIKE ${lowercaseQuery}`,
            sql`LOWER(${callLogs.notes}) LIKE ${lowercaseQuery}`,
            sql`EXISTS (SELECT 1 FROM UNNEST(${callLogs.tags}) AS tag WHERE LOWER(tag) LIKE ${lowercaseQuery})`
          )
        )
        .orderBy(desc(callLogs.callDate));
    } catch (error) {
      console.error("Error searching call logs:", error);
      return [];
    }
  }
  
  async createCallLog(callLog: InsertCallLog): Promise<CallLog> {
    try {
      const now = new Date();
      
      const [createdCallLog] = await this.db
        .insert(callLogs)
        .values({
          ...callLog,
          customerId: callLog.customerId || null,
          companyName: callLog.companyName || null,
          callTime: callLog.callTime || null,
          duration: callLog.duration || null,
          notes: callLog.notes || null,
          followupDate: callLog.followupDate || null,
          followupTime: callLog.followupTime || null,
          followupAssignedTo: callLog.followupAssignedTo || null,
          reminderSent: false,
          previousCallId: callLog.previousCallId || null,
          tags: callLog.tags || [],
          createdAt: now,
          updatedAt: now
        })
        .returning();
      
      return createdCallLog;
    } catch (error) {
      console.error("Error creating call log:", error);
      throw error;
    }
  }
  
  async updateCallLog(id: number, callLog: Partial<InsertCallLog>): Promise<CallLog | undefined> {
    try {
      // Process any date fields to ensure they're valid Date objects
      const processedData: any = { ...callLog };
      
      // Handle callDate conversion
      if (processedData.callDate !== undefined) {
        try {
          processedData.callDate = typeof processedData.callDate === 'string' 
            ? new Date(processedData.callDate) 
            : processedData.callDate;
        } catch (e) {
          console.error("Error converting callDate:", e);
          delete processedData.callDate; // Remove the field if conversion fails
        }
      }
      
      // Handle followupDate conversion
      if (processedData.followupDate !== undefined) {
        try {
          if (processedData.followupDate === null) {
            // Keep null value
          } else {
            processedData.followupDate = typeof processedData.followupDate === 'string' 
              ? new Date(processedData.followupDate) 
              : processedData.followupDate;
          }
        } catch (e) {
          console.error("Error converting followupDate:", e);
          processedData.followupDate = null; // Set to null if conversion fails
        }
      }
      
      const [updatedCallLog] = await this.db
        .update(callLogs)
        .set({
          ...processedData,
          updatedAt: new Date()
        })
        .where(eq(callLogs.id, id))
        .returning();
      
      return updatedCallLog;
    } catch (error) {
      console.error("Error updating call log:", error);
      return undefined;
    }
  }
  
  async deleteCallLog(id: number): Promise<boolean> {
    try {
      // First delete any associated outcomes
      await this.db
        .delete(callOutcomes)
        .where(eq(callOutcomes.callId, id));
      
      // Then delete the call log
      const result = await this.db
        .delete(callLogs)
        .where(eq(callLogs.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting call log:", error);
      return false;
    }
  }
  
  // Call Outcomes methods
  async getCallOutcome(id: number): Promise<CallOutcome | undefined> {
    try {
      const result = await this.db.select().from(callOutcomes).where(eq(callOutcomes.id, id));
      return result[0];
    } catch (error) {
      console.error("Error fetching call outcome:", error);
      return undefined;
    }
  }
  
  async getCallOutcomesByCall(callId: number): Promise<CallOutcome[]> {
    try {
      return await this.db
        .select()
        .from(callOutcomes)
        .where(eq(callOutcomes.callId, callId))
        .orderBy(asc(callOutcomes.createdAt));
    } catch (error) {
      console.error("Error fetching call outcomes by call:", error);
      return [];
    }
  }
  
  async createCallOutcome(outcome: InsertCallOutcome): Promise<CallOutcome> {
    try {
      const now = new Date();
      
      const [createdOutcome] = await this.db
        .insert(callOutcomes)
        .values({
          ...outcome,
          dueDate: outcome.dueDate || null,
          assignedToId: outcome.assignedToId || null,
          notes: outcome.notes || null,
          completedById: null,
          completedAt: null,
          createdAt: now,
          updatedAt: now
        })
        .returning();
      
      return createdOutcome;
    } catch (error) {
      console.error("Error creating call outcome:", error);
      throw error;
    }
  }
  
  async updateCallOutcome(id: number, outcome: Partial<InsertCallOutcome>): Promise<CallOutcome | undefined> {
    try {
      // Process any date fields to ensure they're valid Date objects
      const processedData: any = { ...outcome };
      
      // Handle dueDate conversion if present
      if (processedData.dueDate !== undefined) {
        try {
          if (processedData.dueDate === null) {
            // Keep null value
          } else {
            processedData.dueDate = typeof processedData.dueDate === 'string' 
              ? new Date(processedData.dueDate) 
              : processedData.dueDate;
          }
        } catch (e) {
          console.error("Error converting dueDate:", e);
          processedData.dueDate = null; // Set to null if conversion fails
        }
      }
      
      const [updatedOutcome] = await this.db
        .update(callOutcomes)
        .set({
          ...processedData,
          updatedAt: new Date()
        })
        .where(eq(callOutcomes.id, id))
        .returning();
      
      return updatedOutcome;
    } catch (error) {
      console.error("Error updating call outcome:", error);
      return undefined;
    }
  }
  
  async completeCallOutcome(id: number, userId: number, notes?: string): Promise<CallOutcome | undefined> {
    try {
      const now = new Date();
      
      let updateData: any = {
        status: 'completed',
        completedById: userId,
        completedAt: now,
        updatedAt: now
      };
      
      if (notes !== undefined) {
        updateData.notes = notes;
      }
      
      const [completedOutcome] = await this.db
        .update(callOutcomes)
        .set(updateData)
        .where(eq(callOutcomes.id, id))
        .returning();
      
      return completedOutcome;
    } catch (error) {
      console.error("Error completing call outcome:", error);
      return undefined;
    }
  }
  
  async deleteCallOutcome(id: number): Promise<boolean> {
    try {
      const result = await this.db
        .delete(callOutcomes)
        .where(eq(callOutcomes.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting call outcome:", error);
      return false;
    }
  }

  // Prospective Customer methods
  async getProspectiveCustomer(id: number): Promise<ProspectiveCustomer | undefined> {
    try {
      const result = await this.db
        .select()
        .from(prospectiveCustomers)
        .where(eq(prospectiveCustomers.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching prospective customer:', error);
      return undefined;
    }
  }

  async getAllProspectiveCustomers(): Promise<ProspectiveCustomer[]> {
    try {
      return await this.db
        .select()
        .from(prospectiveCustomers)
        .orderBy(prospectiveCustomers.name);
    } catch (error) {
      console.error('Error fetching all prospective customers:', error);
      return [];
    }
  }

  async getProspectiveCustomersByStatus(status: string): Promise<ProspectiveCustomer[]> {
    try {
      return await this.db
        .select()
        .from(prospectiveCustomers)
        .where(eq(prospectiveCustomers.status, status))
        .orderBy(prospectiveCustomers.name);
    } catch (error) {
      console.error('Error fetching prospective customers by status:', error);
      return [];
    }
  }

  async searchProspectiveCustomers(query: string): Promise<ProspectiveCustomer[]> {
    try {
      const lowerQuery = `%${query.toLowerCase()}%`;
      return await this.db
        .select()
        .from(prospectiveCustomers)
        .where(
          or(
            sql`${prospectiveCustomers.name} ILIKE ${lowerQuery}`,
            sql`${prospectiveCustomers.companyName} ILIKE ${lowerQuery}`,
            sql`${prospectiveCustomers.email} ILIKE ${lowerQuery}`,
            sql`${prospectiveCustomers.phone} ILIKE ${lowerQuery}`
          )
        )
        .orderBy(prospectiveCustomers.name);
    } catch (error) {
      console.error('Error searching prospective customers:', error);
      return [];
    }
  }

  async createProspectiveCustomer(customer: InsertProspectiveCustomer): Promise<ProspectiveCustomer> {
    try {
      const now = new Date();
      // Process any date fields to ensure they're valid Date objects
      const processedData: any = { ...customer };
      
      // Handle lastContactDate conversion if present
      if (processedData.lastContactDate !== undefined && processedData.lastContactDate !== null) {
        try {
          processedData.lastContactDate = typeof processedData.lastContactDate === 'string' 
            ? new Date(processedData.lastContactDate) 
            : processedData.lastContactDate;
        } catch (e) {
          console.error("Error converting lastContactDate:", e);
          processedData.lastContactDate = now; // Use current date as fallback
        }
      } else {
        processedData.lastContactDate = now; // Default to current date
      }
      
      // Handle nextContactDate conversion if present
      if (processedData.nextContactDate !== undefined) {
        try {
          if (processedData.nextContactDate === null) {
            // Keep null value
          } else {
            processedData.nextContactDate = typeof processedData.nextContactDate === 'string' 
              ? new Date(processedData.nextContactDate) 
              : processedData.nextContactDate;
          }
        } catch (e) {
          console.error("Error converting nextContactDate:", e);
          processedData.nextContactDate = null; // Set to null if conversion fails
        }
      }
      
      const insertData = {
        ...processedData,
        createdAt: now,
        updatedAt: now
      };
      
      const result = await this.db
        .insert(prospectiveCustomers)
        .values(insertData)
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error creating prospective customer:', error);
      throw error;
    }
  }

  async updateProspectiveCustomer(id: number, customer: Partial<InsertProspectiveCustomer>): Promise<ProspectiveCustomer | undefined> {
    try {
      // Process any date fields to ensure they're valid Date objects
      const processedData: any = { ...customer };
      
      // Handle lastContactDate conversion if present
      if (processedData.lastContactDate !== undefined) {
        try {
          if (processedData.lastContactDate === null) {
            // Keep null value
          } else {
            processedData.lastContactDate = typeof processedData.lastContactDate === 'string' 
              ? new Date(processedData.lastContactDate) 
              : processedData.lastContactDate;
          }
        } catch (e) {
          console.error("Error converting lastContactDate:", e);
          delete processedData.lastContactDate; // Remove if conversion fails
        }
      }
      
      // Handle nextContactDate conversion if present
      if (processedData.nextContactDate !== undefined) {
        try {
          if (processedData.nextContactDate === null) {
            // Keep null value
          } else {
            processedData.nextContactDate = typeof processedData.nextContactDate === 'string' 
              ? new Date(processedData.nextContactDate) 
              : processedData.nextContactDate;
          }
        } catch (e) {
          console.error("Error converting nextContactDate:", e);
          processedData.nextContactDate = null; // Set to null if conversion fails
        }
      }
      
      const updateData = {
        ...processedData,
        updatedAt: new Date()
      };
      
      const result = await this.db
        .update(prospectiveCustomers)
        .set(updateData)
        .where(eq(prospectiveCustomers.id, id))
        .returning();
      
      return result[0];
    } catch (error) {
      console.error('Error updating prospective customer:', error);
      return undefined;
    }
  }

  async deleteProspectiveCustomer(id: number): Promise<boolean> {
    try {
      const result = await this.db
        .delete(prospectiveCustomers)
        .where(eq(prospectiveCustomers.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting prospective customer:', error);
      return false;
    }
  }

  async convertToCustomer(id: number): Promise<Customer | undefined> {
    try {
      // 1. Get the prospective customer
      const prospectiveCustomer = await this.getProspectiveCustomer(id);
      if (!prospectiveCustomer) return undefined;
      
      // 2. Begin a transaction
      return await this.db.transaction(async (tx) => {
        // 3. Create a new customer from the prospective customer data
        const now = new Date();
        const insertCustomerData = {
          name: prospectiveCustomer.name,
          email: prospectiveCustomer.email,
          phone: prospectiveCustomer.phone,
          address: prospectiveCustomer.address, 
          city: prospectiveCustomer.city,
          state: prospectiveCustomer.state,
          postalCode: prospectiveCustomer.postalCode,
          country: prospectiveCustomer.country,
          notes: prospectiveCustomer.notes || null,
          vatNumber: null,
          paymentTerms: null,
          shippingMethod: null,
          shippingInstructions: null,
          preferredShippingCompany: null,
          customShippingCompany: null,
          contactPerson: null,
          createdAt: now,
          updatedAt: now
        };
        
        const customerResult = await tx
          .insert(customers)
          .values(insertCustomerData)
          .returning();
        
        // 4. Delete the prospective customer
        await tx
          .delete(prospectiveCustomers)
          .where(eq(prospectiveCustomers.id, id));
        
        return customerResult[0];
      });
    } catch (error) {
      console.error('Error converting prospective customer to customer:', error);
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