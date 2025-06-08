import { Express, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import { storage } from './storage';
import { log } from './vite';
import pg from 'pg';
import { User, roles, userRoles } from '@shared/schema';
import { loginLimiter } from './middlewares/loginRateLimit';
import { eq } from 'drizzle-orm';
import { pool } from './db';

// Configure session storage
const PgSession = pgSession(session);

// Create a dedicated connection pool for sessions
const sessionPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

export function setupAuth(app: Express) {
  // Session configuration
  const sessionOptions = {
    store: new PgSession({
      pool: sessionPool, // Use dedicated session pool
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' 
      ? require('crypto').randomBytes(64).toString('hex') // Generate random secret in production
      : 'warehouse_mgmt_dev_secret'), // Static secret for development
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration countdown on activity
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      secure: false, // Allow cookies over HTTP for now (even in production)
      httpOnly: true, // Prevents JavaScript from reading cookies (XSS protection)
      sameSite: 'lax' as const, // Changed from strict to allow redirects
      path: '/', // Restrict cookie to base path
    },
  };
  
  // In production, set a permanent session secret
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = require('crypto').randomBytes(64).toString('hex');
    console.log('[auth] Created new session secret for production');
  }
  
  app.use(session(sessionOptions));

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport to use local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Find user by username
        const user = await storage.getUserByUsername(username);
        
        if (!user) {
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        if (!user.active) {
          return done(null, false, { message: 'User account is inactive' });
        }
        
        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        // Update last login time
        await storage.updateUserLastLogin(user.id);
        
        return done(null, user);
      } catch (error) {
        log(`Authentication error: ${error}`, 'auth');
        return done(error);
      }
    })
  );

  // Configure serialization for session storage
  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        console.log(`[auth] User with id ${id} not found during session deserialization`);
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      console.error(`[auth] Error deserializing user: ${error}`);
      done(null, false);
    }
  });

  // API authentication routes
  app.post('/api/login', loginLimiter, (req, res, next) => {
    passport.authenticate('local', (err: any, user: User | false, info: { message: string }) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ message: info.message });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        
        // Don't send password in response
        const { password, ...safeUser } = user;
        
        // Add security headers for successful login
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        
        return res.json(safeUser);
      });
    })(req, res, next);
  });

  app.post('/api/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.json({ message: 'Successfully logged out' });
    });
  });

  app.get('/api/user', isAuthenticated, (req, res) => {
    const { password, ...safeUser } = req.user as User;
    res.json(safeUser);
  });
}

// Helper middleware functions for role-based access control
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
}

export function hasPermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    try {
      const user = req.user as User;
      const userPermissions = await storage.getPermissionsForRole(user.role);
      
      if (userPermissions.includes(permission)) {
        return next();
      }
      
      res.status(403).json({ message: 'Forbidden - Insufficient permissions' });
    } catch (error) {
      console.error(`[auth] Error checking permissions: ${error}`);
      res.status(500).json({ message: 'Internal server error while checking permissions' });
    }
  };
}

// Helper function to hash passwords
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Helper function to check if a user has a specific role
export async function hasRole(userId: number, roleName: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = $1 AND r.name = $2',
      [userId, roleName]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error(`[auth] Error checking role: ${error}`);
    return false;
  }
}