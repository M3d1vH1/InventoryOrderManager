import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated, hasPermission } from '../auth';
import { insertCategorySchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Get all categories
router.get('/', async (req, res) => {
  try {
    const categories = await storage.getAllCategories();
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get category by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const category = await storage.getCategory(id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create new category
router.post('/', isAuthenticated, hasPermission('manage_categories'), async (req, res) => {
  try {
    const categoryData = insertCategorySchema.parse(req.body);
    const category = await storage.createCategory(categoryData);
    res.status(201).json(category);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update category
router.patch('/:id', isAuthenticated, hasPermission('manage_categories'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData = insertCategorySchema.partial().parse(req.body);
    
    const updatedCategory = await storage.updateCategory(id, updateData);
    
    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(updatedCategory);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete category
router.delete('/:id', isAuthenticated, hasPermission('manage_categories'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }
    
    const category = await storage.getCategory(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const result = await storage.deleteCategory(id);
    
    if (!result) {
      return res.status(404).json({ message: 'Category not found or could not be deleted' });
    }
    
    res.json({ success: true, message: `Category ${category.name} has been deleted` });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: error.message || 'An error occurred while deleting the category' });
  }
});

export default router; 