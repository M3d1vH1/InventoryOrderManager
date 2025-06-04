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
import { globalErrorHandler, notFoundHandler, setupProcessErrorHandlers, asyncHandler } from './middlewares/errorHandler';
import { addRequestId, customRequestLogger } from './middlewares/requestLogger';
import logger from './utils/logger';
// csurf is disabled by default as it requires proper setup with cookies, but you can enable it if needed
// import csrf from "csurf";

// Load environment variables from .env file
dotenv.config();

// Setup process-level error handlers
setupProcessErrorHandlers();

// Import Replit optimizer for deployment environment
let replitOptimizer;
if (process.env.NODE_ENV === 'production') {
  try {
    // Create public directory if it doesn't exist (for production deployment)
    const fs = require('fs');
    const publicDir = path.join(process.cwd(), 'server', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
      // Create minimal index.html
      const indexPath = path.join(publicDir, 'index.html');
      const htmlContent = `<!DOCTYPE html><html><head><title>Amphoreus</title></head><body><h1>Amphoreus Warehouse Management System</h1></body></html>`;
      fs.writeFileSync(indexPath, htmlContent);
    }
    
    // Try to load the optimizer
    replitOptimizer = require('./utils/replitOptimizer');
    replitOptimizer.optimizeForReplit();
  } catch (err) {
    console.warn('Replit optimizer not available:', err instanceof Error ? err.message : String(err));
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

// Apply geoblocking to restrict access to users in Greece only
app.use(geoBlockMiddleware);

// Security middleware
// Apply Helmet for secure HTTP headers
app.use(
  helmet({
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

// Rate limiting - protect against brute force attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later'
});

// Apply rate limiting to API routes only
app.use('/api/', apiLimiter);

// CORS configuration - Make sure it works with Replit preview
app.use(cors({
  origin: true, // Allow all origins for preview access
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Add request ID and logging middleware early
app.use(addRequestId);
app.use(customRequestLogger);

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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 404 handler for undefined routes (must be after all route registrations AND static serving)
  app.use(notFoundHandler);

  // Global error handler (must be last middleware)
  app.use(globalErrorHandler);

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 5000;
  
  // Handle port conflicts gracefully
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = Number(port) + 1;
      console.log(`Port ${port} is busy, trying port ${nextPort}`);
      server.listen(nextPort, "0.0.0.0");
    } else {
      throw err;
    }
  });
  
  server.listen(Number(port), "0.0.0.0", () => {
    log(`serving on port ${port}`);
    // Log additional information to help with debugging
    log(`Server is running in ${app.get('env')} mode`);
    log(`Application URL: ${process.env.APP_URL || 'http://localhost:' + port}`);
  });
})();
