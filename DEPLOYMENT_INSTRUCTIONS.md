# Amphoreus Warehouse Management System - Deployment Guide

This guide provides instructions for deploying the Amphoreus Warehouse Management System to Replit.

## Deployment Steps

1. **Ensure your environment is set correctly**
   - `.env.production` contains the correct settings:
     - `NODE_ENV=production`
     - `APP_URL=https://amphoreus.replit.app`

2. **Build the application**
   - Run `npm run build` (This may take some time due to the size of the application)
   - Ensure the build completes successfully

3. **Deploy on Replit**
   - Click the "Deploy" button in Replit
   - Replit will use the build settings from your package.json
   - Your application will be available at: https://amphoreus.replit.app

## Troubleshooting

If you encounter any issues:

1. **Check logs for errors**
   - Review the deployment logs for specific error messages

2. **Verify database connection**
   - Ensure the PostgreSQL database is properly connected
   - The connection string should be in the DATABASE_URL environment variable

3. **Content Security Policy issues**
   - If Font Awesome icons aren't appearing, check the CSP configuration in server/index.ts

## Production Settings

The following optimizations have been applied:

1. **Database connection pool**
   - Optimized pool settings for Replit's environment
   - Connection pooling configured for production workloads

2. **Security enhancements**
   - Helmet configured with proper CSP settings
   - Rate limiting applied to API endpoints
   - Geoblocking enabled for Greece-only access

3. **Performance optimizations**
   - Reduced verbose logging
   - Optimized static file serving