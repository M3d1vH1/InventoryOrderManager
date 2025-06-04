import { Request, Response, NextFunction } from 'express';
import logger, { logRequest } from '../utils/logger';

// Generate simple request ID
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Add request ID to all requests
export function addRequestId(req: Request, res: Response, next: NextFunction) {
  (req as any).requestId = generateRequestId();
  res.setHeader('X-Request-ID', (req as any).requestId);
  next();
}

// Custom request logging middleware
export function customRequestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Log when response finishes
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    logRequest(req, res.statusCode, responseTime);
  });
  
  next();
}

// Security event logger
export function logSecurityEvent(req: Request, event: string, details?: any) {
  logger.warn(`Security event: ${event}`, {
    requestId: (req as any).requestId,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    event,
    ...details
  });
}

// Business event logger
export function logBusinessEvent(req: Request, event: string, details?: any) {
  logger.info(`Business event: ${event}`, {
    requestId: (req as any).requestId,
    userId: (req as any).user?.id,
    username: (req as any).user?.username,
    event,
    ...details
  });
}