import { Request, Response } from 'express';
import { labelPrinterService } from '../services/labelPrinterService';
import { storage } from '../storage';
import { z } from 'zod';

// Validation schema for print label request
const printLabelSchema = z.object({
  orderId: z.number({
    required_error: 'Order ID is required',
    invalid_type_error: 'Order ID must be a number'
  }),
  boxCount: z.number({
    required_error: 'Box count is required',
    invalid_type_error: 'Box count must be a number'
  }).int().positive(),
  currentBox: z.number({
    required_error: 'Current box number is required',
    invalid_type_error: 'Current box number must be a number'
  }).int().positive().optional()
});

// Validation schema for print batch labels request
const printBatchLabelsSchema = z.object({
  orderId: z.number({
    required_error: 'Order ID is required',
    invalid_type_error: 'Order ID must be a number'
  }),
  boxCount: z.number({
    required_error: 'Box count is required',
    invalid_type_error: 'Box count must be a number'
  }).int().positive()
});

/**
 * Print a single shipping label
 */
export async function printShippingLabel(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = printLabelSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request data',
        errors: validationResult.error.format()
      });
    }
    
    const { orderId, boxCount, currentBox = 1 } = validationResult.data;
    
    // Check if the order exists
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Ensure order is in "picked" status or later
    const validStatuses = ['picked', 'partially_shipped', 'shipped'];
    if (!validStatuses.includes(order.status)) {
      return res.status(400).json({ 
        message: 'Cannot print shipping label for order that is not picked',
        currentStatus: order.status,
        requiredStatus: validStatuses.join(' or ')
      });
    }
    
    // Print the shipping label
    const result = await labelPrinterService.printShippingLabel(
      orderId, 
      boxCount, 
      currentBox
    );
    
    // Check for errors in the result
    if (result.startsWith('Error:')) {
      return res.status(500).json({ message: result });
    }
    
    res.json({ 
      message: 'Shipping label printed successfully',
      details: result,
      orderId,
      boxCount,
      currentBox
    });
  } catch (error: any) {
    console.error('Error printing shipping label:', error);
    res.status(500).json({ message: error.message });
  }
}

/**
 * Print a batch of shipping labels for multiple boxes
 */
export async function printBatchShippingLabels(req: Request, res: Response) {
  try {
    // Validate request body
    const validationResult = printBatchLabelsSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        message: 'Invalid request data',
        errors: validationResult.error.format()
      });
    }
    
    const { orderId, boxCount } = validationResult.data;
    
    // Check if the order exists
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Ensure order is in "picked" status or later
    const validStatuses = ['picked', 'partially_shipped', 'shipped'];
    if (!validStatuses.includes(order.status)) {
      return res.status(400).json({ 
        message: 'Cannot print shipping labels for order that is not picked',
        currentStatus: order.status,
        requiredStatus: validStatuses.join(' or ')
      });
    }
    
    // Print batch of shipping labels
    const results = await labelPrinterService.printBatchLabels(orderId, boxCount);
    
    // Check if any errors occurred
    const errors = results.filter(r => r.startsWith('Error:'));
    
    if (errors.length > 0) {
      return res.status(500).json({ 
        message: 'Some labels failed to print',
        errors,
        results
      });
    }
    
    res.json({ 
      message: `Successfully printed ${boxCount} shipping labels`,
      results,
      orderId,
      boxCount
    });
  } catch (error: any) {
    console.error('Error printing batch shipping labels:', error);
    res.status(500).json({ message: error.message });
  }
}

/**
 * Generate preview of shipping label without printing
 */
export async function previewShippingLabel(req: Request, res: Response) {
  try {
    // Validate path parameters
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }
    
    // Get query parameters with defaults
    const boxCount = parseInt(req.query.boxCount as string) || 1;
    const currentBox = parseInt(req.query.currentBox as string) || 1;
    
    // Check if the order exists
    const order = await storage.getOrderWithItems(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // If customer info not embedded, fetch it
    if (!order.customer && order.customerName) {
      order.customer = await storage.getCustomerByName(order.customerName);
    }
    
    // Generate JScript without printing
    const jScript = labelPrinterService.generateLabelJScript(
      order, 
      boxCount, 
      currentBox
    );
    
    // Return the JScript content for preview
    res.json({ 
      message: 'Shipping label preview generated',
      orderId,
      boxCount,
      currentBox,
      jScript,
      note: 'This is the JScript code that would be sent to the printer'
    });
  } catch (error: any) {
    console.error('Error generating shipping label preview:', error);
    res.status(500).json({ message: error.message });
  }
}