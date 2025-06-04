# Robust Error Handling Implementation Guide

This guide explains the comprehensive error handling middleware system implemented in your Express.js application.

## Overview

The error handling system provides:
- **Global error catching** for all synchronous and asynchronous errors
- **Standardized JSON responses** with different detail levels for development vs production
- **Request correlation IDs** for easier debugging
- **Process-level error handlers** for uncaught exceptions and unhandled rejections
- **Custom error classes** for different types of application errors
- **Database error transformation** to user-friendly messages

## Implementation Details

### 1. Global Error Handler Middleware

Located in `server/middlewares/errorHandler.ts`, this middleware:

- Catches all unhandled errors from routes and other middleware
- Generates unique request IDs for error correlation
- Provides detailed logging in development, minimal logging in production
- Returns standardized JSON error responses
- Handles different error status codes appropriately

### 2. Process Error Handlers

The system catches:
- **Uncaught exceptions**: Unexpected synchronous errors
- **Unhandled promise rejections**: Async errors not caught by try/catch
- **SIGTERM/SIGINT signals**: For graceful shutdown

### 3. Custom Error Classes

Pre-built error classes in `server/utils/errorUtils.ts`:

```typescript
ValidationError     // 400 - Invalid input data
NotFoundError      // 404 - Resource not found
UnauthorizedError  // 401 - Authentication required
ForbiddenError     // 403 - Access denied
ConflictError      // 409 - Resource conflicts (duplicates)
DatabaseError      // 500 - Database operation failures
```

## How to Use

### 1. Wrap Async Routes with asyncHandler

```typescript
import { asyncHandler } from '../middlewares/errorHandler';
import { ValidationError, NotFoundError } from '../utils/errorUtils';

// ✅ Good: Async route wrapped with asyncHandler
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('User ID is required');
  }
  
  const user = await getUserFromDatabase(id);
  
  if (!user) {
    throw new NotFoundError(`User ${id} not found`);
  }
  
  res.json({ success: true, data: user });
});
```

### 2. Handle Database Operations

```typescript
import { withDatabaseErrorHandling } from '../utils/errorUtils';

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email } = req.body;
  
  const newUser = await withDatabaseErrorHandling(
    async () => {
      return await db.insert(users).values({ name, email });
    },
    'create new user'
  );
  
  res.status(201).json({ success: true, data: newUser });
});
```

### 3. Manual Error Throwing

```typescript
// Validation errors
if (!email.includes('@')) {
  throw new ValidationError('Invalid email format');
}

// Authentication errors
if (!req.user) {
  throw new UnauthorizedError('Login required');
}

// Not found errors
if (!resource) {
  throw new NotFoundError('Resource not found');
}

// Conflict errors (duplicates)
if (existingUser) {
  throw new ConflictError('Email already registered');
}
```

### 4. Legacy/Synchronous Routes

```typescript
// For routes that don't use asyncHandler
export function legacyRoute(req: Request, res: Response, next: NextFunction) {
  try {
    // Your logic here
    if (someCondition) {
      throw new ValidationError('Invalid input');
    }
    res.json({ success: true });
  } catch (error) {
    next(error); // Pass to global error handler
  }
}
```

## Error Response Format

### Development Environment

```json
{
  "error": true,
  "requestId": "1749030087799-wqu9eigg9",
  "timestamp": "2025-06-04T09:41:27.799Z",
  "message": "User not found",
  "stack": "NotFoundError: User not found\n    at getUser...",
  "details": {
    "method": "GET",
    "url": "/api/users/123",
    "params": { "id": "123" }
  }
}
```

### Production Environment

```json
{
  "error": true,
  "requestId": "1749030087799-wqu9eigg9",
  "timestamp": "2025-06-04T09:41:27.799Z",
  "message": "User not found"
}
```

For 500 errors in production:
```json
{
  "error": true,
  "requestId": "1749030087799-wqu9eigg9",
  "timestamp": "2025-06-04T09:41:27.799Z",
  "message": "Internal Server Error"
}
```

## Logging

### Development Logs
```
=== ERROR DETAILS ===
Request ID: 1749030087799-wqu9eigg9
GET /api/users/123
Status: 404
Message: User not found
Stack: NotFoundError: User not found...
===================
```

### Production Logs
```
9:41:27 AM [error] [1749030087799-wqu9eigg9] 404 Error: User not found
```

## Best Practices

### 1. Always Use asyncHandler for Async Routes
```typescript
// ❌ Don't do this
app.get('/api/users', async (req, res) => {
  // Unhandled promise rejections!
});

// ✅ Do this
app.get('/api/users', asyncHandler(async (req, res) => {
  // Errors automatically caught
}));
```

### 2. Use Specific Error Classes
```typescript
// ❌ Generic errors
throw new Error('Something went wrong');

// ✅ Specific error types
throw new ValidationError('Email is required');
throw new NotFoundError('User not found');
throw new UnauthorizedError('Login required');
```

### 3. Wrap Database Operations
```typescript
// ❌ Raw database calls
const user = await db.select().from(users);

// ✅ With error handling
const user = await withDatabaseErrorHandling(
  () => db.select().from(users),
  'fetch users'
);
```

### 4. Validate Input Early
```typescript
export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  
  // Validate early
  if (!id || isNaN(Number(id))) {
    throw new ValidationError('Invalid user ID');
  }
  
  if (!name || !email) {
    throw new ValidationError('Name and email are required');
  }
  
  // Continue with business logic...
});
```

## Integration Status

The error handling system is already integrated into your application:

✅ **Global error handler** installed as the last middleware  
✅ **404 handler** for undefined routes  
✅ **Process error handlers** for uncaught exceptions  
✅ **Custom error classes** available for use  
✅ **Database error transformation** utilities  
✅ **Request correlation IDs** for debugging  

You can now use this system immediately in your routes by importing the utilities and following the patterns shown above.