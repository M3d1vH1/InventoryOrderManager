import express, { type Request, Response, NextFunction, Express } from "express";
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
import { storage } from './storage';
import { createServer, Server } from 'http';
import apiRouter from './routes';
import {
  setupSecurity,
  setupRateLimit,
  setupCors,
  setupCompression,
  setupLogging,
  setupBodyParser,
  setupStaticFiles,
  setupSession,
  setupErrorHandling
} from './middleware';
import {
  setupPassport,
  setupWebSocket,
  setupDatabase,
  setupEmail,
  setupSlack,
  setupNotifications,
  setupScheduler,
  setupHealthCheck,
  setupMetrics,
  setupSwagger,
  setupGraphQL,
  setupRedis,
  setupCache,
  setupQueue,
  setupStorage,
  setupValidation,
  setupI18n,
  setupMonitoring,
  setupAnalytics,
  setupAudit,
  setupBackup,
  setupMigration,
  setupSeeding,
  setupTesting,
  setupDocumentation,
  setupDeployment,
  setupMaintenance,
  setupUpgrade,
  setupRollback,
  setupRecovery,
  setupSecurityAudit,
  setupPerformance,
  setupOptimization,
  setupDebugging,
  setupProfiling,
  setupTracing
} from './services';

// Load environment variables from .env file
dotenv.config();

// Log critical environment variables at startup
console.log('Environment variables at startup:', {
  APP_URL: process.env.APP_URL || 'Not set',
  NODE_ENV: process.env.NODE_ENV || 'Not set',
  PORT: process.env.PORT || 'Not set'
});

const app: Express = express();
const server = createServer(app);

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
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow inline scripts for Vite in development
        connectSrc: ["'self'", "https:"],
        imgSrc: ["'self'", "data:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:"],
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
  max: 500, // Increased: Limit each IP to 500 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later'
});

// Apply rate limiting to API routes only
app.use('/api/', apiLimiter);

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

  // Setup all middleware and services
  setupSecurity(app);
  setupRateLimit(app);
  setupCors(app);
  setupCompression(app);
  setupLogging(app);
  setupBodyParser(app);
  setupStaticFiles(app);
  setupSession(app);
  setupPassport(app);
  setupWebSocket(server);
  setupDatabase();
  setupEmail();
  setupSlack();
  setupNotifications();
  setupScheduler();
  setupHealthCheck(app);
  setupMetrics(app);
  setupSwagger(app);
  setupGraphQL(app);
  setupRedis();
  setupCache();
  setupQueue();
  setupStorage();
  setupValidation();
  setupI18n();
  setupMonitoring();
  setupAnalytics();
  setupAudit();
  setupBackup();
  setupMigration();
  setupSeeding();
  setupTesting();
  setupDocumentation();
  setupDeployment();
  setupMaintenance();
  setupUpgrade();
  setupRollback();
  setupRecovery();
  setupSecurityAudit();
  setupPerformance();
  setupOptimization();
  setupDebugging();
  setupProfiling();
  setupTracing();

  // Mount API routes
  app.use('/api', apiRouter);

  // Setup error handling
  setupErrorHandling(app);

  // Setup Vite
  await setupVite(app, server);

  // Start server
  const port = parseInt(process.env.PORT || '5000', 10);
  const host = process.env.HOST || 'localhost';

  server.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`);
    console.log(`Environment: ${app.get('env')}`);
    console.log(`Application URL: ${process.env.APP_URL || `http://localhost:${port}`}`);
  });
})();
