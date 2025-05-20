import { Request, Response, NextFunction } from 'express';

// Middleware to force HTTPS in production environments
export const forceHttps = (req: Request, res: Response, next: NextFunction) => {
  // Skip for development or test environments
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  // Trust proxy headers (common in cloud deployments)
  const isSecure = req.secure || (req.headers['x-forwarded-proto'] === 'https');
  
  // Skip HTTPS redirect for health checks
  const isHealthCheck = req.path === '/health' || req.path === '/_health' || req.path === '/api/health';
  if (!isSecure && !isHealthCheck) {
    // Get host from headers or use APP_URL
    const host = req.headers.host || (process.env.APP_URL || '').replace(/^https?:\/\//, '');
    
    if (host) {
      const redirectUrl = `https://${host}${req.url}`;
      return res.redirect(301, redirectUrl);
    }
  }
  
  next();
};