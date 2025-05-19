import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * Returns geoblocking status information
 */
export function getGeoblockingStatus(req: Request, res: Response) {
  try {
    // Get client IP
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || 
                    req.ip || 
                    '127.0.0.1';
    
    // Check current settings
    const enabled = process.env.ENABLE_GEOBLOCKING === 'true';
    const allowedIPs = (process.env.GEOBLOCK_ALLOWED_IPS || '').split(',').filter(ip => ip.trim() !== '');
    
    // Check if in allowlist
    const inAllowlist = allowedIPs.includes(clientIp);
    
    // Get location info
    const geoip = require('geoip-lite');
    const geo = geoip.lookup(clientIp);
    const isGreekIp = geo && geo.country === 'GR';
    const country = geo ? `${geo.country}${geo.country === 'GR' ? ' (Greece)' : ''}` : 'Unknown';
    
    // Check if access allowed
    const isDevelopment = process.env.NODE_ENV === 'development';
    const accessAllowed = !enabled || isGreekIp || inAllowlist || isDevelopment;
    
    // Return status
    res.json({
      enabled,
      clientIp,
      country,
      isGreekIp,
      inAllowlist,
      allowedIPs,
      accessAllowed,
      isDevelopment
    });
  } catch (error) {
    console.error('Error getting geoblocking status:', error);
    res.status(500).json({ error: 'Failed to get geoblocking status' });
  }
}

/**
 * Toggle geoblocking on/off
 */
export function toggleGeoblocking(req: Request, res: Response) {
  try {
    // Get current setting
    const currentSetting = process.env.ENABLE_GEOBLOCKING === 'true';
    
    // Toggle setting
    process.env.ENABLE_GEOBLOCKING = (!currentSetting).toString();
    
    // Update .env file
    updateEnvFile('ENABLE_GEOBLOCKING', (!currentSetting).toString());
    
    // Redirect back to control page
    res.redirect('/geoblocking.html');
  } catch (error) {
    console.error('Error toggling geoblocking:', error);
    res.status(500).send('Error toggling geoblocking setting');
  }
}

/**
 * Add IP to allowlist
 */
export function addToAllowlist(req: Request, res: Response) {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).send('No IP address provided');
    }
    
    // Validate IP
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      return res.status(400).send('Invalid IP address format');
    }
    
    // Get current allowlist
    const allowlist = (process.env.GEOBLOCK_ALLOWED_IPS || '').split(',').filter(i => i.trim() !== '');
    
    // Don't add if already exists
    if (allowlist.includes(ip)) {
      return res.redirect('/geoblocking.html');
    }
    
    // Add to list
    allowlist.push(ip);
    
    // Update env var
    process.env.GEOBLOCK_ALLOWED_IPS = allowlist.join(',');
    
    // Update .env file
    updateEnvFile('GEOBLOCK_ALLOWED_IPS', allowlist.join(','));
    
    // Redirect back to control page
    res.redirect('/geoblocking.html');
  } catch (error) {
    console.error('Error adding to allowlist:', error);
    res.status(500).send('Error adding IP to allowlist');
  }
}

/**
 * Remove IP from allowlist
 */
export function removeFromAllowlist(req: Request, res: Response) {
  try {
    const { ip } = req.query;
    
    if (!ip) {
      return res.status(400).send('No IP address provided');
    }
    
    // Get current allowlist
    const allowlist = (process.env.GEOBLOCK_ALLOWED_IPS || '').split(',').filter(i => i.trim() !== '');
    
    // Remove the IP
    const newAllowlist = allowlist.filter(i => i !== ip);
    
    // Update env var
    process.env.GEOBLOCK_ALLOWED_IPS = newAllowlist.join(',');
    
    // Update .env file
    updateEnvFile('GEOBLOCK_ALLOWED_IPS', newAllowlist.join(','));
    
    // Redirect back to control page
    res.redirect('/geoblocking.html');
  } catch (error) {
    console.error('Error removing from allowlist:', error);
    res.status(500).send('Error removing IP from allowlist');
  }
}

/**
 * Helper to update .env file
 */
function updateEnvFile(key: string, value: string) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let content = fs.readFileSync(envPath, 'utf8');
    
    // Check if key exists
    const regex = new RegExp(`^${key}=.*$`, 'm');
    
    if (regex.test(content)) {
      // Update existing key
      content = content.replace(regex, `${key}=${value}`);
    } else {
      // Add new key
      content += `\n${key}=${value}`;
    }
    
    // Write back to file
    fs.writeFileSync(envPath, content);
  } catch (error) {
    console.error('Error updating .env file:', error);
    throw error;
  }
}