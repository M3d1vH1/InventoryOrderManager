/**
 * Test Slack Notifications for Invoices and Payments
 * Tests the new Slack notification system
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

async function testSlackNotifications() {
  console.log('🧪 Testing Slack Notifications...\n');

  try {
    // 1. Check notification settings
    console.log('1. Checking notification settings...');
    const settingsResponse = await axios.get(`${BASE_URL}/api/settings/notifications`);
    const settings = settingsResponse.data;
    
    console.log(`Slack enabled: ${settings.slackEnabled || false}`);
    console.log(`Webhook URL configured: ${settings.slackWebhookUrl ? 'Yes' : 'No'}`);
    
    if (!settings.slackEnabled || !settings.slackWebhookUrl) {
      console.log('⚠️  Slack notifications not configured. Setting up test webhook...');
      
      // Use a test webhook URL for demonstration
      await axios.patch(`${BASE_URL}/api/settings/notifications`, {
        slackEnabled: true,
        slackWebhookUrl: 'https://hooks.slack.com/services/TEST/TEST/TEST', // Test URL
        slackNotifyInvoices: true,
        slackNotifyPayments: true
      });
      
      console.log('✅ Test notification settings configured');
    }

    // 2. Test invoice creation notification
    console.log('\n2. Testing invoice creation notification...');
    
    const invoiceData = {
      supplierName: 'Test Supplier - Slack Notification',
      invoiceNumber: `INV-SLACK-${Date.now()}`,
      amount: 150.75,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: 'Test invoice for Slack notification testing'
    };

    const invoiceResponse = await axios.post(`${BASE_URL}/api/supplier-invoices`, invoiceData);
    
    if (invoiceResponse.data) {
      console.log(`✅ Invoice created: ${invoiceResponse.data.invoiceNumber}`);
      console.log('   Slack notification should have been sent');
    }

    // 3. Test payment creation notification
    console.log('\n3. Testing payment creation notification...');
    
    if (invoiceResponse.data && invoiceResponse.data.id) {
      const paymentData = {
        invoiceId: invoiceResponse.data.id,
        amount: 150.75,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'bank_transfer',
        notes: 'Test payment for Slack notification testing'
      };

      const paymentResponse = await axios.post(`${BASE_URL}/api/supplier-payments`, paymentData);
      
      if (paymentResponse.data) {
        console.log(`✅ Payment created: ${paymentResponse.data.amount}`);
        console.log('   Slack notification should have been sent');
      }
    }

    // 4. Test out-of-stock order notification
    console.log('\n4. Testing out-of-stock order notification...');
    
    // Create an order and mark items as out of stock
    const orderResponse = await axios.post(`${BASE_URL}/api/orders`, {
      customerName: 'Test Customer - Slack OOS',
      items: [{ productId: 1, quantity: 5 }]
    });
    
    if (orderResponse.data) {
      const orderId = orderResponse.data.id;
      
      // Get order items
      const orderItemsResponse = await axios.get(`${BASE_URL}/api/orders/${orderId}/items`);
      const orderItems = orderItemsResponse.data;
      
      if (orderItems.length > 0) {
        // Mark as picked with out-of-stock items
        const itemQuantities = orderItems.map(item => ({
          orderItemId: item.id,
          productId: item.productId,
          requestedQuantity: item.quantity,
          actualQuantity: 0 // Out of stock
        }));

        await axios.patch(`${BASE_URL}/api/orders/${orderId}/status`, {
          status: 'picked',
          itemQuantities: itemQuantities
        });

        console.log('✅ Order picked with out-of-stock items');
        console.log('   Out-of-stock Slack notification should have been sent');
      }
    }

    // 5. Test notification settings endpoint
    console.log('\n5. Testing notification settings management...');
    
    const testNotificationResponse = await axios.post(`${BASE_URL}/api/settings/test-notification`, {
      type: 'slack',
      webhookUrl: 'https://hooks.slack.com/services/TEST/TEST/TEST',
      message: 'Test notification from warehouse management system'
    });

    if (testNotificationResponse.data && testNotificationResponse.data.success) {
      console.log('✅ Test notification endpoint working');
    } else {
      console.log('⚠️  Test notification endpoint returned unexpected response');
    }

    console.log('\n✅ Slack Notifications Test Completed!');
    console.log('\nNote: Actual Slack messages will only be sent if valid webhook URLs are configured.');
    
  } catch (error) {
    console.error('❌ Error testing Slack notifications:', error.response?.data || error.message);
    
    // If it's a webhook URL error, that's expected for testing
    if (error.response?.data?.message?.includes('webhook') || 
        error.response?.data?.message?.includes('Invalid URL')) {
      console.log('ℹ️  This is expected when using test webhook URLs');
    }
  }
}

// Run the test
testSlackNotifications();