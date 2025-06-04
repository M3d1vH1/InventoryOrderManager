import { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { asyncHandler } from '../middlewares/errorHandler';
import { validateRequest, commonSchemas } from '../utils/validation';
import { ValidationError, NotFoundError } from '../utils/errorUtils';

// Raw material validation schemas
const rawMaterialSchemas = {
  create: z.object({
    name: z.string().min(2, 'Material name must be at least 2 characters').max(100),
    sku: z.string().min(2, 'SKU is required').max(50),
    quantity: z.number().nonnegative('Quantity must be zero or positive'),
    unit: z.enum(['kg', 'liter', 'piece', 'box', 'bottle', 'label', 'cap'], {
      errorMap: () => ({ message: 'Invalid unit type' })
    }),
    cost: z.number().nonnegative('Cost must be zero or positive'),
    supplier: z.string().optional(),
    supplierSku: z.string().optional(),
    minimumStock: z.number().nonnegative('Minimum stock must be zero or positive'),
    location: z.string().optional(),
    notes: z.string().optional(),
    type: z.enum(['olive', 'bottle', 'cap', 'label', 'box', 'filter', 'other'], {
      errorMap: () => ({ message: 'Invalid material type' })
    }),
  }),

  update: z.object({
    name: z.string().min(2).max(100).optional(),
    sku: z.string().min(2).max(50).optional(),
    quantity: z.number().nonnegative().optional(),
    unit: z.enum(['kg', 'liter', 'piece', 'box', 'bottle', 'label', 'cap']).optional(),
    cost: z.number().nonnegative().optional(),
    supplier: z.string().optional(),
    supplierSku: z.string().optional(),
    minimumStock: z.number().nonnegative().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
    type: z.enum(['olive', 'bottle', 'cap', 'label', 'box', 'filter', 'other']).optional(),
  }),

  search: z.object({
    q: z.string().max(100).trim().optional(),
    type: z.enum(['olive', 'bottle', 'cap', 'label', 'box', 'filter', 'other', 'all']).optional().default('all'),
    stockStatus: z.enum(['low', 'normal', 'out', 'all']).optional().default('all'),
    page: z.string().regex(/^\d+$/).transform(Number).refine(val => val >= 1).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(val => val >= 1 && val <= 100).optional().default('50')
  })
};

/**
 * GET /api/production/dashboard-stats - Get dashboard statistics
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  try {
    const [materials, recipes, batches, orders] = await Promise.all([
      storage.getRawMaterials(),
      storage.getRecipes(),
      storage.getProductionBatches(),
      storage.getProductionOrders()
    ]);

    // Calculate material statistics
    const materialStats = {
      total: materials.length,
      lowStock: materials.filter((m: any) => m.quantity <= m.minimumStock && m.quantity > 0).length,
      outOfStock: materials.filter((m: any) => m.quantity <= 0).length,
      recentlyAdded: materials.filter((m: any) => {
        const createdDate = new Date(m.createdAt || 0);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return createdDate > weekAgo;
      }).length
    };

    // Calculate recipe statistics
    const recipeStats = {
      total: recipes.length,
      active: recipes.filter((r: any) => r.status === 'active').length,
      draft: recipes.filter((r: any) => r.status === 'draft').length,
      archived: recipes.filter((r: any) => r.status === 'discontinued').length
    };

    // Calculate batch statistics
    const batchStats = {
      total: batches.length,
      inProgress: batches.filter((b: any) => b.status === 'in_progress').length,
      completed: batches.filter((b: any) => b.status === 'completed').length,
      planned: batches.filter((b: any) => b.status === 'planned').length
    };

    // Calculate order statistics
    const orderStats = {
      total: orders.length,
      pending: orders.filter((o: any) => o.status === 'pending').length,
      inProgress: orders.filter((o: any) => o.status === 'in_progress').length,
      completed: orders.filter((o: any) => o.status === 'completed').length
    };

    res.json({
      success: true,
      data: {
        materials: materialStats,
        recipes: recipeStats,
        batches: batchStats,
        orders: orderStats
      }
    });
  } catch (error) {
    throw new Error(`Failed to fetch dashboard statistics: ${error}`);
  }
});

/**
 * GET /api/production/raw-materials - Search and list raw materials
 */
export const getRawMaterials = [
  validateRequest({ query: rawMaterialSchemas.search }),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, type, stockStatus, page, limit } = req.query as any;
    
    try {
      const allMaterials = await storage.getRawMaterials();
      
      // Apply filters
      let filteredMaterials = allMaterials;
      
      // Search filter
      if (q) {
        const searchTerm = q.toLowerCase();
        filteredMaterials = filteredMaterials.filter((material: any) =>
          material.name.toLowerCase().includes(searchTerm) ||
          material.sku.toLowerCase().includes(searchTerm) ||
          material.supplier?.toLowerCase().includes(searchTerm) ||
          material.type.toLowerCase().includes(searchTerm)
        );
      }
      
      // Type filter
      if (type !== 'all') {
        filteredMaterials = filteredMaterials.filter((material: any) => material.type === type);
      }
      
      // Stock status filter
      if (stockStatus !== 'all') {
        filteredMaterials = filteredMaterials.filter((material: any) => {
          switch (stockStatus) {
            case 'out':
              return material.quantity <= 0;
            case 'low':
              return material.quantity > 0 && material.quantity <= material.minimumStock;
            case 'normal':
              return material.quantity > material.minimumStock;
            default:
              return true;
          }
        });
      }
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedMaterials = filteredMaterials.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: paginatedMaterials,
        pagination: {
          page,
          limit,
          total: filteredMaterials.length,
          totalPages: Math.ceil(filteredMaterials.length / limit),
          hasNext: endIndex < filteredMaterials.length,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      throw new Error(`Failed to fetch raw materials: ${error}`);
    }
  })
];

/**
 * GET /api/production/raw-materials/:id - Get a single raw material
 */
export const getRawMaterial = [
  validateRequest({ params: commonSchemas.idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any;
    
    try {
      const material = await storage.getRawMaterial(id);
      
      if (!material) {
        throw new NotFoundError(`Raw material with ID ${id} not found`);
      }
      
      res.json({
        success: true,
        data: material
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to fetch raw material: ${error}`);
    }
  })
];

/**
 * POST /api/production/raw-materials - Create a new raw material
 */
export const createRawMaterial = [
  validateRequest({ body: rawMaterialSchemas.create }),
  asyncHandler(async (req: Request, res: Response) => {
    const materialData = req.body;
    
    try {
      // Check if SKU already exists
      const existingMaterial = await storage.getRawMaterialBySku(materialData.sku);
      if (existingMaterial) {
        throw new ValidationError(`Raw material with SKU '${materialData.sku}' already exists`);
      }
      
      const newMaterial = await storage.createRawMaterial({
        ...materialData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      res.status(201).json({
        success: true,
        data: newMaterial,
        message: 'Raw material created successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to create raw material: ${error}`);
    }
  })
];

/**
 * PATCH /api/production/raw-materials/:id - Update a raw material
 */
export const updateRawMaterial = [
  validateRequest({ 
    params: commonSchemas.idParam,
    body: rawMaterialSchemas.update 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any;
    const updateData = req.body;
    
    try {
      const existingMaterial = await storage.getRawMaterial(id);
      if (!existingMaterial) {
        throw new NotFoundError(`Raw material with ID ${id} not found`);
      }
      
      // Check SKU uniqueness if being updated
      if (updateData.sku && updateData.sku !== existingMaterial.sku) {
        const existingBySku = await storage.getRawMaterialBySku(updateData.sku);
        if (existingBySku) {
          throw new ValidationError(`Raw material with SKU '${updateData.sku}' already exists`);
        }
      }
      
      const updatedMaterial = await storage.updateRawMaterial(id, {
        ...updateData,
        updatedAt: new Date()
      });
      
      res.json({
        success: true,
        data: updatedMaterial,
        message: 'Raw material updated successfully'
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to update raw material: ${error}`);
    }
  })
];

/**
 * DELETE /api/production/raw-materials/:id - Delete a raw material
 */
export const deleteRawMaterial = [
  validateRequest({ params: commonSchemas.idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as any;
    
    try {
      const material = await storage.getRawMaterial(id);
      if (!material) {
        throw new NotFoundError(`Raw material with ID ${id} not found`);
      }
      
      // Check if material is used in any recipes (if this check is needed)
      // const isUsedInRecipes = await storage.isRawMaterialUsedInRecipes(id);
      // if (isUsedInRecipes) {
      //   throw new ValidationError('Cannot delete raw material that is used in recipes');
      // }
      
      await storage.deleteRawMaterial(id);
      
      res.json({
        success: true,
        message: 'Raw material deleted successfully'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to delete raw material: ${error}`);
    }
  })
];