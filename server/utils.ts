import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

/**
 * Convert a Zod error into a user-friendly error message
 * @param error Zod error object
 * @returns Formatted error message
 */
export function zodErrorParser(error: ZodError): string[] {
  const validationError = fromZodError(error);
  return validationError.details.map(detail => detail.message);
}