import { Request, Response, NextFunction } from 'express';
import log from '../utils/logger';

/**
 * Custom security headers middleware for additional protection
 * Supplements helmet with application-specific security measures
 */

/**
 * Security headers for enhanced protection beyond helmet defaults
 */
export function customSecurityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // X-Robots-Tag - Control search engine indexing
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    
    // Expect-CT - Certificate Transparency monitoring
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Expect-CT', 'max-age=86400, enforce');
    }
    
    // Feature-Policy / Permissions-Policy - Control browser features
    res.setHeader('Permissions-Policy', [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'accelerometer=()',
      'gyroscope=()'
    ].join(', '));
    
    // Clear-Site-Data on logout endpoints
    if (req.path === '/api/logout' || req.path === '/api/auth/logout') {
      res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
    }
    
    // X-Content-Security-Policy-Report-Only for monitoring in development
    if (process.env.NODE_ENV === 'development') {
      res.setHeader('X-Content-Security-Policy-Report-Only', 
        "default-src 'self'; report-uri /api/csp-report");
    }
    
    next();
  };
}

/**
 * CSP violation reporting endpoint
 */
export function cspViolationReporter() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/csp-report' && req.method === 'POST') {
      try {
        const violation = req.body;
        log.warn('CSP Violation Report:', {
          blockedUri: violation['blocked-uri'],
          documentUri: violation['document-uri'],
          originalPolicy: violation['original-policy'],
          referrer: violation.referrer,
          violatedDirective: violation['violated-directive'],
          timestamp: new Date().toISOString(),
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
        
        res.status(204).end();
        return;
      } catch (error) {
        log.error('Error processing CSP violation report:', error);
        res.status(400).json({ error: 'Invalid CSP report' });
        return;
      }
    }
    next();
  };
}

/**
 * Security response headers for API endpoints
 */
export function apiSecurityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply to API routes
    if (req.path.startsWith('/api/')) {
      // Prevent caching of sensitive API responses
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // API-specific security headers
      res.setHeader('X-API-Version', '1.0');
      res.setHeader('X-Rate-Limit-Policy', 'standard');
      
      // Prevent API responses from being embedded
      res.setHeader('X-Frame-Options', 'DENY');
    }
    
    next();
  };
}

/**
 * Security audit logging middleware
 */
export function securityAuditLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Log security-relevant events
    const securityEvents = [
      '/api/login',
      '/api/logout',
      '/api/auth',
      '/api/admin',
      '/api/users',
      '/api/settings'
    ];
    
    const isSecurityEvent = securityEvents.some(event => req.path.startsWith(event));
    
    if (isSecurityEvent) {
      log.info('Security Event', {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        sessionId: req.sessionID || 'no-session',
        userId: (req.user as any)?.id || 'anonymous'
      });
    }
    
    // Log suspicious activity
    const suspiciousPatterns = [
      /\.\.\//, // Path traversal
      /<script/, // XSS attempts
      /union.*select/i, // SQL injection
      /javascript:/i, // JavaScript injection
      /'.*or.*'.*=/i // SQL injection
    ];
    
    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(req.url) || 
      pattern.test(JSON.stringify(req.body || {})) ||
      pattern.test(JSON.stringify(req.query || {}))
    );
    
    if (isSuspicious) {
      log.warn('Suspicious Activity Detected', {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        severity: 'high'
      });
    }
    
    next();
  };
}

/**
 * Development-only security headers (less restrictive for debugging)
 */
export function developmentSecurityHeaders() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'development') {
      // Less restrictive CSP for development
      res.setHeader('X-Development-Mode', 'true');
      
      // Allow unsafe inline for development debugging
      res.setHeader('X-Debug-Mode', 'enabled');
    }
    
    next();
  };
}