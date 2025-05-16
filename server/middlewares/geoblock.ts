import { Request, Response, NextFunction } from 'express';
import geoip from 'geoip-lite';

/**
 * Middleware to restrict access to only users from Greece
 * @param req Express request object
 * @param res Express response object
 * @param next Express next function
 */
export function geoBlockMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check if geoblocking is enabled via environment variable
  // If not explicitly enabled, skip the check and allow all traffic
  if (process.env.ENABLE_GEOBLOCKING !== 'true') {
    return next();
  }
  // Skip blocking for certain paths (like assets, API health checks, etc.)
  const skipPaths = [
    '/api/health',
    '/public/placeholder-image.svg',
    '/public/simple-logo.svg',
    '/favicon.ico'
  ];
  
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Get client IP address
  const ip = getClientIp(req);
  
  // For local development or missing IP, allow access
  if (process.env.NODE_ENV === 'development' || !ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    console.log(`[GeoBlock] Development mode or local IP detected: ${ip} - Access allowed`);
    return next();
  }
  
  // Check if the IP is in the allowlist (comma-separated list of IPs)
  const allowedIps = process.env.GEOBLOCK_ALLOWED_IPS?.split(',').map(ip => ip.trim()) || [];
  if (allowedIps.length > 0 && allowedIps.includes(ip)) {
    console.log(`[GeoBlock] IP ${ip} is in the allowlist - Access granted`);
    return next();
  }

  try {
    // Look up the location based on IP
    const geo = geoip.lookup(ip);
    
    // If country is Greece (GR), allow access
    if (geo && geo.country === 'GR') {
      console.log(`[GeoBlock] Access granted to IP ${ip} from ${geo.country}`);
      return next();
    }
    
    // Log the block attempt
    console.log(`[GeoBlock] Access denied to IP ${ip} from ${geo ? geo.country : 'unknown location'}`);
    
    // Otherwise, return a 403 Forbidden response
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Access Restricted</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background-color: #f8f9fa;
              color: #333;
            }
            .container {
              max-width: 600px;
              text-align: center;
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
              margin-top: 0;
              color: #e53935;
            }
            p {
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Access Restricted</h1>
            <p>This site is only available to users in Greece.</p>
            <p>Η πρόσβαση σε αυτή την υπηρεσία είναι διαθέσιμη μόνο για χρήστες στην Ελλάδα.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('[GeoBlock] Error checking location:', error);
    // On error, allow access to avoid blocking legitimate users
    return next();
  }
}

/**
 * Get the client's real IP address, considering proxy headers
 */
function getClientIp(req: Request): string {
  // Check for standard proxy headers
  const forwardedFor = req.headers['x-forwarded-for'] as string;
  
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs in a comma-separated list
    // The client's real IP is typically the first one
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }
  
  // Check for other common headers
  const realIp = req.headers['x-real-ip'] as string;
  if (realIp) {
    return realIp;
  }
  
  // Fallback to connection remote address
  return req.ip || '';
}