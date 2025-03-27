import axios from 'axios';
import { Order, CallLog, NotificationSettings } from '../../../shared/schema';
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
  
  // Format order for Slack notification
  private formatOrderNotification(order: Order): SlackMessage {
    return {
      text: `New Order #${order.orderNumber} received from ${order.customerName}`,
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
              text: `*Order Number:*\n#${order.orderNumber}`
            },
            {
              type: "mrkdwn",
              text: `*Customer:*\n${order.customerName}`
            }
          ]
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Date:*\n${new Date(order.orderDate).toLocaleString()}`
            },
            {
              type: "mrkdwn",
              text: `*Status:*\n${order.status}`
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
              url: `${process.env.APP_URL || ''}/orders/${order.id}`,
              value: `view_order_${order.id}`
            }
          ]
        }
      ]
    };
  }
  
  // Format call log for Slack notification
  private formatCallLogNotification(callLog: CallLog): SlackMessage {
    const formattedDate = callLog.callDate ? new Date(callLog.callDate).toLocaleString() : 'Not specified';
    
    return {
      text: `New call log recorded with ${callLog.contactName}, purpose: ${callLog.callPurpose}`,
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
              text: `*Contact:*\n${callLog.contactName}`
            },
            {
              type: "mrkdwn",
              text: `*Company:*\n${callLog.companyName || 'Not specified'}`
            }
          ]
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Call Type:*\n${callLog.callType}`
            },
            {
              type: "mrkdwn",
              text: `*Purpose:*\n${callLog.callPurpose}`
            }
          ]
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Date:*\n${formattedDate}`
            },
            {
              type: "mrkdwn",
              text: `*Priority:*\n${callLog.priority}`
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
            text: `*Notes:*\n${callLog.notes || 'No notes provided'}`
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
              url: `${process.env.APP_URL || ''}/call-logs/${callLog.id}`,
              value: `view_call_log_${callLog.id}`
            }
          ]
        }
      ]
    };
  }
  
  // Notify about a new order
  async notifyNewOrder(order: Order): Promise<boolean> {
    const settings = await this.getNotificationSettings();
    
    if (!settings || !settings.slackEnabled || !settings.slackNotifyNewOrders || !settings.slackWebhookUrl) {
      return false;
    }
    
    const message = this.formatOrderNotification(order);
    return this.sendSlackMessage(message, settings.slackWebhookUrl);
  }
  
  // Notify about a new call log
  async notifyNewCallLog(callLog: CallLog): Promise<boolean> {
    const settings = await this.getNotificationSettings();
    
    if (!settings || !settings.slackEnabled || !settings.slackNotifyCallLogs || !settings.slackWebhookUrl) {
      return false;
    }
    
    const message = this.formatCallLogNotification(callLog);
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