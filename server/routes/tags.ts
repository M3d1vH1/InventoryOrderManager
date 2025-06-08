import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated, hasPermission } from '../auth';
import { insertTagSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Get all tags
router.get('/', async (req, res) => {
  try {
    const tags = await storage.getAllTags();
    res.json(tags);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get tag by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tag = await storage.getTag(id);
    
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }
    
    res.json(tag);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create new tag
router.post('/', isAuthenticated, hasPermission('manage_tags'), async (req, res) => {
  try {
    const tagData = insertTagSchema.parse(req.body);
    const tag = await storage.createTag(tagData);
    res.status(201).json(tag);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update tag
router.patch('/:id', isAuthenticated, hasPermission('manage_tags'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData = insertTagSchema.partial().parse(req.body);
    
    const updatedTag = await storage.updateTag(id, updateData);
    
    if (!updatedTag) {
      return res.status(404).json({ message: 'Tag not found' });
    }
    
    res.json(updatedTag);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete tag
router.delete('/:id', isAuthenticated, hasPermission('manage_tags'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid tag ID' });
    }
    
    const tag = await storage.getTag(id);
    if (!tag) {
      return res.status(404).json({ message: 'Tag not found' });
    }
    
    const result = await storage.deleteTag(id);
    
    if (!result) {
      return res.status(404).json({ message: 'Tag not found or could not be deleted' });
    }
    
    res.json({ success: true, message: `Tag ${tag.name} has been deleted` });
  } catch (error: any) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ message: error.message || 'An error occurred while deleting the tag' });
  }
});

export default router; 