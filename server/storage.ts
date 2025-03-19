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
import { DatabaseStorage, initStorage } from './storage.postgresql';
import { log } from './vite';

export interface IStorage {
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
  
  // Product methods
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  getLowStockProducts(): Promise<Product[]>;
  searchProducts(query: string, category?: string, stockStatus?: string): Promise<Product[]>;
  
  // Order methods
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getRecentOrders(limit: number): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: 'pending' | 'picked' | 'shipped' | 'cancelled', documentInfo?: {documentPath: string, documentType: string, notes?: string}): Promise<Order | undefined>;
  updateOrder(id: number, orderData: Partial<InsertOrder>): Promise<Order | undefined>;
  
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
  
  private userIdCounter: number;
  private categoryIdCounter: number;
  private productIdCounter: number;
  private orderIdCounter: number;
  private orderItemIdCounter: number;
  private customerIdCounter: number;
  private shippingDocumentIdCounter: number;
  private orderChangelogIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.customers = new Map();
    this.shippingDocuments = new Map();
    this.orderChangelogs = new Map();
    
    this.userIdCounter = 1;
    this.categoryIdCounter = 1;
    this.productIdCounter = 1;
    this.orderIdCounter = 1;
    this.orderItemIdCounter = 1;
    this.customerIdCounter = 1;
    this.shippingDocumentIdCounter = 1;
    this.orderChangelogIdCounter = 1;
    
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
      ...insertCategory,
      id,
      description: insertCategory.description || null,
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
  
  async updateProduct(id: number, productUpdate: Partial<InsertProduct>): Promise<Product | undefined> {
    const existingProduct = this.products.get(id);
    if (!existingProduct) return undefined;
    
    const updatedProduct = { ...existingProduct, ...productUpdate };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }
  
  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }
  
  async getLowStockProducts(): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter(product => product.currentStock <= product.minStockLevel);
  }
  
  async searchProducts(query: string, category?: string, stockStatus?: string): Promise<Product[]> {
    let filteredProducts = Array.from(this.products.values());
    
    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredProducts = filteredProducts.filter(
        product => 
          product.name.toLowerCase().includes(lowerQuery) || 
          product.sku.toLowerCase().includes(lowerQuery)
      );
    }
    
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
    documentInfo?: { documentPath: string, documentType: string, notes?: string }
  ): Promise<Order | undefined> {
    const existingOrder = this.orders.get(id);
    if (!existingOrder) return undefined;
    
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
      const updatedOrder = { 
        ...existingOrder, 
        status,
        hasShippingDocument: true 
      };
      this.orders.set(id, updatedOrder);
      return updatedOrder;
    } else {
      // Just update status
      const updatedOrder = { ...existingOrder, status };
      this.orders.set(id, updatedOrder);
      return updatedOrder;
    }
  }

  async updateOrder(id: number, orderData: Partial<InsertOrder> & { updatedById: number }): Promise<Order | undefined> {
    const existingOrder = this.orders.get(id);
    if (!existingOrder) return undefined;
    
    const previousValues = { ...existingOrder };
    
    // Add update tracking
    const now = new Date();
    const updatedOrder = { 
      ...existingOrder,
      ...orderData,
      lastUpdated: now
    };
    
    this.orders.set(id, updatedOrder);
    
    // Add changelog entry
    await this.addOrderChangelog({
      orderId: id,
      userId: orderData.updatedById,
      action: 'update',
      changes: { ...orderData },
      previousValues: previousValues,
      notes: "Order updated"
    });
    
    return updatedOrder;
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
      changes: changelog.changes || null,
      previousValues: changelog.previousValues || null,
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
  
  // Initialize with sample data
  private async initSampleData() {
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
      customShippingCompany: "",
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
      customShippingCompany: "",
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
      customShippingCompany: "",
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
      customShippingCompany: "",
      notes: "Bulk orders only"
    });
    
    // Create sample categories
    const widgetsCategory = await this.createCategory({
      name: "Widgets",
      description: "Various widget products for industrial use"
    });
    
    const connectorsCategory = await this.createCategory({
      name: "Connectors",
      description: "Connection components for various applications"
    });
    
    const bracketsCategory = await this.createCategory({
      name: "Brackets",
      description: "Mounting brackets and supports"
    });
    
    const mountsCategory = await this.createCategory({
      name: "Mounts",
      description: "Heavy duty mounting systems"
    });
    
    // Sample products with categoryId
    await this.createProduct({
      name: "Widget XL",
      sku: "WDG-001",
      categoryId: widgetsCategory.id,
      description: "Extra large widget for industrial use",
      minStockLevel: 10,
      currentStock: 2
    });
    
    await this.createProduct({
      name: "Premium Connector",
      sku: "CON-002",
      categoryId: connectorsCategory.id,
      description: "High quality connector for professional applications",
      minStockLevel: 15,
      currentStock: 3
    });
    
    await this.createProduct({
      name: "Standard Bracket",
      sku: "BKT-003",
      categoryId: bracketsCategory.id,
      description: "Standard mounting bracket",
      minStockLevel: 20,
      currentStock: 12
    });
    
    await this.createProduct({
      name: "Heavy Duty Mount",
      sku: "MNT-004",
      categoryId: mountsCategory.id,
      description: "Heavy duty mounting system",
      minStockLevel: 10,
      currentStock: 45
    });
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
