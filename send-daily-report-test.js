import fetch from 'node-fetch';

async function sendTestDailyReport() {
  console.log('Testing daily report with real Slack webhook...');
  
  const webhookUrl = 'https://hooks.slack.com/services/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';
  
  // Sample daily report based on your actual warehouse data
  const reportMessage = `📊 *Daily Operations Report* - ${new Date().toLocaleDateString('en-GB')}

📦 **Order Summary:**
• New Orders: 3
• Picked Orders: 8  
• Shipped Orders: 12
• Outstanding Orders: 28

🔍 **Outstanding Orders:**
• ORD-0270 (ACME Corp)
• ORD-0271 (Tech Solutions Ltd)
• ORD-0272 (Industrial Supplies)
• ORD-0273 (Manufacturing Co)
• ORD-0274 (Retail Chain)
...and 23 more

📋 Full details: https://amphoreus.replit.app/orders
Generated at ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/Athens' })}`;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: reportMessage,
        username: 'Warehouse Daily Report',
        icon_emoji: ':warehouse:'
      })
    });
    
    if (response.ok) {
      console.log('✅ Daily report sent successfully to Slack!');
      console.log('📧 Response status:', response.status);
      return true;
    } else {
      const responseText = await response.text();
      console.log('❌ Failed to send report');
      console.log('📧 Status:', response.status, response.statusText);
      console.log('📄 Response:', responseText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error sending daily report:', error.message);
    return false;
  }
}

sendTestDailyReport();