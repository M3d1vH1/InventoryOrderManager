import { Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';

/**
 * Get company settings
 */
export async function getCompanySettings(req: Request, res: Response) {
  try {
    const settings = await storage.getCompanySettings();
    res.json(settings || {});
  } catch (error) {
    console.error('Error getting company settings:', error);
    res.status(500).json({ message: 'Failed to get company settings' });
  }
}

/**
 * Update company settings
 */
export async function updateCompanySettings(req: Request, res: Response) {
  try {
    const schema = z.object({
      companyName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      logoPath: z.string().optional()
    });

    const validatedData = schema.parse(req.body);
    const updatedSettings = await storage.updateCompanySettings(validatedData);
    
    if (updatedSettings) {
      return res.json(updatedSettings);
    }
    
    return res.status(500).json({ message: 'Failed to update company settings' });
  } catch (error) {
    console.error('Error updating company settings:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid input data', 
        errors: error.errors 
      });
    }
    return res.status(500).json({ message: 'Failed to update company settings' });
  }
}

/**
 * Get notification settings
 */
export async function getNotificationSettings(req: Request, res: Response) {
  try {
    const settings = await storage.getNotificationSettings();
    res.json(settings || {});
  } catch (error) {
    console.error('Error getting notification settings:', error);
    res.status(500).json({ message: 'Failed to get notification settings' });
  }
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(req: Request, res: Response) {
  try {
    const schema = z.object({
      lowStockAlerts: z.boolean().optional(),
      orderConfirmation: z.boolean().optional(),
      shippingUpdates: z.boolean().optional(),
      dailyReports: z.boolean().optional(),
      weeklyReports: z.boolean().optional(),
      soundEnabled: z.boolean().optional(),
      
      // Slack notification settings
      slackEnabled: z.boolean().optional(),
      slackWebhookUrl: z.string().optional().nullable(),
      slackNotifyNewOrders: z.boolean().optional(),
      slackNotifyCallLogs: z.boolean().optional(),
      slackNotifyLowStock: z.boolean().optional()
    });

    const validatedData = schema.parse(req.body);
    const updatedSettings = await storage.updateNotificationSettings(validatedData);
    
    if (updatedSettings) {
      return res.json(updatedSettings);
    }
    
    return res.status(500).json({ message: 'Failed to update notification settings' });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: 'Invalid input data', 
        errors: error.errors 
      });
    }
    return res.status(500).json({ message: 'Failed to update notification settings' });
  }
}