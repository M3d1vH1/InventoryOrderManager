import { Request, Response, NextFunction } from 'express';
import { log } from '../vite';

interface CustomError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * Global error handling middleware for Express application
 * This middleware catches all unhandled errors and provides standardized responses
 */
export function globalErrorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response has already been sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  // Determine error status code
  const status = err.status || err.statusCode || 500;
  
  // Determine error message
  const message = err.message || 'Internal Server Error';
  
  // Generate request ID for correlation (using timestamp + random)
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Create error log entry
  const errorLog = {
    requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    status,
    message,
    stack: err.stack,
    body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
    query: req.query && Object.keys(req.query).length > 0 ? req.query : undefined,
    params: req.params && Object.keys(req.params).length > 0 ? req.params : undefined
  };

  // Log error details
  if (process.env.NODE_ENV === 'production') {
    // In production, log structured error without sensitive details
    log(`[${requestId}] ${status} Error: ${message}`, 'error');
    
    // Only log stack trace for 5xx errors in production
    if (status >= 500) {
      console.error(`[${requestId}] Stack trace:`, err.stack);
    }
  } else {
    // In development, log full error details
    console.error('\n=== ERROR DETAILS ===');
    console.error(`Request ID: ${requestId}`);
    console.error(`${req.method} ${req.url}`);
    console.error(`Status: ${status}`);
    console.error(`Message: ${message}`);
    console.error('Stack:', err.stack);
    
    if (errorLog.body) {
      console.error('Request Body:', errorLog.body);
    }
    if (errorLog.query && Object.keys(errorLog.query).length > 0) {
      console.error('Query Params:', errorLog.query);
    }
    if (errorLog.params && Object.keys(errorLog.params).length > 0) {
      console.error('Route Params:', errorLog.params);
    }
    console.error('===================\n');
  }

  // Prepare response based on environment
  let response: any = {
    error: true,
    requestId,
    timestamp: errorLog.timestamp
  };

  if (process.env.NODE_ENV === 'production') {
    // Production response - minimal information
    if (status >= 500) {
      response.message = 'Internal Server Error';
    } else {
      response.message = message;
    }
  } else {
    // Development response - detailed information
    response.message = message;
    response.stack = err.stack;
    response.details = {
      method: req.method,
      url: req.url,
      body: errorLog.body,
      query: errorLog.query,
      params: errorLog.params
    };
    
    // Include additional error properties if they exist
    if (err.code) {
      response.code = err.code;
    }
    if (err.details) {
      response.errorDetails = err.details;
    }
  }

  // Set appropriate headers
  res.set({
    'Content-Type': 'application/json',
    'X-Request-ID': requestId
  });

  // Send error response
  res.status(status).json(response);
}

/**
 * Middleware to handle 404 errors for routes that don't exist
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error: CustomError = new Error(`Route ${req.method} ${req.url} not found`);
  error.status = 404;
  next(error);
}

/**
 * Async error handler wrapper
 * Use this to wrap async route handlers to catch rejected promises
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Process-level error handlers for uncaught exceptions and unhandled rejections
 */
export function setupProcessErrorHandlers(): void {
  // Handle uncaught exceptions
  process.on('uncaughtException', (err: Error) => {
    console.error('UNCAUGHT EXCEPTION! Shutting down...');
    console.error('Error:', err.name, err.message);
    console.error('Stack:', err.stack);
    
    // Log the error
    log(`Uncaught Exception: ${err.message}`, 'critical');
    
    // Exit the process
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('UNHANDLED REJECTION! Shutting down...');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    
    // Log the error
    log(`Unhandled Rejection: ${reason}`, 'critical');
    
    // Exit the process
    process.exit(1);
  });

  // Handle SIGTERM signal (graceful shutdown)
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    log('Server shutting down gracefully (SIGTERM)', 'info');
    process.exit(0);
  });

  // Handle SIGINT signal (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('\nSIGINT received. Shutting down gracefully...');
    log('Server shutting down gracefully (SIGINT)', 'info');
    process.exit(0);
  });
}