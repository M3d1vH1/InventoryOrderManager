import { Order, InsertOrder, OrderItem, InsertOrderItem } from '@shared/schema';
import { IStorage } from '../storage';

export interface IOrderStorage {
  getOrder(id: number): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<InsertOrder>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<boolean>;
  getOrderItems(orderId: number): Promise<OrderItem[]>;
  addOrderItem(orderId: number, item: InsertOrderItem): Promise<OrderItem>;
  updateOrderItem(orderId: number, itemId: number, item: Partial<InsertOrderItem>): Promise<OrderItem | undefined>;
  removeOrderItem(orderId: number, itemId: number): Promise<boolean>;
  getOrdersByStatus(status: string): Promise<Order[]>;
  getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]>;
  getOrdersByCustomer(customerName: string): Promise<Order[]>;
}

export class MemOrderStorage implements IOrderStorage {
  private orders: Map<number, Order>;
  private orderItems: Map<number, OrderItem[]>;
  private orderIdCounter: number;
  private orderItemIdCounter: number;

  constructor() {
    this.orders = new Map();
    this.orderItems = new Map();
    this.orderIdCounter = 1;
    this.orderItemIdCounter = 1;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const id = this.orderIdCounter++;
    const orderNumber = `ORD-${id.toString().padStart(6, '0')}`;
    const newOrder: Order = {
      id,
      orderNumber,
      customerName: order.customerName,
      orderDate: new Date(),
      estimatedShippingDate: order.estimatedShippingDate,
      actualShippingDate: null,
      status: 'pending',
      priority: order.priority ?? 'medium',
      area: order.area ?? null,
      notes: order.notes ?? null,
      hasShippingDocument: false,
      isPartialFulfillment: false,
      partialFulfillmentApproved: false,
      partialFulfillmentApprovedById: null,
      partialFulfillmentApprovedAt: null,
      percentage_shipped: 0,
      createdById: order.createdById,
      updatedById: null,
      lastUpdated: null
    };
    this.orders.set(id, newOrder);
    this.orderItems.set(id, []);
    return newOrder;
  }

  async updateOrder(id: number, orderUpdate: Partial<InsertOrder>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (order) {
      const updatedOrder = {
        ...order,
        ...orderUpdate,
        lastUpdated: new Date()
      };
      this.orders.set(id, updatedOrder);
      return updatedOrder;
    }
    return undefined;
  }

  async deleteOrder(id: number): Promise<boolean> {
    const success = this.orders.delete(id);
    if (success) {
      this.orderItems.delete(id);
    }
    return success;
  }

  async getOrderItems(orderId: number): Promise<OrderItem[]> {
    return this.orderItems.get(orderId) ?? [];
  }

  async addOrderItem(orderId: number, item: InsertOrderItem): Promise<OrderItem> {
    const id = this.orderItemIdCounter++;
    const newItem: OrderItem = {
      id,
      orderId,
      productId: item.productId,
      quantity: item.quantity,
      shipped_quantity: 0,
      shipping_status: 'pending',
      hasQualityIssues: false
    };
    
    const items = this.orderItems.get(orderId) ?? [];
    items.push(newItem);
    this.orderItems.set(orderId, items);
    
    return newItem;
  }

  async updateOrderItem(orderId: number, itemId: number, itemUpdate: Partial<InsertOrderItem>): Promise<OrderItem | undefined> {
    const items = this.orderItems.get(orderId);
    if (!items) return undefined;

    const itemIndex = items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return undefined;

    const updatedItem = {
      ...items[itemIndex],
      ...itemUpdate
    };
    
    items[itemIndex] = updatedItem;
    this.orderItems.set(orderId, items);
    
    return updatedItem;
  }

  async removeOrderItem(orderId: number, itemId: number): Promise<boolean> {
    const items = this.orderItems.get(orderId);
    if (!items) return false;

    const itemIndex = items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return false;

    items.splice(itemIndex, 1);
    this.orderItems.set(orderId, items);
    
    return true;
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => order.status === status);
  }

  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => {
        const orderDate = order.orderDate;
        return orderDate >= startDate && orderDate <= endDate;
      });
  }

  async getOrdersByCustomer(customerName: string): Promise<Order[]> {
    return Array.from(this.orders.values())
      .filter(order => order.customerName === customerName);
  }
} 