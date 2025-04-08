import { z } from 'zod';

/**
 * Parses Zod validation errors into a more user-friendly format
 * @param error The Zod error object
 * @returns A map of field paths to error messages
 */
export function zodErrorParser(error: z.ZodError) {
  const errorMap: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    errorMap[path || "global"] = issue.message;
  }
  return errorMap;
}

/**
 * Calculates the quantity of raw materials needed based on a recipe and batch size
 * @param recipeQuantity The base quantity specified in the recipe
 * @param recipeBatchSize The batch size for which the recipe was defined
 * @param targetBatchSize The desired production batch size
 * @returns The calculated material quantity needed
 */
export function calculateMaterialQuantity(
  recipeQuantity: number,
  recipeBatchSize: number,
  targetBatchSize: number
): number {
  if (recipeBatchSize <= 0) {
    throw new Error('Recipe batch size must be greater than zero');
  }
  return (recipeQuantity / recipeBatchSize) * targetBatchSize;
}

/**
 * Formats a date for display or database operations
 * @param date The date to format
 * @param format The output format (ISO or localized)
 * @returns The formatted date string
 */
export function formatDate(date: Date, format: 'iso' | 'localized' = 'iso'): string {
  if (format === 'iso') {
    return date.toISOString();
  }
  return date.toLocaleDateString();
}

/**
 * Calculates the progress percentage of a production order
 * @param completedSteps Number of completed production steps
 * @param totalSteps Total number of production steps
 * @returns The progress as a percentage
 */
export function calculateProgress(completedSteps: number, totalSteps: number): number {
  if (totalSteps <= 0) {
    return 0;
  }
  const progress = (completedSteps / totalSteps) * 100;
  return Math.min(Math.max(progress, 0), 100); // Ensure between 0-100
}

/**
 * Validates that a given string is a valid production status
 * @param status The status string to validate
 * @returns Boolean indicating if the status is valid
 */
export function isValidProductionStatus(
  status: string
): status is 'planned' | 'material_check' | 'in_progress' | 'completed' | 'partially_completed' | 'cancelled' {
  return ['planned', 'material_check', 'in_progress', 'completed', 'partially_completed', 'cancelled'].includes(status);
}

/**
 * Validates that a given string is a valid production log event type
 * @param eventType The event type string to validate
 * @returns Boolean indicating if the event type is valid
 */
export function isValidProductionEventType(
  eventType: string
): eventType is 'start' | 'pause' | 'resume' | 'completed' | 'quality_check' | 'material_added' | 'issue' {
  return ['start', 'pause', 'resume', 'completed', 'quality_check', 'material_added', 'issue'].includes(eventType);
}

/**
 * Validates that a given string is a valid material unit
 * @param unit The unit string to validate
 * @returns Boolean indicating if the unit is valid
 */
export function isValidMaterialUnit(
  unit: string
): unit is 'liter' | 'kg' | 'piece' {
  return ['liter', 'kg', 'piece'].includes(unit);
}