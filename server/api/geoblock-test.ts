import { Request, Response } from 'express';
import geoip from 'geoip-lite';

/**
 * Test endpoint for geoblocking configuration
 * Displays information about the client's IP and access status
 */
export function testGeoblocking(req: Request, res: Response) {
  // Get the client IP
  const ip = getClientIp(req);
  
  // Get geo information
  const geo = geoip.lookup(ip);
  
  // Check if this IP would be allowed
  const inAllowlist = checkIfInAllowlist(ip);
  const isGreekIp = geo?.country === 'GR';
  const isAllowed = isGreekIp || inAllowlist || isLocalIp(ip);
  
  // Create a response with the geoblocking information
  const response = {
    isGeoblockingActive: process.env.ENABLE_GEOBLOCKING === 'true',
    clientIp: ip,
    location: geo ? {
      country: geo.country,
      region: geo.region,
      city: geo.city,
      timezone: geo.timezone,
    } : 'Unknown location',
    accessStatus: {
      isAllowed,
      reason: getAccessReason(isGreekIp, inAllowlist, isLocalIp(ip))
    }
  };
  
  // Format this as a nice HTML page
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Geoblocking Test</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #2c3e50;
            margin-top: 0;
          }
          h2 {
            color: #3498db;
            margin-top: 30px;
          }
          .info-box {
            background: #f8f9fa;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin: 20px 0;
          }
          .status {
            padding: 10px 15px;
            border-radius: 4px;
            display: inline-block;
            font-weight: bold;
          }
          .allowed {
            background: #d4edda;
            color: #155724;
          }
          .denied {
            background: #f8d7da;
            color: #721c24;
          }
          pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Geoblocking Configuration Test</h1>
          
          <div class="info-box">
            <p><strong>Geoblocking Status:</strong> ${response.isGeoblockingActive ? 'Active' : 'Inactive'}</p>
            <p><strong>Access Status:</strong> 
              <span class="status ${response.accessStatus.isAllowed ? 'allowed' : 'denied'}">
                ${response.accessStatus.isAllowed ? 'Allowed' : 'Denied'}
              </span>
            </p>
            <p><strong>Reason:</strong> ${response.accessStatus.reason}</p>
          </div>
          
          <h2>Your Connection Information</h2>
          <p><strong>IP Address:</strong> ${response.clientIp}</p>
          <p><strong>Location:</strong> ${typeof response.location === 'string' ? response.location : 
            `${response.location.country || 'Unknown'} ${response.location.region ? '/ ' + response.location.region : ''} ${response.location.city ? '/ ' + response.location.city : ''}`}</p>
          <p><strong>Timezone:</strong> ${typeof response.location === 'string' ? 'Unknown' : (response.location.timezone || 'Unknown')}</p>
          
          <h2>Technical Details</h2>
          <pre>${JSON.stringify(response, null, 2)}</pre>
          
          <div style="margin-top: 30px; font-size: 0.9em; color: #6c757d;">
            <p>This is a diagnostic page to verify the geoblocking configuration. In production, unauthorized users will see a simple access denied message.</p>
          </div>
        </div>
      </body>
    </html>
  `);
}

// Helper functions

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

function checkIfInAllowlist(ip: string): boolean {
  const allowedIps = process.env.GEOBLOCK_ALLOWED_IPS?.split(',').map(ip => ip.trim()) || [];
  return allowedIps.includes(ip);
}

function isLocalIp(ip: string): boolean {
  return !ip || ip === '127.0.0.1' || ip === '::1' || 
         ip.startsWith('192.168.') || ip.startsWith('10.') ||
         process.env.NODE_ENV === 'development';
}

function getAccessReason(isGreekIp: boolean, inAllowlist: boolean, isLocalIp: boolean): string {
  if (!process.env.ENABLE_GEOBLOCKING) {
    return 'Geoblocking is disabled';
  }
  
  if (isLocalIp) {
    return 'Local IP address or development environment';
  }
  
  if (inAllowlist) {
    return 'IP address is in the allowlist';
  }
  
  if (isGreekIp) {
    return 'IP address is from Greece';
  }
  
  return 'IP address is not from Greece and not in allowlist';
}