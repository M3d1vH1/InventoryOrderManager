import { Tag, InsertTag, ProductTag } from '@shared/schema';
import { IStorage } from '../storage';

export interface ITagStorage {
  getTag(id: number): Promise<Tag | undefined>;
  getAllTags(): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: number, tag: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: number): Promise<boolean>;
  searchTags(query: string): Promise<Tag[]>;
  getTagsByColor(color: string): Promise<Tag[]>;
  getProductTags(productId: number): Promise<Tag[]>;
  addTagToProduct(productId: number, tagId: number): Promise<void>;
  removeTagFromProduct(productId: number, tagId: number): Promise<void>;
  updateProductTags(productId: number, tagIds: number[]): Promise<void>;
}

export class MemTagStorage implements ITagStorage {
  private tags: Map<number, Tag>;
  private productTags: Map<string, number>;
  private tagIdCounter: number;

  constructor() {
    this.tags = new Map();
    this.productTags = new Map();
    this.tagIdCounter = 1;
  }

  async getTag(id: number): Promise<Tag | undefined> {
    return this.tags.get(id);
  }

  async getAllTags(): Promise<Tag[]> {
    return Array.from(this.tags.values());
  }

  async createTag(tag: InsertTag): Promise<Tag> {
    const id = this.tagIdCounter++;
    const newTag: Tag = {
      id,
      name: tag.name,
      description: tag.description ?? null,
      color: tag.color ?? null,
      createdAt: new Date()
    };
    this.tags.set(id, newTag);
    return newTag;
  }

  async updateTag(id: number, tagUpdate: Partial<InsertTag>): Promise<Tag | undefined> {
    const tag = this.tags.get(id);
    if (tag) {
      const updatedTag = {
        ...tag,
        ...tagUpdate
      };
      this.tags.set(id, updatedTag);
      return updatedTag;
    }
    return undefined;
  }

  async deleteTag(id: number): Promise<boolean> {
    // Remove all product-tag associations
    Array.from(this.productTags.keys()).forEach(key => {
      if (key.endsWith(`-${id}`)) {
        this.productTags.delete(key);
      }
    });
    return this.tags.delete(id);
  }

  async searchTags(query: string): Promise<Tag[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.tags.values())
      .filter(tag => {
        return tag.name.toLowerCase().includes(searchTerm) ||
               tag.description?.toLowerCase().includes(searchTerm);
      });
  }

  async getTagsByColor(color: string): Promise<Tag[]> {
    return Array.from(this.tags.values())
      .filter(tag => tag.color === color);
  }

  async getProductTags(productId: number): Promise<Tag[]> {
    const tagIds = Array.from(this.productTags.entries())
      .filter(([key]) => key.startsWith(`${productId}-`))
      .map(([key]) => parseInt(key.split('-')[1]));

    return tagIds
      .map(id => this.tags.get(id))
      .filter((tag): tag is Tag => tag !== undefined);
  }

  async addTagToProduct(productId: number, tagId: number): Promise<void> {
    this.productTags.set(`${productId}-${tagId}`, 1);
  }

  async removeTagFromProduct(productId: number, tagId: number): Promise<void> {
    this.productTags.delete(`${productId}-${tagId}`);
  }

  async updateProductTags(productId: number, tagIds: number[]): Promise<void> {
    // Remove all existing tags for this product
    Array.from(this.productTags.keys()).forEach(key => {
      if (key.startsWith(`${productId}-`)) {
        this.productTags.delete(key);
      }
    });
    
    // Add new tags
    for (const tagId of tagIds) {
      this.productTags.set(`${productId}-${tagId}`, 1);
    }
  }
} 