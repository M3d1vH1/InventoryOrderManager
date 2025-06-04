import { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { insertProductSchema, Product } from '@shared/schema';
import { asyncHandler } from '../middlewares/errorHandler';
import { validateRequest, commonSchemas, validateFile } from '../utils/validation';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errorUtils';
import { UploadedFile } from 'express-fileupload';
import path from 'path';
import fs from 'fs';

// Product-specific validation schemas
const productSchemas = {
  // Create product request body schema - extends the base insert schema with additional validations
  createProduct: insertProductSchema.extend({
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
    barcode: z.string()
      .min(8, 'Barcode must be at least 8 characters')
      .max(20, 'Barcode must not exceed 20 characters')
      .regex(/^[0-9]+$/, 'Barcode can only contain numbers')
      .optional(),
    categoryId: z.number()
      .int('Category ID must be an integer')
      .positive('Category ID must be positive'),
    description: z.string()
      .max(1000, 'Description must not exceed 1000 characters')
      .trim()
      .optional(),
    minStockLevel: z.number()
      .int('Minimum stock level must be an integer')
      .min(0, 'Minimum stock level cannot be negative')
      .max(10000, 'Minimum stock level cannot exceed 10,000'),
    currentStock: z.number()
      .int('Current stock must be an integer')
      .min(0, 'Current stock cannot be negative')
      .max(100000, 'Current stock cannot exceed 100,000'),
    location: z.string()
      .max(100, 'Location must not exceed 100 characters')
      .trim()
      .optional(),
    unitsPerBox: z.number()
      .int('Units per box must be an integer')
      .positive('Units per box must be positive')
      .max(1000, 'Units per box cannot exceed 1,000')
      .optional(),
    tags: z.array(z.string().trim().min(1)).optional().default([])
  }),

  // Update product request body schema - all fields optional for partial updates
  updateProduct: insertProductSchema.partial().extend({
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
      .optional(),
    barcode: z.string()
      .min(8, 'Barcode must be at least 8 characters')
      .max(20, 'Barcode must not exceed 20 characters')
      .regex(/^[0-9]+$/, 'Barcode can only contain numbers')
      .optional(),
    categoryId: z.number()
      .int('Category ID must be an integer')
      .positive('Category ID must be positive')
      .optional(),
    description: z.string()
      .max(1000, 'Description must not exceed 1000 characters')
      .trim()
      .optional(),
    minStockLevel: z.number()
      .int('Minimum stock level must be an integer')
      .min(0, 'Minimum stock level cannot be negative')
      .max(10000, 'Minimum stock level cannot exceed 10,000')
      .optional(),
    currentStock: z.number()
      .int('Current stock must be an integer')
      .min(0, 'Current stock cannot be negative')
      .max(100000, 'Current stock cannot exceed 100,000')
      .optional(),
    location: z.string()
      .max(100, 'Location must not exceed 100 characters')
      .trim()
      .optional(),
    unitsPerBox: z.number()
      .int('Units per box must be an integer')
      .positive('Units per box must be positive')
      .max(1000, 'Units per box cannot exceed 1,000')
      .optional(),
    tags: z.array(z.string().trim().min(1)).optional()
  }),

  // Product search query parameters
  searchQuery: z.object({
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
  }),

  // Stock update schema
  updateStock: z.object({
    currentStock: z.number()
      .int('Current stock must be an integer')
      .min(0, 'Current stock cannot be negative')
      .max(100000, 'Current stock cannot exceed 100,000'),
    reason: z.string()
      .min(3, 'Reason must be at least 3 characters')
      .max(200, 'Reason must not exceed 200 characters')
      .trim()
      .optional()
  }),

  // Product tags update schema
  updateTags: z.object({
    tagIds: z.array(
      z.number()
        .int('Tag ID must be an integer')
        .positive('Tag ID must be positive')
    ).min(0, 'Tag IDs array cannot be empty').max(20, 'Cannot assign more than 20 tags')
  })
};

// File upload configuration
const UPLOAD_PATH = path.join(process.cwd(), 'uploads/products');
const PUBLIC_PATH = path.join(process.cwd(), 'public/uploads/products');

// Ensure upload directories exist
if (!fs.existsSync(UPLOAD_PATH)) {
  fs.mkdirSync(UPLOAD_PATH, { recursive: true });
}
if (!fs.existsSync(PUBLIC_PATH)) {
  fs.mkdirSync(PUBLIC_PATH, { recursive: true });
}

/**
 * GET /api/products - Search and list products with pagination
 */
export const getProducts = [
  validateRequest({ query: productSchemas.searchQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, category, stockStatus, page, limit } = req.query as any;
    
    try {
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
    } catch (error) {
      throw new Error(`Failed to fetch products: ${error}`);
    }
  })
];

/**
 * GET /api/products/low-stock - Get products with low stock levels
 */
export const getLowStockProducts = asyncHandler(async (req: Request, res: Response) => {
  try {
    const products = await storage.getLowStockProducts();
    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    throw new Error(`Failed to fetch low stock products: ${error}`);
  }
});

/**
 * GET /api/products/:id - Get a single product by ID
 */
export const getProduct = [
  validateRequest({ params: commonSchemas.idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any;
    
    try {
      const product = await storage.getProduct(id);
      
      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }
      
      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to fetch product: ${error}`);
    }
  })
];

/**
 * POST /api/products - Create a new product
 */
export const createProduct = [
  validateRequest({ body: productSchemas.createProduct }),
  asyncHandler(async (req: Request, res: Response) => {
    const productData = req.body;
    
    try {
      // Check if category exists
      const category = await storage.getCategory(productData.categoryId);
      if (!category) {
        throw new ValidationError(`Category with ID ${productData.categoryId} does not exist`);
      }
      
      // Check if SKU already exists
      const existingProduct = await storage.getProductBySku(productData.sku);
      if (existingProduct) {
        throw new ConflictError(`Product with SKU '${productData.sku}' already exists`);
      }
      
      // Handle image upload if present
      let imagePath = null;
      if (req.files && req.files.image) {
        const imageFile = req.files.image as UploadedFile;
        
        // Validate file
        validateFile(imageFile, z.object({
          mimetype: z.string().refine(
            type => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type),
            { message: 'File must be an image (JPEG, PNG, GIF, or WebP)' }
          ),
          size: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB')
        }));
        
        // Generate unique filename
        const filename = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
        const filePath = path.join(UPLOAD_PATH, filename);
        const publicFilePath = path.join(PUBLIC_PATH, filename);
        
        // Save file
        await imageFile.mv(filePath);
        
        // Copy to public directory
        fs.copyFileSync(filePath, publicFilePath);
        
        imagePath = `/uploads/products/${filename}`;
      }
      
      // Create product
      const newProduct = await storage.createProduct({
        ...productData,
        imagePath,
        lastStockUpdate: new Date()
      });
      
      res.status(201).json({
        success: true,
        data: newProduct,
        message: 'Product created successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      throw new Error(`Failed to create product: ${error}`);
    }
  })
];

/**
 * PATCH /api/products/:id - Update an existing product
 */
export const updateProduct = [
  validateRequest({ 
    params: commonSchemas.idParam,
    body: productSchemas.updateProduct 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any;
    const updateData = req.body;
    
    try {
      // Check if product exists
      const existingProduct = await storage.getProduct(id);
      if (!existingProduct) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }
      
      // Check if category exists (if being updated)
      if (updateData.categoryId) {
        const category = await storage.getCategory(updateData.categoryId);
        if (!category) {
          throw new ValidationError(`Category with ID ${updateData.categoryId} does not exist`);
        }
      }
      
      // Check SKU uniqueness (if being updated)
      if (updateData.sku && updateData.sku !== existingProduct.sku) {
        const existingProductBySku = await storage.getProductBySku(updateData.sku);
        if (existingProductBySku) {
          throw new ConflictError(`Product with SKU '${updateData.sku}' already exists`);
        }
      }
      
      // Handle image upload if present
      if (req.files && req.files.image) {
        const imageFile = req.files.image as UploadedFile;
        
        // Validate file
        validateFile(imageFile, z.object({
          mimetype: z.string().refine(
            type => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type),
            { message: 'File must be an image (JPEG, PNG, GIF, or WebP)' }
          ),
          size: z.number().max(5 * 1024 * 1024, 'File size must be less than 5MB')
        }));
        
        // Generate unique filename
        const filename = `${Date.now()}-${imageFile.name.replace(/\s+/g, '-')}`;
        const filePath = path.join(UPLOAD_PATH, filename);
        const publicFilePath = path.join(PUBLIC_PATH, filename);
        
        // Save file
        await imageFile.mv(filePath);
        
        // Copy to public directory
        fs.copyFileSync(filePath, publicFilePath);
        
        updateData.imagePath = `/uploads/products/${filename}`;
        
        // Delete old image if it exists
        if (existingProduct.imagePath) {
          const oldImagePath = path.join(PUBLIC_PATH, path.basename(existingProduct.imagePath));
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
      }
      
      // Update stock timestamp if stock is being changed
      if (updateData.currentStock !== undefined) {
        updateData.lastStockUpdate = new Date();
      }
      
      // Update product
      const updatedProduct = await storage.updateProduct(id, updateData);
      
      res.json({
        success: true,
        data: updatedProduct,
        message: 'Product updated successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ConflictError || error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to update product: ${error}`);
    }
  })
];

/**
 * DELETE /api/products/:id - Delete a product
 */
export const deleteProduct = [
  validateRequest({ params: commonSchemas.idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any;
    
    try {
      const product = await storage.getProduct(id);
      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }
      
      // Check if product is referenced in orders (implement if needed)
      // For now, we'll allow deletion but you can add this check when the method exists
      // const hasOrders = await storage.productHasOrders(id);
      // if (hasOrders) {
      //   throw new ConflictError('Cannot delete product that has associated orders');
      // }
      
      // Delete image file if it exists
      if (product.imagePath) {
        const imagePath = path.join(PUBLIC_PATH, path.basename(product.imagePath));
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      // Delete product
      await storage.deleteProduct(id);
      
      res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      throw new Error(`Failed to delete product: ${error}`);
    }
  })
];

/**
 * PATCH /api/products/:id/stock - Update product stock level
 */
export const updateProductStock = [
  validateRequest({ 
    params: commonSchemas.idParam,
    body: productSchemas.updateStock 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any;
    const { currentStock, reason } = req.body;
    
    try {
      const product = await storage.getProduct(id);
      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }
      
      const updatedProduct = await storage.updateProduct(id, {
        currentStock,
        lastStockUpdate: new Date()
      });
      
      // Log stock change if reason provided (implement if needed)
      if (reason) {
        // You can implement inventory change logging when the method is available
        console.log(`Stock updated for product ${id}: ${product.currentStock} -> ${currentStock}. Reason: ${reason}`);
      }
      
      res.json({
        success: true,
        data: updatedProduct,
        message: 'Product stock updated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to update product stock: ${error}`);
    }
  })
];

/**
 * GET /api/products/:id/tags - Get product tags
 */
export const getProductTags = [
  validateRequest({ params: commonSchemas.idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any;
    
    try {
      const product = await storage.getProduct(id);
      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }
      
      const tags = await storage.getProductTags(id);
      
      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to fetch product tags: ${error}`);
    }
  })
];

/**
 * POST /api/products/:id/tags - Update product tags
 */
export const updateProductTags = [
  validateRequest({ 
    params: commonSchemas.idParam,
    body: productSchemas.updateTags 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any;
    const { tagIds } = req.body;
    
    try {
      const product = await storage.getProduct(id);
      if (!product) {
        throw new NotFoundError(`Product with ID ${id} not found`);
      }
      
      // Validate that all tag IDs exist
      for (const tagId of tagIds) {
        const tag = await storage.getTag(tagId);
        if (!tag) {
          throw new ValidationError(`Tag with ID ${tagId} does not exist`);
        }
      }
      
      await storage.updateProductTags(id, tagIds);
      const updatedTags = await storage.getProductTags(id);
      
      res.json({
        success: true,
        data: updatedTags,
        message: 'Product tags updated successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to update product tags: ${error}`);
    }
  })
];