import express, { Express } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import session from 'express-session';

export const setupSecurity = (app: Express) => {
  // Basic security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });
};

export const setupRateLimit = (app: Express) => {
  // Basic rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  }));
};

export const setupCors = (app: Express) => {
  // Basic CORS setup
  app.use(cors());
};

export const setupCompression = (app: Express) => {
  // Basic compression
  app.use(compression());
};

export const setupLogging = (app: Express) => {
  // Basic logging
  app.use(morgan('dev'));
};

export const setupBodyParser = (app: Express) => {
  // Basic body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
};

export const setupStaticFiles = (app: Express) => {
  // Basic static file serving
  app.use(express.static('public'));
};

export const setupSession = (app: Express) => {
  // Basic session handling
  app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false
  }));
};

export const setupErrorHandling = (app: Express) => {
  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });
}; 