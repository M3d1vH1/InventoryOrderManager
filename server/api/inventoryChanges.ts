import { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { inventoryChangeTypeEnum } from '@shared/schema';

/**
 * Get all inventory changes for a product (or all products)
 */
export async function getInventoryChanges(req: Request, res: Response) {
  try {
    const productId = req.query.productId ? parseInt(req.query.productId as string, 10) : undefined;
    
    const changes = await storage.getInventoryChanges(productId);
    return res.json(changes);
  } catch (error) {
    console.error('Error getting inventory changes:', error);
    return res.status(500).json({ message: 'Failed to get inventory changes' });
  }
}

/**
 * Get a specific inventory change
 */
export async function getInventoryChange(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    
    const change = await storage.getInventoryChange(id);
    if (!change) {
      return res.status(404).json({ message: 'Inventory change not found' });
    }
    
    return res.json(change);
  } catch (error) {
    console.error('Error getting inventory change:', error);
    return res.status(500).json({ message: 'Failed to get inventory change' });
  }
}

/**
 * Track a product inventory change manually
 * In normal operations, this is automatically called by updateProduct
 */
export async function addInventoryChange(req: Request, res: Response) {
  try {
    // Validate request body
    const inventoryChangeSchema = z.object({
      productId: z.number(),
      userId: z.number(),
      changeType: z.enum(inventoryChangeTypeEnum.enumValues),
      previousQuantity: z.number(),
      newQuantity: z.number(),
      quantityChanged: z.number(), 
      reference: z.string().optional(),
      notes: z.string().optional()
    });
    
    const validatedData = inventoryChangeSchema.parse(req.body);
    
    // Add the inventory change record
    const change = await storage.addInventoryChange(validatedData);
    return res.status(201).json(change);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid inventory change data',
        errors: error.errors 
      });
    }
    
    console.error('Error adding inventory change:', error);
    return res.status(500).json({ message: 'Failed to add inventory change' });
  }
}

/**
 * Get recent inventory changes
 */
export async function getRecentInventoryChanges(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    
    const changes = await storage.getRecentInventoryChanges(limit);
    return res.json(changes);
  } catch (error) {
    console.error('Error getting recent inventory changes:', error);
    return res.status(500).json({ message: 'Failed to get recent inventory changes' });
  }
}

/**
 * Get inventory changes by change type
 */
export async function getInventoryChangesByType(req: Request, res: Response) {
  try {
    const changeType = req.params.type;
    
    // Validate change type
    if (!inventoryChangeTypeEnum.enumValues.includes(changeType)) {
      return res.status(400).json({ message: 'Invalid change type' });
    }
    
    const changes = await storage.getInventoryChangesByType(changeType);
    return res.json(changes);
  } catch (error) {
    console.error('Error getting inventory changes by type:', error);
    return res.status(500).json({ message: 'Failed to get inventory changes by type' });
  }
}