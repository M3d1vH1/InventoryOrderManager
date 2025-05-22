import { Request, Response, NextFunction } from 'express';

// Middleware to force HTTPS in production environments
export const forceHttps = (req: Request, res: Response, next: NextFunction) => {
  // If HTTPS redirect is disabled via env var, skip it completely
  if (process.env.DISABLE_HTTPS_REDIRECT === 'true') {
    return next();
  }
  
  // Skip for development or test environments
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  // Skip for Replit preview access
  const isReplitPreview = req.headers.host?.includes('.replit.dev') || 
                         req.headers.host?.includes('localhost') || 
                         req.headers.host?.includes('127.0.0.1') ||
                         req.headers.host?.includes('.replit.co');
  if (isReplitPreview) {
    return next();
  }
  
  // Trust proxy headers (common in cloud deployments)
  const isSecure = req.secure || (req.headers['x-forwarded-proto'] === 'https');
  
  // Skip HTTPS redirect for health checks and API routes
  const isHealthCheck = req.path === '/health' || req.path === '/_health' || req.path === '/api/health';
  const isApiRoute = req.path.startsWith('/api/');
  
  if (!isSecure && !isHealthCheck && !isApiRoute) {
    // Get host from headers or use APP_URL
    const host = req.headers.host || (process.env.APP_URL || '').replace(/^https?:\/\//, '');
    
    if (host) {
      const redirectUrl = `https://${host}${req.url}`;
      return res.redirect(301, redirectUrl);
    }
  }
  
  next();
};