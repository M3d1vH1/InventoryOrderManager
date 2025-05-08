import { Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { orderQualityTypeEnum, InsertOrderQuality } from '../../shared/schema';

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
export async function getOrderQuality(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id, 10);
    const error = await storage.getOrderQuality(id);
    
    if (!error) {
      return res.status(404).json({ message: 'Order quality record not found' });
    }
    
    return res.json(error);
  } catch (error) {
    console.error('Error fetching order quality record:', error);
    return res.status(500).json({ message: 'Failed to fetch order quality record' });
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
      orderNumber: z.string(),
      errorType: z.enum(orderQualityTypeEnum.enumValues),
      description: z.string().min(5),
      reportedById: z.number(),
      affectedItems: z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        issueDescription: z.string()
      })).optional()
    });
    
    // Validate request body
    const validatedData = createErrorSchema.parse(req.body);
    
    // Extract product IDs from affected items
    const affectedProductIds = validatedData.affectedItems 
      ? validatedData.affectedItems.map(item => item.productId.toString())
      : [];
    
    // Create the error record
    const error = await storage.createOrderError({
      orderId: validatedData.orderId,
      orderNumber: validatedData.orderNumber,
      errorType: validatedData.errorType,
      description: validatedData.description,
      reportedById: validatedData.reportedById,
      affectedProductIds: affectedProductIds,
      inventoryAdjusted: false,
      correctiveAction: validatedData.affectedItems 
        ? `Affected items: ${validatedData.affectedItems.map(item => 
            `Product ID ${item.productId}, Qty: ${item.quantity}, Issue: ${item.issueDescription}`
          ).join('; ')}`
        : undefined
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
      errorType: z.enum(orderQualityTypeEnum.enumValues).optional(),
      description: z.string().min(5).optional(),
      affectedItems: z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        issueDescription: z.string()
      })).optional(),
      correctiveAction: z.string().optional()
    });
    
    // Validate request body
    const validatedData = updateErrorSchema.parse(req.body);
    
    // Prepare update data
    const updateData: Partial<InsertOrderQuality> = {};
    
    if (validatedData.errorType) {
      updateData.errorType = validatedData.errorType;
    }
    
    if (validatedData.description) {
      updateData.description = validatedData.description;
    }
    
    if (validatedData.correctiveAction) {
      updateData.correctiveAction = validatedData.correctiveAction;
    }
    
    // Extract product IDs from affected items if present
    if (validatedData.affectedItems) {
      updateData.affectedProductIds = validatedData.affectedItems.map(item => item.productId.toString());
      
      // Update corrective action with affected items details
      updateData.correctiveAction = `Affected items: ${validatedData.affectedItems.map(item => 
        `Product ID ${item.productId}, Qty: ${item.quantity}, Issue: ${item.issueDescription}`
      ).join('; ')}`;
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