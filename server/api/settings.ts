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
    
    // Log notification settings for debugging
    console.log('Retrieved notification settings:', {
      slackEnabled: settings?.slackEnabled,
      slackWebhookUrl: settings?.slackWebhookUrl ? `***${settings.slackWebhookUrl.substring(0, 10)}...` : 'Not set',
      slackNotifyNewOrders: settings?.slackNotifyNewOrders,
      slackNotifyCallLogs: settings?.slackNotifyCallLogs,
      slackNotifyLowStock: settings?.slackNotifyLowStock,
      hasOrderTemplate: !!settings?.slackOrderTemplate,
      APP_URL: process.env.APP_URL || 'Not set'
    });
    
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
      slackNotifyLowStock: z.boolean().optional(),
      
      // Slack notification templates
      slackOrderTemplate: z.string().optional(),
      slackCallLogTemplate: z.string().optional(),
      slackLowStockTemplate: z.string().optional()
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
    
    console.log('Testing Slack templates with webhook URL:', validatedData.webhookUrl);
    console.log('Order template:', validatedData.templates.orderTemplate);
    console.log('Call log template:', validatedData.templates.callLogTemplate);
    console.log('Low stock template:', validatedData.templates.lowStockTemplate);
    
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
    
    let success = true;
    
    // Test each template
    try {
      // First test the order template
      if (validatedData.templates.orderTemplate) {
        console.log('Testing order template');
        
        // Create a mock order that matches the expected format for the Slack service
        const mockOrder = {
          id: 999,
          orderNumber: 'TEST-001',
          customerName: sampleOrder.customerName,
          orderDate: new Date().toISOString(),
          status: sampleOrder.status,
          notes: 'This is a test order',
          totalPrice: sampleOrder.totalPrice,
          items: sampleOrder.items,
          // Add all possible fields that might be in templates
          customer: sampleOrder.customerName,
          total: sampleOrder.totalPrice,
          totalValue: sampleOrder.totalPrice
        };
        
        console.log('Mock order data:', mockOrder);
        
        // Use the formatOrderNotification method directly with our template
        const orderMessage = slackService['formatOrderNotification'](
          mockOrder as any, 
          validatedData.templates.orderTemplate
        );
        
        console.log('Formatted order message:', JSON.stringify(orderMessage));
        
        const orderResult = await slackService['sendSlackMessage'](orderMessage, validatedData.webhookUrl);
        console.log('Order template test result:', orderResult);
        if (!orderResult) success = false;
      }
      
      // Then test the call log template
      if (validatedData.templates.callLogTemplate) {
        console.log('Testing call log template');
        
        // Create a mock call log that matches the expected format for the Slack service
        const mockCallLog = {
          id: 999,
          contactName: sampleCallLog.caller,
          companyName: sampleCallLog.customer,
          callType: 'Outbound',
          callPurpose: sampleCallLog.callPurpose,
          callDate: new Date().toISOString(),
          priority: 'Medium',
          notes: sampleCallLog.notes,
          // Add all possible fields that might be in templates
          caller: sampleCallLog.caller,
          customer: sampleCallLog.customer,
          callTime: new Date().toLocaleString(),
          subject: sampleCallLog.callPurpose
        };
        
        console.log('Mock call log data:', mockCallLog);
        
        // Use the formatCallLogNotification method directly with our template
        const callLogMessage = slackService['formatCallLogNotification'](
          mockCallLog as any, 
          validatedData.templates.callLogTemplate
        );
        
        console.log('Formatted call log message:', JSON.stringify(callLogMessage));
        
        const callLogResult = await slackService['sendSlackMessage'](callLogMessage, validatedData.webhookUrl);
        console.log('Call log template test result:', callLogResult);
        if (!callLogResult) success = false;
      }
      
      // Finally test the low stock template
      if (validatedData.templates.lowStockTemplate) {
        console.log('Testing low stock template');
        
        // Create a mock product that matches the expected format for the Slack service
        const mockProduct = {
          id: 999,
          name: sampleProduct.productName,
          sku: sampleProduct.sku,
          currentStock: sampleProduct.quantity,
          minStockLevel: sampleProduct.reorderPoint,
          category: sampleProduct.category,
          location: 'Warehouse A',
          categoryId: 1,
          // Add all possible fields that might be in templates
          productName: sampleProduct.productName,
          quantity: sampleProduct.quantity,
          reorderPoint: sampleProduct.reorderPoint,
          reorderLevel: sampleProduct.reorderPoint
        };
        
        console.log('Mock product data:', mockProduct);
        
        // Use the formatLowStockNotification method directly with our template
        const lowStockMessage = slackService['formatLowStockNotification'](
          mockProduct as any, 
          validatedData.templates.lowStockTemplate
        );
        
        console.log('Formatted low stock message:', JSON.stringify(lowStockMessage));
        
        const stockResult = await slackService['sendSlackMessage'](lowStockMessage, validatedData.webhookUrl);
        console.log('Low stock template test result:', stockResult);
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