import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated, hasPermission } from '../auth';
import { z } from 'zod';

const router = Router();

// Get all user-role assignments
router.get('/', isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const userRoles = await storage.getAllRolePermissions();
    res.json(userRoles);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get all roles for a user by userId
router.get('/user/:userId', isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const roles = await storage.getRolePermissionsForUser(userId);
    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Assign a role to a user
router.post('/assign', isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const { userId, roleName } = req.body;
    if (!userId || !roleName) {
      return res.status(400).json({ message: 'userId and roleName are required' });
    }
    const result = await storage.assignRoleToUser(userId, roleName);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Remove a role from a user
router.delete('/assign', isAuthenticated, hasPermission('manage_users'), async (req, res) => {
  try {
    const { userId, roleName } = req.body;
    if (!userId || !roleName) {
      return res.status(400).json({ message: 'userId and roleName are required' });
    }
    const result = await storage.removeRoleFromUser(userId, roleName);
    res.json({ success: result });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router; 