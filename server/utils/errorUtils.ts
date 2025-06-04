/**
 * Error utility functions and custom error classes
 */

export class ValidationError extends Error {
  public status = 400;
  public code = 'VALIDATION_ERROR';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  public status = 404;
  public code = 'NOT_FOUND';
  
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  public status = 401;
  public code = 'UNAUTHORIZED';
  
  constructor(message: string = 'Unauthorized access') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  public status = 403;
  public code = 'FORBIDDEN';
  
  constructor(message: string = 'Access forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends Error {
  public status = 409;
  public code = 'CONFLICT';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends Error {
  public status = 500;
  public code = 'DATABASE_ERROR';
  
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Creates a standardized API error response
 */
export function createApiError(
  message: string,
  status: number = 500,
  code?: string,
  details?: any
): Error {
  const error = new Error(message) as any;
  error.status = status;
  if (code) error.code = code;
  if (details) error.details = details;
  return error;
}

/**
 * Wraps database operations to catch and transform errors
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  context: string = 'database operation'
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Log the original error for debugging
    console.error(`Database error in ${context}:`, error);
    
    // Transform database-specific errors into our custom errors
    if (error.code === '23505') { // PostgreSQL unique violation
      throw new ConflictError('Resource already exists', { 
        constraint: error.constraint,
        detail: error.detail 
      });
    }
    
    if (error.code === '23503') { // PostgreSQL foreign key violation
      throw new ValidationError('Referenced resource does not exist', {
        constraint: error.constraint,
        detail: error.detail
      });
    }
    
    if (error.code === '23502') { // PostgreSQL not null violation
      throw new ValidationError('Required field is missing', {
        column: error.column,
        detail: error.detail
      });
    }
    
    // For other database errors, wrap in DatabaseError
    throw new DatabaseError(`Database operation failed: ${context}`, error);
  }
}