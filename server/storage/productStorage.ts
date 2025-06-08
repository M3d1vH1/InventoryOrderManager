import { Product, InsertProduct, Tag, ProductTag } from '@shared/schema';
import { IStorage } from '../storage';

export interface IProductStorage {
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>, userId?: number): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  getLowStockProducts(): Promise<Product[]>;
  getSlowMovingProducts(dayThreshold?: number): Promise<Product[]>;
  searchProducts(query: string, category?: string, stockStatus?: string, tag?: string): Promise<Product[]>;
  getProductTags(productId: number): Promise<Tag[]>;
  addTagToProduct(productId: number, tagId: number): Promise<void>;
  removeTagFromProduct(productId: number, tagId: number): Promise<void>;
  updateProductTags(productId: number, tagIds: number[]): Promise<void>;
}

export class MemProductStorage implements IProductStorage {
  private products: Map<number, Product>;
  private productIdCounter: number;
  private productTagsMap: Map<string, number>;

  constructor() {
    this.products = new Map();
    this.productIdCounter = 1;
    this.productTagsMap = new Map();
  }

  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    return Array.from(this.products.values()).find(p => p.sku === sku);
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.productIdCounter++;
    const newProduct: Product = {
      id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode ?? null,
      categoryId: product.categoryId,
      description: product.description ?? null,
      minStockLevel: product.minStockLevel,
      currentStock: product.currentStock ?? 0,
      location: product.location ?? null,
      unitsPerBox: product.unitsPerBox ?? null,
      imagePath: product.imagePath ?? null,
      tags: product.tags ?? null,
      lastStockUpdate: new Date()
    };
    this.products.set(id, newProduct);
    return newProduct;
  }

  async updateProduct(id: number, productUpdate: Partial<InsertProduct>, userId?: number): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (product) {
      const updatedProduct = {
        ...product,
        ...productUpdate,
        lastStockUpdate: new Date()
      };
      this.products.set(id, updatedProduct);
      return updatedProduct;
    }
    return undefined;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  async getLowStockProducts(): Promise<Product[]> {
    return Array.from(this.products.values())
      .filter(p => p.currentStock <= p.minStockLevel);
  }

  async getSlowMovingProducts(dayThreshold: number = 60): Promise<Product[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dayThreshold);
    
    return Array.from(this.products.values())
      .filter(p => {
        const lastUpdate = p.lastStockUpdate;
        return lastUpdate && lastUpdate < cutoffDate;
      });
  }

  async searchProducts(query: string, category?: string, stockStatus?: string, tag?: string): Promise<Product[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.products.values())
      .filter(p => {
        const matchesQuery = p.name.toLowerCase().includes(searchTerm) ||
                           p.sku.toLowerCase().includes(searchTerm) ||
                           p.description?.toLowerCase().includes(searchTerm);
        
        const matchesCategory = !category || p.categoryId.toString() === category;
        
        const matchesStockStatus = !stockStatus || (
          (stockStatus === 'low' && p.currentStock <= p.minStockLevel) ||
          (stockStatus === 'out' && p.currentStock === 0) ||
          (stockStatus === 'in' && p.currentStock > p.minStockLevel)
        );
        
        const matchesTag = !tag || this.productTagsMap.has(`${p.id}-${tag}`);
        
        return matchesQuery && matchesCategory && matchesStockStatus && matchesTag;
      });
  }

  async getProductTags(productId: number): Promise<Tag[]> {
    // This is a simplified version - in a real implementation, you'd need to join with the tags table
    return [];
  }

  async addTagToProduct(productId: number, tagId: number): Promise<void> {
    this.productTagsMap.set(`${productId}-${tagId}`, 1);
  }

  async removeTagFromProduct(productId: number, tagId: number): Promise<void> {
    this.productTagsMap.delete(`${productId}-${tagId}`);
  }

  async updateProductTags(productId: number, tagIds: number[]): Promise<void> {
    // Remove all existing tags
    Array.from(this.productTagsMap.keys()).forEach(key => {
      if (key.startsWith(`${productId}-`)) {
        this.productTagsMap.delete(key);
      }
    });
    
    // Add new tags
    for (const tagId of tagIds) {
      this.productTagsMap.set(`${productId}-${tagId}`, 1);
    }
  }
} 