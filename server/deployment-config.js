/**
 * Replit Deployment Configuration
 * This file configures how the application should run in the Replit production environment
 */

export const getDeploymentConfig = () => {
  return {
    // Application settings
    appUrl: process.env.APP_URL || 'https://amphoreus.replit.app',
    
    // Server settings
    port: process.env.PORT || 5000,
    
    // Database connection limits specifically for Replit
    database: {
      maxConnections: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    },
    
    // Security settings
    security: {
      enableGeoblock: true,
      corsOrigins: ['https://amphoreus.replit.app'],
      rateLimitMax: 500,
      rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
    }
  };
};