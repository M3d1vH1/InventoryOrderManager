import { Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { insertInventoryPredictionSchema, insertSeasonalPatternSchema } from '@shared/schema';

// Get all inventory predictions
export async function getInventoryPredictions(req: Request, res: Response) {
  try {
    const productId = req.query.productId ? parseInt(req.query.productId as string, 10) : undefined;
    const predictions = await storage.getInventoryPredictions(productId);
    
    // Get product names for better display
    const withProductNames = await Promise.all(
      predictions.map(async (prediction) => {
        const product = await storage.getProduct(prediction.productId);
        return {
          ...prediction,
          productName: product?.name || `Product ID: ${prediction.productId}`
        };
      })
    );
    
    res.json(withProductNames);
  } catch (error: any) {
    console.error('Error getting inventory predictions:', error);
    res.status(500).json({ message: error.message });
  }
}

// Get a specific inventory prediction
export async function getInventoryPrediction(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const prediction = await storage.getInventoryPredictionById(id);
    
    if (!prediction) {
      return res.status(404).json({ message: 'Inventory prediction not found' });
    }
    
    const product = await storage.getProduct(prediction.productId);
    
    res.json({
      ...prediction,
      productName: product?.name || `Product ID: ${prediction.productId}`
    });
  } catch (error: any) {
    console.error('Error getting inventory prediction:', error);
    res.status(500).json({ message: error.message });
  }
}

// Create a new inventory prediction
export async function createInventoryPrediction(req: Request, res: Response) {
  try {
    const predictionData = insertInventoryPredictionSchema.parse({
      ...req.body,
      createdById: req.user?.id,
    });
    
    // Validate product exists
    const product = await storage.getProduct(predictionData.productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const prediction = await storage.createInventoryPrediction(predictionData);
    
    res.status(201).json({
      ...prediction,
      productName: product.name
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Error creating inventory prediction:', error);
    res.status(500).json({ message: error.message });
  }
}

// Update an inventory prediction
export async function updateInventoryPrediction(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const predictionData = insertInventoryPredictionSchema.partial().parse(req.body);
    
    const updatedPrediction = await storage.updateInventoryPrediction(id, predictionData);
    
    if (!updatedPrediction) {
      return res.status(404).json({ message: 'Inventory prediction not found' });
    }
    
    const product = await storage.getProduct(updatedPrediction.productId);
    
    res.json({
      ...updatedPrediction,
      productName: product?.name || `Product ID: ${updatedPrediction.productId}`
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Error updating inventory prediction:', error);
    res.status(500).json({ message: error.message });
  }
}

// Delete an inventory prediction
export async function deleteInventoryPrediction(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    
    const result = await storage.deleteInventoryPrediction(id);
    
    if (!result) {
      return res.status(404).json({ message: 'Inventory prediction not found' });
    }
    
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting inventory prediction:', error);
    res.status(500).json({ message: error.message });
  }
}

// Get products requiring reorder
export async function getProductsRequiringReorder(req: Request, res: Response) {
  try {
    const products = await storage.getProductsRequiringReorder();
    res.json(products);
  } catch (error: any) {
    console.error('Error getting products requiring reorder:', error);
    res.status(500).json({ message: error.message });
  }
}

// Generate predictions for all products
export async function generatePredictions(req: Request, res: Response) {
  try {
    const method = req.query.method as string || 'moving_average';
    const validMethods = ['moving_average', 'linear_regression', 'seasonal_adjustment', 'weighted_average', 'manual'];
    
    if (!validMethods.includes(method)) {
      return res.status(400).json({ 
        message: 'Invalid prediction method', 
        validMethods 
      });
    }
    
    const count = await storage.generatePredictions(method);
    
    res.json({ 
      message: `Generated ${count} predictions using ${method} method`,
      count 
    });
  } catch (error: any) {
    console.error('Error generating predictions:', error);
    res.status(500).json({ message: error.message });
  }
}

// Get inventory history
export async function getInventoryHistory(req: Request, res: Response) {
  try {
    const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
    
    const history = await storage.getInventoryHistory(productId, dateFrom, dateTo);
    
    // Get product names for better display
    const withProductNames = await Promise.all(
      history.map(async (record) => {
        const product = await storage.getProduct(record.productId);
        return {
          ...record,
          productName: product?.name || `Product ID: ${record.productId}`
        };
      })
    );
    
    res.json(withProductNames);
  } catch (error: any) {
    console.error('Error getting inventory history:', error);
    res.status(500).json({ message: error.message });
  }
}

// Create inventory history record
export async function createInventoryHistory(req: Request, res: Response) {
  try {
    const historyData = req.body;
    
    // Validate product exists
    const product = await storage.getProduct(historyData.productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const record = await storage.createInventoryHistory(historyData);
    
    res.status(201).json({
      ...record,
      productName: product.name
    });
  } catch (error: any) {
    console.error('Error creating inventory history record:', error);
    res.status(500).json({ message: error.message });
  }
}

// Get seasonal patterns
export async function getSeasonalPatterns(req: Request, res: Response) {
  try {
    const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
    const patterns = await storage.getSeasonalPatterns(productId);
    
    // Get product names for better display
    const withProductNames = await Promise.all(
      patterns.map(async (pattern) => {
        const product = await storage.getProduct(pattern.productId);
        return {
          ...pattern,
          productName: product?.name || `Product ID: ${pattern.productId}`,
          monthName: getMonthName(pattern.month)
        };
      })
    );
    
    res.json(withProductNames);
  } catch (error: any) {
    console.error('Error getting seasonal patterns:', error);
    res.status(500).json({ message: error.message });
  }
}

// Create or update seasonal pattern
export async function createSeasonalPattern(req: Request, res: Response) {
  try {
    const patternData = insertSeasonalPatternSchema.parse(req.body);
    
    // Validate product exists
    const product = await storage.getProduct(patternData.productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Validate month is between 1-12
    if (patternData.month < 1 || patternData.month > 12) {
      return res.status(400).json({ message: 'Month must be between 1 and 12' });
    }
    
    // Check if pattern already exists for this product and month
    const existingPatterns = await storage.getSeasonalPatterns(patternData.productId);
    const existing = existingPatterns.find(p => p.month === patternData.month);
    
    let pattern;
    if (existing) {
      pattern = await storage.updateSeasonalPattern(existing.id, patternData);
    } else {
      pattern = await storage.createSeasonalPattern(patternData);
    }
    
    res.status(201).json({
      ...pattern,
      productName: product.name,
      monthName: getMonthName(pattern.month)
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    console.error('Error creating/updating seasonal pattern:', error);
    res.status(500).json({ message: error.message });
  }
}

// Delete a seasonal pattern
export async function deleteSeasonalPattern(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    
    const result = await storage.deleteSeasonalPattern(id);
    
    if (!result) {
      return res.status(404).json({ message: 'Seasonal pattern not found' });
    }
    
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting seasonal pattern:', error);
    res.status(500).json({ message: error.message });
  }
}

// Import multiple seasonal patterns
export async function importSeasonalPatterns(req: Request, res: Response) {
  try {
    const patterns = req.body;
    
    if (!Array.isArray(patterns)) {
      return res.status(400).json({ message: 'Expected an array of seasonal patterns' });
    }
    
    const count = await storage.importSeasonalPatterns(patterns);
    
    res.json({ 
      message: `Imported ${count} seasonal patterns`,
      count 
    });
  } catch (error: any) {
    console.error('Error importing seasonal patterns:', error);
    res.status(500).json({ message: error.message });
  }
}

// Helper function to get month name from number
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return months[month - 1] || `Month ${month}`;
}