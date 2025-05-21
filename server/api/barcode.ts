import { Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';

// Barcode Log schema
const barcodeLogSchema = z.object({
  barcode: z.string(),
  mode: z.enum(['lookup', 'inventory', 'picking', 'receiving']),
  timestamp: z.string().datetime(),
  userId: z.string()
});

// Get product by barcode
export async function getProductByBarcode(req: Request, res: Response) {
  try {
    const { barcode } = req.params;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode parameter is required' });
    }
    
    // First try exact barcode match
    let product = await storage.getProductByBarcode(barcode);
    
    // If product not found by barcode, try SKU as fallback
    if (!product) {
      product = await storage.getProductBySku(barcode);
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found with this barcode' });
    }
    
    // Get product category name
    const category = product.categoryId ? await storage.getCategory(product.categoryId) : null;
    
    // Get product movement trend (simple version for now)
    const inventoryChanges = await storage.getRecentInventoryChanges(product.id, 7); // Last 7 days
    
    let movementTrend: 'up' | 'down' | 'stable' = 'stable';
    let averageDailySales = 0;
    
    if (inventoryChanges && inventoryChanges.length > 0) {
      // Calculate if trend is up or down
      let totalChange = 0;
      let salesCount = 0;
      
      for (const change of inventoryChanges) {
        if (change.type === 'sale' || change.type === 'picked') {
          totalChange -= change.quantity;
          salesCount++;
        }
      }
      
      if (totalChange > 0) {
        movementTrend = 'up'; // Inventory increasing
      } else if (totalChange < 0) {
        movementTrend = 'down'; // Inventory decreasing
      }
      
      // Calculate average daily sales
      if (salesCount > 0) {
        const days = Math.min(7, salesCount);
        averageDailySales = Math.abs(totalChange) / days;
      }
    }
    
    // Return enhanced product info
    return res.status(200).json({
      ...product,
      categoryName: category?.name || null,
      movementTrend,
      averageDailySales
    });
  } catch (error) {
    console.error('Error getting product by barcode:', error);
    return res.status(500).json({ error: 'Failed to get product information' });
  }
}

// Log barcode scan
export async function logBarcodeScan(req: Request, res: Response) {
  try {
    const validationResult = barcodeLogSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Invalid barcode log data',
        details: validationResult.error.format()
      });
    }
    
    const logData = validationResult.data;
    
    // Store log in database
    await storage.createBarcodeScanLog({
      barcode: logData.barcode,
      mode: logData.mode,
      timestamp: new Date(logData.timestamp),
      userId: logData.userId
    });
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error logging barcode scan:', error);
    return res.status(500).json({ error: 'Failed to log barcode scan' });
  }
}

// Get barcode scan history
export async function getBarcodeScanHistory(req: Request, res: Response) {
  try {
    const logs = await storage.getBarcodeScanLogs(50); // Get last 50 logs
    return res.status(200).json(logs);
  } catch (error) {
    console.error('Error getting barcode scan history:', error);
    return res.status(500).json({ error: 'Failed to get barcode scan history' });
  }
}

// Update inventory through barcode scan
export async function updateInventoryByBarcode(req: Request, res: Response) {
  try {
    const { barcode, quantity, adjustmentType } = req.body;
    
    if (!barcode || quantity === undefined || !adjustmentType) {
      return res.status(400).json({ error: 'Barcode, quantity, and adjustmentType are required' });
    }
    
    // Find product by barcode
    let product = await storage.getProductByBarcode(barcode);
    
    // If product not found by barcode, try SKU as fallback
    if (!product) {
      product = await storage.getProductBySku(barcode);
    }
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found with this barcode' });
    }
    
    // Update inventory
    const newQuantity = adjustmentType === 'count' 
      ? parseInt(quantity.toString()) 
      : product.currentStock + parseInt(quantity.toString());
    
    await storage.updateProductStock(product.id, newQuantity);
    
    // Log the inventory change
    await storage.createInventoryChange({
      productId: product.id,
      previousStock: product.currentStock,
      newStock: newQuantity,
      changeAmount: newQuantity - product.currentStock,
      type: adjustmentType,
      reason: 'Barcode scan inventory update',
      userId: req.user?.id || null,
      timestamp: new Date()
    });
    
    return res.status(200).json({ 
      success: true,
      product: {
        id: product.id,
        name: product.name,
        previousStock: product.currentStock,
        newStock: newQuantity
      }
    });
  } catch (error) {
    console.error('Error updating inventory by barcode:', error);
    return res.status(500).json({ error: 'Failed to update inventory' });
  }
}