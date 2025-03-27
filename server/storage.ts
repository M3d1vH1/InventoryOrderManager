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
import { DatabaseStorage, initStorage } from './storage.postgresql';
import { log } from './vite';

export interface IStorage {
  // Email settings methods
  getEmailSettings(): Promise<EmailSettings | undefined>;
  updateEmailSettings(settings: Partial<InsertEmailSettings>): Promise<EmailSettings | undefined>;
  
  // Company settings methods
  getCompanySettings(): Promise<CompanySettings | undefined>;
  updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings | undefined>;
  
  // Notification settings methods
  getNotificationSettings(): Promise<NotificationSettings | undefined>;
  updateNotificationSettings(settings: Partial<InsertNotificationSettings>): Promise<NotificationSettings | undefined>;
  
  // Role Permissions methods
  getRolePermissions(role: string): Promise<RolePermission[]>;
  getAllRolePermissions(): Promise<RolePermission[]>;
  updateRolePermission(role: string, permission: string, enabled: boolean): Promise<RolePermission | undefined>;
  checkPermission(role: string, permission: string): Promise<boolean>;
  
  // Order Quality methods
  getOrderErrors(orderId?: number): Promise<OrderQuality[]>;
  getOrderQuality(id: number): Promise<OrderQuality | undefined>;
  createOrderError(error: InsertOrderQuality): Promise<OrderQuality>;
  updateOrderError(id: number, error: Partial<InsertOrderQuality>): Promise<OrderQuality | undefined>;
  resolveOrderError(id: number, userId: number, resolution: { rootCause?: string, preventiveMeasures?: string }): Promise<OrderQuality | undefined>;
  getErrorStats(period?: number): Promise<{
    totalErrors: number,
    totalShippedOrders: number,
    errorRate: number,
    errorsByType: { type: string, count: number }[],
    trending: { date: string, errorRate: number }[]
  }>;
  adjustInventoryForError(errorId: number, adjustments: { productId: number, quantity: number }[]): Promise<boolean>;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserLastLogin(id: number): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Category methods
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  
  // Tag methods
  getTag(id: number): Promise<Tag | undefined>;
  getTagByName(name: string): Promise<Tag | undefined>;
  getAllTags(): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: number, tag: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: number): Promise<boolean>;
  getProductTags(productId: number): Promise<Tag[]>;
  addTagToProduct(productId: number, tagId: number): Promise<void>;
  removeTagFromProduct(productId: number, tagId: number): Promise<void>;
  updateProductTags(productId: number, tagIds: number[]): Promise<void>;
  
  // Product methods
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>, userId?: number): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  getLowStockProducts(): Promise<Product[]>;
  getSlowMovingProducts(dayThreshold?: number): Promise<Product[]>;
  searchProducts(query: string, category?: string, stockStatus?: string, tag?: string): Promise<Product[]>;
  
  // Order methods
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getRecentOrders(limit: number): Promise<Order[]>;
  getOrdersByCustomer(customerName: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: 'pending' | 'picked' | 'shipped' | 'cancelled', documentInfo?: {documentPath: string, documentType: string, notes?: string}, updatedById?: number): Promise<Order | undefined>;
  updateOrder(id: number, orderData: Partial<InsertOrder>, updatedById?: number): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<boolean>;
  
  // Order Item methods
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  addOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  
  // Shipping Document methods
  getShippingDocument(orderId: number): Promise<ShippingDocument | undefined>;
  addShippingDocument(document: InsertShippingDocument): Promise<ShippingDocument>;
  updateShippingDocument(id: number, document: Partial<InsertShippingDocument>): Promise<ShippingDocument | undefined>;
  
  // Order Changelog methods
  getOrderChangelogs(orderId: number): Promise<OrderChangelog[]>;
  addOrderChangelog(changelog: InsertOrderChangelog): Promise<OrderChangelog>;
  getOrderChangelogById(id: number): Promise<OrderChangelog | undefined>;
  
  // Customer methods
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByVatNumber(vatNumber: string): Promise<Customer | undefined>;
  getAllCustomers(): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
  searchCustomers(query: string): Promise<Customer[]>;
  
  // Stats methods
  getDashboardStats(): Promise<{
    pendingOrders: number;
    itemsToPick: number;
    shippedToday: number;
    lowStockItems: number;
  }>;

  // Advanced Analytics Methods
  getInventoryTrendData(weeks?: number): Promise<{
    name: string;
    inStock: number;
    lowStock: number;
    outOfStock: number;
  }[]>;

  getOrdersTrendData(months?: number): Promise<{
    name: string;
    pending: number;
    picked: number;
    shipped: number;
    cancelled: number;
  }[]>;

  getProductCategoryData(): Promise<{
    name: string;
    value: number;
  }[]>;

  getTopSellingProducts(limit?: number): Promise<{
    id: number;
    name: string;
    sku: string;
    soldQuantity: number;
  }[]>;

  getInventoryValueReport(): Promise<{
    totalValue: number;
    categoryBreakdown: {
      category: string;
      productCount: number;
      totalValue: number;
      percentageOfTotal: number;
    }[];
  }>;
  
  getPickingEfficiencyReport(): Promise<{
    averagePickingTimeMinutes: number;
    pickingEfficiency: {
      date: string;
      ordersProcessed: number;
      avgTimeMinutes: number;
    }[];
  }>;

  // Unshipped Items methods
  getUnshippedItem(id: number): Promise<UnshippedItem | undefined>;
  getUnshippedItems(customerId?: string): Promise<UnshippedItem[]>;
  getUnshippedItemsByOrder(orderId: number): Promise<UnshippedItem[]>;
  addUnshippedItem(item: InsertUnshippedItem): Promise<UnshippedItem>;
  authorizeUnshippedItems(ids: number[], userId: number): Promise<void>;
  markUnshippedItemsAsShipped(ids: number[], newOrderId: number): Promise<void>;
  getUnshippedItemsForAuthorization(): Promise<UnshippedItem[]>;
  
  // Inventory Change Tracking methods
  getInventoryChanges(productId?: number): Promise<InventoryChange[]>;
  getInventoryChange(id: number): Promise<InventoryChange | undefined>;
  addInventoryChange(change: InsertInventoryChange): Promise<InventoryChange>;
  getRecentInventoryChanges(limit: number): Promise<InventoryChange[]>;
  getInventoryChangesByType(changeType: string): Promise<InventoryChange[]>;
  
  // Call Logs methods
  getCallLog(id: number): Promise<CallLog | undefined>;
  getAllCallLogs(dateFrom?: string, dateTo?: string): Promise<CallLog[]>;
  getCallLogsByCustomer(customerId: number): Promise<CallLog[]>;
  getScheduledCalls(userId?: number): Promise<CallLog[]>;
  getCallLogsRequiringFollowup(): Promise<CallLog[]>;
  searchCallLogs(query: string): Promise<CallLog[]>;
  createCallLog(callLog: InsertCallLog): Promise<CallLog>;
  updateCallLog(id: number, callLog: Partial<InsertCallLog>): Promise<CallLog | undefined>;
  deleteCallLog(id: number): Promise<boolean>;
  
  // Call Outcomes methods
  getCallOutcome(id: number): Promise<CallOutcome | undefined>;
  getCallOutcomesByCall(callId: number): Promise<CallOutcome[]>;
  createCallOutcome(outcome: InsertCallOutcome): Promise<CallOutcome>;
  updateCallOutcome(id: number, outcome: Partial<InsertCallOutcome>): Promise<CallOutcome | undefined>;
  completeCallOutcome(id: number, userId: number, notes?: string): Promise<CallOutcome | undefined>;
  deleteCallOutcome(id: number): Promise<boolean>;
  
  // Prospective Customer methods
  getProspectiveCustomer(id: number): Promise<ProspectiveCustomer | undefined>;
  getAllProspectiveCustomers(): Promise<ProspectiveCustomer[]>;
  getProspectiveCustomersByStatus(status: string): Promise<ProspectiveCustomer[]>;
  searchProspectiveCustomers(query: string): Promise<ProspectiveCustomer[]>;
  createProspectiveCustomer(customer: InsertProspectiveCustomer): Promise<ProspectiveCustomer>;
  updateProspectiveCustomer(id: number, customer: Partial<InsertProspectiveCustomer>): Promise<ProspectiveCustomer | undefined>;
  deleteProspectiveCustomer(id: number): Promise<boolean>;
  convertToCustomer(id: number): Promise<Customer | undefined>;
}

// We're keeping the MemStorage class definition for fallback
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private categories: Map<number, Category>;
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem>;
  private customers: Map<number, Customer>;
  private shippingDocuments: Map<number, ShippingDocument>;
  private orderChangelogs: Map<number, OrderChangelog>;
  private tags: Map<number, Tag>;
  private productTagsMap: Map<string, number>; // key: productId-tagId, value: 1 (just for existence)
  private unshippedItems: Map<number, UnshippedItem>;
  private emailSettingsData: EmailSettings | undefined;
  private companySettingsData: CompanySettings | undefined;
  private notificationSettingsData: NotificationSettings | undefined;
  private callLogs: Map<number, CallLog>;
  private callOutcomes: Map<number, CallOutcome>;
  private prospectiveCustomers: Map<number, ProspectiveCustomer>;
  
  private userIdCounter: number;
  private categoryIdCounter: number;
  private productIdCounter: number;
  private orderIdCounter: number;
  private orderItemIdCounter: number;
  private customerIdCounter: number;
  private shippingDocumentIdCounter: number;
  private orderChangelogIdCounter: number;
  private tagIdCounter: number;
  private unshippedItemIdCounter: number;
  private callLogIdCounter: number;
  private callOutcomeIdCounter: number;
  private prospectiveCustomerIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.customers = new Map();
    this.shippingDocuments = new Map();
    this.orderChangelogs = new Map();
    this.tags = new Map();
    this.productTagsMap = new Map();
    this.unshippedItems = new Map();
    this.callLogs = new Map();
    this.callOutcomes = new Map();
    this.prospectiveCustomers = new Map();
    
    this.userIdCounter = 1;
    this.categoryIdCounter = 1;
    this.productIdCounter = 1;
    this.orderIdCounter = 1;
    this.orderItemIdCounter = 1;
    this.customerIdCounter = 1;
    this.shippingDocumentIdCounter = 1;
    this.orderChangelogIdCounter = 1;
    this.tagIdCounter = 1;
    this.unshippedItemIdCounter = 1;
    this.callLogIdCounter = 1;
    this.callOutcomeIdCounter = 1;
    this.prospectiveCustomerIdCounter = 1;
    
    // Initialize with sample data (async)
    // We're calling this in a non-blocking way since constructor can't be async
    this.initSampleData().catch(err => 
      console.error('Failed to initialize sample data:', err)
    );
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { 
      ...insertUser, 
      id,
      email: insertUser.email || null,
      createdAt: new Date(),
      lastLogin: null
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUserLastLogin(id: number): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, lastLogin: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
  
  // Category methods
  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }
  
  async getCategoryByName(name: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(
      (category) => category.name.toLowerCase() === name.toLowerCase()
    );
  }
  
  async getAllCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }
  
  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = this.categoryIdCounter++;
    const category: Category = {
      id,
      name: insertCategory.name,
      description: insertCategory.description || null,
      color: insertCategory.color === undefined ? null : insertCategory.color,
      createdAt: new Date()
    };
    this.categories.set(id, category);
    return category;
  }
  
  async updateCategory(id: number, categoryUpdate: Partial<InsertCategory>): Promise<Category | undefined> {
    const existingCategory = this.categories.get(id);
    if (!existingCategory) return undefined;
    
    const updatedCategory = { ...existingCategory, ...categoryUpdate };
    this.categories.set(id, updatedCategory);
    return updatedCategory;
  }
  
  async deleteCategory(id: number): Promise<boolean> {
    // Check if there are products using this category
    const productsWithCategory = Array.from(this.products.values()).filter(
      (product) => product.categoryId === id
    );
    
    if (productsWithCategory.length > 0) {
      return false; // Can't delete a category that's in use
    }
    
    return this.categories.delete(id);
  }
  
  // Tag methods
  async getTag(id: number): Promise<Tag | undefined> {
    return this.tags.get(id);
  }
  
  async getTagByName(name: string): Promise<Tag | undefined> {
    return Array.from(this.tags.values()).find(
      (tag) => tag.name.toLowerCase() === name.toLowerCase()
    );
  }
  
  async getAllTags(): Promise<Tag[]> {
    return Array.from(this.tags.values());
  }
  
  async createTag(insertTag: InsertTag): Promise<Tag> {
    const id = this.tagIdCounter++;
    const tag: Tag = {
      id,
      name: insertTag.name,
      color: insertTag.color || null,
      description: insertTag.description || null,
      createdAt: new Date()
    };
    this.tags.set(id, tag);
    return tag;
  }
  
  async updateTag(id: number, tagUpdate: Partial<InsertTag>): Promise<Tag | undefined> {
    const existingTag = this.tags.get(id);
    if (!existingTag) return undefined;
    
    const updatedTag = { ...existingTag, ...tagUpdate };
    this.tags.set(id, updatedTag);
    return updatedTag;
  }
  
  async deleteTag(id: number): Promise<boolean> {
    // Check if tag is being used by any products
    const productTagsForThisTag = Array.from(this.productTagsMap.keys())
      .filter(key => key.endsWith(`-${id}`));
    
    if (productTagsForThisTag.length > 0) {
      return false; // Can't delete tag that's in use
    }
    
    return this.tags.delete(id);
  }
  
  async getProductTags(productId: number): Promise<Tag[]> {
    // Find all tag IDs associated with this product
    const tagIds = Array.from(this.productTagsMap.keys())
      .filter(key => key.startsWith(`${productId}-`))
      .map(key => parseInt(key.split('-')[1], 10));
    
    // Get the tag objects
    return tagIds.map(tagId => this.tags.get(tagId)).filter(Boolean) as Tag[];
  }
  
  async addTagToProduct(productId: number, tagId: number): Promise<void> {
    // Ensure both product and tag exist
    const product = await this.getProduct(productId);
    const tag = await this.getTag(tagId);
    if (!product || !tag) {
      throw new Error(`Product (${productId}) or tag (${tagId}) does not exist`);
    }
    
    // Add the relation
    const key = `${productId}-${tagId}`;
    this.productTagsMap.set(key, 1);
  }
  
  async removeTagFromProduct(productId: number, tagId: number): Promise<void> {
    const key = `${productId}-${tagId}`;
    this.productTagsMap.delete(key);
  }
  
  async updateProductTags(productId: number, tagIds: number[]): Promise<void> {
    // Validate product exists
    const product = await this.getProduct(productId);
    if (!product) {
      throw new Error(`Product (${productId}) does not exist`);
    }
    
    // Remove all existing tags for this product
    const existingKeys = Array.from(this.productTagsMap.keys())
      .filter(key => key.startsWith(`${productId}-`));
    
    for (const key of existingKeys) {
      this.productTagsMap.delete(key);
    }
    
    // Add the new tags
    for (const tagId of tagIds) {
      // Validate tag exists
      const tag = await this.getTag(tagId);
      if (tag) {
        const key = `${productId}-${tagId}`;
        this.productTagsMap.set(key, 1);
      }
    }
  }
  
  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }
  
  async getProductBySku(sku: string): Promise<Product | undefined> {
    return Array.from(this.products.values()).find(
      (product) => product.sku === sku
    );
  }
  
  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }
  
  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.productIdCounter++;
    // Ensure all nullable fields are properly set
    const product: Product = { 
      ...insertProduct, 
      id,
      barcode: insertProduct.barcode || null,
      description: insertProduct.description || null,
      location: insertProduct.location || null,
      unitsPerBox: insertProduct.unitsPerBox || null,
      imagePath: insertProduct.imagePath || null
    };
    this.products.set(id, product);
    return product;
  }
  
  async updateProduct(id: number, productUpdate: Partial<InsertProduct>, userId?: number): Promise<Product | undefined> {
    const existingProduct = this.products.get(id);
    if (!existingProduct) return undefined;
    
    const updatedProduct = { ...existingProduct, ...productUpdate };
    this.products.set(id, updatedProduct);
    
    // If we're tracking inventory changes and stock was modified
    if (userId && productUpdate.currentStock !== undefined && productUpdate.currentStock !== existingProduct.currentStock) {
      console.log(`[MemStorage] Inventory change for product ${id}: ${existingProduct.currentStock} → ${productUpdate.currentStock}`);
      // Note: In MemStorage we don't actually log inventory changes, but in a real DB we would
    }
    
    return updatedProduct;
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }
  
  async getLowStockProducts(): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter(product => product.currentStock <= product.minStockLevel);
  }
  
  async getSlowMovingProducts(dayThreshold: number = 60): Promise<Product[]> {
    // Calculate the date threshold
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - dayThreshold);
    
    return Array.from(this.products.values())
      .filter(product => {
        // Products without lastStockUpdate or with lastStockUpdate older than the threshold
        return !product.lastStockUpdate || 
               (product.lastStockUpdate && product.lastStockUpdate < thresholdDate);
      });
  }
  
  async searchProducts(query: string, category?: string, stockStatus?: string, tag?: string): Promise<Product[]> {
    let filteredProducts = Array.from(this.products.values());
    
    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredProducts = filteredProducts.filter(
        product => 
          product.name.toLowerCase().includes(lowerQuery) || 
          product.sku.toLowerCase().includes(lowerQuery)
      );
    }
    
    // Handle tag filtering if tag parameter is provided
    if (tag && tag !== 'all_tags') {
      // Try to find tag by name first
      const tagObj = await this.getTagByName(tag);
      if (tagObj) {
        // Get all products with this tag
        const productsWithTagIds = new Set<number>();
        
        // Collect product IDs with this tag
        const productTagEntries = Array.from(this.productTagsMap.keys())
          .filter(key => key.endsWith(`-${tagObj.id}`))
          .map(key => parseInt(key.split('-')[0], 10));
        
        productTagEntries.forEach(id => productsWithTagIds.add(id));
        
        // Filter products by the collected IDs
        filteredProducts = filteredProducts.filter(product => 
          productsWithTagIds.has(product.id)
        );
      } else {
        // Try to filter by tagId if it's a number
        const tagId = parseInt(tag, 10);
        if (!isNaN(tagId)) {
          const productsWithTagIds = new Set<number>();
          
          // Collect product IDs with this tag ID
          const productTagEntries = Array.from(this.productTagsMap.keys())
            .filter(key => key.endsWith(`-${tagId}`))
            .map(key => parseInt(key.split('-')[0], 10));
          
          productTagEntries.forEach(id => productsWithTagIds.add(id));
          
          // Filter products by the collected IDs
          filteredProducts = filteredProducts.filter(product => 
            productsWithTagIds.has(product.id)
          );
        }
      }
    }
    
    // For backward compatibility, still handle category filtering
    if (category && category !== 'all') {
      // Try to find category by name first
      const categoryObj = await this.getCategoryByName(category);
      if (categoryObj) {
        // Filter by category ID if found
        filteredProducts = filteredProducts.filter(
          product => product.categoryId === categoryObj.id
        );
      } else {
        // Try to filter by categoryId if it's a number
        const categoryId = parseInt(category, 10);
        if (!isNaN(categoryId)) {
          filteredProducts = filteredProducts.filter(
            product => product.categoryId === categoryId
          );
        }
      }
    }
    
    if (stockStatus) {
      switch(stockStatus) {
        case 'in-stock':
          filteredProducts = filteredProducts.filter(
            product => product.currentStock > product.minStockLevel
          );
          break;
        case 'low-stock':
          filteredProducts = filteredProducts.filter(
            product => 
              product.currentStock > 0 && 
              product.currentStock <= product.minStockLevel
          );
          break;
        case 'out-stock':
          filteredProducts = filteredProducts.filter(
            product => product.currentStock === 0
          );
          break;
      }
    }
    
    return filteredProducts;
  }
  
  // Order methods
  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }
  
  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    return Array.from(this.orders.values()).find(
      (order) => order.orderNumber === orderNumber
    );
  }
  
  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }
  
  async getRecentOrders(limit: number): Promise<Order[]> {
    return Array.from(this.orders.values())
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
      .slice(0, limit);
  }
  
  async getOrdersByCustomer(customerName: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => order.customerName.toLowerCase() === customerName.toLowerCase())
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }
  
  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = this.orderIdCounter++;
    const orderNumber = `ORD-${String(id).padStart(4, '0')}`;
    
    const order: Order = { 
      ...insertOrder,
      orderDate: new Date(insertOrder.orderDate || Date.now()),
      id, 
      orderNumber,
      status: insertOrder.status || 'pending',
      notes: insertOrder.notes || null,
      hasShippingDocument: false,
      updatedById: null,
      lastUpdated: null
    };
    
    this.orders.set(id, order);
    
    // Add changelog entry for creation
    await this.addOrderChangelog({
      orderId: id,
      userId: insertOrder.createdById,
      action: 'create',
      changes: { ...order },
      previousValues: {},
      notes: "Order created"
    });
    
    return order;
  }
  
  async updateOrderStatus(
    id: number, 
    status: 'pending' | 'picked' | 'shipped' | 'cancelled',
    documentInfo?: { documentPath: string, documentType: string, notes?: string },
    updatedById?: number
  ): Promise<Order | undefined> {
    const existingOrder = this.orders.get(id);
    if (!existingOrder) return undefined;
    
    // Track the previous values
    const previousValues = { ...existingOrder };
    
    // If status is 'shipped' and documentInfo is provided, create or update shipping document
    if (status === 'shipped' && documentInfo) {
      // Check if shipping document already exists
      const existingDoc = await this.getShippingDocument(id);
      
      if (existingDoc) {
        // Update existing document
        await this.updateShippingDocument(existingDoc.id, {
          documentPath: documentInfo.documentPath,
          documentType: documentInfo.documentType,
          notes: documentInfo.notes || undefined
        });
      } else {
        // Create new document
        await this.addShippingDocument({
          orderId: id,
          documentPath: documentInfo.documentPath,
          documentType: documentInfo.documentType,
          notes: documentInfo.notes || undefined
        });
      }
      
      // Update order with shipping document flag
      const now = new Date();
      const updatedOrder = { 
        ...existingOrder, 
        status,
        hasShippingDocument: true,
        lastUpdated: now
      };
      this.orders.set(id, updatedOrder);
      
      // Add changelog entry if we have a user ID
      if (updatedById) {
        await this.addOrderChangelog({
          orderId: id,
          userId: updatedById,
          action: 'status_change',
          changes: { status, hasShippingDocument: true, lastUpdated: now },
          previousValues: previousValues,
          notes: `Order status changed to ${status} with document`
        });
      }
      
      return updatedOrder;
    } else {
      // Just update status
      const now = new Date();
      const updatedOrder = { 
        ...existingOrder, 
        status,
        lastUpdated: now
      };
      this.orders.set(id, updatedOrder);
      
      // Add changelog entry if we have a user ID
      if (updatedById) {
        await this.addOrderChangelog({
          orderId: id,
          userId: updatedById,
          action: 'status_change',
          changes: { status, lastUpdated: now },
          previousValues: previousValues,
          notes: `Order status changed to ${status}`
        });
      }
      
      return updatedOrder;
    }
  }

  async updateOrder(id: number, orderData: Partial<InsertOrder>, updatedById?: number): Promise<Order | undefined> {
    const existingOrder = this.orders.get(id);
    if (!existingOrder) return undefined;
    
    const previousValues = { ...existingOrder };
    
    // Add update tracking
    const now = new Date();
    const updatedOrder = { 
      ...existingOrder,
      ...orderData,
      updatedById: updatedById || existingOrder.updatedById,
      lastUpdated: now
    };
    
    this.orders.set(id, updatedOrder);
    
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
      const existingOrder = this.orders.get(id);
      if (!existingOrder) return false;
      
      // 1. Delete related order items
      const orderItemsToDelete = Array.from(this.orderItems.values())
        .filter(item => item.orderId === id)
        .map(item => item.id);
      
      for (const itemId of orderItemsToDelete) {
        this.orderItems.delete(itemId);
      }
      
      // 2. Delete shipping documents
      const shippingDocsToDelete = Array.from(this.shippingDocuments.values())
        .filter(doc => doc.orderId === id)
        .map(doc => doc.id);
        
      for (const docId of shippingDocsToDelete) {
        this.shippingDocuments.delete(docId);
      }
      
      // 3. Delete order changelogs
      const changelogsToDelete = Array.from(this.orderChangelogs.values())
        .filter(log => log.orderId === id)
        .map(log => log.id);
        
      for (const logId of changelogsToDelete) {
        this.orderChangelogs.delete(logId);
      }
      
      // 4. Delete unshipped items
      const unshippedItemsToDelete = Array.from(this.unshippedItems.values())
        .filter(item => item.orderId === id)
        .map(item => item.id);
        
      for (const itemId of unshippedItemsToDelete) {
        this.unshippedItems.delete(itemId);
      }
      
      // 5. Finally delete the order itself
      return this.orders.delete(id);
    } catch (error) {
      console.error('Error deleting order:', error);
      return false;
    }
  }
  
  // Order Item methods
  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values())
      .filter(item => item.orderId === orderId);
  }
  
  async addOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const id = this.orderItemIdCounter++;
    const orderItem: OrderItem = { ...insertOrderItem, id };
    
    // Reduce product stock
    const product = await this.getProduct(orderItem.productId);
    if (product) {
      const updatedStock = Math.max(0, product.currentStock - orderItem.quantity);
      await this.updateProduct(product.id, { currentStock: updatedStock });
    }
    
    this.orderItems.set(id, orderItem);
    return orderItem;
  }
  
  // Shipping Document methods
  async getShippingDocument(orderId: number): Promise<ShippingDocument | undefined> {
    return Array.from(this.shippingDocuments.values()).find(
      (doc) => doc.orderId === orderId
    );
  }
  
  async addShippingDocument(document: InsertShippingDocument): Promise<ShippingDocument> {
    const id = this.shippingDocumentIdCounter++;
    const shippingDocument: ShippingDocument = { 
      ...document, 
      id,
      uploadDate: new Date(),
      notes: document.notes || null
    };
    
    this.shippingDocuments.set(id, shippingDocument);
    return shippingDocument;
  }
  
  async updateShippingDocument(id: number, document: Partial<InsertShippingDocument>): Promise<ShippingDocument | undefined> {
    const existingDocument = this.shippingDocuments.get(id);
    if (!existingDocument) return undefined;
    
    const updatedDocument = { ...existingDocument, ...document };
    this.shippingDocuments.set(id, updatedDocument);
    return updatedDocument;
  }
  
  // Order Changelog methods
  async getOrderChangelogs(orderId: number): Promise<OrderChangelog[]> {
    return Array.from(this.orderChangelogs.values())
      .filter(changelog => changelog.orderId === orderId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  
  async addOrderChangelog(changelog: InsertOrderChangelog): Promise<OrderChangelog> {
    const id = this.orderChangelogIdCounter++;
    const orderChangelog: OrderChangelog = {
      ...changelog,
      id,
      timestamp: new Date(),
      changes: changelog.changes || {},
      previousValues: changelog.previousValues || {},
      notes: changelog.notes || null
    };
    
    this.orderChangelogs.set(id, orderChangelog);
    return orderChangelog;
  }
  
  async getOrderChangelogById(id: number): Promise<OrderChangelog | undefined> {
    return this.orderChangelogs.get(id);
  }
  
  // Customer methods
  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }
  
  async getCustomerByVatNumber(vatNumber: string): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find(
      (customer) => customer.vatNumber === vatNumber
    );
  }
  
  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }
  
  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = this.customerIdCounter++;
    // Create a complete customer with all fields (handling nulls correctly)
    const customer: Customer = { 
      ...insertCustomer, 
      id,
      vatNumber: insertCustomer.vatNumber || null,
      address: insertCustomer.address || null,
      city: insertCustomer.city || null,
      state: insertCustomer.state || null,
      postalCode: insertCustomer.postalCode || null,
      country: insertCustomer.country || null,
      email: insertCustomer.email || null,
      phone: insertCustomer.phone || null,
      contactPerson: insertCustomer.contactPerson || null,
      preferredShippingCompany: insertCustomer.preferredShippingCompany || null,
      customShippingCompany: insertCustomer.customShippingCompany || "",
      notes: insertCustomer.notes || null,
      createdAt: new Date()
    };
    
    this.customers.set(id, customer);
    return customer;
  }
  
  async updateCustomer(id: number, customerUpdate: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const existingCustomer = this.customers.get(id);
    if (!existingCustomer) return undefined;
    
    const updatedCustomer = { ...existingCustomer, ...customerUpdate };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }
  
  async deleteCustomer(id: number): Promise<boolean> {
    return this.customers.delete(id);
  }
  
  async searchCustomers(query: string): Promise<Customer[]> {
    if (!query) return this.getAllCustomers();
    
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.customers.values()).filter(customer => 
      customer.name.toLowerCase().includes(lowercaseQuery) || 
      (customer.vatNumber && customer.vatNumber.toLowerCase().includes(lowercaseQuery)) ||
      (customer.email && customer.email.toLowerCase().includes(lowercaseQuery)) ||
      (customer.contactPerson && customer.contactPerson.toLowerCase().includes(lowercaseQuery))
    );
  }
  
  // Stats methods
  async getDashboardStats(): Promise<{
    pendingOrders: number;
    itemsToPick: number;
    shippedToday: number;
    lowStockItems: number;
  }> {
    const allOrders = Array.from(this.orders.values());
    const pendingOrders = allOrders.filter(order => order.status === 'pending').length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const shippedToday = allOrders.filter(
      order => 
        order.status === 'shipped' && 
        new Date(order.orderDate) >= today
    ).length;
    
    let itemsToPick = 0;
    const pendingOrderIds = allOrders
      .filter(order => order.status === 'pending')
      .map(order => order.id);
    
    const allOrderItems = Array.from(this.orderItems.values());
    for (const orderItem of allOrderItems) {
      if (pendingOrderIds.includes(orderItem.orderId)) {
        itemsToPick += orderItem.quantity;
      }
    }
    
    const lowStockItems = (await this.getLowStockProducts()).length;
    
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
    // For now, we'll generate some realistic sample data
    const products = Array.from(this.products.values());
    const totalProducts = products.length;
    
    const result = [];
    for (let i = 0; i < weeks; i++) {
      const weekName = `Week ${i + 1}`;
      
      // Calculate actual current figures for the latest week
      let inStock = 0;
      let lowStock = 0;
      let outOfStock = 0;
      
      if (i === weeks - 1) {
        // Use actual current data for the last week
        inStock = products.filter(p => p.currentStock > p.minStockLevel).length;
        lowStock = products.filter(p => p.currentStock > 0 && p.currentStock <= p.minStockLevel).length;
        outOfStock = products.filter(p => p.currentStock === 0).length;
      } else {
        // Generate realistic variations for historical weeks
        // This simulates historical data while maintaining realistic patterns
        const baseInStock = Math.floor(totalProducts * 0.7);
        const baseLowStock = Math.floor(totalProducts * 0.2);
        const baseOutOfStock = Math.floor(totalProducts * 0.1);
        
        // Add random variations to simulate changes over time
        inStock = baseInStock + Math.floor(Math.random() * 10) - 5;
        lowStock = baseLowStock + Math.floor(Math.random() * 6) - 3;
        outOfStock = baseOutOfStock + Math.floor(Math.random() * 4) - 2;
        
        // Ensure positive values and correct total
        inStock = Math.max(0, inStock);
        lowStock = Math.max(0, lowStock);
        outOfStock = Math.max(0, outOfStock);
        
        // Adjust to match total
        const total = inStock + lowStock + outOfStock;
        if (total !== totalProducts) {
          inStock += (totalProducts - total);
        }
      }
      
      result.push({
        name: weekName,
        inStock,
        lowStock,
        outOfStock
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
    const allOrders = Array.from(this.orders.values());
    const result = [];
    
    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Generate data for each month
    for (let i = 0; i < months; i++) {
      const monthIndex = (currentMonth - i + 12) % 12; // Go back i months
      const year = currentYear - Math.floor((i - (currentMonth + 1)) / 12);
      const monthName = new Date(year, monthIndex, 1).toLocaleString('default', { month: 'short' });
      
      // Calculate start and end dates for this month
      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59);
      
      // Filter orders for this month
      const monthOrders = allOrders.filter(order => {
        const orderDate = new Date(order.orderDate);
        return orderDate >= startDate && orderDate <= endDate;
      });
      
      // Count by status
      const pending = monthOrders.filter(order => order.status === 'pending').length;
      const picked = monthOrders.filter(order => order.status === 'picked').length;
      const shipped = monthOrders.filter(order => order.status === 'shipped').length;
      const cancelled = monthOrders.filter(order => order.status === 'cancelled').length;
      
      result.unshift({
        name: monthName,
        pending,
        picked,
        shipped,
        cancelled
      });
    }
    
    return result;
  }

  async getProductCategoryData(): Promise<{
    name: string;
    value: number;
  }[]> {
    const products = Array.from(this.products.values());
    const allCategories = Array.from(this.categories.values());
    const categoryCounts = {} as Record<number, number>;
    
    // Count products by categoryId
    products.forEach(product => {
      const categoryId = product.categoryId;
      if (!categoryCounts[categoryId]) {
        categoryCounts[categoryId] = 0;
      }
      categoryCounts[categoryId]++;
    });
    
    // Convert to array format with category names
    return Object.entries(categoryCounts).map(([categoryIdStr, value]) => {
      const categoryId = parseInt(categoryIdStr, 10);
      const category = allCategories.find(c => c.id === categoryId);
      return {
        name: category ? category.name : `Category ${categoryId}`,
        value
      };
    });
  }

  async getTopSellingProducts(limit: number = 5): Promise<{
    id: number;
    name: string;
    sku: string;
    soldQuantity: number;
  }[]> {
    const allOrderItems = Array.from(this.orderItems.values());
    const productSales = {} as Record<number, number>;
    
    // Calculate total quantity sold for each product
    allOrderItems.forEach(item => {
      if (!productSales[item.productId]) {
        productSales[item.productId] = 0;
      }
      productSales[item.productId] += item.quantity;
    });
    
    // Convert to array and sort by quantity sold
    const sortedProducts = Object.entries(productSales)
      .map(([productId, soldQuantity]) => {
        const product = this.products.get(parseInt(productId));
        return {
          id: parseInt(productId),
          name: product?.name || 'Unknown Product',
          sku: product?.sku || 'N/A',
          soldQuantity
        };
      })
      .sort((a, b) => b.soldQuantity - a.soldQuantity)
      .slice(0, limit);
    
    return sortedProducts;
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
    const products = Array.from(this.products.values());
    const allCategories = Array.from(this.categories.values());
    
    // Calculate individual product values (simulated as we don't have price in the model)
    const productValues = products.map(product => {
      // Find the category name
      const category = allCategories.find(c => c.id === product.categoryId);
      const categoryName = category ? category.name : 'unknown';
      
      // Simulate product price based on category and stock level
      let basePrice = 0;
      // Use a default price for each product
      basePrice = 10.00 + (Math.random() * 15); // Random price between 10 and 25
      
      // Calculate total value
      return {
        product,
        categoryId: product.categoryId,
        categoryName,
        value: basePrice * product.currentStock
      };
    });
    
    // Calculate total inventory value
    const totalValue = productValues.reduce((sum, item) => sum + item.value, 0);
    
    // Calculate category breakdown
    const categories = {} as Record<number, {
      name: string;
      productCount: number;
      totalValue: number;
    }>;
    
    productValues.forEach(({ product, categoryId, categoryName, value }) => {
      if (!categories[categoryId]) {
        categories[categoryId] = {
          name: categoryName,
          productCount: 0,
          totalValue: 0
        };
      }
      categories[categoryId].productCount++;
      categories[categoryId].totalValue += value;
    });
    
    // Convert to array with percentage
    const categoryBreakdown = Object.entries(categories).map(([categoryIdStr, data]) => ({
      category: data.name,
      productCount: data.productCount,
      totalValue: data.totalValue,
      percentageOfTotal: (data.totalValue / totalValue) * 100
    }));
    
    return {
      totalValue,
      categoryBreakdown: categoryBreakdown.sort((a, b) => b.totalValue - a.totalValue)
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
    const allOrders = Array.from(this.orders.values());
    const pickedOrders = allOrders.filter(order => 
      order.status === 'picked' || order.status === 'shipped'
    );
    
    // Simulate picking efficiency data (in real system, would use actual timestamps)
    const pickingData: {date: string; ordersProcessed: number; avgTimeMinutes: number}[] = [];
    
    // Get dates for the last 7 days
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date);
    }
    
    // Generate data for each day
    let totalTime = 0;
    let totalOrders = 0;
    
    dates.forEach(date => {
      // Simulate orders processed on this day
      const ordersProcessed = Math.floor(Math.random() * 5) + 1;
      // Simulate average picking time (10-25 minutes)
      const avgTimeMinutes = 10 + Math.floor(Math.random() * 15);
      
      totalOrders += ordersProcessed;
      totalTime += avgTimeMinutes * ordersProcessed;
      
      pickingData.push({
        date: date.toISOString().split('T')[0],
        ordersProcessed,
        avgTimeMinutes
      });
    });
    
    const averagePickingTimeMinutes = totalOrders > 0 ? totalTime / totalOrders : 0;
    
    return {
      averagePickingTimeMinutes,
      pickingEfficiency: pickingData
    };
  }
  
  // Unshipped Items methods
  async getUnshippedItem(id: number): Promise<UnshippedItem | undefined> {
    return this.unshippedItems.get(id);
  }
  
  async getUnshippedItems(customerName?: string): Promise<UnshippedItem[]> {
    let items = Array.from(this.unshippedItems.values())
      .filter(item => !item.shipped);
    
    if (customerName) {
      items = items.filter(item => 
        item.customerName.toLowerCase().includes(customerName.toLowerCase())
      );
    }
    
    return items;
  }
  
  async getUnshippedItemsByOrder(orderId: number): Promise<UnshippedItem[]> {
    return Array.from(this.unshippedItems.values())
      .filter(item => item.orderId === orderId && !item.shipped);
  }
  
  async addUnshippedItem(item: InsertUnshippedItem): Promise<UnshippedItem> {
    const id = this.unshippedItemIdCounter++;
    const unshippedItem: UnshippedItem = {
      ...item,
      id,
      date: new Date(),
      shipped: false,
      shippedInOrderId: null,
      authorized: false,
      authorizedById: null,
      notes: item.notes || null
    };
    
    this.unshippedItems.set(id, unshippedItem);
    return unshippedItem;
  }
  
  async authorizeUnshippedItems(ids: number[], userId: number): Promise<void> {
    for (const id of ids) {
      const item = this.unshippedItems.get(id);
      if (item) {
        const updatedItem = {
          ...item,
          authorized: true,
          authorizedById: userId
        };
        this.unshippedItems.set(id, updatedItem);
      }
    }
  }
  
  async markUnshippedItemsAsShipped(ids: number[], newOrderId: number): Promise<void> {
    for (const id of ids) {
      const item = this.unshippedItems.get(id);
      if (item) {
        const updatedItem = {
          ...item,
          shipped: true,
          shippedInOrderId: newOrderId
        };
        this.unshippedItems.set(id, updatedItem);
      }
    }
  }
  
  async getUnshippedItemsForAuthorization(): Promise<UnshippedItem[]> {
    return Array.from(this.unshippedItems.values())
      .filter(item => !item.authorized && !item.shipped);
  }
  
  // Email Settings methods
  async getEmailSettings(): Promise<EmailSettings | undefined> {
    return this.emailSettingsData;
  }
  
  async updateEmailSettings(settings: Partial<InsertEmailSettings>): Promise<EmailSettings | undefined> {
    if (!this.emailSettingsData) {
      // Create new settings if none exist
      this.emailSettingsData = {
        id: 1,
        host: settings.host || 'smtp.gmail.com',
        port: settings.port || 587,
        secure: settings.secure ?? false,
        authUser: settings.authUser || '',
        authPass: settings.authPass || '',
        fromEmail: settings.fromEmail || '',
        companyName: settings.companyName || 'Warehouse Management System',
        enableNotifications: settings.enableNotifications ?? true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      // Update existing settings
      this.emailSettingsData = {
        ...this.emailSettingsData,
        ...settings,
        updatedAt: new Date()
      };
    }
    
    return this.emailSettingsData;
  }
  
  // Company settings methods
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    return this.companySettingsData;
  }
  
  async updateCompanySettings(settings: Partial<InsertCompanySettings>): Promise<CompanySettings | undefined> {
    if (!this.companySettingsData) {
      // Create new settings if none exist
      this.companySettingsData = {
        id: 1,
        companyName: settings.companyName || 'Warehouse Systems Inc.',
        email: settings.email || 'info@warehousesys.com',
        phone: settings.phone || '',
        address: settings.address || '',
        logoPath: settings.logoPath || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      // Update existing settings
      this.companySettingsData = {
        ...this.companySettingsData,
        ...settings,
        updatedAt: new Date()
      };
    }
    
    return this.companySettingsData;
  }
  
  // Notification settings methods
  async getNotificationSettings(): Promise<NotificationSettings | undefined> {
    return this.notificationSettingsData;
  }
  
  async updateNotificationSettings(settings: Partial<InsertNotificationSettings>): Promise<NotificationSettings | undefined> {
    if (!this.notificationSettingsData) {
      // Create new settings if none exist
      this.notificationSettingsData = {
        id: 1,
        lowStockAlerts: settings.lowStockAlerts ?? true,
        orderConfirmation: settings.orderConfirmation ?? true,
        shippingUpdates: settings.shippingUpdates ?? true,
        dailyReports: settings.dailyReports ?? false,
        weeklyReports: settings.weeklyReports ?? true,
        soundEnabled: settings.soundEnabled ?? true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      // Update existing settings
      this.notificationSettingsData = {
        ...this.notificationSettingsData,
        ...settings,
        updatedAt: new Date()
      };
    }
    
    return this.notificationSettingsData;
  }
  
  // Role permissions storage
  private rolePermissionsMap: Map<string, RolePermission> = new Map();
  private rolePermissionsIdCounter: number = 1;
  
  // Helper method to initialize default role permissions if not already done
  private async initRolePermissions() {
    const allPermissions = [
      'view_dashboard', 'view_products', 'edit_products', 
      'view_customers', 'edit_customers', 'view_orders', 'create_orders', 
      'edit_orders', 'delete_orders', 'view_reports', 'order_picking',
      'view_unshipped_items', 'authorize_unshipped_items', 'view_settings',
      'edit_settings', 'view_users', 'edit_users', 'view_email_templates',
      'edit_email_templates'
    ];
    
    const roles = ['admin', 'manager', 'front_office', 'warehouse'];
    
    // Default permissions for each role
    const defaultPermissions: Record<string, string[]> = {
      'admin': allPermissions,
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
    
    // Check if permissions exist for each role
    for (const role of roles) {
      const existingPermissions = await this.getRolePermissions(role);
      
      // If no permissions exist for this role, create default ones
      if (existingPermissions.length === 0) {
        for (const permission of allPermissions) {
          const enabled = defaultPermissions[role].includes(permission);
          await this.updateRolePermission(role, permission, enabled);
        }
      }
    }
  }
  
  async getRolePermissions(role: string): Promise<RolePermission[]> {
    // Initialize if needed
    const permCount = this.rolePermissionsMap.size;
    if (permCount === 0) {
      await this.initRolePermissions();
    }
    
    return Array.from(this.rolePermissionsMap.values())
      .filter(perm => perm.role === role);
  }
  
  async getAllRolePermissions(): Promise<RolePermission[]> {
    // Initialize if needed
    const permCount = this.rolePermissionsMap.size;
    if (permCount === 0) {
      await this.initRolePermissions();
    }
    
    return Array.from(this.rolePermissionsMap.values());
  }
  
  async updateRolePermission(role: string, permission: string, enabled: boolean): Promise<RolePermission | undefined> {
    // Check if permission already exists
    const key = `${role}-${permission}`;
    const existingPermission = this.rolePermissionsMap.get(key);
    
    if (existingPermission) {
      // Update existing permission
      const updatedPermission: RolePermission = {
        ...existingPermission,
        enabled,
        updatedAt: new Date()
      };
      this.rolePermissionsMap.set(key, updatedPermission);
      return updatedPermission;
    } else {
      // Create new permission
      const id = this.rolePermissionsIdCounter++;
      const newPermission: RolePermission = {
        id,
        role: role as any, // Type assertion needed because enums are strings
        permission: permission as any,
        enabled,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.rolePermissionsMap.set(key, newPermission);
      return newPermission;
    }
  }
  
  async checkPermission(role: string, permission: string): Promise<boolean> {
    if (role === 'admin') {
      return true; // Admin always has all permissions
    }
    
    // Initialize if needed
    const permCount = this.rolePermissionsMap.size;
    if (permCount === 0) {
      await this.initRolePermissions();
    }
    
    const key = `${role}-${permission}`;
    const permissionRecord = this.rolePermissionsMap.get(key);
    
    // If permission record doesn't exist, deny access
    return permissionRecord ? permissionRecord.enabled : false;
  }
  
  // Call Logs methods
  async getCallLog(id: number): Promise<CallLog | undefined> {
    return this.callLogs.get(id);
  }
  
  async getAllCallLogs(dateFrom?: string, dateTo?: string): Promise<CallLog[]> {
    let logs = Array.from(this.callLogs.values());
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      logs = logs.filter(log => log.callDate >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      logs = logs.filter(log => log.callDate <= toDate);
    }
    
    return logs.sort((a, b) => b.callDate.getTime() - a.callDate.getTime());
  }
  
  async getCallLogsByCustomer(customerId: number): Promise<CallLog[]> {
    return Array.from(this.callLogs.values())
      .filter(log => log.customerId === customerId)
      .sort((a, b) => b.callDate.getTime() - a.callDate.getTime());
  }
  
  async getScheduledCalls(userId?: number): Promise<CallLog[]> {
    let logs = Array.from(this.callLogs.values())
      .filter(log => log.callStatus === 'scheduled');
    
    if (userId) {
      logs = logs.filter(log => log.userId === userId || log.followupAssignedTo === userId);
    }
    
    return logs.sort((a, b) => a.callDate.getTime() - b.callDate.getTime());
  }
  
  async getCallLogsRequiringFollowup(): Promise<CallLog[]> {
    return Array.from(this.callLogs.values())
      .filter(log => log.callStatus === 'needs_followup')
      .sort((a, b) => (a.followupDate?.getTime() || 0) - (b.followupDate?.getTime() || 0));
  }
  
  async searchCallLogs(query: string): Promise<CallLog[]> {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.callLogs.values())
      .filter(log => 
        log.contactName.toLowerCase().includes(lowercaseQuery) ||
        (log.companyName && log.companyName.toLowerCase().includes(lowercaseQuery)) ||
        (log.notes && log.notes.toLowerCase().includes(lowercaseQuery)) ||
        (log.tags && log.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)))
      )
      .sort((a, b) => b.callDate.getTime() - a.callDate.getTime());
  }
  
  async createCallLog(callLog: InsertCallLog): Promise<CallLog> {
    const id = this.callLogIdCounter++;
    
    const now = new Date();
    const newCallLog: CallLog = {
      id,
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
    };
    
    this.callLogs.set(id, newCallLog);
    return newCallLog;
  }
  
  async updateCallLog(id: number, callLog: Partial<InsertCallLog>): Promise<CallLog | undefined> {
    const existingLog = this.callLogs.get(id);
    if (!existingLog) return undefined;
    
    const updatedLog: CallLog = {
      ...existingLog,
      ...callLog,
      customerId: callLog.customerId !== undefined ? callLog.customerId : existingLog.customerId,
      companyName: callLog.companyName !== undefined ? callLog.companyName : existingLog.companyName,
      callTime: callLog.callTime !== undefined ? callLog.callTime : existingLog.callTime,
      duration: callLog.duration !== undefined ? callLog.duration : existingLog.duration,
      notes: callLog.notes !== undefined ? callLog.notes : existingLog.notes,
      followupDate: callLog.followupDate !== undefined ? callLog.followupDate : existingLog.followupDate,
      followupTime: callLog.followupTime !== undefined ? callLog.followupTime : existingLog.followupTime,
      followupAssignedTo: callLog.followupAssignedTo !== undefined ? callLog.followupAssignedTo : existingLog.followupAssignedTo,
      previousCallId: callLog.previousCallId !== undefined ? callLog.previousCallId : existingLog.previousCallId,
      tags: callLog.tags !== undefined ? callLog.tags : existingLog.tags,
      updatedAt: new Date()
    };
    
    this.callLogs.set(id, updatedLog);
    return updatedLog;
  }
  
  async deleteCallLog(id: number): Promise<boolean> {
    return this.callLogs.delete(id);
  }
  
  // Call Outcome methods
  async getCallOutcome(id: number): Promise<CallOutcome | undefined> {
    return this.callOutcomes.get(id);
  }
  
  async getCallOutcomesByCall(callId: number): Promise<CallOutcome[]> {
    return Array.from(this.callOutcomes.values())
      .filter(outcome => outcome.callId === callId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  
  async createCallOutcome(outcome: InsertCallOutcome): Promise<CallOutcome> {
    const id = this.callOutcomeIdCounter++;
    
    const now = new Date();
    const newOutcome: CallOutcome = {
      id,
      ...outcome,
      dueDate: outcome.dueDate || null,
      assignedToId: outcome.assignedToId || null,
      notes: outcome.notes || null,
      completedById: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };
    
    this.callOutcomes.set(id, newOutcome);
    return newOutcome;
  }
  
  async updateCallOutcome(id: number, outcome: Partial<InsertCallOutcome>): Promise<CallOutcome | undefined> {
    const existingOutcome = this.callOutcomes.get(id);
    if (!existingOutcome) return undefined;
    
    const updatedOutcome: CallOutcome = {
      ...existingOutcome,
      ...outcome,
      dueDate: outcome.dueDate !== undefined ? outcome.dueDate : existingOutcome.dueDate,
      assignedToId: outcome.assignedToId !== undefined ? outcome.assignedToId : existingOutcome.assignedToId,
      notes: outcome.notes !== undefined ? outcome.notes : existingOutcome.notes,
      updatedAt: new Date()
    };
    
    this.callOutcomes.set(id, updatedOutcome);
    return updatedOutcome;
  }
  
  async completeCallOutcome(id: number, userId: number, notes?: string): Promise<CallOutcome | undefined> {
    const existingOutcome = this.callOutcomes.get(id);
    if (!existingOutcome) return undefined;
    
    const now = new Date();
    const completedOutcome: CallOutcome = {
      ...existingOutcome,
      status: 'completed',
      notes: notes !== undefined ? notes : existingOutcome.notes,
      completedById: userId,
      completedAt: now,
      updatedAt: now
    };
    
    this.callOutcomes.set(id, completedOutcome);
    return completedOutcome;
  }
  
  async deleteCallOutcome(id: number): Promise<boolean> {
    return this.callOutcomes.delete(id);
  }

  // Prospective Customer methods
  async getProspectiveCustomer(id: number): Promise<ProspectiveCustomer | undefined> {
    return this.prospectiveCustomers.get(id);
  }

  async getAllProspectiveCustomers(): Promise<ProspectiveCustomer[]> {
    return Array.from(this.prospectiveCustomers.values());
  }

  async getProspectiveCustomersByStatus(status: string): Promise<ProspectiveCustomer[]> {
    return Array.from(this.prospectiveCustomers.values())
      .filter(customer => customer.status === status);
  }

  async searchProspectiveCustomers(query: string): Promise<ProspectiveCustomer[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.prospectiveCustomers.values())
      .filter(customer => 
        customer.name.toLowerCase().includes(lowerQuery) ||
        (customer.companyName && customer.companyName.toLowerCase().includes(lowerQuery)) ||
        (customer.email && customer.email.toLowerCase().includes(lowerQuery)) ||
        (customer.phone && customer.phone.toLowerCase().includes(lowerQuery))
      );
  }

  async createProspectiveCustomer(customer: InsertProspectiveCustomer): Promise<ProspectiveCustomer> {
    const id = this.prospectiveCustomerIdCounter++;
    const now = new Date();
    
    const newCustomer: ProspectiveCustomer = {
      ...customer,
      id,
      createdAt: now,
      updatedAt: now,
      lastContactDate: customer.lastContactDate || now,
      nextContactDate: customer.nextContactDate || null,
      email: customer.email || null,
      phone: customer.phone || null,
      address: customer.address || null,
      city: customer.city || null,
      state: customer.state || null,
      postalCode: customer.postalCode || null,
      country: customer.country || null,
      notes: customer.notes || null
    };
    
    this.prospectiveCustomers.set(id, newCustomer);
    return newCustomer;
  }

  async updateProspectiveCustomer(id: number, customer: Partial<InsertProspectiveCustomer>): Promise<ProspectiveCustomer | undefined> {
    const existingCustomer = this.prospectiveCustomers.get(id);
    if (!existingCustomer) return undefined;
    
    const updatedCustomer = { 
      ...existingCustomer, 
      ...customer,
      updatedAt: new Date()
    };
    
    this.prospectiveCustomers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async deleteProspectiveCustomer(id: number): Promise<boolean> {
    return this.prospectiveCustomers.delete(id);
  }

  async convertToCustomer(id: number): Promise<Customer | undefined> {
    const prospectiveCustomer = this.prospectiveCustomers.get(id);
    if (!prospectiveCustomer) return undefined;
    
    // Create a new customer from the prospective customer data
    const customerId = this.customerIdCounter++;
    const now = new Date();
    
    const newCustomer: Customer = {
      id: customerId,
      name: prospectiveCustomer.name,
      email: prospectiveCustomer.email,
      phone: prospectiveCustomer.phone,
      address: prospectiveCustomer.address,
      city: prospectiveCustomer.city,
      state: prospectiveCustomer.state,
      postalCode: prospectiveCustomer.postalCode,
      country: prospectiveCustomer.country,
      notes: prospectiveCustomer.notes,
      vatNumber: null,
      paymentTerms: null,
      shippingMethod: null,
      shippingInstructions: null,
      shippingCompany: null,
      createdAt: now,
      updatedAt: now
    };
    
    // Add the new customer to the customers Map
    this.customers.set(customerId, newCustomer);
    
    // Remove the prospective customer
    this.prospectiveCustomers.delete(id);
    
    return newCustomer;
  }
  
  // Initialize with sample data
  private async initSampleData(): Promise<void> {
    try {
      // Sample customers with extended data
      await this.createCustomer({ 
        name: "Acme Corporation", 
        vatNumber: "GB123456789",
        address: "123 Business Park",
        city: "London",
        state: "",
        postalCode: "E1 6AN",
        country: "United Kingdom",
        email: "orders@acmecorp.example",
        phone: "+44 20 1234 5678",
        contactPerson: "John Smith",
        preferredShippingCompany: "royal_mail",
        customShippingCompany: null,
        notes: "Major account - priority shipping"
      });
      
      await this.createCustomer({ 
        name: "TechStart Inc.", 
        vatNumber: "US987654321",
        address: "456 Innovation Avenue",
        city: "San Francisco",
        state: "CA",
        postalCode: "94107",
        country: "United States",
        email: "purchasing@techstart.example",
        phone: "+1 415 555 1234",
        contactPerson: "Sarah Johnson",
        preferredShippingCompany: "fedex",
        customShippingCompany: null,
        notes: "Requires special packaging"
      });
      
      await this.createCustomer({ 
        name: "Euro Distributors GmbH", 
        vatNumber: "DE567891234",
        address: "789 Industrie Strasse",
        city: "Berlin",
        state: "",
        postalCode: "10115",
        country: "Germany",
        email: "info@eurodistributors.example",
        phone: "+49 30 9876 5432",
        contactPerson: "Klaus Mueller",
        preferredShippingCompany: "dhl",
        customShippingCompany: null,
        notes: ""
      });
      
      await this.createCustomer({ 
        name: "Pacific Traders Ltd", 
        vatNumber: "AU123789456",
        address: "10 Harbor Road",
        city: "Sydney",
        state: "NSW",
        postalCode: "2000",
        country: "Australia",
        email: "orders@pacifictraders.example",
        phone: "+61 2 8765 4321",
        contactPerson: "Emma Davis",
        preferredShippingCompany: "ups",
        customShippingCompany: null,
        notes: "Bulk orders only"
      });
    } catch (error) {
      console.error("Error initializing sample data:", error);
    }
  }
}

// Initialize storage based on environment or configuration
// For development or testing, use MemStorage
// For production, use DatabaseStorage
export let storage: IStorage = new MemStorage();

// This function switches to database storage when called
export async function useDatabase() {
  try {
    // Initialize database storage
    const dbStorage = await initStorage();
    
    // Switch the storage implementation
    storage = dbStorage;
    
    log('Successfully switched to database storage', 'database');
    return true;
  } catch (error) {
    log(`Failed to switch to database storage: ${error instanceof Error ? error.message : String(error)}`, 'database');
    log('Falling back to in-memory storage', 'database');
    return false;
  }
}
