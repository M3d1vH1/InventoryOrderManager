# Replit Deployment Optimizations

This document outlines the changes made to optimize the application for Replit deployment and prevent 502 errors.

## Security Feature Adjustments

1. **Content Security Policy**
   - Temporarily disabled CSP to troubleshoot deployment issues
   - Original CSP settings preserved in comments for future re-enabling

2. **Geoblocking**
   - Temporarily disabled geoblocking middleware
   - IP detection can sometimes cause issues in Replit's environment

3. **Rate Limiting**
   - Temporarily disabled API rate limiting
   - This reduces memory overhead and potential IP detection issues

## Database Optimizations

1. **Ultra-Light Connection Pool**
   - Reduced maximum connections to 2 in production
   - Shortened idle timeout to 5 seconds
   - Disabled keepAlive to reduce overhead
   - Shortened query timeouts to 10 seconds

2. **Memory Management**
   - Added NODE_OPTIONS environment variable to limit memory usage
   - Added basic memory usage monitoring

## How to Re-enable Security Features

Once the deployment is stable, you can gradually re-enable security features:

1. First, uncomment the geoblocking middleware in `server/index.ts`
2. Then restore the CSP configuration in the Helmet setup
3. Finally, re-enable rate limiting

Each feature should be enabled one at a time, with testing after each change to ensure stability.

## Production Environment Configuration

A new `.env.production` file has been added with optimized settings for Replit:

```
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=384
ENABLE_GEOBLOCKING=false
ENABLE_RATE_LIMITING=false
DB_MAX_CONNECTIONS=2
DB_IDLE_TIMEOUT=5000
DB_STATEMENT_TIMEOUT=10000
DB_RECONNECT_INTERVAL=10000
APP_URL=https://warehouse-management-system.replit.app
```

Ensure these environment variables are set in your Replit deployment.