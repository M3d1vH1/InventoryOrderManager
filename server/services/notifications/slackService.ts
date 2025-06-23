import { Order, CallLog, NotificationSettings, Product } from '../../../shared/schema';
import { IStorage } from '../../storage';
import { RobustHttpClient, HttpRequestError } from '../../utils/robustHttpClient';

interface SlackMessage {
  text: string;
  blocks?: any[];
}

export class SlackNotificationService {
  private storage: IStorage;
  private httpClient: RobustHttpClient;
  
  constructor(storage: IStorage) {
    this.storage = storage;
    // Simple HTTP client configuration for Slack webhooks
    this.httpClient = new RobustHttpClient(
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Warehouse-Management-System/1.0'
        }
      },
      {
        timeout: 8000, // 8 seconds for Slack webhooks
        maxRetries: 2,
        retryDelay: 1000, // 1 second initial delay
        maxRetryDelay: 5000, // 5 seconds max delay
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
        onRetry: (attempt, error) => {
          console.log(`Slack retry ${attempt}: ${error.message}`);
        }
      }
    );
  }
  
  // Get notification settings
  private async getNotificationSettings(): Promise<NotificationSettings | null> {
    try {
      const settings = await this.storage.getNotificationSettings();
      return settings || null;
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      return null;
    }
  }
  
  // Send notification method for invoice/payment service compatibility
  async sendNotification(webhookUrl: string, message: string): Promise<boolean> {
    const slackMessage: SlackMessage = { text: message };
    return this.sendSlackMessage(slackMessage, webhookUrl);
  }

  // Send a message to Slack
  private async sendSlackMessage(message: SlackMessage, webhookUrl: string): Promise<boolean> {
    try {
      if (!webhookUrl) {
        console.error('No Slack webhook URL provided');
        return false;
      }
      
      console.log('Sending Slack notification for:', message.text?.substring(0, 50) + '...');
      
      const response = await this.httpClient.post(webhookUrl, message);
      
      if (response.status === 200) {
        console.log('Slack notification sent successfully');
        return true;
      } else {
        console.error('Slack API returned non-200 status:', response.status);
        return false;
      }
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      if (error instanceof HttpRequestError) {
        console.error('HTTP error details:', {
          status: error.statusCode,
          attempts: error.attempts,
          message: error.message
        });
      }
      return false;
    }
  }
  
  // Apply template with data - simplified version
  private applyTemplate(template: string, data: Record<string, any>): SlackMessage {
    try {
      let messageText = template;
      
      // Replace all template variables with actual data
      Object.entries(data).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, 'g');
        const strValue = value !== undefined && value !== null ? String(value) : '';
        messageText = messageText.replace(regex, strValue);
      });
      
      console.log('Template applied successfully');
      
      return {
        text: messageText
      };
    } catch (error) {
      console.error('Error applying template:', error);
      // Fallback to a simple text message if template parsing fails
      return {
        text: `Notification from Warehouse Management System`,
      };
    }
  }
  
  // Format order for Slack notification using template
  private formatOrderNotification(order: Order, template?: string): SlackMessage {
    // Default simple template if none is provided
    const defaultTemplate = `🛒 *New Order Received*
• Order: #{orderNumber}
• Customer: {customerName}
• Date: {orderDate}
• Status: {status}
• Items: {totalItems}
• View: {appUrl}/orders/{id}`;
    
    // Calculate derived properties without modifying the order object
    const totalItems = (order as any).totalItems || 1;
    const totalPrice = (order as any).totalPrice || 0;
    
    // Prepare data for template variables
    const data = {
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.customerName,
      customerName: order.customerName,
      orderDate: order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'Unknown',
      status: order.status,
      priority: order.priority || 'medium',
      totalItems: totalItems,
      total: typeof totalPrice === 'number' ? `€${totalPrice.toFixed(2)}` : '€0.00',
      notes: order.notes || 'No notes',
      appUrl: process.env.APP_URL || '',
    };
    
    console.log('Order notification data prepared for:', order.orderNumber);
    
    return this.applyTemplate(template || defaultTemplate, data);
  }
  
  // Format call log for Slack notification using template
  private formatCallLogNotification(callLog: CallLog, template?: string): SlackMessage {
    // Default template if none is provided
    const defaultTemplate = JSON.stringify({
      text: `New call log recorded with {contactName}, purpose: {callPurpose}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📞 New Call Log Recorded",
            emoji: true
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*Contact:*\n{contactName}"
            },
            {
              type: "mrkdwn",
              text: "*Company:*\n{companyName}"
            }
          ]
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*Call Type:*\n{callType}"
            },
            {
              type: "mrkdwn",
              text: "*Purpose:*\n{callPurpose}"
            }
          ]
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*Date:*\n{callDate}"
            },
            {
              type: "mrkdwn",
              text: "*Priority:*\n{priority}"
            }
          ]
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Notes:*\n{notes}"
          }
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "View Call Log",
                emoji: true
              },
              url: "{appUrl}/call-logs/{id}",
              value: "view_call_log_{id}"
            }
          ]
        }
      ]
    });
    
    // Prepare data for template variables
    const data = {
      id: callLog.id,
      contactName: callLog.contactName,
      caller: callLog.contactName, // Add caller as synonym for contactName
      companyName: callLog.companyName || 'Not specified',
      customer: callLog.companyName || 'Not specified', // Add customer as synonym for companyName
      callType: callLog.callType,
      callPurpose: callLog.callPurpose,
      callDate: callLog.callDate ? new Date(callLog.callDate).toLocaleString() : 'Not specified',
      callTime: callLog.callDate ? new Date(callLog.callDate).toLocaleString() : 'Not specified', // Add callTime as synonym
      priority: callLog.priority,
      notes: callLog.notes || 'No notes provided',
      appUrl: process.env.APP_URL || '',
    };
    
    console.log('Call log notification data:', data);
    console.log('Call log template:', template);
    
    return this.applyTemplate(template || defaultTemplate, data);
  }
  
  // Format low stock notification using template
  private formatLowStockNotification(product: Product, template?: string): SlackMessage {
    // Default template if none is provided
    const defaultTemplate = JSON.stringify({
      text: `Low stock alert: {productName} is running low`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "⚠️ Low Stock Alert",
            emoji: true
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*Product:*\n{productName}"
            },
            {
              type: "mrkdwn",
              text: "*SKU:*\n{sku}"
            }
          ]
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*Current Stock:*\n{currentStock}"
            },
            {
              type: "mrkdwn",
              text: "*Reorder Level:*\n{reorderLevel}"
            }
          ]
        },
        {
          type: "divider"
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "View Product",
                emoji: true
              },
              url: "{appUrl}/products/{id}",
              value: "view_product_{id}"
            }
          ]
        }
      ]
    });
    
    // Get product fields safely
    const reorderLevel = (product as any).reorderLevel || product.minStockLevel || 0;
    let categoryName = 'Not specified';
    if ((product as any).category) {
      categoryName = (product as any).category;
    } else if (product.categoryId) {
      // We could fetch category name from storage here if needed
      categoryName = `Category ID: ${product.categoryId}`;
    }
    
    // Prepare data for template variables
    const data = {
      id: product.id,
      productName: product.name,
      name: product.name, // Add name as synonym for productName
      sku: product.sku,
      currentStock: product.currentStock,
      quantity: product.currentStock, // Add quantity as synonym for currentStock
      reorderPoint: reorderLevel, // Add reorderPoint as synonym
      reorderLevel: reorderLevel,
      location: product.location || 'Not specified',
      category: categoryName,
      appUrl: process.env.APP_URL || '',
    };
    
    console.log('Product notification data:', data);
    console.log('Product template:', template);
    
    return this.applyTemplate(template || defaultTemplate, data);
  }
  
  // Notify about a new order
  async notifyNewOrder(order: Order): Promise<boolean> {
    try {
      console.log('Starting Slack notification for order:', order.orderNumber);
      
      const settings = await this.getNotificationSettings();
      
      if (!settings || !settings.slackEnabled || !settings.slackNotifyNewOrders) {
        console.log('Slack notification skipped: not enabled in settings');
        return false;
      }
      
      if (!settings.slackWebhookUrl) {
        console.error('Slack notification failed: webhook URL not configured');
        return false;
      }
      
      // Validate webhook URL format
      if (!settings.slackWebhookUrl.startsWith('https://hooks.slack.com/')) {
        console.error('Invalid Slack webhook URL format');
        return false;
      }
      
      // Get order items to calculate total
      let totalItems = 1; // Default fallback
      try {
        const orderItems = await this.storage.getOrderItems(order.id);
        totalItems = orderItems.length;
        console.log(`Found ${totalItems} items for order ${order.orderNumber}`);
      } catch (error) {
        console.warn('Could not fetch order items, using default count:', error);
      }
      
      // Add totalItems to order data (non-destructive)
      const orderWithItems = { ...order, totalItems };
      
      // Format and send message
      const template = settings.slackOrderTemplate || undefined;
      const message = this.formatOrderNotification(orderWithItems as Order, template);
      
      const success = await this.sendSlackMessage(message, settings.slackWebhookUrl);
      
      if (success) {
        console.log('Slack notification sent successfully for order:', order.orderNumber);
      } else {
        console.error('Failed to send Slack notification for order:', order.orderNumber);
      }
      
      return success;
      
    } catch (error) {
      console.error('Error in notifyNewOrder:', error);
      return false;
    }
  }
  
  // Notify about a new call log
  async notifyNewCallLog(callLog: CallLog): Promise<boolean> {
    const settings = await this.getNotificationSettings();
    
    if (!settings || !settings.slackEnabled || !settings.slackNotifyCallLogs || !settings.slackWebhookUrl) {
      return false;
    }
    
    // Cast the template to string | undefined to handle null values
    const template = settings.slackCallLogTemplate ? settings.slackCallLogTemplate : undefined;
    const message = this.formatCallLogNotification(callLog, template);
    return this.sendSlackMessage(message, settings.slackWebhookUrl);
  }
  
  // Notify about low stock
  async notifyLowStock(product: Product): Promise<boolean> {
    const settings = await this.getNotificationSettings();
    
    if (!settings || !settings.slackEnabled || !settings.slackNotifyLowStock || !settings.slackWebhookUrl) {
      return false;
    }
    
    // Cast the template to string | undefined to handle null values
    const template = settings.slackLowStockTemplate ? settings.slackLowStockTemplate : undefined;
    const message = this.formatLowStockNotification(product, template);
    return this.sendSlackMessage(message, settings.slackWebhookUrl);
  }
  
  // Test Slack webhook connection
  async testConnection(webhookUrl: string): Promise<boolean> {
    const testMessage: SlackMessage = {
      text: "👋 Testing connection from Warehouse Management System",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "👋 *Connection test successful!*\nYour Warehouse Management System is now connected to Slack."
          }
        }
      ]
    };
    
    return this.sendSlackMessage(testMessage, webhookUrl);
  }
}

// Function to create the service instance
export function createSlackService(storage: IStorage): SlackNotificationService {
  return new SlackNotificationService(storage);
}