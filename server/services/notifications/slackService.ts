import axios from 'axios';
import { Order, CallLog, NotificationSettings, Product } from '../../../shared/schema';
import { IStorage } from '../../storage';

interface SlackMessage {
  text: string;
  blocks?: any[];
}

export class SlackNotificationService {
  private storage: IStorage;
  
  constructor(storage: IStorage) {
    this.storage = storage;
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
      
      await axios.post(webhookUrl, message, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      return false;
    }
  }
  
  // Apply template with data
  private applyTemplate(template: string, data: Record<string, any>): SlackMessage {
    try {
      // Determine if template is a JSON string or a plain text template
      let parsedTemplate: SlackMessage;
      let isJsonTemplate = false;
      
      try {
        parsedTemplate = JSON.parse(template);
        isJsonTemplate = true;
      } catch (e) {
        // Not a JSON string, treat as plain text template
        isJsonTemplate = false;
      }
      
      if (isJsonTemplate) {
        // It's a JSON template - replace variables in the parsed object
        let templateStr = template;
        
        // Replace all template variables with actual data
        Object.entries(data).forEach(([key, value]) => {
          const regex = new RegExp(`{${key}}`, 'g');
          templateStr = templateStr.replace(regex, String(value ?? ''));
        });
        
        // Parse the template as JSON after variable replacement
        return JSON.parse(templateStr);
      } else {
        // It's a plain text template - create a simple message with replaced variables
        let messageText = template;
        
        // Replace all template variables with actual data
        Object.entries(data).forEach(([key, value]) => {
          const regex = new RegExp(`{${key}}`, 'g');
          messageText = messageText.replace(regex, String(value ?? ''));
        });
        
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
    
    // Get the order items to calculate the total items (if not available directly)
    let totalItems = (order as any).totalItems || 0;
    let totalValue = (order as any).totalPrice || 0;
    let shippingAddress = (order as any).shippingAddress || '';
    
    // Prepare data for template variables
    const data = {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      orderDate: new Date(order.orderDate).toLocaleString(),
      status: order.status,
      totalItems: totalItems,
      totalValue: typeof totalValue === 'number' ? totalValue.toFixed(2) : '0.00',
      shippingAddress: shippingAddress,
      notes: order.notes || 'No notes',
      appUrl: process.env.APP_URL || '',
    };
    
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
      companyName: callLog.companyName || 'Not specified',
      callType: callLog.callType,
      callPurpose: callLog.callPurpose,
      callDate: callLog.callDate ? new Date(callLog.callDate).toLocaleString() : 'Not specified',
      priority: callLog.priority,
      notes: callLog.notes || 'No notes provided',
      appUrl: process.env.APP_URL || '',
    };
    
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
      sku: product.sku,
      currentStock: product.currentStock,
      reorderLevel: reorderLevel,
      location: product.location || 'Not specified',
      category: categoryName,
      appUrl: process.env.APP_URL || '',
    };
    
    return this.applyTemplate(template || defaultTemplate, data);
  }
  
  // Notify about a new order
  async notifyNewOrder(order: Order): Promise<boolean> {
    const settings = await this.getNotificationSettings();
    
    if (!settings || !settings.slackEnabled || !settings.slackNotifyNewOrders || !settings.slackWebhookUrl) {
      return false;
    }
    
    // Cast the template to string | undefined to handle null values
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