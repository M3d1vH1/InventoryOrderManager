/**
 * Test Order Status Notifications
 * This script tests the fixed Slack notification system for order status changes
 */

const express = require('express');

async function testOrderStatusNotifications() {
  try {
    const baseUrl = process.env.APP_URL || 'http://localhost:5000';
    
    console.log('🧪 Testing Order Status Notifications...');
    console.log('==========================================\n');
    
    // Test 1: Get an existing order to update its status
    console.log('📋 Step 1: Finding an existing order...');
    const ordersResponse = await fetch(`${baseUrl}/api/orders`);
    const orders = await ordersResponse.json();
    
    if (!orders || orders.length === 0) {
      console.log('❌ No orders found. Please create an order first.');
      return;
    }
    
    const testOrder = orders.find(order => order.status === 'pending') || orders[0];
    console.log(`✅ Found order: ${testOrder.orderNumber} (Status: ${testOrder.status})`);
    
    // Test 2: Check current notification settings
    console.log('\n📊 Step 2: Checking notification settings...');
    const settingsResponse = await fetch(`${baseUrl}/api/settings/notifications`);
    const settings = await settingsResponse.json();
    
    console.log(`Slack enabled: ${settings.slackEnabled}`);
    console.log(`Order picked notifications: ${settings.slackNotifyOrderPicked}`);
    console.log(`Order shipped notifications: ${settings.slackNotifyOrderShipped}`);
    console.log(`Webhook configured: ${!!settings.slackWebhookUrl}`);
    
    if (!settings.slackEnabled || !settings.slackWebhookUrl) {
      console.log('⚠️  Slack notifications not properly configured. Enabling for test...');
      
      // Enable notifications for testing
      const enableResponse = await fetch(`${baseUrl}/api/settings/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          slackEnabled: true,
          slackNotifyOrderPicked: true,
          slackNotifyOrderShipped: true,
          slackWebhookUrl: settings.slackWebhookUrl || 'https://hooks.slack.com/test/webhook'
        })
      });
      
      if (enableResponse.ok) {
        console.log('✅ Notifications enabled for testing');
      }
    }
    
    // Test 3: Update order status to "picked" (should trigger ✅ icon notification)
    console.log('\n✅ Step 3: Testing "picked" status notification...');
    const pickedResponse = await fetch(`${baseUrl}/api/orders/${testOrder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'picked'
      })
    });
    
    if (pickedResponse.ok) {
      console.log('✅ Order marked as picked - check Slack for ✅ icon notification');
      console.log('Expected message format: "✅ *Order Picked*"');
    } else {
      console.log(`❌ Failed to update order to picked: ${pickedResponse.statusText}`);
    }
    
    // Wait a moment before next test
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 4: Update order status to "shipped" (should trigger 🚚 icon notification)
    console.log('\n🚚 Step 4: Testing "shipped" status notification...');
    const shippedResponse = await fetch(`${baseUrl}/api/orders/${testOrder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'shipped'
      })
    });
    
    if (shippedResponse.ok) {
      console.log('✅ Order marked as shipped - check Slack for 🚚 icon notification');
      console.log('Expected message format: "🚚 *Order Shipped*"');
    } else {
      console.log(`❌ Failed to update order to shipped: ${shippedResponse.statusText}`);
    }
    
    console.log('\n🎉 Test completed! Check your Slack channel for:');
    console.log('1. ✅ Order Picked notification with checkmark icon');
    console.log('2. 🚚 Order Shipped notification with truck icon');
    console.log('\nIf you see these distinct messages with different icons, the fix is working correctly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testOrderStatusNotifications();