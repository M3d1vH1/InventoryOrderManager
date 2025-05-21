import { Request, Response } from 'express';
import { storage } from '../storage';
import { barcodeScanLogs, insertBarcodeScanLogSchema } from '@shared/schema';
import { z } from 'zod';

/**
 * Get product information by barcode
 */
export const getProductByBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;
    
    if (!barcode) {
      return res.status(400).json({ message: 'Barcode is required' });
    }
    
    const product = await storage.getProductByBarcode(barcode);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found with this barcode' });
    }
    
    res.json(product);
  } catch (error: any) {
    console.error('Error fetching product by barcode:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Log a barcode scan event
 */
export const logBarcodeScan = async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = insertBarcodeScanLogSchema.parse(req.body);
    
    // Add the scan to logs
    const scanLog = await storage.createBarcodeScanLog(validatedData);
    
    res.status(201).json(scanLog);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid data provided',
        errors: error.errors 
      });
    }
    
    console.error('Error logging barcode scan:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get barcode scan history
 */
export const getBarcodeScanHistory = async (req: Request, res: Response) => {
  try {
    // Optional filters
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
    const barcode = req.query.barcode as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    
    // Get scan history
    const scanLogs = await storage.getBarcodeScanLogs({
      userId,
      productId,
      barcode,
      limit
    });
    
    res.json(scanLogs);
  } catch (error: any) {
    console.error('Error fetching barcode scan history:', error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update inventory quantity based on barcode scan
 */
export const updateInventoryByBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode, quantity, userId, changeType = 'manual_adjustment', notes } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ message: 'Barcode is required' });
    }
    
    if (quantity === undefined || isNaN(parseInt(quantity))) {
      return res.status(400).json({ message: 'Valid quantity is required' });
    }
    
    // Find product by barcode
    const product = await storage.getProductByBarcode(barcode);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found with this barcode' });
    }
    
    // Get current stock
    const currentStock = product.currentStock;
    const newQuantity = parseInt(quantity);
    
    // Create an inventory change record
    const change = {
      productId: product.id,
      previousQuantity: currentStock,
      newQuantity: newQuantity,
      quantityChanged: newQuantity - currentStock,
      userId: parseInt(userId),
      changeType: changeType,
      notes: notes || `Stock updated via barcode scan: ${barcode}`,
      reference: `Barcode scan: ${barcode}`
    };
    
    // Update the product stock
    await storage.updateProductStock(product.id, newQuantity);
    
    // Log the inventory change
    const inventoryChange = await storage.createInventoryChange(change);
    
    // Log the barcode scan as well
    await storage.createBarcodeScanLog({
      barcode,
      productId: product.id,
      userId: parseInt(userId),
      scanType: 'inventory_update',
      notes: `Updated inventory to ${newQuantity} units`
    });
    
    res.json({
      success: true,
      product: {
        ...product,
        currentStock: newQuantity
      },
      inventoryChange
    });
  } catch (error: any) {
    console.error('Error updating inventory by barcode:', error);
    res.status(500).json({ message: error.message });
  }
};