/**
 * Final Notification Trigger Test - Creates real data to test each notification type
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function testOrderNotification() {
  console.log('Testing Order Notification...');
  
  const command = `curl -s -X POST http://localhost:5000/api/orders \\
    -H "Content-Type: application/json" \\
    -d '{
      "customerName": "Notification Test Customer",
      "priority": "high", 
      "notes": "Test order created by notification system test",
      "items": [{"productId": 1, "quantity": 3}]
    }'`;
  
  try {
    const { stdout } = await execAsync(command);
    const response = JSON.parse(stdout);
    console.log(`✅ Order created: ${response.orderNumber || response.id}`);
    console.log('   → Check main Slack channel for new order notification');
    return true;
  } catch (error) {
    console.log('❌ Order creation failed:', error.message);
    return false;
  }
}

async function testInvoiceNotification() {
  console.log('Testing Invoice Notification...');
  
  const invoiceNumber = `INV-NOTIF-${Date.now()}`;
  const command = `curl -s -X POST http://localhost:5000/api/invoices \\
    -H "Content-Type: application/json" \\
    -d '{
      "supplierName": "Test Notification Supplier",
      "invoiceNumber": "${invoiceNumber}",
      "invoiceDate": "${new Date().toISOString().split('T')[0]}",
      "totalAmount": 2500.00,
      "currency": "EUR",
      "description": "Test invoice for notification validation"
    }'`;
  
  try {
    const { stdout } = await execAsync(command);
    const response = JSON.parse(stdout);
    console.log(`✅ Invoice created: ${response.invoiceNumber || invoiceNumber}`);
    console.log('   → Check finance Slack channel for invoice notification');
    return true;
  } catch (error) {
    console.log('❌ Invoice creation failed:', error.message);
    return false;
  }
}

async function testPaymentNotification() {
  console.log('Testing Payment Notification...');
  
  const paymentRef = `PAY-NOTIF-${Date.now()}`;
  const command = `curl -s -X POST http://localhost:5000/api/payments \\
    -H "Content-Type: application/json" \\
    -d '{
      "supplierName": "Test Notification Supplier",
      "amount": 1250.75,
      "currency": "EUR",
      "paymentMethod": "bank_transfer",
      "description": "Test payment for notification validation",
      "paymentDate": "${new Date().toISOString().split('T')[0]}",
      "referenceNumber": "${paymentRef}"
    }'`;
  
  try {
    const { stdout } = await execAsync(command);
    const response = JSON.parse(stdout);
    console.log(`✅ Payment created: ${response.referenceNumber || paymentRef}`);
    console.log('   → Check finance Slack channel for payment notification');
    return true;
  } catch (error) {
    console.log('❌ Payment creation failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔔 Final Notification System Test');
  console.log('Creating real data to trigger all notification types...\n');
  
  const results = [];
  
  // Test each notification type
  results.push(await testOrderNotification());
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  results.push(await testInvoiceNotification());
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  results.push(await testPaymentNotification());
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Notification Test Results:');
  console.log('='.repeat(60));
  
  const successCount = results.filter(Boolean).length;
  console.log(`✅ ${successCount}/3 notification triggers successful`);
  
  if (successCount === 3) {
    console.log('\n🎉 All notification tests passed!');
    console.log('Check your Slack channels:');
    console.log('• Main channel: Order notification');
    console.log('• Finance channel: Invoice and payment notifications');
  } else {
    console.log('\n⚠️ Some notifications may not have been triggered');
    console.log('Check the logs above for specific errors');
  }
}

if (require.main === module) {
  main().catch(console.error);
}