import { Product, InventoryChange, InsertInventoryChange } from '@shared/schema';
import { IStorage } from '../storage';

export interface IInventoryStorage {
  getProductStock(productId: number): Promise<number>;
  updateProductStock(productId: number, quantity: number, userId: number, reason: string): Promise<void>;
  getInventoryChanges(productId: number): Promise<InventoryChange[]>;
  getInventoryChangesByDateRange(startDate: Date, endDate: Date): Promise<InventoryChange[]>;
  getLowStockProducts(): Promise<Product[]>;
  getProductStockHistory(productId: number): Promise<InventoryChange[]>;
}

export class MemInventoryStorage implements IInventoryStorage {
  private productStock: Map<number, number>;
  private inventoryChanges: Map<number, InventoryChange[]>;
  private changeIdCounter: number;

  constructor() {
    this.productStock = new Map();
    this.inventoryChanges = new Map();
    this.changeIdCounter = 1;
  }

  async getProductStock(productId: number): Promise<number> {
    return this.productStock.get(productId) ?? 0;
  }

  async updateProductStock(productId: number, quantity: number, userId: number, reason: string): Promise<void> {
    const currentStock = this.productStock.get(productId) ?? 0;
    const newStock = currentStock + quantity;
    
    if (newStock < 0) {
      throw new Error('Insufficient stock');
    }

    this.productStock.set(productId, newStock);

    const change: InventoryChange = {
      id: this.changeIdCounter++,
      productId,
      userId,
      changeType: 'manual_adjustment',
      previousQuantity: currentStock,
      newQuantity: newStock,
      quantityChanged: quantity,
      timestamp: new Date(),
      reference: null,
      notes: reason
    };

    const changes = this.inventoryChanges.get(productId) ?? [];
    changes.push(change);
    this.inventoryChanges.set(productId, changes);
  }

  async getInventoryChanges(productId: number): Promise<InventoryChange[]> {
    return this.inventoryChanges.get(productId) ?? [];
  }

  async getInventoryChangesByDateRange(startDate: Date, endDate: Date): Promise<InventoryChange[]> {
    const allChanges: InventoryChange[] = [];
    Array.from(this.inventoryChanges.values()).forEach(changes => {
      allChanges.push(...changes);
    });
    
    return allChanges.filter(change => {
      const changeDate = change.timestamp;
      return changeDate >= startDate && changeDate <= endDate;
    });
  }

  async getLowStockProducts(): Promise<Product[]> {
    // This is a simplified version - in a real implementation, you'd need to join with the products table
    return [];
  }

  async getProductStockHistory(productId: number): Promise<InventoryChange[]> {
    return this.inventoryChanges.get(productId) ?? [];
  }
} 