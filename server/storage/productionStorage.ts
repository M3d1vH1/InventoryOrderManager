import { 
  ProductionBatch, InsertProductionBatch,
  ProductionRecipe, InsertProductionRecipe,
  RecipeIngredient, InsertRecipeIngredient,
  ProductionOrder, InsertProductionOrder,
  MaterialConsumption, InsertMaterialConsumption,
  ProductionLog, InsertProductionLog,
  ProductionQualityCheck, InsertProductionQualityCheck,
  RawMaterial, InsertRawMaterial
} from '@shared/schema';
import { IStorage } from '../storage';

export interface IProductionStorage {
  // Raw Material methods
  getRawMaterial(id: number): Promise<RawMaterial | undefined>;
  getRawMaterialBySku(sku: string): Promise<RawMaterial | undefined>;
  getAllRawMaterials(): Promise<RawMaterial[]>;
  createRawMaterial(material: InsertRawMaterial): Promise<RawMaterial>;
  updateRawMaterial(id: number, material: Partial<InsertRawMaterial>): Promise<RawMaterial | undefined>;
  deleteRawMaterial(id: number): Promise<boolean>;
  
  // Production Batch methods
  getProductionBatch(id: number): Promise<ProductionBatch | undefined>;
  getProductionBatchByNumber(batchNumber: string): Promise<ProductionBatch | undefined>;
  getAllProductionBatches(): Promise<ProductionBatch[]>;
  createProductionBatch(batch: InsertProductionBatch): Promise<ProductionBatch>;
  updateProductionBatch(id: number, batch: Partial<InsertProductionBatch>): Promise<ProductionBatch | undefined>;
  deleteProductionBatch(id: number): Promise<boolean>;
  
  // Production Recipe methods
  getProductionRecipe(id: number): Promise<ProductionRecipe | undefined>;
  getProductionRecipesByProduct(productId: number): Promise<ProductionRecipe[]>;
  getAllProductionRecipes(): Promise<ProductionRecipe[]>;
  createProductionRecipe(recipe: InsertProductionRecipe): Promise<ProductionRecipe>;
  updateProductionRecipe(id: number, recipe: Partial<InsertProductionRecipe>): Promise<ProductionRecipe | undefined>;
  deleteProductionRecipe(id: number): Promise<boolean>;
  
  // Recipe Ingredient methods
  getRecipeIngredient(id: number): Promise<RecipeIngredient | undefined>;
  getRecipeIngredientsByRecipe(recipeId: number): Promise<RecipeIngredient[]>;
  getAllRecipeIngredients(): Promise<RecipeIngredient[]>;
  createRecipeIngredient(ingredient: InsertRecipeIngredient): Promise<RecipeIngredient>;
  updateRecipeIngredient(id: number, ingredient: Partial<InsertRecipeIngredient>): Promise<RecipeIngredient | undefined>;
  deleteRecipeIngredient(id: number): Promise<boolean>;
  
  // Production Order methods
  getProductionOrder(id: number): Promise<ProductionOrder | undefined>;
  getProductionOrdersByProduct(productId: number): Promise<ProductionOrder[]>;
  getAllProductionOrders(): Promise<ProductionOrder[]>;
  createProductionOrder(order: InsertProductionOrder): Promise<ProductionOrder>;
  updateProductionOrder(id: number, order: Partial<InsertProductionOrder>): Promise<ProductionOrder | undefined>;
  deleteProductionOrder(id: number): Promise<boolean>;
  
  // Material Consumption methods
  getMaterialConsumption(id: number): Promise<MaterialConsumption | undefined>;
  getMaterialConsumptionsByOrder(orderId: number): Promise<MaterialConsumption[]>;
  getAllMaterialConsumptions(): Promise<MaterialConsumption[]>;
  createMaterialConsumption(consumption: InsertMaterialConsumption): Promise<MaterialConsumption>;
  updateMaterialConsumption(id: number, consumption: Partial<InsertMaterialConsumption>): Promise<MaterialConsumption | undefined>;
  deleteMaterialConsumption(id: number): Promise<boolean>;
  
  // Production Log methods
  getProductionLog(id: number): Promise<ProductionLog | undefined>;
  getProductionLogsByOrder(orderId: number): Promise<ProductionLog[]>;
  getAllProductionLogs(): Promise<ProductionLog[]>;
  createProductionLog(log: InsertProductionLog): Promise<ProductionLog>;
  updateProductionLog(id: number, log: Partial<InsertProductionLog>): Promise<ProductionLog | undefined>;
  deleteProductionLog(id: number): Promise<boolean>;
  
  // Production Quality Check methods
  getProductionQualityCheck(id: number): Promise<ProductionQualityCheck | undefined>;
  getProductionQualityChecksByOrder(orderId: number): Promise<ProductionQualityCheck[]>;
  getAllProductionQualityChecks(): Promise<ProductionQualityCheck[]>;
  createProductionQualityCheck(check: InsertProductionQualityCheck): Promise<ProductionQualityCheck>;
  updateProductionQualityCheck(id: number, check: Partial<InsertProductionQualityCheck>): Promise<ProductionQualityCheck | undefined>;
  deleteProductionQualityCheck(id: number): Promise<boolean>;
  
  // Production Analytics methods
  getProductionEfficiency(orderId: number): Promise<{
    plannedQuantity: number;
    actualQuantity: number;
    efficiency: number;
    materialWaste: number;
    productionTime: number;
    qualityScore: number;
  }>;
  
  getMaterialUsageReport(materialId: number, startDate: Date, endDate: Date): Promise<{
    totalConsumed: number;
    averagePerBatch: number;
    wastePercentage: number;
    batches: {
      batchNumber: string;
      date: Date;
      quantity: number;
      waste: number;
    }[];
  }>;
}

export class MemProductionStorage implements IProductionStorage {
  private rawMaterials: Map<number, RawMaterial>;
  private productionBatches: Map<number, ProductionBatch>;
  private productionRecipes: Map<number, ProductionRecipe>;
  private recipeIngredients: Map<number, RecipeIngredient>;
  private productionOrders: Map<number, ProductionOrder>;
  private materialConsumptions: Map<number, MaterialConsumption>;
  private productionLogs: Map<number, ProductionLog>;
  private qualityChecks: Map<number, ProductionQualityCheck>;
  private materialIdCounter: number;
  private batchIdCounter: number;
  private recipeIdCounter: number;
  private ingredientIdCounter: number;
  private orderIdCounter: number;
  private consumptionIdCounter: number;
  private logIdCounter: number;
  private checkIdCounter: number;

  constructor() {
    this.rawMaterials = new Map();
    this.productionBatches = new Map();
    this.productionRecipes = new Map();
    this.recipeIngredients = new Map();
    this.productionOrders = new Map();
    this.materialConsumptions = new Map();
    this.productionLogs = new Map();
    this.qualityChecks = new Map();
    this.materialIdCounter = 1;
    this.batchIdCounter = 1;
    this.recipeIdCounter = 1;
    this.ingredientIdCounter = 1;
    this.orderIdCounter = 1;
    this.consumptionIdCounter = 1;
    this.logIdCounter = 1;
    this.checkIdCounter = 1;
  }

  async getRawMaterial(id: number): Promise<RawMaterial | undefined> {
    return this.rawMaterials.get(id);
  }

  async getRawMaterialBySku(sku: string): Promise<RawMaterial | undefined> {
    return Array.from(this.rawMaterials.values()).find(m => m.sku === sku);
  }

  async getAllRawMaterials(): Promise<RawMaterial[]> {
    return Array.from(this.rawMaterials.values());
  }

  async createRawMaterial(material: InsertRawMaterial): Promise<RawMaterial> {
    const id = this.materialIdCounter++;
    const newMaterial: RawMaterial = {
      id,
      name: material.name,
      type: material.type,
      sku: material.sku,
      currentStock: material.currentStock.toString(),
      minStockLevel: material.minStockLevel.toString(),
      unit: material.unit,
      unitCost: material.unitCost?.toString() ?? null,
      description: material.description ?? null,
      location: material.location ?? null,
      supplierId: material.supplierId ?? null,
      lastStockUpdate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.rawMaterials.set(id, newMaterial);
    return newMaterial;
  }

  async updateRawMaterial(id: number, material: Partial<InsertRawMaterial>): Promise<RawMaterial | undefined> {
    const existing = this.rawMaterials.get(id);
    if (!existing) return undefined;

    const updated: RawMaterial = {
      ...existing,
      ...material,
      currentStock: material.currentStock?.toString() ?? existing.currentStock,
      minStockLevel: material.minStockLevel?.toString() ?? existing.minStockLevel,
      unitCost: material.unitCost?.toString() ?? existing.unitCost,
      lastStockUpdate: new Date(),
      updatedAt: new Date()
    };
    this.rawMaterials.set(id, updated);
    return updated;
  }

  async deleteRawMaterial(id: number): Promise<boolean> {
    return this.rawMaterials.delete(id);
  }

  async getProductionBatch(id: number): Promise<ProductionBatch | undefined> {
    return this.productionBatches.get(id);
  }

  async getProductionBatchByNumber(batchNumber: string): Promise<ProductionBatch | undefined> {
    return Array.from(this.productionBatches.values()).find(b => b.batchNumber === batchNumber);
  }

  async getAllProductionBatches(): Promise<ProductionBatch[]> {
    return Array.from(this.productionBatches.values());
  }

  async createProductionBatch(batch: InsertProductionBatch): Promise<ProductionBatch> {
    const id = this.batchIdCounter++;
    const newBatch: ProductionBatch = {
      id,
      batchNumber: batch.batchNumber,
      startDate: batch.startDate,
      endDate: batch.endDate ?? null,
      status: batch.status ?? 'planned',
      quantity: batch.quantity.toString(),
      unit: batch.unit ?? 'liter',
      notes: batch.notes ?? null,
      createdById: batch.createdById ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.productionBatches.set(id, newBatch);
    return newBatch;
  }

  async updateProductionBatch(id: number, batch: Partial<InsertProductionBatch>): Promise<ProductionBatch | undefined> {
    const existing = this.productionBatches.get(id);
    if (!existing) return undefined;

    const updated: ProductionBatch = {
      ...existing,
      ...batch,
      quantity: batch.quantity?.toString() ?? existing.quantity,
      updatedAt: new Date()
    };
    this.productionBatches.set(id, updated);
    return updated;
  }

  async deleteProductionBatch(id: number): Promise<boolean> {
    return this.productionBatches.delete(id);
  }

  async getProductionRecipe(id: number): Promise<ProductionRecipe | undefined> {
    return this.productionRecipes.get(id);
  }

  async getProductionRecipesByProduct(productId: number): Promise<ProductionRecipe[]> {
    return Array.from(this.productionRecipes.values())
      .filter(recipe => recipe.productId === productId);
  }

  async getAllProductionRecipes(): Promise<ProductionRecipe[]> {
    return Array.from(this.productionRecipes.values());
  }

  async createProductionRecipe(recipe: InsertProductionRecipe): Promise<ProductionRecipe> {
    const id = this.recipeIdCounter++;
    const newRecipe: ProductionRecipe = {
      id,
      productId: recipe.productId,
      name: recipe.name,
      sku: recipe.sku,
      description: recipe.description ?? null,
      yield: recipe.yield.toString(),
      yieldUnit: recipe.yieldUnit,
      status: recipe.status ?? 'active',
      isDefault: recipe.isDefault ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.productionRecipes.set(id, newRecipe);
    return newRecipe;
  }

  async updateProductionRecipe(id: number, recipe: Partial<InsertProductionRecipe>): Promise<ProductionRecipe | undefined> {
    const existing = this.productionRecipes.get(id);
    if (!existing) return undefined;

    const updated: ProductionRecipe = {
      ...existing,
      ...recipe,
      yield: recipe.yield?.toString() ?? existing.yield,
      updatedAt: new Date()
    };
    this.productionRecipes.set(id, updated);
    return updated;
  }

  async deleteProductionRecipe(id: number): Promise<boolean> {
    return this.productionRecipes.delete(id);
  }

  async getRecipeIngredient(id: number): Promise<RecipeIngredient | undefined> {
    return this.recipeIngredients.get(id);
  }

  async getRecipeIngredientsByRecipe(recipeId: number): Promise<RecipeIngredient[]> {
    return Array.from(this.recipeIngredients.values())
      .filter(ingredient => ingredient.recipeId === recipeId);
  }

  async getAllRecipeIngredients(): Promise<RecipeIngredient[]> {
    return Array.from(this.recipeIngredients.values());
  }

  async createRecipeIngredient(ingredient: InsertRecipeIngredient): Promise<RecipeIngredient> {
    const id = this.ingredientIdCounter++;
    const newIngredient: RecipeIngredient = {
      id,
      recipeId: ingredient.recipeId,
      materialId: ingredient.materialId,
      quantity: ingredient.quantity.toString(),
      unit: ingredient.unit,
      notes: ingredient.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.recipeIngredients.set(id, newIngredient);
    return newIngredient;
  }

  async updateRecipeIngredient(id: number, ingredient: Partial<InsertRecipeIngredient>): Promise<RecipeIngredient | undefined> {
    const existing = this.recipeIngredients.get(id);
    if (!existing) return undefined;

    const updated: RecipeIngredient = {
      ...existing,
      ...ingredient,
      quantity: ingredient.quantity?.toString() ?? existing.quantity,
      updatedAt: new Date()
    };
    this.recipeIngredients.set(id, updated);
    return updated;
  }

  async deleteRecipeIngredient(id: number): Promise<boolean> {
    return this.recipeIngredients.delete(id);
  }

  async getProductionOrder(id: number): Promise<ProductionOrder | undefined> {
    return this.productionOrders.get(id);
  }

  async getProductionOrdersByProduct(productId: number): Promise<ProductionOrder[]> {
    return Array.from(this.productionOrders.values())
      .filter(order => order.productId === productId);
  }

  async getAllProductionOrders(): Promise<ProductionOrder[]> {
    return Array.from(this.productionOrders.values());
  }

  async createProductionOrder(order: InsertProductionOrder): Promise<ProductionOrder> {
    const id = this.orderIdCounter++;
    const newOrder: ProductionOrder = {
      id,
      productId: order.productId,
      recipeId: order.recipeId,
      quantity: order.quantity.toString(),
      status: order.status ?? 'planned',
      startDate: order.startDate,
      endDate: order.endDate ?? null,
      notes: order.endDate ?? null,
      createdById: order.createdById ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.productionOrders.set(id, newOrder);
    return newOrder;
  }

  async updateProductionOrder(id: number, order: Partial<InsertProductionOrder>): Promise<ProductionOrder | undefined> {
    const existing = this.productionOrders.get(id);
    if (!existing) return undefined;

    const updated: ProductionOrder = {
      ...existing,
      ...order,
      quantity: order.quantity?.toString() ?? existing.quantity,
      updatedAt: new Date()
    };
    this.productionOrders.set(id, updated);
    return updated;
  }

  async deleteProductionOrder(id: number): Promise<boolean> {
    return this.productionOrders.delete(id);
  }

  async getMaterialConsumption(id: number): Promise<MaterialConsumption | undefined> {
    return this.materialConsumptions.get(id);
  }

  async getMaterialConsumptionsByOrder(orderId: number): Promise<MaterialConsumption[]> {
    return Array.from(this.materialConsumptions.values())
      .filter(consumption => consumption.orderId === orderId);
  }

  async getAllMaterialConsumptions(): Promise<MaterialConsumption[]> {
    return Array.from(this.materialConsumptions.values());
  }

  async createMaterialConsumption(consumption: InsertMaterialConsumption): Promise<MaterialConsumption> {
    const id = this.consumptionIdCounter++;
    const newConsumption: MaterialConsumption = {
      id,
      orderId: consumption.orderId,
      materialId: consumption.materialId,
      quantity: consumption.quantity.toString(),
      unit: consumption.unit,
      notes: consumption.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.materialConsumptions.set(id, newConsumption);
    return newConsumption;
  }

  async updateMaterialConsumption(id: number, consumption: Partial<InsertMaterialConsumption>): Promise<MaterialConsumption | undefined> {
    const existing = this.materialConsumptions.get(id);
    if (!existing) return undefined;

    const updated: MaterialConsumption = {
      ...existing,
      ...consumption,
      quantity: consumption.quantity?.toString() ?? existing.quantity,
      updatedAt: new Date()
    };
    this.materialConsumptions.set(id, updated);
    return updated;
  }

  async deleteMaterialConsumption(id: number): Promise<boolean> {
    return this.materialConsumptions.delete(id);
  }

  async getProductionLog(id: number): Promise<ProductionLog | undefined> {
    return this.productionLogs.get(id);
  }

  async getProductionLogsByOrder(orderId: number): Promise<ProductionLog[]> {
    return Array.from(this.productionLogs.values())
      .filter(log => log.orderId === orderId);
  }

  async getAllProductionLogs(): Promise<ProductionLog[]> {
    return Array.from(this.productionLogs.values());
  }

  async createProductionLog(log: InsertProductionLog): Promise<ProductionLog> {
    const id = this.logIdCounter++;
    const newLog: ProductionLog = {
      id,
      orderId: log.orderId,
      eventType: log.eventType,
      timestamp: log.timestamp,
      notes: log.notes ?? null,
      createdById: log.createdById ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.productionLogs.set(id, newLog);
    return newLog;
  }

  async updateProductionLog(id: number, log: Partial<InsertProductionLog>): Promise<ProductionLog | undefined> {
    const existing = this.productionLogs.get(id);
    if (!existing) return undefined;

    const updated: ProductionLog = {
      ...existing,
      ...log,
      updatedAt: new Date()
    };
    this.productionLogs.set(id, updated);
    return updated;
  }

  async deleteProductionLog(id: number): Promise<boolean> {
    return this.productionLogs.delete(id);
  }

  async getProductionQualityCheck(id: number): Promise<ProductionQualityCheck | undefined> {
    return this.qualityChecks.get(id);
  }

  async getProductionQualityChecksByOrder(orderId: number): Promise<ProductionQualityCheck[]> {
    return Array.from(this.qualityChecks.values())
      .filter(check => check.productionOrderId === orderId);
  }

  async getAllProductionQualityChecks(): Promise<ProductionQualityCheck[]> {
    return Array.from(this.qualityChecks.values());
  }

  async createProductionQualityCheck(check: InsertProductionQualityCheck): Promise<ProductionQualityCheck> {
    const id = this.checkIdCounter++;
    const newCheck: ProductionQualityCheck = {
      id,
      productionOrderId: check.productionOrderId,
      checkType: check.checkType,
      passed: check.passed,
      notes: check.notes ?? null,
      createdById: check.createdById ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.qualityChecks.set(id, newCheck);
    return newCheck;
  }

  async updateProductionQualityCheck(id: number, check: Partial<InsertProductionQualityCheck>): Promise<ProductionQualityCheck | undefined> {
    const existing = this.qualityChecks.get(id);
    if (!existing) return undefined;

    const updated: ProductionQualityCheck = {
      ...existing,
      ...check,
      updatedAt: new Date()
    };
    this.qualityChecks.set(id, updated);
    return updated;
  }

  async deleteProductionQualityCheck(id: number): Promise<boolean> {
    return this.qualityChecks.delete(id);
  }

  async getProductionEfficiency(orderId: number): Promise<{
    plannedQuantity: number;
    actualQuantity: number;
    efficiency: number;
    materialWaste: number;
    productionTime: number;
    qualityScore: number;
  }> {
    const order = this.productionOrders.get(orderId);
    if (!order) {
      throw new Error('Production order not found');
    }

    const plannedQuantity = parseFloat(order.quantity);
    const consumptions = Array.from(this.materialConsumptions.values())
      .filter(c => c.orderId === orderId);
    
    const recipe = this.productionRecipes.get(order.recipeId);
    if (!recipe) {
      throw new Error('Production recipe not found');
    }

    const recipeIngredients = Array.from(this.recipeIngredients.values())
      .filter(i => i.recipeId === order.recipeId);

    // Calculate actual quantity based on material consumption
    let actualQuantity = 0;
    let materialWaste = 0;

    for (const ingredient of recipeIngredients) {
      const consumption = consumptions.find(c => c.materialId === ingredient.materialId);
      if (consumption) {
        const consumedQuantity = parseFloat(consumption.quantity);
        const plannedQuantity = parseFloat(ingredient.quantity);
        const waste = consumedQuantity - plannedQuantity;
        materialWaste += waste;
        actualQuantity += consumedQuantity;
      }
    }

    // Calculate production time
    const logs = Array.from(this.productionLogs.values())
      .filter(l => l.orderId === orderId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const startTime = logs[0]?.timestamp;
    const endTime = logs[logs.length - 1]?.timestamp;
    const productionTime = startTime && endTime ? 
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60) : 0; // in hours

    // Calculate quality score
    const qualityChecks = Array.from(this.qualityChecks.values())
      .filter(c => c.productionOrderId === orderId);
    const qualityScore = qualityChecks.length > 0 ?
      qualityChecks.filter(c => c.passed).length / qualityChecks.length : 0;

    // Calculate efficiency
    const efficiency = plannedQuantity > 0 ? (actualQuantity / plannedQuantity) * 100 : 0;

    return {
      plannedQuantity,
      actualQuantity,
      efficiency,
      materialWaste,
      productionTime,
      qualityScore
    };
  }

  async getMaterialUsageReport(materialId: number, startDate: Date, endDate: Date): Promise<{
    totalConsumed: number;
    averagePerBatch: number;
    wastePercentage: number;
    batches: {
      batchNumber: string;
      date: Date;
      quantity: number;
      waste: number;
    }[];
  }> {
    const consumptions = Array.from(this.materialConsumptions.values())
      .filter(c => c.materialId === materialId);

    const batches = consumptions.map(consumption => {
      const order = this.productionOrders.get(consumption.orderId);
      const recipe = order ? this.productionRecipes.get(order.recipeId) : null;
      const ingredient = recipe ? 
        Array.from(this.recipeIngredients.values())
          .find(i => i.recipeId === recipe.id && i.materialId === materialId) : null;

      const consumedQuantity = parseFloat(consumption.quantity);
      const plannedQuantity = ingredient ? parseFloat(ingredient.quantity) : 0;
      const waste = consumedQuantity - plannedQuantity;

      return {
        batchNumber: order?.id.toString() ?? 'Unknown',
        date: order?.startDate ?? new Date(),
        quantity: consumedQuantity,
        waste
      };
    }).filter(batch => batch.date >= startDate && batch.date <= endDate);

    const totalConsumed = batches.reduce((sum, b) => sum + b.quantity, 0);
    const totalWaste = batches.reduce((sum, b) => sum + b.waste, 0);
    const averagePerBatch = batches.length > 0 ? totalConsumed / batches.length : 0;
    const wastePercentage = totalConsumed > 0 ? (totalWaste / totalConsumed) * 100 : 0;

    return {
      totalConsumed,
      averagePerBatch,
      wastePercentage,
      batches: batches.sort((a, b) => b.date.getTime() - a.date.getTime())
    };
  }
} 