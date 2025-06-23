/**
 * Individual Notification Trigger Tests
 * Tests each notification type separately with simple curl commands
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const BASE_URL = 'http://localhost:5000';

// Test helper function
async function testTrigger(description, curlCommand) {
  console.log(`\n${description}`);
  console.log('Command:', curlCommand);
  
  try {
    const { stdout, stderr } = await execAsync(curlCommand);
    
    if (stderr) {
      console.log('⚠️ Error:', stderr);
      return false;
    }
    
    const response = JSON.parse(stdout);
    console.log('✅ Success:', JSON.stringify(response, null, 2));
    return true;
  } catch (error) {
    console.log('❌ Failed:', error.message);
    return false;
  }
}

async function runIndividualTests() {
  console.log('🧪 Testing Individual Notification Triggers\n');
  
  const tests = [
    {
      name: '1. Test Order Creation (should trigger main webhook)',
      command: `curl -s -X POST ${BASE_URL}/api/orders \\
        -H "Content-Type: application/json" \\
        -d '{
          "customerName": "Test Customer",
          "priority": "high",
          "notes": "Test order for webhook notification",
          "items": [{"productId": 1, "quantity": 2}]
        }'`
    },
    
    {
      name: '2. Test Call Log Creation (should trigger main webhook)',
      command: `curl -s -X POST ${BASE_URL}/api/call-logs \\
        -H "Content-Type: application/json" \\
        -d '{
          "companyName": "Test Company",
          "contactName": "John Doe",
          "callPurpose": "Order inquiry",
          "notes": "Test call log",
          "priority": "high"
        }'`
    },
    
    {
      name: '3. Test Invoice Creation (should trigger finance webhook)',
      command: `curl -s -X POST ${BASE_URL}/api/invoices \\
        -H "Content-Type: application/json" \\
        -d '{
          "supplierName": "Test Supplier",
          "invoiceNumber": "INV-TEST-001",
          "totalAmount": 1000,
          "currency": "EUR",
          "description": "Test invoice"
        }'`
    },
    
    {
      name: '4. Test Payment Creation (should trigger finance webhook)',
      command: `curl -s -X POST ${BASE_URL}/api/payments \\
        -H "Content-Type: application/json" \\
        -d '{
          "supplierName": "Test Supplier",
          "amount": 500,
          "currency": "EUR",
          "paymentMethod": "bank_transfer",
          "description": "Test payment"
        }'`
    },
    
    {
      name: '5. Test Low Stock Alert (manual trigger)',
      command: `curl -s -X POST ${BASE_URL}/api/test/low-stock-alert \\
        -H "Content-Type: application/json" \\
        -d '{
          "productName": "Test Product",
          "sku": "TEST-001",
          "currentStock": 2,
          "minStockLevel": 10
        }'`
    }
  ];
  
  console.log('Testing notification triggers without authentication...\n');
  
  const results = [];
  
  for (const test of tests) {
    const result = await testTrigger(test.name, test.command);
    results.push({ name: test.name, success: result });
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Results Summary:');
  console.log('='.repeat(60));
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name.split('.')[1]}`);
  });
  
  console.log('\n🔔 Check your Slack channels for notifications');
  console.log('📝 Note: Some tests may fail due to authentication requirements');
}

// Create a simple manual test function
async function testSimpleNotification() {
  console.log('🧪 Testing Simple Notification Trigger\n');
  
  // Test webhook directly using the test endpoint
  const testCommand = `curl -s -X POST ${BASE_URL}/api/settings/test-webhook \\
    -H "Content-Type: application/json" \\
    -d '{"message": "Manual notification test from trigger test script"}'`;
  
  console.log('Testing webhook endpoint directly...');
  console.log('Command:', testCommand);
  
  try {
    const { stdout, stderr } = await execAsync(testCommand);
    
    if (stderr) {
      console.log('⚠️ Error:', stderr);
      return;
    }
    
    const response = JSON.parse(stdout);
    console.log('✅ Webhook test result:', JSON.stringify(response, null, 2));
    console.log('\n📱 Check your Slack channel for the test message!');
    
  } catch (error) {
    console.log('❌ Webhook test failed:', error.message);
  }
}

// Check if individual endpoints exist
async function checkEndpoints() {
  console.log('🔍 Checking API Endpoints\n');
  
  const endpoints = [
    '/api/orders',
    '/api/call-logs', 
    '/api/invoices',
    '/api/payments',
    '/api/settings/test-webhook'
  ];
  
  for (const endpoint of endpoints) {
    const command = `curl -s -o /dev/null -w "%{http_code}" ${BASE_URL}${endpoint}`;
    
    try {
      const { stdout } = await execAsync(command);
      const statusCode = stdout.trim();
      
      if (statusCode === '200' || statusCode === '405' || statusCode === '401') {
        console.log(`✅ ${endpoint}: Available (${statusCode})`);
      } else {
        console.log(`❌ ${endpoint}: Not available (${statusCode})`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint}: Error - ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Notification Trigger Testing Suite\n');
  
  if (process.argv[2] === 'check') {
    await checkEndpoints();
  } else if (process.argv[2] === 'webhook') {
    await testSimpleNotification();
  } else {
    await runIndividualTests();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runIndividualTests, testSimpleNotification, checkEndpoints };