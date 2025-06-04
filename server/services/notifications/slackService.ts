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
    // Configure robust HTTP client with Slack-specific settings
    this.httpClient = new RobustHttpClient(
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Warehouse-Management-System/1.0'
        }
      },
      {
        timeout: 15000, // 15 seconds for Slack webhooks
        maxRetries: 3,
        retryDelay: 2000, // 2 seconds initial delay
        maxRetryDelay: 30000, // 30 seconds max delay
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
        onRetry: (attempt, error) => {
          console.log(`Slack notification retry attempt ${attempt}: ${error.message}`);
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
  
  // Send a message to Slack
  private async sendSlackMessage(message: SlackMessage, webhookUrl: string): Promise<boolean> {
    try {
      if (!webhookUrl) {
        console.error('No Slack webhook URL provided');
        return false;
      }
      
      console.log('Sending Slack message to webhook URL:', webhookUrl);
      console.log('Message payload:', JSON.stringify(message, null, 2));
      
      const response = await this.httpClient.post(webhookUrl, message);
      
      console.log('Slack API response status:', response.status, response.statusText);
      console.log('Slack API response data:', response.data || 'No response data');
      
      return true;
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      if (error instanceof HttpRequestError) {
        console.error('Robust HTTP client error details:', {
          statusCode: error.statusCode,
          attempts: error.attempts,
          isTimeout: error.isTimeout,
          isNetworkError: error.isNetworkError,
          message: error.message
        });
      }
      return false;
    }
  }
  
  // Apply template with data
  private applyTemplate(template: string, data: Record<string, any>): SlackMessage {
    try {
      // Log the incoming template and data
      console.log('Applying template:', template ? template.substring(0, 100) + '...' : 'undefined');
      console.log('With data:', JSON.stringify(data));
      console.log('totalItems value in applyTemplate:', data.totalItems);

      // Determine if template is a JSON string or a plain text template
      let isJsonTemplate = false;
      
      try {
        const test = JSON.parse(template);
        isJsonTemplate = test && typeof test === 'object';
        console.log('Detected JSON template');
      } catch (e) {
        console.log('Detected plain text template');
        isJsonTemplate = false;
      }
      
      if (isJsonTemplate) {
        // It's a JSON template - replace variables in the string first, then parse
        let templateStr = template;
        
        // Replace all template variables with actual data
        Object.entries(data).forEach(([key, value]) => {
          const regex = new RegExp(`\\{${key}\\}`, 'g');
          const strValue = value !== undefined && value !== null ? String(value) : '';
          templateStr = templateStr.replace(regex, strValue);
        });
        
        console.log('JSON template after variable replacement:', templateStr.substring(0, 100) + '...');
        
        // Parse the template as JSON after variable replacement
        try {
          return JSON.parse(templateStr);
        } catch (error) {
          console.error('Error parsing JSON template after replacement:', error);
          // If JSON parsing fails after replacement, fall back to plain text
          return {
            text: templateStr
          };
        }
      } else {
        // It's a plain text template - create a simple message with replaced variables
        let messageText = template;
        
        // Replace all template variables with actual data
        Object.entries(data).forEach(([key, value]) => {
          const regex = new RegExp(`\\{${key}\\}`, 'g');
          const strValue = value !== undefined && value !== null ? String(value) : '';
          messageText = messageText.replace(regex, strValue);
        });
        
        console.log('Plain text template after variable replacement:', messageText);
        
        return {
          text: messageText
        };
      }
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
    // Default template if none is provided
    const defaultTemplate = JSON.stringify({
      text: `New Order #{orderNumber} received from {customerName}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🛒 New Order Received",
            emoji: true
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*Order Number:*\n#{orderNumber}"
            },
            {
              type: "mrkdwn",
              text: "*Customer:*\n{customerName}"
            }
          ]
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: "*Date:*\n{orderDate}"
            },
            {
              type: "mrkdwn",
              text: "*Status:*\n{status}"
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
                text: "View Order",
                emoji: true
              },
              url: "{appUrl}/orders/{id}",
              value: "view_order_{id}"
            }
          ]
        }
      ]
    });
    
    // Log incoming order object to see what properties are available
    console.log('Raw order object in formatOrderNotification:', JSON.stringify(order));
    console.log('totalItems from order object:', (order as any).totalItems);
    
    // Get the order items to calculate the total items (if not available directly)
    let totalItems = (order as any).totalItems || 0;
    let totalPrice = (order as any).totalPrice || 0;
    let shippingAddress = (order as any).shippingAddress || '';
    
    // Force totalItems to use the value from the incoming order object 
    // and set a default of 1 if it's missing or zero (orders must have at least one item)
    totalItems = typeof (order as any).totalItems === 'number' ? (order as any).totalItems : 
                (totalItems > 0 ? totalItems : 1);
    
    // Prepare data for template variables
    const data = {
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.customerName, // Both customer and customerName for flexibility
      customerName: order.customerName,
      orderDate: new Date(order.orderDate).toLocaleString(),
      status: order.status,
      priority: order.priority || 'medium', // Add priority field with default
      items: (order as any).items || 'Unknown items',
      totalItems: totalItems, // Use the forced value we determined above
      total: typeof totalPrice === 'number' ? `$${totalPrice.toFixed(2)}` : '$0.00',
      totalPrice: typeof totalPrice === 'number' ? `$${totalPrice.toFixed(2)}` : '$0.00',
      totalValue: typeof totalPrice === 'number' ? `$${totalPrice.toFixed(2)}` : '$0.00',
      shippingAddress: shippingAddress,
      notes: order.notes || 'No notes',
      appUrl: process.env.APP_URL || '',
    };
    
    console.log('Order notification data:', data);
    console.log('Order template:', template);
    
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
    console.log('Starting Slack notification process for order:', order.orderNumber);
    
    const settings = await this.getNotificationSettings();
    
    if (!settings || !settings.slackEnabled || !settings.slackNotifyNewOrders || !settings.slackWebhookUrl) {
      console.log('Slack notification skipped: either not enabled or missing webhook URL', {
        enabled: settings?.slackEnabled,
        notifyNewOrders: settings?.slackNotifyNewOrders,
        hasWebhookUrl: !!settings?.slackWebhookUrl
      });
      return false;
    }
    
    console.log('Notification settings for order notification:', {
      slackEnabled: settings.slackEnabled,
      slackNotifyNewOrders: settings.slackNotifyNewOrders,
      hasWebhookUrl: !!settings.slackWebhookUrl,
      hasOrderTemplate: !!settings.slackOrderTemplate
    });
    
    console.log('About to send slack notification for order');
    
    // Always fetch the order items to get the most accurate count
    try {
      const orderItems = await this.storage.getOrderItems(order.id);
      console.log(`Found ${orderItems.length} items for order ${order.orderNumber}`);
      
      // Calculate total items and total price
      const totalItems = orderItems.length;
      
      // Add these properties to the order object
      (order as any).totalItems = totalItems;
      (order as any).items = totalItems > 0 
        ? `${totalItems} item${totalItems !== 1 ? 's' : ''}` 
        : 'No items';
      
      console.log(`Order now has totalItems=${totalItems}`);
      
    } catch (error) {
      console.error(`Error getting order items for notification: ${error}`);
      // Set default values if we can't get the items
      (order as any).totalItems = 0;
      (order as any).items = 'No items';
    }
    
    // Log the notification settings and order data
    console.log('Order template:', settings.slackOrderTemplate);
    
    // Explicitly fetch the template from the database again to ensure we have the latest
    try {
      const freshSettings = await this.storage.getNotificationSettings();
      if (freshSettings && freshSettings.slackOrderTemplate) {
        console.log('Using freshly fetched template:', freshSettings.slackOrderTemplate);
        const message = this.formatOrderNotification(order, freshSettings.slackOrderTemplate);
        return this.sendSlackMessage(message, settings.slackWebhookUrl);
      }
    } catch (error) {
      console.error('Error fetching fresh notification settings:', error);
    }
    
    // Fall back to the original template if needed
    const template = settings.slackOrderTemplate ? settings.slackOrderTemplate : undefined;
    const message = this.formatOrderNotification(order, template);
    return this.sendSlackMessage(message, settings.slackWebhookUrl);
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