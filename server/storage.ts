import { 
  users, type User, type InsertUser,
  products, type Product, type InsertProduct,
  orders, type Order, type InsertOrder,
  orderItems, type OrderItem, type InsertOrderItem,
  customers, type Customer, type InsertCustomer
} from "@shared/schema";
import { storage as databaseStorage, initStorage } from './storage.postgresql';
import { log } from './vite';

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  updateOrderStatus(id: number, status: 'pending' | 'picked' | 'shipped' | 'cancelled'): Promise<Order | undefined>;
  
  // Order Item methods
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  addOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  
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
  private products: Map<number, Product>;
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem>;
  private customers: Map<number, Customer>;
  
  private userIdCounter: number;
  private productIdCounter: number;
  private orderIdCounter: number;
  private orderItemIdCounter: number;
  private customerIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.products = new Map();
    this.orders = new Map();
    this.orderItems = new Map();
    this.customers = new Map();
    
    this.userIdCounter = 1;
    this.productIdCounter = 1;
    this.orderIdCounter = 1;
    this.orderItemIdCounter = 1;
    this.customerIdCounter = 1;
    
    // Initialize with sample data
    this.initSampleData();
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
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
      filteredProducts = filteredProducts.filter(
        product => product.category === category
      );
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
      notes: insertOrder.notes || null
    };
    
    this.orders.set(id, order);
    return order;
  }
  
  async updateOrderStatus(id: number, status: 'pending' | 'picked' | 'shipped' | 'cancelled'): Promise<Order | undefined> {
    const existingOrder = this.orders.get(id);
    if (!existingOrder) return undefined;
    
    const updatedOrder = { ...existingOrder, status };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async updateOrder(id: number, orderData: Partial<InsertOrder>): Promise<Order | undefined> {
    const existingOrder = this.orders.get(id);
    if (!existingOrder) return undefined;
    
    const updatedOrder = { ...existingOrder, ...orderData };
    this.orders.set(id, updatedOrder);
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
    const categories = {} as Record<string, number>;
    
    // Count products by category
    products.forEach(product => {
      const category = product.category;
      if (!categories[category]) {
        categories[category] = 0;
      }
      categories[category]++;
    });
    
    // Convert to array format
    return Object.entries(categories).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1), // Capitalize first letter
      value
    }));
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
    
    // Calculate individual product values (simulated as we don't have price in the model)
    const productValues = products.map(product => {
      // Simulate product price based on category and stock level
      let basePrice = 0;
      switch (product.category) {
        case 'widgets': basePrice = 12.99; break;
        case 'connectors': basePrice = 8.50; break;
        case 'brackets': basePrice = 15.75; break;
        case 'mounts': basePrice = 22.50; break;
        default: basePrice = 10.00;
      }
      
      // Calculate total value
      return {
        product,
        value: basePrice * product.currentStock
      };
    });
    
    // Calculate total inventory value
    const totalValue = productValues.reduce((sum, item) => sum + item.value, 0);
    
    // Calculate category breakdown
    const categories = {} as Record<string, {
      productCount: number;
      totalValue: number;
    }>;
    
    productValues.forEach(({ product, value }) => {
      const category = product.category;
      if (!categories[category]) {
        categories[category] = {
          productCount: 0,
          totalValue: 0
        };
      }
      categories[category].productCount++;
      categories[category].totalValue += value;
    });
    
    // Convert to array with percentage
    const categoryBreakdown = Object.entries(categories).map(([category, data]) => ({
      category: category.charAt(0).toUpperCase() + category.slice(1),
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
  private initSampleData() {
    // Sample customers with extended data
    this.createCustomer({ 
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
    
    this.createCustomer({ 
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
    
    this.createCustomer({ 
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
    
    this.createCustomer({ 
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
    
    // Sample products
    this.createProduct({
      name: "Widget XL",
      sku: "WDG-001",
      category: "widgets",
      description: "Extra large widget for industrial use",
      minStockLevel: 10,
      currentStock: 2
    });
    
    this.createProduct({
      name: "Premium Connector",
      sku: "CON-002",
      category: "connectors",
      description: "High quality connector for professional applications",
      minStockLevel: 15,
      currentStock: 3
    });
    
    this.createProduct({
      name: "Standard Bracket",
      sku: "BKT-003",
      category: "brackets",
      description: "Standard mounting bracket",
      minStockLevel: 20,
      currentStock: 12
    });
    
    this.createProduct({
      name: "Heavy Duty Mount",
      sku: "MNT-004",
      category: "mounts",
      description: "Heavy duty mounting system",
      minStockLevel: 10,
      currentStock: 45
    });
  }
}

export const storage = new MemStorage();
