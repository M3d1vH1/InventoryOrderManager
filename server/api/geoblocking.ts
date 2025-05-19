import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Get the current geoblocking settings
 */
export function getGeoblockingSettings(req: Request, res: Response) {
  try {
    // Check current settings from environment variables
    const isEnabled = process.env.ENABLE_GEOBLOCKING === 'true';
    const allowedIPs = process.env.GEOBLOCK_ALLOWED_IPS || '';
    
    res.json({
      enabled: isEnabled,
      allowedIPs: allowedIPs.split(',').filter(ip => ip.trim() !== '')
    });
  } catch (error) {
    console.error('Error getting geoblocking settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve geoblocking settings' 
    });
  }
}

/**
 * Update geoblocking settings
 */
export function updateGeoblockingSettings(req: Request, res: Response) {
  try {
    const { enabled, allowedIPs } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid enabled parameter' 
      });
    }
    
    // Read the current .env file
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Parse the current environment variables
    const envConfig = dotenv.parse(envContent);
    
    // Update the values
    envConfig.ENABLE_GEOBLOCKING = enabled ? 'true' : 'false';
    
    if (Array.isArray(allowedIPs)) {
      envConfig.GEOBLOCK_ALLOWED_IPS = allowedIPs.join(',');
    }
    
    // Convert back to .env format
    const newEnvContent = Object.entries(envConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Write the updated content back to the .env file
    fs.writeFileSync(envPath, newEnvContent);
    
    // Update the current process.env values
    process.env.ENABLE_GEOBLOCKING = enabled ? 'true' : 'false';
    if (Array.isArray(allowedIPs)) {
      process.env.GEOBLOCK_ALLOWED_IPS = allowedIPs.join(',');
    }
    
    res.json({ 
      success: true, 
      message: 'Geoblocking settings updated successfully',
      enabled,
      allowedIPs: Array.isArray(allowedIPs) ? allowedIPs : []
    });
  } catch (error) {
    console.error('Error updating geoblocking settings:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update geoblocking settings' 
    });
  }
}