/**
 * Production deployment configuration for Replit Cloud Run
 */

export const getProductionConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const port = process.env.PORT || 5000;
  
  return {
    port: parseInt(port.toString()),
    host: '0.0.0.0', // Listen on all interfaces for Cloud Run
    nodeEnv: isProduction ? 'production' : 'development',
    cors: {
      origin: isProduction 
        ? [
            'https://amphoreus.replit.app',
            /\.replit\.app$/,
            /\.replit\.dev$/
          ]
        : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    rateLimiting: isProduction ? {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      standardHeaders: true,
      legacyHeaders: false
    } : {
      windowMs: 15 * 60 * 1000,
      max: 10000, // More lenient for development
      standardHeaders: true,
      legacyHeaders: false
    },
    helmet: {
      contentSecurityPolicy: isProduction ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "https:"]
        }
      } : false
    }
  };
};

export const logStartupInfo = (port: number) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const appUrl = process.env.APP_URL || `http://localhost:${port}`;
  
  console.log('='.repeat(50));
  console.log('🚀 Warehouse Management System Starting');
  console.log('='.repeat(50));
  console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`Port: ${port}`);
  console.log(`URL: ${appUrl}`);
  console.log(`Host: 0.0.0.0 (listening on all interfaces)`);
  console.log(`Process ID: ${process.pid}`);
  console.log('='.repeat(50));
  
  if (isProduction) {
    console.log('✅ Production mode active');
    console.log('✅ Security headers enabled');
    console.log('✅ Rate limiting configured');
    console.log('✅ CORS configured for production domains');
  }
};