import { Category, InsertCategory } from '@shared/schema';
import { IStorage } from '../storage';

export interface ICategoryStorage {
  getCategory(id: number): Promise<Category | undefined>;
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;
  searchCategories(query: string): Promise<Category[]>;
  getCategoriesByColor(color: string): Promise<Category[]>;
}

export class MemCategoryStorage implements ICategoryStorage {
  private categories: Map<number, Category>;
  private categoryIdCounter: number;

  constructor() {
    this.categories = new Map();
    this.categoryIdCounter = 1;
  }

  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async getAllCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = this.categoryIdCounter++;
    const newCategory: Category = {
      id,
      name: category.name,
      description: category.description ?? null,
      color: category.color ?? null,
      createdAt: new Date()
    };
    this.categories.set(id, newCategory);
    return newCategory;
  }

  async updateCategory(id: number, categoryUpdate: Partial<InsertCategory>): Promise<Category | undefined> {
    const category = this.categories.get(id);
    if (category) {
      const updatedCategory = {
        ...category,
        ...categoryUpdate
      };
      this.categories.set(id, updatedCategory);
      return updatedCategory;
    }
    return undefined;
  }

  async deleteCategory(id: number): Promise<boolean> {
    return this.categories.delete(id);
  }

  async searchCategories(query: string): Promise<Category[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.categories.values())
      .filter(category => {
        return category.name.toLowerCase().includes(searchTerm) ||
               category.description?.toLowerCase().includes(searchTerm);
      });
  }

  async getCategoriesByColor(color: string): Promise<Category[]> {
    return Array.from(this.categories.values())
      .filter(category => category.color === color);
  }
} 