import { Request, Response } from 'express';

/**
 * Test endpoint for geoblocking configuration
 * Displays information about the client's IP and access status
 */
export function testGeoblocking(req: Request, res: Response) {
  // Get client IP
  const ip = getClientIp(req);
  
  // Use geoip-lite to detect country
  const geoip = require('geoip-lite');
  const geo = geoip.lookup(ip);
  
  // Check if geoblocking is enabled
  const isGeoblockingEnabled = process.env.ENABLE_GEOBLOCKING === 'true';
  
  // Check if the IP is in the allowlist
  const inAllowlist = checkIfInAllowlist(ip);
  
  // Check if it's a local/development IP
  const isLocal = isLocalIp(ip);
  
  // Check if it's a Greek IP
  const isGreekIp = geo && geo.country === 'GR';
  
  // Determine access status
  const accessAllowed = !isGeoblockingEnabled || 
                        isGreekIp || 
                        inAllowlist || 
                        isLocal;
  
  // Get the reason for access decision
  const accessReason = getAccessReason(isGreekIp, inAllowlist, isLocal);
  
  // Return a simple HTML page with the information
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
          .blocked {
            background: #f8d7da;
            color: #721c24;
          }
          .header {
            background: #343a40;
            color: white;
            padding: 10px 15px;
            margin: -20px -20px 20px;
            border-radius: 8px 8px 0 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Warehouse Management System</h1>
            <p>Geoblocking Test Page</p>
          </div>
          
          <div class="info-box">
            <h2>Your Connection Information</h2>
            <p><strong>IP Address:</strong> ${ip}</p>
            <p><strong>Country:</strong> ${geo ? `${geo.country} (${geo.country === 'GR' ? 'Greece' : geo.country})` : 'Unknown'}</p>
            <p><strong>Region:</strong> ${geo ? geo.region : 'Unknown'}</p>
            <p><strong>City:</strong> ${geo ? geo.city : 'Unknown'}</p>
            
            <h3>Access Status: 
              <span class="status ${accessAllowed ? 'allowed' : 'blocked'}">
                ${accessAllowed ? 'ALLOWED' : 'BLOCKED'}
              </span>
            </h3>
            <p><strong>Reason:</strong> ${accessReason}</p>
          </div>
          
          <div class="info-box">
            <h2>Geoblocking Configuration</h2>
            <p><strong>Geoblocking Enabled:</strong> ${isGeoblockingEnabled ? 'Yes' : 'No'}</p>
            <p><strong>IP in Allowlist:</strong> ${inAllowlist ? 'Yes' : 'No'}</p>
            <p><strong>Local/Development IP:</strong> ${isLocal ? 'Yes' : 'No'}</p>
            <p><strong>Greek IP Address:</strong> ${isGreekIp ? 'Yes' : 'No'}</p>
          </div>
          
          <div class="info-box">
            <h2>Configuration Instructions</h2>
            <p>Geoblocking can be configured in the <code>.env</code> file with these settings:</p>
            <ul>
              <li><code>ENABLE_GEOBLOCKING=true</code> - Turn on geoblocking (block non-Greek IPs)</li>
              <li><code>ENABLE_GEOBLOCKING=false</code> - Turn off geoblocking (allow all IPs)</li>
              <li><code>GEOBLOCK_ALLOWED_IPS=1.2.3.4,5.6.7.8</code> - Comma-separated list of IPs to allow regardless of country</li>
              <li><code>NODE_ENV=development</code> - Development mode disables geoblocking</li>
              <li><code>NODE_ENV=production</code> - Production mode applies geoblocking according to settings</li>
            </ul>
          </div>
        </div>
      </body>
    </html>
  `);
}

/**
 * Get the client's real IP address, considering proxy headers
 */
function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || 
         req.ip || 
         '127.0.0.1';
}

/**
 * Check if the IP is in the allowlist from environment variable
 */
function checkIfInAllowlist(ip: string): boolean {
  const allowedIps = process.env.GEOBLOCK_ALLOWED_IPS || '';
  return allowedIps.split(',').some(allowedIp => allowedIp.trim() === ip);
}

/**
 * Check if the IP is a local development IP
 */
function isLocalIp(ip: string): boolean {
  return ip === '127.0.0.1' || 
         ip === 'localhost' || 
         ip.startsWith('192.168.') || 
         ip.startsWith('10.') || 
         process.env.NODE_ENV === 'development';
}

/**
 * Get a human-readable reason for the access decision
 */
function getAccessReason(isGreekIp: boolean, inAllowlist: boolean, isLocalIp: boolean): string {
  if (!process.env.ENABLE_GEOBLOCKING || process.env.ENABLE_GEOBLOCKING !== 'true') {
    return 'Geoblocking is disabled - all users can access the site';
  }
  
  if (isGreekIp) {
    return 'Your IP is from Greece - access is allowed';
  }
  
  if (inAllowlist) {
    return 'Your IP is in the allowlist - access is allowed';
  }
  
  if (isLocalIp) {
    return 'You are connecting from a local/development environment - access is allowed';
  }
  
  return 'Your IP is not from Greece - access would be blocked in production';
}