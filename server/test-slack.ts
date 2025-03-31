import dotenv from 'dotenv';
import { createSlackService, SlackNotificationService } from './services/notifications/slackService';
import { IStorage } from './storage';

// Load environment variables from .env file
dotenv.config();

// Print the APP_URL environment variable
console.log('APP_URL from environment:', process.env.APP_URL);

// Create a mock order
const mockOrder = {
  id: 999,
  orderNumber: 'TEST-001',
  customerName: 'Test Customer',
  orderDate: new Date(),
  status: 'pending',
  notes: 'Test order for Slack notification',
  hasShippingDocument: false,
  isPartialFulfillment: false,
  partialFulfillmentApproved: false,
  partialFulfillmentApprovedById: null,
  partialFulfillmentApprovedAt: null,
  createdById: 1,
  updatedById: null,
  lastUpdated: null,
};

// Mock storage interface for testing
const mockStorage = {
  getNotificationSettings: () => Promise.resolve({
    id: 1,
    slackEnabled: true,
    slackWebhookUrl: 'https://hooks.slack.com/services/TEST',
    slackNotifyNewOrders: true,
    slackOrderTemplate: null,
    // Add other required fields
    lowStockAlerts: true,
    orderConfirmation: true,
    shippingUpdates: true,
    dailyReports: false,
    weeklyReports: true,
    soundEnabled: true,
    slackNotifyCallLogs: true,
    slackNotifyLowStock: true,
    slackCallLogTemplate: null,
    slackLowStockTemplate: null,
    createdAt: new Date(),
    updatedAt: new Date()
  })
};

// Run the test
async function runTest() {
  try {
    console.log('Creating slack service with mock storage');
    
    // Create a Slack service instance
    const slackService = createSlackService(mockStorage as IStorage);
    
    // Directly call the private method using type assertion
    const formatMethod = (slackService as any).formatOrderNotification;
    const message = formatMethod.call(slackService, mockOrder);
    
    console.log('Formatted message:', JSON.stringify(message, null, 2));
    
    // Check if APP_URL was included in message
    if (message.blocks && Array.isArray(message.blocks)) {
      const actionBlock = message.blocks.find((block: any) => block.type === 'actions');
      if (actionBlock && actionBlock.elements && actionBlock.elements.length > 0) {
        const button = actionBlock.elements[0];
        console.log('Button URL:', button.url);
        
        // Check if APP_URL was correctly used
        if (button.url.includes(process.env.APP_URL || '')) {
          console.log('✅ APP_URL correctly used in button URL');
        } else {
          console.log('❌ APP_URL not found in button URL');
        }
      }
    }
    
    console.log('Test completed!');
    process.exit(0);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runTest();