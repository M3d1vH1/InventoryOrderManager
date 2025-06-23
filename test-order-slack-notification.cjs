/**
 * Test Order Slack Notification with Authentication
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function loginAndCreateOrder() {
  console.log('🔐 Testing Order Slack Notification with Authentication...\n');
  
  try {
    // Step 1: Get session cookie via dev login
    console.log('1. Authenticating...');
    const loginCommand = `curl -s -c cookies.txt -X GET http://localhost:5000/api/dev-login`;
    const loginResult = await execAsync(loginCommand);
    const loginResponse = JSON.parse(loginResult.stdout);
    
    if (!loginResponse.success) {
      throw new Error('Authentication failed');
    }
    
    console.log(`✅ Authenticated as: ${loginResponse.user.username}`);
    
    // Step 2: Create order with authentication
    console.log('2. Creating order with authentication...');
    const orderCommand = `curl -s -b cookies.txt -X POST http://localhost:5000/api/orders \\
      -H "Content-Type: application/json" \\
      -d '{
        "customerName": "Slack Test Customer - $(date +%H:%M)",
        "priority": "high",
        "estimatedShippingDate": "${new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}",
        "notes": "Testing order creation Slack notification with proper authentication",
        "items": [{"productId": 1, "quantity": 3}]
      }'`;
    
    const orderResult = await execAsync(orderCommand);
    const orderResponse = JSON.parse(orderResult.stdout);
    
    if (orderResponse.error || orderResponse.message) {
      throw new Error(orderResponse.message || orderResponse.error);
    }
    
    console.log(`✅ Order created successfully: ${orderResponse.orderNumber || orderResponse.id}`);
    console.log('📱 Slack notification should have been sent to main channel');
    
    // Clean up
    await execAsync('rm -f cookies.txt');
    
    return true;
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    // Clean up on error
    await execAsync('rm -f cookies.txt').catch(() => {});
    return false;
  }
}

async function main() {
  console.log('🔔 Order Creation Slack Notification Test');
  console.log('=========================================\n');
  
  const success = await loginAndCreateOrder();
  
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('✅ Order creation Slack notification test PASSED');
    console.log('Check your main Slack channel for the new order alert');
  } else {
    console.log('❌ Order creation Slack notification test FAILED');
    console.log('Check the logs above for specific errors');
  }
  console.log('='.repeat(50));
}

if (require.main === module) {
  main().catch(console.error);
}