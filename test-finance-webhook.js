/**
 * Test Finance Webhook Functionality
 * Tests that invoice and payment notifications use the separate finance webhook
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testFinanceWebhook() {
  console.log('🧪 Testing Finance Webhook Functionality...\n');

  try {
    // Step 1: Login as admin
    console.log('1. Logging in as admin...');
    const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    const cookies = loginResponse.headers['set-cookie'];
    const cookieString = cookies ? cookies.join('; ') : '';
    
    console.log('✅ Login successful\n');

    // Step 2: Get current notification settings
    console.log('2. Getting current notification settings...');
    const settingsResponse = await axios.get(`${BASE_URL}/api/notification-settings`, {
      headers: { Cookie: cookieString }
    });
    
    console.log('Current settings:', {
      slackEnabled: settingsResponse.data.slackEnabled,
      mainWebhook: settingsResponse.data.slackWebhookUrl ? '✅ Set' : '❌ Not set',
      financeWebhook: settingsResponse.data.slackFinanceWebhookUrl ? '✅ Set' : '❌ Not set'
    });
    console.log('');

    // Step 3: Configure test webhooks
    console.log('3. Configuring test webhooks...');
    const testMainWebhook = 'https://hooks.slack.com/test/main/webhook';
    const testFinanceWebhook = 'https://hooks.slack.com/test/finance/webhook';
    
    await axios.post(`${BASE_URL}/api/notification-settings`, {
      slackEnabled: true,
      slackWebhookUrl: testMainWebhook,
      slackFinanceWebhookUrl: testFinanceWebhook,
      slackNotifyInvoices: true,
      slackNotifyPayments: true,
      slackNotifyNewOrders: true
    }, {
      headers: { 
        Cookie: cookieString,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Test webhooks configured');
    console.log(`   Main webhook: ${testMainWebhook}`);
    console.log(`   Finance webhook: ${testFinanceWebhook}\n`);

    // Step 4: Test invoice notification (should use finance webhook)
    console.log('4. Testing invoice notification...');
    
    // First, get suppliers to create a test invoice
    const suppliersResponse = await axios.get(`${BASE_URL}/api/suppliers`, {
      headers: { Cookie: cookieString }
    });
    
    if (suppliersResponse.data.length === 0) {
      console.log('❌ No suppliers found. Creating test supplier...');
      await axios.post(`${BASE_URL}/api/suppliers`, {
        name: 'Test Supplier for Webhook',
        email: 'test@supplier.com',
        phone: '123-456-7890'
      }, {
        headers: { Cookie: cookieString }
      });
      
      // Get suppliers again
      const newSuppliersResponse = await axios.get(`${BASE_URL}/api/suppliers`, {
        headers: { Cookie: cookieString }
      });
      console.log('✅ Test supplier created');
    }
    
    const suppliers = suppliersResponse.data.length > 0 ? suppliersResponse.data : 
                     (await axios.get(`${BASE_URL}/api/suppliers`, {
                       headers: { Cookie: cookieString }
                     })).data;
    
    const testSupplierId = suppliers[0].id;
    
    // Create test invoice
    const invoiceData = {
      supplierId: testSupplierId,
      invoiceNumber: `TEST-${Date.now()}`,
      amount: 100.00,
      description: 'Test invoice for webhook testing',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
    
    console.log('Creating test invoice...');
    const invoiceResponse = await axios.post(`${BASE_URL}/api/supplier-invoices`, invoiceData, {
      headers: { Cookie: cookieString }
    });
    
    console.log('✅ Invoice created successfully');
    console.log(`   Invoice ID: ${invoiceResponse.data.id}`);
    console.log('   This should trigger a notification to the FINANCE webhook\n');

    // Step 5: Test payment notification (should use finance webhook)
    console.log('5. Testing payment notification...');
    
    const paymentData = {
      supplierId: testSupplierId,
      amount: 50.00,
      description: 'Test payment for webhook testing',
      paymentMethod: 'bank_transfer'
    };
    
    console.log('Creating test payment...');
    const paymentResponse = await axios.post(`${BASE_URL}/api/supplier-payments`, paymentData, {
      headers: { Cookie: cookieString }
    });
    
    console.log('✅ Payment created successfully');
    console.log(`   Payment ID: ${paymentResponse.data.id}`);
    console.log('   This should trigger a notification to the FINANCE webhook\n');

    // Step 6: Summary
    console.log('📊 Test Summary:');
    console.log('================');
    console.log('✅ Finance webhook functionality is configured');
    console.log('✅ Invoice notifications should use finance webhook');
    console.log('✅ Payment notifications should use finance webhook');
    console.log('✅ Order notifications would use main webhook');
    console.log('');
    console.log('Check the server logs to see if notifications were sent');
    console.log('In production, these would be sent to different Slack channels');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testFinanceWebhook();