import { Request, Response } from 'express';
import { storage } from '../storage.postgresql';
import { z } from 'zod';
import { orderErrorTypeEnum } from '../../shared/schema';

/**
 * Get all order errors, optionally filtered by order ID
 */
export async function getOrderErrors(req: Request, res: Response) {
  try {
    const orderId = req.query.orderId ? parseInt(req.query.orderId as string, 10) : undefined;
    const errors = await storage.getOrderErrors(orderId);
    return res.json(errors);
  } catch (error) {
    console.error('Error fetching order errors:', error);
    return res.status(500).json({ message: 'Failed to fetch order errors' });
  }
}

/**
 * Get a specific order error by ID
 */
export async function getOrderError(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const error = await storage.getOrderError(id);
    
    if (!error) {
      return res.status(404).json({ message: 'Order error not found' });
    }
    
    return res.json(error);
  } catch (error) {
    console.error('Error fetching order error:', error);
    return res.status(500).json({ message: 'Failed to fetch order error' });
  }
}

/**
 * Create a new order error report
 */
export async function createOrderError(req: Request, res: Response) {
  try {
    // Basic validation schema for order error creation
    const createErrorSchema = z.object({
      orderId: z.number(),
      errorType: z.enum(orderErrorTypeEnum.enumValues),
      description: z.string().min(5),
      reportedById: z.number(),
      affectedProductIds: z.array(z.number()).optional()
    });
    
    // Validate request body
    const validatedData = createErrorSchema.parse(req.body);
    
    // Create the error record
    const error = await storage.createOrderError({
      ...validatedData,
      reportDate: new Date(),
      resolved: false,
      resolvedById: null,
      resolvedDate: null,
      rootCause: null,
      preventiveMeasures: null,
      affectedProductIds: validatedData.affectedProductIds ? JSON.stringify(validatedData.affectedProductIds) : null,
      inventoryAdjusted: false
    });
    
    return res.status(201).json(error);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid order error data',
        errors: error.errors 
      });
    }
    
    console.error('Error creating order error:', error);
    return res.status(500).json({ message: 'Failed to create order error' });
  }
}

/**
 * Update an existing order error (for partial updates)
 */
export async function updateOrderError(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    
    // Basic validation schema for order error updates
    const updateErrorSchema = z.object({
      errorType: z.enum(orderErrorTypeEnum.enumValues).optional(),
      description: z.string().min(5).optional(),
      affectedProductIds: z.array(z.number()).optional()
    });
    
    // Validate request body
    const validatedData = updateErrorSchema.parse(req.body);
    
    // Prepare update data with proper formatting for affected product IDs
    const updateData = {
      ...validatedData
    };
    
    // Format affected product IDs as a JSON string if present
    if (updateData.affectedProductIds) {
      updateData.affectedProductIds = JSON.stringify(updateData.affectedProductIds);
    }
    
    // Update the error
    const updatedError = await storage.updateOrderError(id, updateData);
    
    if (!updatedError) {
      return res.status(404).json({ message: 'Order error not found' });
    }
    
    return res.json(updatedError);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid update data',
        errors: error.errors 
      });
    }
    
    console.error('Error updating order error:', error);
    return res.status(500).json({ message: 'Failed to update order error' });
  }
}

/**
 * Resolve an order error
 */
export async function resolveOrderError(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    
    // Basic validation schema for error resolution
    const resolveErrorSchema = z.object({
      userId: z.number(),
      rootCause: z.string().min(5).optional(),
      preventiveMeasures: z.string().min(5).optional()
    });
    
    // Validate request body
    const validatedData = resolveErrorSchema.parse(req.body);
    
    // Resolve the error
    const resolvedError = await storage.resolveOrderError(id, validatedData.userId, {
      rootCause: validatedData.rootCause,
      preventiveMeasures: validatedData.preventiveMeasures
    });
    
    if (!resolvedError) {
      return res.status(404).json({ message: 'Order error not found' });
    }
    
    return res.json(resolvedError);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid resolution data',
        errors: error.errors 
      });
    }
    
    console.error('Error resolving order error:', error);
    return res.status(500).json({ message: 'Failed to resolve order error' });
  }
}

/**
 * Adjust inventory based on an order error
 */
export async function adjustInventoryForError(req: Request, res: Response) {
  try {
    const errorId = parseInt(req.params.id, 10);
    
    // Basic validation schema for inventory adjustments
    const adjustmentSchema = z.object({
      adjustments: z.array(z.object({
        productId: z.number(),
        quantity: z.number()
      }))
    });
    
    // Validate request body
    const validatedData = adjustmentSchema.parse(req.body);
    
    // Make the adjustments
    const success = await storage.adjustInventoryForError(
      errorId, 
      validatedData.adjustments
    );
    
    if (!success) {
      return res.status(500).json({ message: 'Failed to adjust inventory' });
    }
    
    return res.json({ 
      message: 'Inventory adjusted successfully',
      adjustments: validatedData.adjustments
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid adjustment data',
        errors: error.errors 
      });
    }
    
    console.error('Error adjusting inventory:', error);
    return res.status(500).json({ message: 'Failed to adjust inventory' });
  }
}

/**
 * Get error statistics for the reporting dashboard
 */
export async function getErrorStats(req: Request, res: Response) {
  try {
    // Get period from query params, default to 90 days
    const period = req.query.period ? parseInt(req.query.period as string, 10) : 90;
    
    // Get the stats
    const stats = await storage.getErrorStats(period);
    
    return res.json(stats);
  } catch (error) {
    console.error('Error fetching error stats:', error);
    return res.status(500).json({ message: 'Failed to fetch error statistics' });
  }
}