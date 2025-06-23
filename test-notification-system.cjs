/**
 * Comprehensive Notification System Test
 * Tests all notification triggers by creating actual data that should trigger Slack notifications
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const BASE_URL = 'http://localhost:5000';

async function testNotificationTriggers() {
  console.log('Testing Notification System - Creating Real Data to Trigger Notifications\n');
  
  const tests = [
    {
      name: 'Order Creation (Main Webhook)',
      description: 'Creating a new order should trigger main Slack webhook',
      command: `curl -s -X POST ${BASE_URL}/api/orders -H "Content-Type: application/json" -d '{
        "customerName": "Notification Test Customer",
        "priority": "high",
        "notes": "Test order for notification system validation",
        "items": [{"productId": 1, "quantity": 2}]
      }'`
    },
    
    {
      name: 'Invoice Creation (Finance Webhook)',
      description: 'Creating a supplier invoice should trigger finance Slack webhook',
      command: `curl -s -X POST ${BASE_URL}/api/invoices -H "Content-Type: application/json" -d '{
        "supplierName": "Test Supplier for Notifications",
        "invoiceNumber": "INV-NOTIF-TEST-${Date.now()}",
        "invoiceDate": "${new Date().toISOString().split('T')[0]}",
        "totalAmount": 1500.00,
        "currency": "EUR",
        "description": "Test invoice for notification validation"
      }'`
    },
    
    {
      name: 'Payment Creation (Finance Webhook)',
      description: 'Creating a supplier payment should trigger finance Slack webhook',
      command: `curl -s -X POST ${BASE_URL}/api/payments -H "Content-Type: application/json" -d '{
        "supplierName": "Test Supplier for Notifications",
        "invoiceNumber": "INV-NOTIF-TEST-${Date.now()}",
        "amount": 750.50,
        "currency": "EUR",
        "paymentMethod": "bank_transfer",
        "description": "Test payment for notification validation",
        "paymentDate": "${new Date().toISOString().split('T')[0]}"
      }'`
    }
  ];
  
  console.log('Running notification trigger tests...\n');
  
  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    console.log(`Expected: ${test.description}`);
    
    try {
      const { stdout, stderr } = await execAsync(test.command);
      
      if (stderr) {
        console.log(`❌ Error: ${stderr}`);
        continue;
      }
      
      try {
        const response = JSON.parse(stdout);
        if (response.id || response.orderNumber || response.invoiceNumber) {
          console.log(`✅ Success: Created ${test.name.split(' ')[0].toLowerCase()} successfully`);
          console.log(`   Data: ${JSON.stringify(response, null, 2).substring(0, 100)}...`);
        } else {
          console.log(`⚠️ Warning: Unexpected response format`);
          console.log(`   Response: ${stdout.substring(0, 100)}...`);
        }
      } catch (parseError) {
        console.log(`⚠️ Non-JSON response: ${stdout.substring(0, 100)}...`);
      }
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
    
    console.log('');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds between tests
  }
  
  console.log('='.repeat(70));
  console.log('Notification Test Summary');
  console.log('='.repeat(70));
  console.log('All tests completed. Check your Slack channels:');
  console.log('• Main Slack Channel: Should have received order notifications');
  console.log('• Finance Slack Channel: Should have received invoice and payment notifications');
  console.log('');
  console.log('If notifications were not received, check:');
  console.log('1. Webhook URLs are correctly configured in Settings');
  console.log('2. Slack webhook URLs are valid and accessible');
  console.log('3. Application logs for any error messages');
}

// Test webhook configuration
async function testWebhookConfig() {
  console.log('Testing Webhook Configuration...\n');
  
  try {
    const { stdout } = await execAsync(`curl -s ${BASE_URL}/api/settings/notifications`);
    const settings = JSON.parse(stdout);
    
    console.log('Current Notification Settings:');
    console.log(`• Slack Webhook URL: ${settings.slackWebhookUrl ? 'Configured ✅' : 'Missing ❌'}`);
    console.log(`• Finance Webhook URL: ${settings.slackFinanceWebhookUrl ? 'Configured ✅' : 'Missing ❌'}`);
    console.log(`• Order Notifications: ${settings.orderNotifications ? 'Enabled ✅' : 'Disabled ❌'}`);
    console.log(`• Invoice Notifications: ${settings.invoiceNotifications ? 'Enabled ✅' : 'Disabled ❌'}`);
    console.log(`• Payment Notifications: ${settings.paymentNotifications ? 'Enabled ✅' : 'Disabled ❌'}`);
    
  } catch (error) {
    console.log(`❌ Could not retrieve notification settings: ${error.message}`);
  }
}

// Main execution
async function main() {
  console.log('🔔 Notification System Validation Test\n');
  
  if (process.argv[2] === 'config') {
    await testWebhookConfig();
  } else {
    await testWebhookConfig();
    console.log('');
    await testNotificationTriggers();
  }
  
  console.log('\n📝 Test completed. Review Slack channels for notifications.');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testNotificationTriggers, testWebhookConfig };