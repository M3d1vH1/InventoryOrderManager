const { DatabaseStorage } = require('./server/storage.postgresql.ts');
const { db } = require('./server/db.ts');

async function testDailyReport() {
  console.log('Testing daily report generation...');
  
  try {
    const storage = new DatabaseStorage(db);
    
    // Get current settings
    const settings = await storage.getNotificationSettings();
    console.log('Daily report enabled:', settings?.dailyReportEnabled);
    console.log('Daily report time:', settings?.dailyReportTime);
    console.log('Daily report webhook URL:', settings?.dailyReportWebhookUrl ? 'SET' : 'NOT SET');
    
    // Get orders for report
    console.log('\nFetching orders for report...');
    const ordersData = await storage.getOrdersForReport();
    console.log('Orders data:', JSON.stringify(ordersData, null, 2));
    
    // Generate report content
    const today = new Date().toISOString().split('T')[0];
    const reportMessage = `📊 *Daily Operations Report* - ${today}

📦 **Order Summary:**
• New Orders: ${ordersData.newOrders.length}
• Picked Orders: ${ordersData.pickedOrders.length}  
• Shipped Orders: ${ordersData.shippedOrders.length}
• Outstanding Orders: ${ordersData.outstandingOrders.length}

${ordersData.outstandingOrders.length > 0 ? `
🔍 **Outstanding Orders:**
${ordersData.outstandingOrders.slice(0, 10).map(order => 
  `• ${order.orderNumber} (${order.customerName})`
).join('\n')}${ordersData.outstandingOrders.length > 10 ? `\n...and ${ordersData.outstandingOrders.length - 10} more` : ''}
` : ''}

Generated at ${new Date().toLocaleString()}`;

    console.log('\nGenerated report:');
    console.log(reportMessage);
    
    // Test sending to Slack if webhook URL is available
    if (settings?.dailyReportWebhookUrl) {
      console.log('\nTesting Slack webhook...');
      
      const webhookPayload = {
        text: reportMessage,
        username: 'Warehouse Bot',
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
      } else {
        console.log('❌ Failed to send to Slack:', response.status, response.statusText);
      }
    } else {
      console.log('⚠️ No webhook URL configured for daily reports');
    }
    
  } catch (error) {
    console.error('❌ ERROR during daily report test:', error);
  }
  
  process.exit(0);
}

// Add fetch polyfill for Node.js
global.fetch = require('node-fetch');

testDailyReport();