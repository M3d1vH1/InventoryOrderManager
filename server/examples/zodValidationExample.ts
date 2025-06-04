/**
 * Complete example showing how to integrate Zod validation with Express routes
 * This demonstrates strict validation of request body, query params, and path params
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { validateRequest, commonSchemas } from '../utils/validation';
import { asyncHandler } from '../middlewares/errorHandler';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errorUtils';
import { insertProductSchema } from '@shared/schema';
import { storage } from '../storage';

const router = Router();

// Example 1: Basic Product Creation with Comprehensive Validation
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
    .max(10000, 'Minimum stock level cannot exceed 10,000')
});

/**
 * POST /api/products - Create a new product with full validation
 * 
 * Request body validation:
 * - name: required string, 2-100 characters
 * - sku: required string, 3-50 characters, alphanumeric
 * - categoryId: required positive integer
 * - currentStock: required non-negative integer
 * - minStockLevel: required non-negative integer
 */
router.post('/products', [
  validateRequest({ body: createProductSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const productData = req.body;
    
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
    
    const newProduct = await storage.createProduct({
      ...productData,
      lastStockUpdate: new Date()
    });
    
    res.status(201).json({
      success: true,
      data: newProduct,
      message: 'Product created successfully'
    });
  })
]);

// Example 2: Product Search with Query Parameter Validation
const searchQuerySchema = z.object({
  q: z.string()
    .max(100, 'Search query must not exceed 100 characters')
    .trim()
    .optional(),
  category: z.string()
    .regex(/^\d+$/, 'Category must be a valid ID')
    .transform(Number)
    .optional(),
  stockStatus: z.enum(['low', 'normal', 'high'], {
    errorMap: () => ({ message: 'Stock status must be one of: low, normal, high' })
  }).optional(),
  page: z.string()
    .regex(/^\d+$/, 'Page must be a positive integer')
    .transform(Number)
    .refine(val => val >= 1, 'Page must be at least 1')
    .optional()
    .default('1'),
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a positive integer')
    .transform(Number)
    .refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
    .optional()
    .default('10')
});

/**
 * GET /api/products - Search products with query parameter validation
 * 
 * Query parameters:
 * - q: optional string, max 100 characters
 * - category: optional integer (as string)
 * - stockStatus: optional enum (low, normal, high)
 * - page: optional positive integer, default 1
 * - limit: optional integer 1-100, default 10
 */
router.get('/products', [
  validateRequest({ query: searchQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, category, stockStatus, page, limit } = req.query as any;
    
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
        totalPages: Math.ceil(products.length / limit),
        hasNext: endIndex < products.length,
        hasPrev: page > 1
      }
    });
  })
]);

// Example 3: Product Update with Path and Body Validation
const updateProductSchema = createProductSchema.partial().extend({
  // Allow all fields to be optional for partial updates
  name: z.string()
    .min(2, 'Product name must be at least 2 characters')
    .max(100, 'Product name must not exceed 100 characters')
    .trim()
    .optional(),
  sku: z.string()
    .min(3, 'SKU must be at least 3 characters')
    .max(50, 'SKU must not exceed 50 characters')
    .regex(/^[A-Z0-9-_]+$/i, 'SKU can only contain letters, numbers, hyphens, and underscores')
    .trim()
    .transform(val => val ? val.toUpperCase() : undefined)
    .optional()
});

/**
 * PATCH /api/products/:id - Update product with path and body validation
 * 
 * Path parameters:
 * - id: required positive integer
 * 
 * Request body: partial product data (all fields optional)
 */
router.patch('/products/:id', [
  validateRequest({ 
    params: commonSchemas.idParam,
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
    
    // Validate category if being updated
    if (updateData.categoryId) {
      const category = await storage.getCategory(updateData.categoryId);
      if (!category) {
        throw new ValidationError(`Category with ID ${updateData.categoryId} does not exist`);
      }
    }
    
    // Check SKU uniqueness if being updated
    if (updateData.sku && updateData.sku !== existingProduct.sku) {
      const existingProductBySku = await storage.getProductBySku(updateData.sku);
      if (existingProductBySku) {
        throw new ConflictError(`Product with SKU '${updateData.sku}' already exists`);
      }
    }
    
    const updatedProduct = await storage.updateProduct(id, updateData);
    
    res.json({
      success: true,
      data: updatedProduct,
      message: 'Product updated successfully'
    });
  })
]);

// Example 4: Complex Validation with Custom Business Rules
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

/**
 * PATCH /api/products/bulk-update - Bulk update with complex validation
 * 
 * Request body validation:
 * - products: array of 1-50 product updates
 * - Each product must have unique ID
 * - Stock levels must be within valid ranges
 * - reason: required string explaining the bulk update
 */
router.patch('/products/bulk-update', [
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
    const updatePromises = products.map(product => 
      storage.updateProduct(product.id, {
        currentStock: product.currentStock,
        minStockLevel: product.minStockLevel,
        lastStockUpdate: new Date()
      })
    );
    
    const updatedProducts = await Promise.all(updatePromises);
    
    console.log(`Bulk stock update completed for ${products.length} products. Reason: ${reason}`);
    
    res.json({
      success: true,
      data: updatedProducts,
      message: `Successfully updated ${products.length} products`
    });
  })
]);

// Example 5: File Upload Validation
const imageUploadSchema = z.object({
  productId: z.string()
    .regex(/^\d+$/, 'Product ID must be a positive integer')
    .transform(Number)
});

/**
 * POST /api/products/:productId/image - Upload product image with validation
 * 
 * Path parameters:
 * - productId: required positive integer
 * 
 * File validation:
 * - Required image file
 * - Max 5MB size
 * - JPEG, PNG, GIF, or WebP format
 */
router.post('/products/:productId/image', [
  validateRequest({ params: imageUploadSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { productId } = req.params as any;
    
    // Check if product exists
    const product = await storage.getProduct(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${productId} not found`);
    }
    
    // Validate file upload
    if (!req.files || !req.files.image) {
      throw new ValidationError('Image file is required');
    }
    
    const imageFile = req.files.image as any;
    
    // File validation
    const fileValidation = z.object({
      mimetype: z.string().refine(
        type => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type),
        { message: 'File must be an image (JPEG, PNG, GIF, or WebP)' }
      ),
      size: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB')
    });
    
    const fileResult = fileValidation.safeParse(imageFile);
    if (!fileResult.success) {
      throw new ValidationError('Invalid file upload', fileResult.error.errors);
    }
    
    // Process file upload (implementation depends on your file handling)
    const imagePath = `/uploads/products/${Date.now()}-${imageFile.name}`;
    
    const updatedProduct = await storage.updateProduct(productId, { imagePath });
    
    res.json({
      success: true,
      data: updatedProduct,
      message: 'Product image uploaded successfully'
    });
  })
]);

export default router;