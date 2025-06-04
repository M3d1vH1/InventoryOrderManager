/**
 * Examples demonstrating how to use the robust error handling middleware
 * These examples show best practices for different types of errors
 */

import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../middlewares/errorHandler';
import { 
  ValidationError, 
  NotFoundError, 
  UnauthorizedError,
  ConflictError,
  withDatabaseErrorHandling 
} from '../utils/errorUtils';

// Example 1: Using asyncHandler wrapper for async routes
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Validate input
  if (!id || isNaN(Number(id))) {
    throw new ValidationError('Invalid user ID provided');
  }
  
  // Simulate database operation with error handling
  const user = await withDatabaseErrorHandling(
    async () => {
      // Your database query here
      // const user = await db.select().from(users).where(eq(users.id, Number(id)));
      
      // Simulate user not found
      if (Number(id) === 999) {
        return null;
      }
      
      // Simulate database error
      if (Number(id) === 888) {
        throw new Error('Database connection failed');
      }
      
      return { id: Number(id), name: 'John Doe', email: 'john@example.com' };
    },
    'fetch user by ID'
  );
  
  if (!user) {
    throw new NotFoundError(`User with ID ${id} not found`);
  }
  
  res.json({ success: true, data: user });
});

// Example 2: Synchronous route with manual error throwing
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email } = req.body;
  
  // Validation
  if (!name || !email) {
    throw new ValidationError('Name and email are required', {
      missing: {
        name: !name,
        email: !email
      }
    });
  }
  
  if (!email.includes('@')) {
    throw new ValidationError('Invalid email format');
  }
  
  // Simulate duplicate email check
  if (email === 'duplicate@example.com') {
    throw new ConflictError('User with this email already exists');
  }
  
  // Simulate user creation
  const newUser = await withDatabaseErrorHandling(
    async () => {
      // Your database insert here
      return { id: Date.now(), name, email };
    },
    'create new user'
  );
  
  res.status(201).json({ success: true, data: newUser });
});

// Example 3: Route with authentication check
export const getProtectedData = asyncHandler(async (req: Request, res: Response) => {
  // Check if user is authenticated (assuming you have auth middleware)
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  
  // Check user permissions
  if (req.user.role !== 'admin') {
    throw new UnauthorizedError('Admin access required');
  }
  
  const sensitiveData = await withDatabaseErrorHandling(
    async () => {
      // Fetch sensitive data
      return { secret: 'This is protected information' };
    },
    'fetch protected data'
  );
  
  res.json({ success: true, data: sensitiveData });
});

// Example route registration (add these to your routes.ts file):
/*
app.get('/api/users/:id', getUser);
app.post('/api/users', createUser);
app.get('/api/protected', authenticateToken, getProtectedData);
*/