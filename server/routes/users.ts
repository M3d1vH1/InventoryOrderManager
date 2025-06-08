import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated, hasPermission } from '../auth';
import { insertUserSchema } from '@shared/schema';
import { z } from 'zod';
import bcrypt from 'bcrypt';

const router = Router();

// Get all users
router.get('/', isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const users = await storage.getAllUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get user by ID
router.get('/:id', isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = await storage.getUser(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create new user
router.post('/', isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const userData = insertUserSchema.parse(req.body);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const userWithHashedPassword = { ...userData, password: hashedPassword };
    
    const user = await storage.createUser(userWithHashedPassword);
    res.status(201).json(user);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update user
router.patch('/:id', isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData = insertUserSchema.partial().parse(req.body);
    
    // If password is being updated, hash it
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    const updatedUser = await storage.updateUser(id, updateData);
    
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(updatedUser);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Delete user
router.delete('/:id', isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    
    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const result = await storage.deleteUser(id);
    
    if (!result) {
      return res.status(404).json({ message: 'User not found or could not be deleted' });
    }
    
    res.json({ success: true, message: `User ${user.username} has been deleted` });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: error.message || 'An error occurred while deleting the user' });
  }
});

export default router; 