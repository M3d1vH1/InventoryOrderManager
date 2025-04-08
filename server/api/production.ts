import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated } from '../auth';
import { zodErrorParser } from '../utils';
import { 
  insertRawMaterialSchema,
  insertProductionRecipeSchema,
  insertRecipeIngredientSchema,
  insertProductionBatchSchema,
  insertProductionOrderSchema,
  insertMaterialConsumptionSchema,
  insertProductionLogSchema
} from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Raw Materials endpoints
router.get('/raw-materials', isAuthenticated, async (req, res) => {
  try {
    const materials = await storage.getAllRawMaterials();
    res.json(materials);
  } catch (error) {
    console.error('Error fetching raw materials:', error);
    res.status(500).json({ error: 'Failed to fetch raw materials' });
  }
});

router.get('/raw-materials/low-stock', isAuthenticated, async (req, res) => {
  try {
    const materials = await storage.getLowStockRawMaterials();
    res.json(materials);
  } catch (error) {
    console.error('Error fetching low stock materials:', error);
    res.status(500).json({ error: 'Failed to fetch low stock materials' });
  }
});

router.get('/raw-materials/search', isAuthenticated, async (req, res) => {
  try {
    const query = req.query.q as string || '';
    const type = req.query.type as string;
    const materials = await storage.searchRawMaterials(query, type);
    res.json(materials);
  } catch (error) {
    console.error('Error searching raw materials:', error);
    res.status(500).json({ error: 'Failed to search raw materials' });
  }
});

router.get('/raw-materials/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const material = await storage.getRawMaterial(id);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    
    res.json(material);
  } catch (error) {
    console.error(`Error fetching raw material ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch raw material' });
  }
});

router.post('/raw-materials', isAuthenticated, async (req, res) => {
  try {
    const parsedData = insertRawMaterialSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    const material = await storage.createRawMaterial(parsedData.data);
    res.status(201).json(material);
  } catch (error) {
    console.error('Error creating raw material:', error);
    res.status(500).json({ error: 'Failed to create raw material' });
  }
});

router.patch('/raw-materials/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    // Partial validation using zod schema
    const validationSchema = insertRawMaterialSchema.partial();
    const parsedData = validationSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    const updatedMaterial = await storage.updateRawMaterial(id, parsedData.data);
    if (!updatedMaterial) {
      return res.status(404).json({ error: 'Material not found' });
    }
    
    res.json(updatedMaterial);
  } catch (error) {
    console.error(`Error updating raw material ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update raw material' });
  }
});

router.patch('/raw-materials/:id/stock', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const stockUpdateSchema = z.object({
      quantity: z.number().int(),
      notes: z.string().optional()
    });
    
    const parsedData = stockUpdateSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    const { quantity, notes } = parsedData.data;
    const updatedMaterial = await storage.updateRawMaterialStock(id, quantity, notes);
    if (!updatedMaterial) {
      return res.status(404).json({ error: 'Material not found' });
    }
    
    res.json(updatedMaterial);
  } catch (error) {
    console.error(`Error updating raw material stock ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update raw material stock' });
  }
});

router.delete('/raw-materials/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const success = await storage.deleteRawMaterial(id);
    if (!success) {
      return res.status(404).json({ error: 'Material not found or could not be deleted' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting raw material ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete raw material' });
  }
});

// Production Recipes endpoints
router.get('/recipes', isAuthenticated, async (req, res) => {
  try {
    const recipes = await storage.getAllRecipes();
    res.json(recipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

router.get('/recipes/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const recipe = await storage.getRecipe(id);
    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    // Get recipe ingredients
    const ingredients = await storage.getRecipeIngredients(id);
    
    res.json({ ...recipe, ingredients });
  } catch (error) {
    console.error(`Error fetching recipe ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

router.post('/recipes', isAuthenticated, async (req, res) => {
  try {
    const { recipe, ingredients } = req.body;
    
    // Validate recipe data
    const parsedRecipe = insertProductionRecipeSchema.safeParse(recipe);
    if (!parsedRecipe.success) {
      return res.status(400).json({ errors: { recipe: zodErrorParser(parsedRecipe.error) } });
    }
    
    // Create the recipe first
    const createdRecipe = await storage.createRecipe(parsedRecipe.data);
    
    // If ingredients are provided, add them
    if (Array.isArray(ingredients) && ingredients.length > 0) {
      // Validate each ingredient
      const ingredientSchema = insertRecipeIngredientSchema.omit({ id: true });
      
      for (const ingredient of ingredients) {
        const parsedIngredient = ingredientSchema.safeParse({
          ...ingredient,
          recipeId: createdRecipe.id
        });
        
        if (parsedIngredient.success) {
          await storage.addRecipeIngredient(parsedIngredient.data);
        }
      }
    }
    
    // Return the complete recipe with ingredients
    const fullRecipe = await storage.getRecipe(createdRecipe.id);
    const recipeIngredients = await storage.getRecipeIngredients(createdRecipe.id);
    
    res.status(201).json({ ...fullRecipe, ingredients: recipeIngredients });
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

router.patch('/recipes/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const { recipe, ingredients } = req.body;
    
    // Validate recipe data if provided
    if (recipe) {
      const validationSchema = insertProductionRecipeSchema.partial();
      const parsedData = validationSchema.safeParse(recipe);
      if (!parsedData.success) {
        return res.status(400).json({ errors: { recipe: zodErrorParser(parsedData.error) } });
      }
      
      const updatedRecipe = await storage.updateRecipe(id, parsedData.data);
      if (!updatedRecipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }
    }
    
    // Update ingredients if provided
    if (Array.isArray(ingredients)) {
      // Get existing ingredients
      const existingIngredients = await storage.getRecipeIngredients(id);
      
      // For each existing ingredient, check if it's in the new list
      for (const existing of existingIngredients) {
        const matchingIngredient = ingredients.find(i => i.id === existing.id);
        
        if (!matchingIngredient) {
          // Ingredient was removed, delete it
          await storage.removeRecipeIngredient(existing.id);
        } else if (
          matchingIngredient.materialId !== existing.materialId ||
          matchingIngredient.quantity !== existing.quantity
        ) {
          // Ingredient was updated
          await storage.updateRecipeIngredient(existing.id, {
            materialId: matchingIngredient.materialId,
            quantity: matchingIngredient.quantity,
            notes: matchingIngredient.notes
          });
        }
      }
      
      // Add new ingredients
      for (const ingredient of ingredients) {
        if (!ingredient.id) {
          // This is a new ingredient
          const parsedIngredient = insertRecipeIngredientSchema
            .omit({ id: true })
            .safeParse({
              ...ingredient,
              recipeId: id
            });
          
          if (parsedIngredient.success) {
            await storage.addRecipeIngredient(parsedIngredient.data);
          }
        }
      }
    }
    
    // Return the updated recipe with ingredients
    const updatedRecipe = await storage.getRecipe(id);
    if (!updatedRecipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    
    const updatedIngredients = await storage.getRecipeIngredients(id);
    
    res.json({ ...updatedRecipe, ingredients: updatedIngredients });
  } catch (error) {
    console.error(`Error updating recipe ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update recipe' });
  }
});

router.delete('/recipes/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const success = await storage.deleteRecipe(id);
    if (!success) {
      return res.status(404).json({ error: 'Recipe not found or could not be deleted' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting recipe ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete recipe' });
  }
});

// Production Batches endpoints
router.get('/batches', isAuthenticated, async (req, res) => {
  try {
    let batches;
    if (req.query.status) {
      batches = await storage.getProductionBatchesByStatus(req.query.status as string);
    } else {
      batches = await storage.getAllProductionBatches();
    }
    res.json(batches);
  } catch (error) {
    console.error('Error fetching production batches:', error);
    res.status(500).json({ error: 'Failed to fetch production batches' });
  }
});

router.get('/batches/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const batch = await storage.getProductionBatch(id);
    if (!batch) {
      return res.status(404).json({ error: 'Production batch not found' });
    }
    
    res.json(batch);
  } catch (error) {
    console.error(`Error fetching production batch ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch production batch' });
  }
});

router.post('/batches', isAuthenticated, async (req, res) => {
  try {
    const parsedData = insertProductionBatchSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    const batch = await storage.createProductionBatch(parsedData.data);
    res.status(201).json(batch);
  } catch (error) {
    console.error('Error creating production batch:', error);
    res.status(500).json({ error: 'Failed to create production batch' });
  }
});

router.patch('/batches/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    // Validate request data
    const validationSchema = insertProductionBatchSchema.partial();
    const parsedData = validationSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    const updatedBatch = await storage.updateProductionBatch(id, parsedData.data);
    if (!updatedBatch) {
      return res.status(404).json({ error: 'Production batch not found' });
    }
    
    res.json(updatedBatch);
  } catch (error) {
    console.error(`Error updating production batch ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update production batch' });
  }
});

router.patch('/batches/:id/status', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const statusSchema = z.object({
      status: z.enum(['planned', 'in_progress', 'completed', 'quality_check', 'approved', 'rejected']),
      notes: z.string().optional()
    });
    
    const parsedData = statusSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    const { status, notes } = parsedData.data;
    const updatedBatch = await storage.updateProductionBatchStatus(id, status, notes);
    if (!updatedBatch) {
      return res.status(404).json({ error: 'Production batch not found' });
    }
    
    res.json(updatedBatch);
  } catch (error) {
    console.error(`Error updating production batch status ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update production batch status' });
  }
});

router.delete('/batches/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const success = await storage.deleteProductionBatch(id);
    if (!success) {
      return res.status(404).json({ error: 'Production batch not found or could not be deleted' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting production batch ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete production batch' });
  }
});

// Production Orders endpoints
router.get('/orders', isAuthenticated, async (req, res) => {
  try {
    let orders;
    
    if (req.query.status) {
      orders = await storage.getProductionOrdersByStatus(req.query.status as string);
    } else if (req.query.batchId) {
      const batchId = parseInt(req.query.batchId as string);
      if (isNaN(batchId)) {
        return res.status(400).json({ error: 'Invalid batch ID format' });
      }
      orders = await storage.getProductionOrdersByBatch(batchId);
    } else {
      orders = await storage.getAllProductionOrders();
    }
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching production orders:', error);
    res.status(500).json({ error: 'Failed to fetch production orders' });
  }
});

router.get('/orders/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const order = await storage.getProductionOrder(id);
    if (!order) {
      return res.status(404).json({ error: 'Production order not found' });
    }
    
    // Get material consumptions for this order
    const consumptions = await storage.getMaterialConsumptions(id);
    
    // Get production logs for this order
    const logs = await storage.getProductionLogs(id);
    
    res.json({ ...order, consumptions, logs });
  } catch (error) {
    console.error(`Error fetching production order ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch production order' });
  }
});

router.post('/orders', isAuthenticated, async (req, res) => {
  try {
    const parsedData = insertProductionOrderSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    const order = await storage.createProductionOrder(parsedData.data);
    
    // Add initial production log
    await storage.addProductionLog({
      productionOrderId: order.id,
      eventType: 'start',
      description: 'Production order created',
      createdById: (req.user as any)?.id || 1
    });
    
    res.status(201).json(order);
  } catch (error) {
    console.error('Error creating production order:', error);
    res.status(500).json({ error: 'Failed to create production order' });
  }
});

router.patch('/orders/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    // Validate request data
    const validationSchema = insertProductionOrderSchema.partial();
    const parsedData = validationSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    const updatedOrder = await storage.updateProductionOrder(id, parsedData.data);
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Production order not found' });
    }
    
    // Add update log if there was an actual change
    if (Object.keys(parsedData.data).length > 0) {
      await storage.addProductionLog({
        productionOrderId: id,
        eventType: 'material_added', // Using a valid event type
        description: 'Production order updated',
        createdById: (req.user as any)?.id || 1
      });
    }
    
    res.json(updatedOrder);
  } catch (error) {
    console.error(`Error updating production order ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update production order' });
  }
});

router.patch('/orders/:id/status', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const statusSchema = z.object({
      status: z.enum(['planned', 'material_check', 'in_progress', 'completed', 'partially_completed', 'cancelled']),
      notes: z.string().optional()
    });
    
    const parsedData = statusSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    const { status, notes } = parsedData.data;
    const updatedOrder = await storage.updateProductionOrderStatus(id, status, notes);
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Production order not found' });
    }
    
    // Add status change log
    await storage.addProductionLog({
      productionOrderId: id,
      eventType: status === 'completed' ? 'completed' : (status === 'in_progress' ? 'start' : 'material_added'), // Using valid event type
      description: notes || `Status changed to ${status}`,
      createdById: (req.user as any)?.id || 1
    });
    
    res.json(updatedOrder);
  } catch (error) {
    console.error(`Error updating production order status ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update production order status' });
  }
});

router.delete('/orders/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const success = await storage.deleteProductionOrder(id);
    if (!success) {
      return res.status(404).json({ error: 'Production order not found or could not be deleted' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting production order ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete production order' });
  }
});

// Material Consumptions endpoints
router.post('/orders/:orderId/consumptions', isAuthenticated, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }
    
    // Make sure the order exists
    const order = await storage.getProductionOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Production order not found' });
    }
    
    // Validate consumption data
    const validationSchema = insertMaterialConsumptionSchema.omit({ id: true });
    const parsedData = validationSchema.safeParse({
      ...req.body,
      productionOrderId: orderId
    });
    
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    // Add the consumption
    const consumption = await storage.addMaterialConsumption(parsedData.data);
    
    // Add material added log
    await storage.addProductionLog({
      productionOrderId: orderId,
      eventType: 'material_added',
      description: `Added ${consumption.quantity} units of material #${consumption.materialId}`,
      createdById: (req.user as any)?.id || 1
    });
    
    res.status(201).json(consumption);
  } catch (error) {
    console.error(`Error adding material consumption to order ${req.params.orderId}:`, error);
    res.status(500).json({ error: 'Failed to add material consumption' });
  }
});

router.patch('/consumptions/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    // Validate request data
    const validationSchema = insertMaterialConsumptionSchema.partial();
    const parsedData = validationSchema.safeParse(req.body);
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    const updatedConsumption = await storage.updateMaterialConsumption(id, parsedData.data);
    if (!updatedConsumption) {
      return res.status(404).json({ error: 'Consumption not found' });
    }
    
    res.json(updatedConsumption);
  } catch (error) {
    console.error(`Error updating material consumption ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update material consumption' });
  }
});

router.delete('/consumptions/:id', isAuthenticated, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const success = await storage.removeMaterialConsumption(id);
    if (!success) {
      return res.status(404).json({ error: 'Consumption not found or could not be deleted' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting material consumption ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete material consumption' });
  }
});

// Production Logs endpoints
router.post('/orders/:orderId/logs', isAuthenticated, async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID format' });
    }
    
    // Make sure the order exists
    const order = await storage.getProductionOrder(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Production order not found' });
    }
    
    // Validate log data
    const validationSchema = insertProductionLogSchema.omit({ id: true });
    const parsedData = validationSchema.safeParse({
      ...req.body,
      productionOrderId: orderId,
      createdById: (req.user as any)?.id || 1
    });
    
    if (!parsedData.success) {
      return res.status(400).json({ errors: zodErrorParser(parsedData.error) });
    }
    
    // Add the log
    const log = await storage.addProductionLog(parsedData.data);
    res.status(201).json(log);
  } catch (error) {
    console.error(`Error adding production log to order ${req.params.orderId}:`, error);
    res.status(500).json({ error: 'Failed to add production log' });
  }
});

// zodErrorParser is now imported from ../utils

export default router;