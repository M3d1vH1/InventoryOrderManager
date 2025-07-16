/**
 * Debug validation errors by checking the specific error details
 */

import { z } from 'zod';

// Copy the exact validation schema from the backend
const insertProductSchema = z.object({
  name: z.string(),
  sku: z.string(),
  barcode: z.string().optional(),
  categoryId: z.number(),
  description: z.string().optional(),
  minStockLevel: z.number(),
  currentStock: z.number(),
  location: z.string().optional(),
  unitsPerBox: z.number().optional(),
  tags: z.array(z.string()).optional(),
  lastStockUpdate: z.date().optional(),
});

const createProductSchema = insertProductSchema.extend({
  name: z.string()
    .min(2, 'Product name must be at least 2 characters')
    .max(100, 'Product name must not exceed 100 characters')
    .trim(),
  sku: z.string()
    .min(3, 'SKU must be at least 3 characters')
    .max(50, 'SKU must not exceed 50 characters')
    .regex(/^[A-Z0-9\-_.]+$/i, 'SKU can only contain letters, numbers, hyphens, underscores, and periods')
    .trim()
    .transform(val => val.toUpperCase()),
  categoryId: z.number()
    .int('Category ID must be an integer')
    .positive('Category ID must be positive'),
  currentStock: z.number()
    .int('Current stock must be an integer')
    .min(0, 'Current stock cannot be negative')
    .max(100000, 'Current stock cannot exceed 100,000'),
  minStockLevel: z.number()
    .int('Minimum stock level must be an integer')
    .min(0, 'Minimum stock level cannot be negative')
    .max(10000, 'Minimum stock level cannot exceed 10,000'),
  barcode: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string()
      .min(8, 'Barcode must be at least 8 characters')
      .max(20, 'Barcode must not exceed 20 characters')
      .regex(/^[0-9]+$/, 'Barcode can only contain numbers')
      .optional()
  ),
  description: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string()
      .max(1000, 'Description must not exceed 1000 characters')
      .trim()
      .optional()
  ),
  location: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string()
      .max(100, 'Location must not exceed 100 characters')
      .trim()
      .optional()
  ),
  unitsPerBox: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.number()
      .int('Units per box must be an integer')
      .positive('Units per box must be positive')
      .max(1000, 'Units per box cannot exceed 1,000')
      .optional()
  ),
  tags: z.array(z.string().trim().min(1)).optional().default([])
});

function debugValidation(data) {
  console.log('Testing validation for:', JSON.stringify(data, null, 2));
  
  const result = createProductSchema.safeParse(data);
  
  if (result.success) {
    console.log('✅ Validation passed!');
    console.log('Parsed data:', JSON.stringify(result.data, null, 2));
  } else {
    console.log('❌ Validation failed!');
    console.log('Errors:', result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: err.received
    })));
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

// Test the problematic data
const testData = [
  {
    name: 'Fixed Validation Test',
    sku: 'FIXED-001',
    barcode: '',
    description: '',
    minStockLevel: 5,
    currentStock: 0,
    location: '',
    unitsPerBox: 1,
    categoryId: 1,
    tags: []
  },
  {
    name: 'Empty Barcode Test',
    sku: 'EMPTY-BARCODE-001',
    barcode: '',
    description: 'Valid description',
    location: 'A1',
    unitsPerBox: 12,
    categoryId: 1,
    minStockLevel: 5,
    currentStock: 10,
    tags: []
  }
];

testData.forEach(debugValidation);