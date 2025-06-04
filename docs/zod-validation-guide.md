# Comprehensive Zod Validation Guide for Express APIs

This guide demonstrates how to implement strict validation for all incoming API request data (body, query params, path params) using Zod schemas in your Express application.

## Overview

The validation system provides:
- **Request body validation** with detailed error messages
- **Query parameter validation** with type coercion
- **Path parameter validation** for route parameters
- **File upload validation** for multipart requests
- **Custom business rule validation** beyond basic schema checks
- **Standardized error responses** with 400 status codes

## Implementation

### 1. Basic Product Creation with Full Validation

```typescript
import { z } from 'zod';
import { validateRequest } from '../utils/validation';
import { insertProductSchema } from '@shared/schema';

// Enhanced product creation schema
const createProductSchema = insertProductSchema.extend({
  name: z.string()
    .min(2, 'Product name must be at least 2 characters')
    .max(100, 'Product name must not exceed 100 characters')
    .trim(),
  sku: z.string()
    .min(3, 'SKU must be at least 3 characters')
    .max(50, 'SKU must not exceed 50 characters')
    .regex(/^[A-Z0-9-_]+$/i, 'SKU can only contain letters, numbers, hyphens, and underscores')
    .trim()
    .transform(val => val.toUpperCase()), // Auto-uppercase SKUs
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
    .max(10000, 'Minimum stock level cannot exceed 10,000')
});

// Route handler with validation middleware
export const createProduct = [
  validateRequest({ body: createProductSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const productData = req.body; // Already validated and transformed
    
    // Business logic validation
    const category = await storage.getCategory(productData.categoryId);
    if (!category) {
      throw new ValidationError(`Category with ID ${productData.categoryId} does not exist`);
    }
    
    // Check SKU uniqueness
    const existingProduct = await storage.getProductBySku(productData.sku);
    if (existingProduct) {
      throw new ConflictError(`Product with SKU '${productData.sku}' already exists`);
    }
    
    const newProduct = await storage.createProduct(productData);
    
    res.status(201).json({
      success: true,
      data: newProduct,
      message: 'Product created successfully'
    });
  })
];
```

### 2. Query Parameter Validation

```typescript
// Search query schema with transformation and defaults
const searchQuerySchema = z.object({
  q: z.string()
    .max(100, 'Search query must not exceed 100 characters')
    .trim()
    .optional(),
  category: z.string()
    .regex(/^\d+$/, 'Category must be a valid ID')
    .transform(Number) // Convert string to number
    .optional(),
  stockStatus: z.enum(['low', 'normal', 'high'], {
    errorMap: () => ({ message: 'Stock status must be one of: low, normal, high' })
  }).optional(),
  page: z.string()
    .regex(/^\d+$/, 'Page must be a positive integer')
    .transform(Number)
    .refine(val => val >= 1, 'Page must be at least 1')
    .optional()
    .default('1'), // Default value
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform(Number)
    .refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default('10')
});

export const getProducts = [
  validateRequest({ query: searchQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, category, stockStatus, page, limit } = req.query as any;
    // All parameters are validated, transformed, and have defaults applied
    
    const products = await storage.searchProducts(q, category?.toString(), stockStatus);
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedProducts = products.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedProducts,
      pagination: {
        page,
        limit,
        total: products.length,
        totalPages: Math.ceil(products.length / limit)
      }
    });
  })
];
```

### 3. Path Parameter Validation

```typescript
// Common ID parameter schema
const idParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID must be a positive integer')
    .transform(Number)
});

export const getProduct = [
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any; // Already validated and transformed to number
    
    const product = await storage.getProduct(id);
    if (!product) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }
    
    res.json({
      success: true,
      data: product
    });
  })
];
```

### 4. Combined Validation (Params + Body)

```typescript
// Update product schema - all fields optional for partial updates
const updateProductSchema = createProductSchema.partial();

export const updateProduct = [
  validateRequest({ 
    params: idParamSchema,
    body: updateProductSchema 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any;
    const updateData = req.body;
    
    // Check if product exists
    const existingProduct = await storage.getProduct(id);
    if (!existingProduct) {
      throw new NotFoundError(`Product with ID ${id} not found`);
    }
    
    // Additional business validation
    if (updateData.categoryId) {
      const category = await storage.getCategory(updateData.categoryId);
      if (!category) {
        throw new ValidationError(`Category with ID ${updateData.categoryId} does not exist`);
      }
    }
    
    const updatedProduct = await storage.updateProduct(id, updateData);
    
    res.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    });
  })
];
```

### 5. Complex Validation with Custom Rules

```typescript
// Bulk update with complex validation rules
const bulkUpdateSchema = z.object({
  products: z.array(
    z.object({
      id: z.number().int().positive(),
      currentStock: z.number().int().min(0).max(100000),
      minStockLevel: z.number().int().min(0).max(10000)
    })
  ).min(1, 'At least one product is required')
   .max(50, 'Cannot update more than 50 products at once')
   .refine(
     products => {
       // Custom validation: ensure no duplicate IDs
       const ids = products.map(p => p.id);
       return new Set(ids).size === ids.length;
     },
     { message: 'Duplicate product IDs are not allowed' }
   ),
  reason: z.string()
    .min(3, 'Reason must be at least 3 characters')
    .max(200, 'Reason must not exceed 200 characters')
    .trim()
});

export const bulkUpdateProducts = [
  validateRequest({ body: bulkUpdateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { products, reason } = req.body;
    
    // Verify all products exist
    const productIds = products.map(p => p.id);
    const existingProducts = await Promise.all(
      productIds.map(id => storage.getProduct(id))
    );
    
    const notFound = productIds.filter((id, index) => !existingProducts[index]);
    if (notFound.length > 0) {
      throw new ValidationError(`Products not found: ${notFound.join(', ')}`);
    }
    
    // Perform bulk update
    const updatedProducts = await Promise.all(
      products.map(product => storage.updateProduct(product.id, {
        currentStock: product.currentStock,
        minStockLevel: product.minStockLevel,
        lastStockUpdate: new Date()
      }))
    );
    
    res.json({
      success: true,
      data: updatedProducts,
      message: `Successfully updated ${products.length} products`
    });
  })
];
```

### 6. File Upload Validation

```typescript
// File upload validation
const imageUploadSchema = z.object({
  mimetype: z.string().refine(
    type => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type),
    { message: 'File must be an image (JPEG, PNG, GIF, or WebP)' }
  ),
  size: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB')
});

export const uploadProductImage = [
  validateRequest({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any;
    
    // Validate file upload
    if (!req.files || !req.files.image) {
      throw new ValidationError('Image file is required');
    }
    
    const imageFile = req.files.image as any;
    
    // Validate file properties
    const fileResult = imageUploadSchema.safeParse(imageFile);
    if (!fileResult.success) {
      throw new ValidationError('Invalid file upload', fileResult.error.errors);
    }
    
    // Process file upload
    const imagePath = `/uploads/products/${Date.now()}-${imageFile.name}`;
    const updatedProduct = await storage.updateProduct(id, { imagePath });
    
    res.json({
      success: true,
      data: updatedProduct,
      message: 'Product image uploaded successfully'
    });
  })
];
```

## Error Response Format

When validation fails, the system returns a standardized 400 error response:

```json
{
  "error": true,
  "requestId": "1749043675330-ha64ihob0",
  "timestamp": "2025-06-04T13:30:00.000Z",
  "message": "Invalid request body",
  "details": {
    "errors": [
      {
        "field": "name",
        "message": "Product name must be at least 2 characters",
        "code": "too_small"
      },
      {
        "field": "sku",
        "message": "SKU can only contain letters, numbers, hyphens, and underscores",
        "code": "invalid_string"
      },
      {
        "field": "categoryId",
        "message": "Category ID must be positive",
        "code": "too_small"
      }
    ],
    "count": 3
  }
}
```

## Integration with Existing Routes

### Replace existing route handlers:

```typescript
// Before (no validation)
app.post('/api/products', async (req, res) => {
  try {
    const product = await storage.createProduct(req.body);
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// After (with validation)
app.post('/api/products', createProduct);
```

### Update your routes.ts file:

```typescript
import { 
  getProducts, 
  getProduct, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  updateProductStock,
  uploadProductImage 
} from './api/products';

// Product routes with validation
app.get('/api/products', getProducts);
app.get('/api/products/:id', getProduct);
app.post('/api/products', isAuthenticated, createProduct);
app.patch('/api/products/:id', isAuthenticated, updateProduct);
app.delete('/api/products/:id', isAuthenticated, hasRole(['admin']), deleteProduct);
app.patch('/api/products/:id/stock', isAuthenticated, updateProductStock);
app.post('/api/products/:id/image', isAuthenticated, uploadProductImage);
```

## Best Practices

### 1. Schema Reuse and Composition

```typescript
// Base schemas
const baseProductSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  sku: z.string().min(3).max(50).regex(/^[A-Z0-9-_]+$/i).transform(s => s.toUpperCase())
});

// Composed schemas
const createProductSchema = baseProductSchema.extend({
  categoryId: z.number().positive(),
  currentStock: z.number().int().min(0)
});

const updateProductSchema = baseProductSchema.partial();
```

### 2. Environment-Specific Validation

```typescript
const getValidationLimits = () => {
  if (process.env.NODE_ENV === 'production') {
    return {
      maxProducts: 50,
      maxFileSize: 5 * 1024 * 1024,
      maxQueryLength: 100
    };
  } else {
    return {
      maxProducts: 10,
      maxFileSize: 1 * 1024 * 1024,
      maxQueryLength: 50
    };
  }
};
```

### 3. Custom Error Messages

```typescript
const productSchema = z.object({
  name: z.string().min(2, 'Product name is too short'),
  sku: z.string().regex(/^[A-Z0-9-_]+$/i, {
    message: 'SKU must contain only letters, numbers, hyphens, and underscores'
  }),
  categoryId: z.number({
    required_error: 'Category is required',
    invalid_type_error: 'Category must be a number'
  }).positive('Please select a valid category')
});
```

## Benefits

- **Type Safety**: Request data is validated and typed
- **Automatic Transformation**: String numbers converted to integers
- **Detailed Error Messages**: Clear validation feedback
- **Performance**: Fast validation with early returns
- **Maintainability**: Centralized validation logic
- **Security**: Prevents injection attacks and malformed data

This validation system ensures all incoming API data is strictly validated before reaching your business logic, preventing 400 errors and improving data integrity throughout your application.