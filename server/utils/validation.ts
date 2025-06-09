import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ValidationError } from './errorUtils';

/**
 * Validation middleware factory for Express routes
 * Validates request body, query parameters, and path parameters using Zod schemas
 */
export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Create validation middleware for Express routes
 */
export function validateRequest(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body
      if (schemas.body) {
        const bodyResult = schemas.body.safeParse(req.body);
        if (!bodyResult.success) {
          throw new ValidationError(
            'Invalid request body',
            formatZodErrors(bodyResult.error)
          );
        }
        req.body = bodyResult.data;
      }

      // Validate query parameters
      if (schemas.query) {
        const queryResult = schemas.query.safeParse(req.query);
        if (!queryResult.success) {
          throw new ValidationError(
            'Invalid query parameters',
            formatZodErrors(queryResult.error)
          );
        }
        req.query = queryResult.data;
      }

      // Validate path parameters
      if (schemas.params) {
        const paramsResult = schemas.params.safeParse(req.params);
        if (!paramsResult.success) {
          throw new ValidationError(
            'Invalid path parameters',
            formatZodErrors(paramsResult.error)
          );
        }
        req.params = paramsResult.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Format Zod validation errors into a user-friendly structure
 */
function formatZodErrors(error: ZodError): any {
  return {
    errors: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      ...(err.code === 'invalid_type' && { 
        expected: (err as any).expected,
        received: (err as any).received 
      })
    })),
    count: error.errors.length
  };
}

/**
 * Common validation schemas for reuse across routes
 */
export const commonSchemas = {
  // Path parameter for numeric IDs
  idParam: z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a positive integer').transform(Number)
  }),

  // Pagination query parameters
  pagination: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val) : 1),
    limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
    offset: z.string().optional().transform(val => val ? parseInt(val) : 0)
  }).refine(data => data.page >= 1, { message: 'Page must be >= 1' })
   .refine(data => data.limit >= 1 && data.limit <= 100, { message: 'Limit must be between 1 and 100' })
   .refine(data => data.offset >= 0, { message: 'Offset must be >= 0' }),

  // Search query parameters
  search: z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    stockStatus: z.enum(['low', 'normal', 'high']).optional()
  }),

  // File upload validation
  fileUpload: z.object({
    mimetype: z.string().refine(
      type => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type),
      { message: 'File must be an image (JPEG, PNG, GIF, or WebP)' }
    ),
    size: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB')
  })
};

/**
 * Validate uploaded file
 */
export function validateFile(file: any, schema: ZodSchema) {
  const result = schema.safeParse(file);
  if (!result.success) {
    throw new ValidationError(
      'Invalid file upload',
      formatZodErrors(result.error)
    );
  }
  return result.data;
}