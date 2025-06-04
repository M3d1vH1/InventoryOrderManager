/**
 * Winston Logging Usage Examples
 * Demonstrates how to use the enhanced logging system in Express route handlers
 */

import { Request, Response } from 'express';
import logger, { logError, logBusinessEvent, logDatabaseOperation } from '../utils/logger';
import { logSecurityEvent, logBusinessEvent as logBusinessEventWithReq } from '../middlewares/requestLogger';

// Example 1: Basic info and error logging in a route handler
export async function exampleProductRoute(req: Request, res: Response) {
  try {
    // Log business event with request context
    logBusinessEventWithReq(req, 'product_creation_attempted', {
      productName: req.body.name,
      sku: req.body.sku
    });

    // Simulate database operation
    const startTime = Date.now();
    
    // Your actual database operation here
    // const product = await storage.createProduct(req.body);
    
    const duration = Date.now() - startTime;
    
    // Log successful database operation
    logDatabaseOperation('INSERT', 'products', duration);

    // Log successful business event
    logBusinessEvent('product_created', {
      productId: 123, // product.id,
      sku: req.body.sku,
      createdBy: (req as any).user?.id
    });

    // Info log with structured data
    logger.info('Product created successfully', {
      requestId: (req as any).requestId,
      productId: 123,
      userId: (req as any).user?.id,
      action: 'create_product'
    });

    res.status(201).json({ success: true, productId: 123 });

  } catch (error: any) {
    // Log error with full context
    logError(error, {
      requestId: (req as any).requestId,
      operation: 'create_product',
      userId: (req as any).user?.id,
      requestBody: req.body
    });

    res.status(500).json({ 
      error: true, 
      message: 'Failed to create product',
      requestId: (req as any).requestId 
    });
  }
}

// Example 2: Authentication failure logging
export async function exampleAuthRoute(req: Request, res: Response) {
  const { username, password } = req.body;

  try {
    // Your auth logic here
    const isValid = false; // await validateCredentials(username, password);

    if (!isValid) {
      // Log security event for failed login
      logSecurityEvent(req, 'login_failed', {
        username,
        attemptedAt: new Date().toISOString(),
        reason: 'invalid_credentials'
      });

      return res.status(401).json({ 
        error: true, 
        message: 'Invalid credentials' 
      });
    }

    // Log successful login
    logBusinessEventWithReq(req, 'user_login_success', {
      username,
      loginTime: new Date().toISOString()
    });

    res.json({ success: true, message: 'Login successful' });

  } catch (error: any) {
    logError(error, {
      requestId: (req as any).requestId,
      operation: 'user_authentication',
      username
    });

    res.status(500).json({ 
      error: true, 
      message: 'Authentication service error' 
    });
  }
}

// Example 3: File upload with logging
export async function exampleFileUploadRoute(req: Request, res: Response) {
  try {
    const uploadedFile = (req as any).files?.image;

    if (!uploadedFile) {
      logger.warn('File upload attempted without file', {
        requestId: (req as any).requestId,
        userId: (req as any).user?.id
      });

      return res.status(400).json({ 
        error: true, 
        message: 'No file provided' 
      });
    }

    // Log file upload details
    logger.info('File upload processing started', {
      requestId: (req as any).requestId,
      fileName: uploadedFile.name,
      fileSize: uploadedFile.size,
      mimeType: uploadedFile.mimetype,
      userId: (req as any).user?.id
    });

    // Your file processing logic here
    // await processFile(uploadedFile);

    // Log successful upload
    logBusinessEventWithReq(req, 'file_uploaded', {
      fileName: uploadedFile.name,
      fileSize: uploadedFile.size,
      uploadPath: '/uploads/example.jpg'
    });

    res.json({ 
      success: true, 
      message: 'File uploaded successfully',
      fileName: uploadedFile.name 
    });

  } catch (error: any) {
    logError(error, {
      requestId: (req as any).requestId,
      operation: 'file_upload',
      userId: (req as any).user?.id,
      fileName: (req as any).files?.image?.name
    });

    res.status(500).json({ 
      error: true, 
      message: 'File upload failed' 
    });
  }
}

// Example 4: Database transaction logging
export async function exampleOrderProcessingRoute(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    logger.info('Order processing started', {
      requestId: (req as any).requestId,
      orderId: req.params.id,
      userId: (req as any).user?.id,
      action: 'process_order'
    });

    // Simulate multiple database operations
    logDatabaseOperation('SELECT', 'orders', 50);
    logDatabaseOperation('UPDATE', 'orders', 120);
    logDatabaseOperation('INSERT', 'order_history', 80);

    const totalTime = Date.now() - startTime;

    // Log business event
    logBusinessEventWithReq(req, 'order_processed', {
      orderId: req.params.id,
      processingTime: `${totalTime}ms`,
      status: 'completed'
    });

    res.json({ 
      success: true, 
      message: 'Order processed successfully',
      processingTime: `${totalTime}ms`
    });

  } catch (error: any) {
    const totalTime = Date.now() - startTime;

    // Log failed database operation
    logDatabaseOperation('ROLLBACK', 'orders', totalTime, error);

    logError(error, {
      requestId: (req as any).requestId,
      operation: 'process_order',
      orderId: req.params.id,
      userId: (req as any).user?.id,
      processingTime: `${totalTime}ms`
    });

    res.status(500).json({ 
      error: true, 
      message: 'Order processing failed',
      requestId: (req as any).requestId 
    });
  }
}

// Example 5: API rate limiting logging
export function exampleRateLimitingRoute(req: Request, res: Response) {
  // Check if user is hitting rate limits
  const requestCount = 150; // Simulate getting from cache

  if (requestCount > 100) {
    logSecurityEvent(req, 'rate_limit_exceeded', {
      requestCount,
      limit: 100,
      timeWindow: '15 minutes'
    });

    return res.status(429).json({ 
      error: true, 
      message: 'Rate limit exceeded' 
    });
  }

  // Normal request processing
  logger.debug('API request within rate limits', {
    requestId: (req as any).requestId,
    requestCount,
    userId: (req as any).user?.id
  });

  res.json({ success: true, data: 'API response' });
}