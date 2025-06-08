import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated, hasPermission } from '../auth';
import { insertInventoryAdjustmentSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Get all inventory items
router.get('/', async (req, res) => {
  try {
    const items = await storage.getAllInventoryItems();
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get inventory item by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const item = await storage.getInventoryItem(id);
    
    if (!item) {
      return res.status(404).json({ message: 'Inventory item not found' });
    }
    
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create inventory adjustment
router.post('/adjustments', isAuthenticated, hasPermission('manage_inventory'), async (req, res) => {
  try {
    const adjustmentData = insertInventoryAdjustmentSchema.parse(req.body);
    const adjustment = await storage.createInventoryAdjustment(adjustmentData);
    res.status(201).json(adjustment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Get inventory adjustments
router.get('/adjustments', isAuthenticated, hasPermission('manage_inventory'), async (req, res) => {
  try {
    const adjustments = await storage.getInventoryAdjustments();
    res.json(adjustments);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get inventory adjustments by item ID
router.get('/adjustments/:itemId', isAuthenticated, hasPermission('manage_inventory'), async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const adjustments = await storage.getInventoryAdjustmentsByItem(itemId);
    res.json(adjustments);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get low stock items
router.get('/low-stock', async (req, res) => {
  try {
    const items = await storage.getLowStockItems();
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get out of stock items
router.get('/out-of-stock', async (req, res) => {
  try {
    const items = await storage.getOutOfStockItems();
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get inventory history
router.get('/history/:itemId', isAuthenticated, hasPermission('manage_inventory'), async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const history = await storage.getInventoryHistory(itemId);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router; 