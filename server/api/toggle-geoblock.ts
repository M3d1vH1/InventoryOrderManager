import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Simple route to toggle geoblocking on/off
 */
export function toggleGeoblocking(req: Request, res: Response) {
  try {
    // Read the current .env file
    const envPath = path.resolve(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Parse the current environment variables
    const envConfig = dotenv.parse(envContent);
    
    // Toggle the geoblocking setting
    const currentSetting = envConfig.ENABLE_GEOBLOCKING === 'true';
    envConfig.ENABLE_GEOBLOCKING = currentSetting ? 'false' : 'true';
    
    // Convert back to .env format
    const newEnvContent = Object.entries(envConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Write the updated content back to the .env file
    fs.writeFileSync(envPath, newEnvContent);
    
    // Update the current process.env value
    process.env.ENABLE_GEOBLOCKING = envConfig.ENABLE_GEOBLOCKING;
    
    // Redirect back to the test page
    res.redirect('/geoblock-test');
  } catch (error) {
    console.error('Error toggling geoblocking:', error);
    res.status(500).send('Failed to toggle geoblocking setting');
  }
}