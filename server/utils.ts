// Utility functions for the application
import { fromZodError } from 'zod-validation-error';
import { ZodError } from 'zod';

/**
 * Helper function to validate required fields in a request
 * @param requiredFields Array of field names that are required
 * @param body Request body object
 * @returns Object with isValid flag and missingFields array
 */
export function validateRequiredFields(requiredFields: string[], body: Record<string, any>) {
  const missingFields = requiredFields.filter(field => body[field] === undefined);
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Parses Zod validation errors into a readable format
 * @param error ZodError from validation failure
 * @returns Formatted error message
 */
export function zodErrorParser(error: ZodError) {
  return fromZodError(error).message;
}

/**
 * Formats a date string to a readable format
 * @param date Date to format
 * @returns Formatted date string (e.g., "Jan 1, 2023")
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return 'N/A';
  
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Formats a datetime string to include time
 * @param date Date to format
 * @returns Formatted datetime string (e.g., "Jan 1, 2023, 12:00 PM")
 */
export function formatDateTime(date: Date | string | null): string {
  if (!date) return 'N/A';
  
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Generates a random ID string with a prefix
 * @param prefix Prefix for the ID
 * @returns Random ID string (e.g., "PROD-123456")
 */
export function generateRandomId(prefix: string): string {
  const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `${prefix}-${randomNum}`;
}

/**
 * Calculates the total quantity of materials needed for a recipe and quantity
 * @param recipeQuantity The quantity of recipe to produce
 * @param materialQuantity The quantity of material per single recipe
 * @returns Total quantity of material needed
 */
export function calculateMaterialNeeded(recipeQuantity: number, materialQuantity: number): number {
  return recipeQuantity * materialQuantity;
}

/**
 * Truncates a string to a specified length and adds ellipsis
 * @param str String to truncate
 * @param maxLength Maximum length of the string before truncation
 * @returns Truncated string with ellipsis if necessary
 */
export function truncateString(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Converts a number to a formatted string with a specified number of decimal places
 * @param value Number to format
 * @param decimals Number of decimal places
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (value === null || value === undefined) return 'N/A';
  return value.toFixed(decimals);
}

/**
 * Formats a status string to title case with spaces
 * @param status Status string (e.g., "in_progress")
 * @returns Formatted status string (e.g., "In Progress")
 */
export function formatStatus(status: string): string {
  if (!status) return '';
  
  // Replace underscores and hyphens with spaces
  const withSpaces = status.replace(/[_-]/g, ' ');
  
  // Convert to title case
  return withSpaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}