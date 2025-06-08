import { Router } from 'express';
import { storage } from '../storage';
import { isAuthenticated, hasPermission } from '../auth';
import { insertEmailSettingsSchema, insertLabelTemplateSchema, insertCompanySettingsSchema, insertNotificationSettingsSchema, insertSlackIntegrationSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

// Email Settings Routes
router.get('/email', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const settings = await storage.getEmailSettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/email', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const settings = insertEmailSettingsSchema.parse(req.body);
    const result = await storage.updateEmailSettings(settings);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Label Template Routes
router.get('/label-templates', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const templates = await storage.getLabelTemplates();
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/label-templates', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const template = insertLabelTemplateSchema.parse(req.body);
    const result = await storage.createLabelTemplate(template);
    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

router.patch('/label-templates/:id', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const template = insertLabelTemplateSchema.partial().parse(req.body);
    const result = await storage.updateLabelTemplate(id, template);
    
    if (!result) {
      return res.status(404).json({ message: 'Label template not found' });
    }
    
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

router.delete('/label-templates/:id', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await storage.deleteLabelTemplate(id);
    
    if (!result) {
      return res.status(404).json({ message: 'Label template not found' });
    }
    
    res.json({ success: true, message: 'Label template deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Company Settings Routes
router.get('/company', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const settings = await storage.getCompanySettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/company', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const settings = insertCompanySettingsSchema.parse(req.body);
    const result = await storage.updateCompanySettings(settings);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Notification Settings Routes
router.get('/notifications', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const settings = await storage.getNotificationSettings();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/notifications', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const settings = insertNotificationSettingsSchema.parse(req.body);
    const result = await storage.updateNotificationSettings(settings);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Slack Integration Routes
router.get('/slack', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const settings = await storage.getSlackIntegration();
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/slack', isAuthenticated, hasPermission('manage_settings'), async (req, res) => {
  try {
    const settings = insertSlackIntegrationSchema.parse(req.body);
    const result = await storage.updateSlackIntegration(settings);
    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

export default router; 