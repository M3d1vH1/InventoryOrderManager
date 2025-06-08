import { 
  InventoryPrediction, InsertInventoryPrediction,
  SeasonalPattern, InsertSeasonalPattern
} from '@shared/schema';
import { IStorage } from '../storage';

export interface IAnalyticsStorage {
  // Inventory Prediction methods
  getInventoryPrediction(id: number): Promise<InventoryPrediction | undefined>;
  getInventoryPredictionsByProduct(productId: number): Promise<InventoryPrediction[]>;
  getAllInventoryPredictions(): Promise<InventoryPrediction[]>;
  createInventoryPrediction(prediction: InsertInventoryPrediction): Promise<InventoryPrediction>;
  updateInventoryPrediction(id: number, prediction: Partial<InsertInventoryPrediction>): Promise<InventoryPrediction | undefined>;
  deleteInventoryPrediction(id: number): Promise<boolean>;
  
  // Seasonal Pattern methods
  getSeasonalPattern(id: number): Promise<SeasonalPattern | undefined>;
  getSeasonalPatternsByProduct(productId: number): Promise<SeasonalPattern[]>;
  getAllSeasonalPatterns(): Promise<SeasonalPattern[]>;
  createSeasonalPattern(pattern: InsertSeasonalPattern): Promise<SeasonalPattern>;
  updateSeasonalPattern(id: number, pattern: Partial<InsertSeasonalPattern>): Promise<SeasonalPattern | undefined>;
  deleteSeasonalPattern(id: number): Promise<boolean>;
  
  // Analytics methods
  getProductDemandForecast(productId: number, months: number): Promise<{
    month: string;
    predictedDemand: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
  }[]>;
  
  getSeasonalTrends(productId: number): Promise<{
    month: string;
    averageDemand: number;
    peakFactor: number;
  }[]>;
  
  getInventoryOptimization(productId: number): Promise<{
    optimalStockLevel: number;
    reorderPoint: number;
    safetyStock: number;
    leadTimeDemand: number;
    serviceLevel: number;
  }>;
}

export class MemAnalyticsStorage implements IAnalyticsStorage {
  private inventoryPredictions: Map<number, InventoryPrediction>;
  private seasonalPatterns: Map<number, SeasonalPattern>;
  private predictionIdCounter: number;
  private patternIdCounter: number;

  constructor() {
    this.inventoryPredictions = new Map();
    this.seasonalPatterns = new Map();
    this.predictionIdCounter = 1;
    this.patternIdCounter = 1;
  }

  async getInventoryPrediction(id: number): Promise<InventoryPrediction | undefined> {
    return this.inventoryPredictions.get(id);
  }

  async getInventoryPredictionsByProduct(productId: number): Promise<InventoryPrediction[]> {
    return Array.from(this.inventoryPredictions.values())
      .filter(prediction => prediction.productId === productId);
  }

  async getAllInventoryPredictions(): Promise<InventoryPrediction[]> {
    return Array.from(this.inventoryPredictions.values());
  }

  async createInventoryPrediction(prediction: InsertInventoryPrediction): Promise<InventoryPrediction> {
    const id = this.predictionIdCounter++;
    const newPrediction: InventoryPrediction = {
      id,
      productId: prediction.productId,
      generatedAt: new Date(),
      predictionMethod: prediction.predictionMethod,
      predictedDemand: prediction.predictedDemand,
      confidenceLevel: prediction.confidenceLevel,
      accuracy: prediction.accuracy ?? 'medium',
      predictedStockoutDate: prediction.predictedStockoutDate ?? null,
      recommendedReorderDate: prediction.recommendedReorderDate ?? null,
      recommendedQuantity: prediction.recommendedQuantity ?? null,
      notes: prediction.notes ?? null,
      createdById: prediction.createdById ?? null,
      updatedAt: new Date()
    };
    this.inventoryPredictions.set(id, newPrediction);
    return newPrediction;
  }

  async updateInventoryPrediction(id: number, prediction: Partial<InsertInventoryPrediction>): Promise<InventoryPrediction | undefined> {
    const existing = this.inventoryPredictions.get(id);
    if (!existing) return undefined;

    const updated: InventoryPrediction = {
      ...existing,
      ...prediction,
      updatedAt: new Date()
    };
    this.inventoryPredictions.set(id, updated);
    return updated;
  }

  async deleteInventoryPrediction(id: number): Promise<boolean> {
    return this.inventoryPredictions.delete(id);
  }

  async getSeasonalPattern(id: number): Promise<SeasonalPattern | undefined> {
    return this.seasonalPatterns.get(id);
  }

  async getSeasonalPatternsByProduct(productId: number): Promise<SeasonalPattern[]> {
    return Array.from(this.seasonalPatterns.values())
      .filter(pattern => pattern.productId === productId);
  }

  async getAllSeasonalPatterns(): Promise<SeasonalPattern[]> {
    return Array.from(this.seasonalPatterns.values());
  }

  async createSeasonalPattern(pattern: InsertSeasonalPattern): Promise<SeasonalPattern> {
    const id = this.patternIdCounter++;
    const newPattern: SeasonalPattern = {
      id,
      productId: pattern.productId,
      month: pattern.month,
      adjustmentFactor: pattern.adjustmentFactor ?? 100,
      notes: pattern.notes ?? null,
      updatedAt: new Date()
    };
    this.seasonalPatterns.set(id, newPattern);
    return newPattern;
  }

  async updateSeasonalPattern(id: number, pattern: Partial<InsertSeasonalPattern>): Promise<SeasonalPattern | undefined> {
    const existing = this.seasonalPatterns.get(id);
    if (!existing) return undefined;

    const updated: SeasonalPattern = {
      ...existing,
      ...pattern,
      updatedAt: new Date()
    };
    this.seasonalPatterns.set(id, updated);
    return updated;
  }

  async deleteSeasonalPattern(id: number): Promise<boolean> {
    return this.seasonalPatterns.delete(id);
  }

  async getProductDemandForecast(productId: number, months: number): Promise<{
    month: string;
    predictedDemand: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
  }[]> {
    const predictions = Array.from(this.inventoryPredictions.values())
      .filter(prediction => prediction.productId === productId)
      .sort((a, b) => a.generatedAt.getTime() - b.generatedAt.getTime());

    if (predictions.length === 0) {
      return [];
    }

    const latestPrediction = predictions[predictions.length - 1];
    const baseDemand = latestPrediction.predictedDemand;
    const confidenceLevel = latestPrediction.confidenceLevel / 100;
    const margin = (1 - confidenceLevel) / 2;

    const forecast: {
      month: string;
      predictedDemand: number;
      confidenceInterval: {
        lower: number;
        upper: number;
      };
    }[] = [];

    const startDate = new Date(latestPrediction.generatedAt);
    for (let i = 0; i < months; i++) {
      const forecastDate = new Date(startDate);
      forecastDate.setMonth(forecastDate.getMonth() + i + 1);

      // Apply seasonal adjustment if available
      const seasonalPattern = Array.from(this.seasonalPatterns.values())
        .find(pattern => pattern.productId === productId && pattern.month === forecastDate.getMonth() + 1);

      const seasonalFactor = seasonalPattern ? seasonalPattern.adjustmentFactor / 100 : 1;
      const adjustedDemand = baseDemand * seasonalFactor;

      forecast.push({
        month: forecastDate.toISOString().slice(0, 7), // YYYY-MM format
        predictedDemand: adjustedDemand,
        confidenceInterval: {
          lower: Math.floor(adjustedDemand * (1 - margin)),
          upper: Math.ceil(adjustedDemand * (1 + margin))
        }
      });
    }

    return forecast;
  }

  async getSeasonalTrends(productId: number): Promise<{
    month: string;
    averageDemand: number;
    peakFactor: number;
  }[]> {
    const patterns = Array.from(this.seasonalPatterns.values())
      .filter(pattern => pattern.productId === productId)
      .sort((a, b) => a.month - b.month);

    return patterns.map(pattern => ({
      month: new Date(2000, pattern.month - 1).toLocaleString('default', { month: 'long' }),
      averageDemand: pattern.adjustmentFactor,
      peakFactor: pattern.adjustmentFactor / 100
    }));
  }

  async getInventoryOptimization(productId: number): Promise<{
    optimalStockLevel: number;
    reorderPoint: number;
    safetyStock: number;
    leadTimeDemand: number;
    serviceLevel: number;
  }> {
    // Get historical predictions for the product
    const predictions = Array.from(this.inventoryPredictions.values())
      .filter(prediction => prediction.productId === productId);

    if (predictions.length === 0) {
      throw new Error('No historical data available for optimization');
    }

    // Calculate average demand and standard deviation
    const demands = predictions.map(p => p.predictedDemand);
    const avgDemand = demands.reduce((sum, val) => sum + val, 0) / demands.length;
    const stdDev = Math.sqrt(
      demands.reduce((sum, val) => sum + Math.pow(val - avgDemand, 2), 0) / demands.length
    );

    // Assume lead time of 2 weeks and service level of 95%
    const leadTimeDays = 14;
    const serviceLevel = 0.95;
    const serviceFactor = 1.645; // Z-score for 95% service level

    // Calculate safety stock
    const safetyStock = serviceFactor * stdDev * Math.sqrt(leadTimeDays / 30);

    // Calculate lead time demand
    const leadTimeDemand = avgDemand * (leadTimeDays / 30);

    // Calculate reorder point
    const reorderPoint = leadTimeDemand + safetyStock;

    // Calculate optimal stock level (assuming order quantity of 2 weeks of demand)
    const optimalStockLevel = reorderPoint + (avgDemand * 2);

    return {
      optimalStockLevel,
      reorderPoint,
      safetyStock,
      leadTimeDemand,
      serviceLevel
    };
  }
} 