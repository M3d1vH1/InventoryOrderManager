# Amphoreus Warehouse Management System - Deployment Checklist

Follow this checklist before deploying your application to ensure it runs correctly in production mode.

## Pre-Deployment Steps

1. **Run the Production Preparation Script**
   ```bash
   ./prepare-for-deployment.sh
   ```
   This script will:
   - Set NODE_ENV to production in .env
   - Build the frontend assets
   - Copy the assets to server/public directory
   - Build the server with optimizations

2. **Verify Production Configuration**
   - Confirm .env has NODE_ENV=production
   - Check that server/public contains all frontend assets
   - Verify that database connections are properly configured

3. **Test Production Build Locally**
   - Start the server with `npm start` (not `npm run dev`)
   - Verify basic functionality before deploying

## Deployment Process

1. **Use Replit's Deploy Button**
   - The deployment will pick up the production configuration
   - Replit will build and deploy your application

2. **Post-Deployment Verification**
   - Check that the deployed application works
   - Verify database connections
   - Test critical workflows

## Important Notes

- **Always use production mode for deployment**
- Development mode should only be used for local development and debugging
- The production build optimizes performance and security

## Troubleshooting

If you encounter issues with the deployed application:

1. Check server logs for errors
2. Verify that all environment variables are correctly set
3. Ensure the database is accessible
4. Run the prepare-for-deployment script again and redeploy