import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import fileUpload from "express-fileupload";
import path from "path";
import { setupAuth } from "./auth";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { forceHttps } from './middlewares/forceHttps';
import { geoBlockMiddleware } from './middlewares/geoblock';
// csurf is disabled by default as it requires proper setup with cookies, but you can enable it if needed
// import csrf from "csurf";

// Load environment variables from .env file
dotenv.config();

// Import Replit optimizer for deployment environment
let replitOptimizer;
if (process.env.NODE_ENV === 'production') {
  try {
    replitOptimizer = require('./utils/replitOptimizer');
    replitOptimizer.optimizeForReplit();
  } catch (err) {
    console.warn('Replit optimizer not available:', err.message);
  }
}

// Log critical environment variables at startup
console.log('Environment variables at startup:', {
  APP_URL: process.env.APP_URL || 'Not set',
  NODE_ENV: process.env.NODE_ENV || 'Not set',
  PORT: process.env.PORT || 'Not set'
});

const app = express();

// Enable trust proxy to work correctly with proxied requests
// This is needed for proper rate limiting when behind a reverse proxy
app.set('trust proxy', 1);

// Apply HTTPS redirection for production environments
app.use(forceHttps);

// Temporarily disable geoblocking for troubleshooting
// app.use(geoBlockMiddleware);

// Security middleware
// Apply Helmet with relaxed settings for troubleshooting
app.use(
  helmet({
    contentSecurityPolicy: false, // Temporarily disable CSP for troubleshooting
    /*
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], 
        connectSrc: ["'self'", "https:"],
        imgSrc: ["'self'", "data:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
        fontSrc: ["'self'", "data:", "https://cdnjs.cloudflare.com"],
      },
    },
    */
    // Set HSTS header
    hsts: {
      maxAge: 15552000, // 180 days
      includeSubDomains: true,
      preload: true,
    },
    // Only use the X-Powered-By field if you specifically want it
    hidePoweredBy: true,
  })
);

// Temporarily disabled rate limiting for troubleshooting
/*
// Rate limiting - protect against brute force attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased: Limit each IP to 500 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later'
});

// Apply rate limiting to API routes only
app.use('/api/', apiLimiter);
*/

// CORS configuration
app.use(cors({
  origin: process.env.APP_URL ? [process.env.APP_URL] : true, // Restrict to the app URL if defined, otherwise allow all
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Standard middleware
app.use(express.json({ limit: '1mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  abortOnLimit: true,
  useTempFiles: true,
  tempFileDir: '/tmp/',
  safeFileNames: true, // Remove special characters
  preserveExtension: true, // Keep file extensions
}));

// Serve static files from public directory
app.use('/uploads', express.static(path.join(process.cwd(), 'public/uploads')));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Import the useDatabase function
  const { useDatabase } = await import("./storage");
  
  // Attempt to switch to database storage
  // This will fall back to in-memory storage if database connection fails
  await useDatabase();
  
  // Setup authentication system
  setupAuth(app);
  log('Authentication system initialized', 'auth');
  
  // Add basic memory usage monitoring for deployment
  if (process.env.NODE_ENV === 'production') {
    // Check memory usage every minute
    setInterval(() => {
      const memUsage = Math.round(process.memoryUsage().rss / 1024 / 1024);
      log(`Memory usage: ${memUsage}MB`, 'monitoring');
    }, 60000);
    log('Basic monitoring initialized', 'monitoring');
  }
  
  const server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Log the error (but not in production for sensitive data)
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[ERROR] ${req.method} ${req.path} - ${status}: ${message}`);
      console.error(err.stack);
    } else {
      // In production, log minimal information to avoid leaking sensitive data
      log(`Error ${status}: ${message}`, 'error');
    }
    
    // Don't expose error details in production
    const responseError = process.env.NODE_ENV === 'production' && status === 500
      ? { message: 'Internal Server Error' }
      : { message, ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}) };
    
    res.status(status).json(responseError);
    
    // Don't throw the error after handling it
    // This prevents the server from crashing on unhandled errors
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    // Log additional information to help with debugging
    log(`Server is running in ${app.get('env')} mode`);
    log(`Application URL: ${process.env.APP_URL || 'http://localhost:' + port}`);
  });
})();
