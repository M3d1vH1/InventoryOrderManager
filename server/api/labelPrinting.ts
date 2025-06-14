import { Request, Response } from 'express';
import { storage } from '../storage';
import { labelPrinterService } from '../services/labelPrinterService';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

// Validation schema for printing requests
const printLabelSchema = z.object({
  orderId: z.number(),
  boxCount: z.number().min(1),
  currentBox: z.number().min(1)
});

const batchPrintSchema = z.object({
  orderId: z.number(),
  boxCount: z.number().min(1)
});

/**
 * Print a single shipping label
 */
export async function printShippingLabel(req: Request, res: Response) {
  try {
    const { orderId, boxCount, currentBox } = printLabelSchema.parse(req.body);
    
    // Log exact values received from user input
    console.log(`[api:printShippingLabel] Using user-specified values - Box count: ${boxCount}, Current box: ${currentBox}`);
    
    // Check if orderId exists
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Validate that currentBox is not greater than boxCount
    if (currentBox > boxCount) {
      return res.status(400).json({ error: 'Current box number cannot exceed total box count' });
    }
    
    // Print the label
    const result = await labelPrinterService.printShippingLabel(orderId, boxCount, currentBox);
    
    return res.status(200).json({ 
      success: !result.startsWith('Error:'),
      message: result 
    });
  } catch (error: any) {
    console.error('Error processing print request:', error);
    return res.status(400).json({ 
      error: error.message || 'Failed to print shipping label' 
    });
  }
}

/**
 * Print a batch of shipping labels for multiple boxes
 */
export async function printBatchShippingLabels(req: Request, res: Response) {
  try {
    const { orderId, boxCount } = batchPrintSchema.parse(req.body);
    
    // Log exact values received from user input for batch printing
    console.log(`[api:printBatchShippingLabels] Using user-specified box count: ${boxCount}`);
    
    // Check if orderId exists
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Print batch of labels
    const results = await labelPrinterService.printBatchLabels(orderId, boxCount);
    
    return res.status(200).json({ 
      success: true,
      results
    });
  } catch (error: any) {
    console.error('Error processing batch print request:', error);
    return res.status(400).json({ 
      error: error.message || 'Failed to print batch of shipping labels' 
    });
  }
}

/**
 * Generate preview of shipping label without printing
 */
export async function previewShippingLabel(req: Request, res: Response) {
  try {
    const { orderId, boxCount, currentBox } = printLabelSchema.parse(req.body);
    
    // Log exact values received from user input for preview
    console.log(`[api:previewShippingLabel] Using user-specified values - Box count: ${boxCount}, Current box: ${currentBox}`);
    
    // Check if orderId exists
    const order = await storage.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Validate that currentBox is not greater than boxCount
    if (currentBox > boxCount) {
      return res.status(400).json({ error: 'Current box number cannot exceed total box count' });
    }
    
    // Generate preview HTML
    const previewPath = await labelPrinterService.generatePreview(orderId, boxCount, currentBox);
    
    // Create a public URL for the HTML preview
    const filename = path.basename(previewPath);
    const publicPath = path.join(process.cwd(), 'public', filename);
    
    // Ensure public directory exists
    if (!fs.existsSync(path.dirname(publicPath))) {
      fs.mkdirSync(path.dirname(publicPath), { recursive: true });
    }
    
    // Clean up old preview files in public directory to prevent accumulation
    try {
      const publicDir = path.dirname(publicPath);
      const files = fs.readdirSync(publicDir);
      const labelPattern = 'label-preview-';
      
      // Keep max 10 most recent files
      const labelFiles = files
        .filter(f => f.startsWith(labelPattern) && f.endsWith('.html'))
        .map(f => ({ name: f, time: fs.statSync(path.join(publicDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time); // Sort newest first
      
      // Delete older files if we have more than 10
      if (labelFiles.length > 10) {
        for (let i = 10; i < labelFiles.length; i++) {
          try {
            fs.unlinkSync(path.join(publicDir, labelFiles[i].name));
          } catch (err) {
            console.warn(`Failed to delete old public preview file ${labelFiles[i].name}:`, err);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to clean up old public preview files:', err);
    }
    
    // Copy new file to public directory
    fs.copyFileSync(previewPath, publicPath);
    
    // Return the URL to access the preview
    const previewUrl = `/api/preview-label/${filename}`;
    
    return res.status(200).json({ 
      success: true,
      previewUrl,
      isHtml: true,
      message: 'Preview generated successfully'
    });
  } catch (error: any) {
    console.error('Error generating preview:', error);
    return res.status(400).json({ 
      error: error.message || 'Failed to generate label preview' 
    });
  }
}

/**
 * Serve preview image
 */
export async function servePreviewImage(req: Request, res: Response) {
  try {
    const { filename } = req.params;
    
    // Security check to prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filePath = path.join(process.cwd(), 'public', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Preview not found' });
    }
    
    return res.sendFile(filePath);
  } catch (error: any) {
    console.error('Error serving preview:', error);
    return res.status(500).json({ error: 'Failed to serve preview image' });
  }
}