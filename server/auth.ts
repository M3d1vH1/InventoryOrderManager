import { Express, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import { storage } from './storage';
import { log } from './vite';
import pg from 'pg';
import { User } from '@shared/schema';
import { loginLimiter } from './middlewares/loginRateLimit';

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
      sameSite: 'lax', // Changed from strict to allow redirects
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

  // Development-only auto-login endpoint
  app.get('/api/dev-login', async (req, res) => {
    // Only available in development mode
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ message: 'Not found' });
    }

    try {
      // Get the admin user
      const users = await storage.getAllUsers();
      const adminUser = users.find(user => user.role === 'admin');

      if (!adminUser) {
        return res.status(500).json({ 
          message: 'No admin user found. Try restarting the server to create default admin.' 
        });
      }

      // Log the user in
      req.login(adminUser, (err) => {
        if (err) {
          return res.status(500).json({ message: 'Login failed', error: err.message });
        }

        // Don't send password in response
        const { password, ...safeUser } = adminUser;
        
        return res.json({ 
          success: true, 
          message: 'Auto-login successful',
          user: safeUser
        });
      });
    } catch (error: any) {
      console.error('Dev login error:', error);
      res.status(500).json({ 
        message: 'Auto-login failed', 
        error: error.message 
      });
    }
  });

  // Default admin user creation (if no admin exists)
  createDefaultAdminUser();
}

// Helper middleware functions for role-based access control
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
}

export function hasRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const user = req.user as User;
    if (roles.includes(user.role)) {
      return next();
    }
    
    res.status(403).json({ message: 'Forbidden - Insufficient permissions' });
  };
}

// Create default admin user if none exists
async function createDefaultAdminUser() {
  try {
    const users = await storage.getAllUsers();
    const adminExists = users.some(user => user.role === 'admin');
    
    if (!adminExists) {
      // Create a default admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await storage.createUser({
        username: 'admin',
        password: hashedPassword,
        fullName: 'Administrator',
        role: 'admin',
        email: 'admin@example.com',
        active: true
      });
      
      log('Default admin user created. Username: admin, Password: admin123', 'auth');
    }
  } catch (error) {
    log(`Error creating default admin user: ${error}`, 'auth');
  }
}

// Helper function to hash passwords
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}