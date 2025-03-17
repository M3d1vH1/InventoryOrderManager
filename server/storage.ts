import { 
  users, type User, type InsertUser,
  products, type Product, type InsertProduct,
  orders, type Order, type InsertOrder,
  orderItems, type OrderItem, type InsertOrderItem,
  customers, type Customer, type InsertCustomer
} from "@shared/schema";

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
  getAllCustomers(): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  
  // Stats methods
  getDashboardStats(): Promise<{
    pendingOrders: number;
    itemsToPick: number;
    shippedToday: number;
    lowStockItems: number;
  }>;
}

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
    const product: Product = { ...insertProduct, id };
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
      id, 
      orderNumber
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
  
  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }
  
  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = this.customerIdCounter++;
    const customer: Customer = { ...insertCustomer, id };
    this.customers.set(id, customer);
    return customer;
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
  
  // Initialize with sample data
  private initSampleData() {
    // Sample customers
    this.createCustomer({ name: "John Smith" });
    this.createCustomer({ name: "Sarah Johnson" });
    this.createCustomer({ name: "Mike Williams" });
    this.createCustomer({ name: "Emma Davis" });
    
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
