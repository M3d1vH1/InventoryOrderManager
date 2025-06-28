import { DatabaseStorage } from './server/storage.postgresql.js';
import { db } from './server/db.js';

async function testDailyReportSystem() {
  console.log('🧪 Testing daily report system...');
  
  try {
    const storage = new DatabaseStorage(db);
    
    // Get notification settings to verify webhook URL persistence
    console.log('\n📋 Checking notification settings...');
    const settings = await storage.getNotificationSettings();
    
    console.log('✅ Daily report enabled:', settings?.dailyReportEnabled);
    console.log('⏰ Daily report time:', settings?.dailyReportTime);
    console.log('🔗 Daily report webhook URL:', settings?.dailyReportWebhookUrl ? 'CONFIGURED' : 'NOT SET');
    
    if (!settings?.dailyReportWebhookUrl) {
      console.log('❌ No daily report webhook URL configured. Please set one in Settings.');
      return;
    }
    
    // Get orders data for the report
    console.log('\n📊 Collecting order metrics...');
    const ordersData = await storage.getOrdersForReport();
    
    console.log('📦 New orders:', ordersData.newOrders?.length || 0);
    console.log('✅ Picked orders:', ordersData.pickedOrders?.length || 0);
    console.log('🚚 Shipped orders:', ordersData.shippedOrders?.length || 0);
    console.log('⏳ Outstanding orders:', ordersData.outstandingOrders?.length || 0);
    
    // Generate the daily report message
    const today = new Date().toLocaleDateString('en-GB');
    const reportMessage = `📊 *Daily Operations Report* - ${today}

📦 **Order Summary:**
• New Orders: ${ordersData.newOrders?.length || 0}
• Picked Orders: ${ordersData.pickedOrders?.length || 0}
• Shipped Orders: ${ordersData.shippedOrders?.length || 0}
• Outstanding Orders: ${ordersData.outstandingOrders?.length || 0}

${ordersData.outstandingOrders?.length > 0 ? `
🔍 **Outstanding Orders:**
${ordersData.outstandingOrders.slice(0, 10).map(order => 
  `• ${order.orderNumber} (${order.customerName.length > 20 ? order.customerName.substring(0, 20) + '...' : order.customerName})`
).join('\n')}${ordersData.outstandingOrders.length > 10 ? `\n...and ${ordersData.outstandingOrders.length - 10} more` : ''}
` : ''}

Generated at ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/Athens' })}`;

    console.log('\n📄 Generated report:');
    console.log('═'.repeat(60));
    console.log(reportMessage);
    console.log('═'.repeat(60));
    
    // Test sending to Slack
    console.log('\n🚀 Sending report to Slack...');
    
    const webhookPayload = {
      text: reportMessage,
      username: 'Warehouse Daily Report',
      icon_emoji: ':warehouse:'
    };
    
    const response = await fetch(settings.dailyReportWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    });
    
    if (response.ok) {
      console.log('✅ Daily report sent to Slack successfully!');
      console.log('📧 Response status:', response.status);
    } else {
      const responseText = await response.text();
      console.log('❌ Failed to send report to Slack');
      console.log('📧 Status:', response.status, response.statusText);
      console.log('📄 Response:', responseText);
    }
    
  } catch (error) {
    console.error('❌ Error during daily report test:', error.message);
    if (error.stack) {
      console.error('📍 Stack trace:', error.stack);
    }
  }
}

testDailyReportSystem();