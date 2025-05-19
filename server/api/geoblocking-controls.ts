import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Get current geoblocking status
export function getGeoblockingStatus(req: Request, res: Response) {
  try {
    // Get client IP
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || 
                   req.ip || 
                   '127.0.0.1';
    
    // Check if geoblocking is enabled
    const enabled = process.env.ENABLE_GEOBLOCKING === 'true';
    
    // Get allowed IPs list
    const allowedIPsString = process.env.GEOBLOCK_ALLOWED_IPS || '';
    const allowedIPs = allowedIPsString.split(',').filter(ip => ip.trim() !== '');
    
    // Check if client IP is in allowlist
    const inAllowlist = allowedIPs.includes(clientIp);
    
    // Use geoip-lite to detect country
    const geoip = require('geoip-lite');
    const geo = geoip.lookup(clientIp);
    const country = geo ? `${geo.country} (${geo.country === 'GR' ? 'Greece' : geo.country})` : 'Unknown';
    const isGreekIp = geo && geo.country === 'GR';
    
    // Check if access would be allowed
    const isDevelopment = process.env.NODE_ENV === 'development';
    const accessAllowed = !enabled || isGreekIp || inAllowlist || isDevelopment;
    
    res.json({
      enabled,
      clientIp,
      country,
      isGreekIp,
      allowedIPs,
      inAllowlist,
      accessAllowed,
      isDevelopment
    });
  } catch (error) {
    console.error('Error getting geoblocking status:', error);
    res.status(500).json({
      error: 'Failed to get geoblocking status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

// Toggle geoblocking on/off
export function toggleGeoblocking(req: Request, res: Response) {
  try {
    // Get current setting
    const currentSetting = process.env.ENABLE_GEOBLOCKING === 'true';
    
    // Update the environment variable
    process.env.ENABLE_GEOBLOCKING = (!currentSetting).toString();
    
    // Update the .env file
    updateEnvFile('ENABLE_GEOBLOCKING', (!currentSetting).toString());
    
    res.json({
      success: true,
      enabled: !currentSetting,
      message: `Geoblocking ${!currentSetting ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    console.error('Error toggling geoblocking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle geoblocking',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

// Add IP to allowlist
export function addIpToAllowlist(req: Request, res: Response) {
  try {
    const { ip } = req.body;
    
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid IP address'
      });
    }
    
    // Basic IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IP address format'
      });
    }
    
    // Get current allowlist
    const allowedIPsString = process.env.GEOBLOCK_ALLOWED_IPS || '';
    const allowedIPs = allowedIPsString.split(',').filter(ip => ip.trim() !== '');
    
    // Check if IP already exists
    if (allowedIPs.includes(ip)) {
      return res.json({
        success: true,
        message: 'IP is already in the allowlist',
        allowedIPs
      });
    }
    
    // Add new IP to the list
    allowedIPs.push(ip);
    
    // Update environment variable
    const newAllowedIPsString = allowedIPs.join(',');
    process.env.GEOBLOCK_ALLOWED_IPS = newAllowedIPsString;
    
    // Update .env file
    updateEnvFile('GEOBLOCK_ALLOWED_IPS', newAllowedIPsString);
    
    res.json({
      success: true,
      message: `IP ${ip} added to allowlist`,
      allowedIPs
    });
  } catch (error) {
    console.error('Error adding IP to allowlist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add IP to allowlist',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

// Remove IP from allowlist
export function removeIpFromAllowlist(req: Request, res: Response) {
  try {
    const { ip } = req.body;
    
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid IP address'
      });
    }
    
    // Get current allowlist
    const allowedIPsString = process.env.GEOBLOCK_ALLOWED_IPS || '';
    let allowedIPs = allowedIPsString.split(',').filter(ipAddr => ipAddr.trim() !== '');
    
    // Check if IP exists
    if (!allowedIPs.includes(ip)) {
      return res.status(404).json({
        success: false,
        error: 'IP is not in the allowlist',
        allowedIPs
      });
    }
    
    // Remove the IP
    allowedIPs = allowedIPs.filter(ipAddr => ipAddr !== ip);
    
    // Update environment variable
    const newAllowedIPsString = allowedIPs.join(',');
    process.env.GEOBLOCK_ALLOWED_IPS = newAllowedIPsString;
    
    // Update .env file
    updateEnvFile('GEOBLOCK_ALLOWED_IPS', newAllowedIPsString);
    
    res.json({
      success: true,
      message: `IP ${ip} removed from allowlist`,
      allowedIPs
    });
  } catch (error) {
    console.error('Error removing IP from allowlist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove IP from allowlist',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

// Helper function to update .env file
function updateEnvFile(key: string, value: string) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Check if the key exists in the file
    const regex = new RegExp(`^${key}=.*$`, 'm');
    
    if (regex.test(envContent)) {
      // Update existing key
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      // Add new key
      envContent += `\n${key}=${value}`;
    }
    
    // Write updated content back to file
    fs.writeFileSync(envPath, envContent);
  } catch (error) {
    console.error('Error updating .env file:', error);
    throw error;
  }
}