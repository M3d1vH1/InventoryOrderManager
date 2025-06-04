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

// Express-winston middleware for detailed request logging
export const expressWinstonLogger = expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms',
  expressFormat: false,
  colorize: false,
  requestWhitelist: ['url', 'headers', 'method', 'httpVersion', 'originalUrl', 'query'],
  responseWhitelist: ['statusCode'],
  dynamicMeta: (req: Request, res: Response) => {
    return {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      username: (req as any).user?.username
    };
  },
  skip: (req: Request, res: Response) => {
    // Skip logging for health checks and static assets
    return req.url === '/api/health' || 
           req.url.startsWith('/assets/') || 
           req.url.startsWith('/favicon');
  }
});

// Express-winston error logger
export const expressWinstonErrorLogger = expressWinston.errorLogger({
  winstonInstance: logger,
  meta: true,
  msg: 'Error processing request {{req.method}} {{req.url}}',
  dynamicMeta: (req: Request, res: Response, err: Error) => {
    return {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      username: (req as any).user?.username,
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack
    };
  }
});