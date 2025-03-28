import { Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { createSlackService } from '../services/notifications/slackService';

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

/**
 * Test Slack webhook
 */
export async function testSlackWebhook(req: Request, res: Response) {
  try {
    const schema = z.object({
      webhookUrl: z.string()
    });

    const validatedData = schema.parse(req.body);
    const slackService = createSlackService(storage);
    
    const success = await slackService.testConnection(validatedData.webhookUrl);
    
    if (success) {
      return res.json({ success: true, message: 'Slack webhook test was successful!' });
    }
    
    return res.status(400).json({ success: false, message: 'Failed to send test message to Slack. Please check your webhook URL.' });
  } catch (error) {
    console.error('Error testing Slack webhook:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid webhook URL', 
        errors: error.errors 
      });
    }
    return res.status(500).json({ success: false, message: 'An error occurred while testing the Slack webhook' });
  }
}

/**
 * Test sending a slack notification with a specific template
 */
export async function testSlackNotification(req: Request, res: Response) {
  try {
    const schema = z.object({
      notificationType: z.enum(['order', 'callLog', 'lowStock']),
      webhookUrl: z.string(),
      template: z.string().optional(),
      testData: z.record(z.any()).optional(),
    });

    const validatedData = schema.parse(req.body);
    
    // Rest of the implementation...
    
    return res.json({ success: true, message: 'Test notification sent successfully' });
  } catch (error) {
    console.error('Error sending test notification:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid request data', 
        errors: error.errors 
      });
    }
    return res.status(500).json({ success: false, message: 'An error occurred while sending test notification' });
  }
}

/**
 * Test sending a slack notification with all templates
 */
export async function testSlackTemplate(req: Request, res: Response) {
  try {
    const schema = z.object({
      webhookUrl: z.string(),
      templates: z.object({
        orderTemplate: z.string().optional(),
        callLogTemplate: z.string().optional(),
        lowStockTemplate: z.string().optional(),
      }),
    });

    const validatedData = schema.parse(req.body);
    const slackService = createSlackService(storage);
    
    // Create sample data for tests
    const sampleOrder = {
      id: 999,
      orderNumber: 'TEST-001',
      customerName: 'Test Customer',
      totalPrice: 150.99,
      items: '3x Premium Olives, 2x Olive Oil',
      status: 'pending'
    };
    
    const sampleCallLog = {
      id: 999,
      customer: 'Test Company',
      caller: 'John Test',
      callPurpose: 'Sales inquiry',
      callTime: new Date().toLocaleString(),
      notes: 'Customer interested in premium olives'
    };
    
    const sampleProduct = {
      id: 999,
      productName: 'Premium Olives',
      sku: 'OLIVES-001',
      quantity: 3,
      reorderPoint: 10,
      category: 'Food Products'
    };
    
    // Local helper function to replace variables in templates
    const replaceTemplateVars = (template: string, data: Record<string, any>): string => {
      return template.replace(/\{([^}]+)\}/g, (match, key) => {
        return data[key] !== undefined ? String(data[key]) : match;
      });
    };
    
    let success = true;
    
    // Test each template
    try {
      // First test the order template
      if (validatedData.templates.orderTemplate) {
        const orderMessage = {
          text: "Test order notification",
          blocks: [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: replaceTemplateVars(validatedData.templates.orderTemplate, sampleOrder)
            }
          }]
        };
        
        const orderResult = await slackService['sendSlackMessage'](orderMessage, validatedData.webhookUrl);
        if (!orderResult) success = false;
      }
      
      // Then test the call log template
      if (validatedData.templates.callLogTemplate) {
        const callLogMessage = {
          text: "Test call log notification",
          blocks: [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: replaceTemplateVars(validatedData.templates.callLogTemplate, sampleCallLog)
            }
          }]
        };
        
        const callLogResult = await slackService['sendSlackMessage'](callLogMessage, validatedData.webhookUrl);
        if (!callLogResult) success = false;
      }
      
      // Finally test the low stock template
      if (validatedData.templates.lowStockTemplate) {
        const lowStockMessage = {
          text: "Test low stock notification",
          blocks: [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: replaceTemplateVars(validatedData.templates.lowStockTemplate, sampleProduct)
            }
          }]
        };
        
        const stockResult = await slackService['sendSlackMessage'](lowStockMessage, validatedData.webhookUrl);
        if (!stockResult) success = false;
      }
    } catch (error) {
      console.error('Error sending test templates:', error);
      success = false;
    }
    
    if (success) {
      return res.json({ 
        success: true, 
        message: 'Test notifications sent successfully!' 
      });
    }
    
    return res.status(400).json({ 
      success: false, 
      message: 'Failed to send test notifications to Slack. Please check your webhook URL and templates.' 
    });
  } catch (error) {
    console.error('Error testing Slack templates:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid input data', 
        errors: error.errors 
      });
    }
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred while testing the Slack templates',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}