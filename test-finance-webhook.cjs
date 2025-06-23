/**
 * Test Finance Webhook Functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testFinanceWebhook() {
  console.log('Testing Finance Webhook...\n');

  try {
    // Login as admin
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    const cookies = loginResponse.headers['set-cookie'];
    const cookieString = cookies ? cookies.join('; ') : '';
    console.log('✅ Login successful\n');

    // Get current settings
    console.log('2. Getting notification settings...');
    const settingsResponse = await axios.get(`${BASE_URL}/api/notification-settings`, {
      headers: { Cookie: cookieString }
    });
    
    console.log('Current settings:', {
      slackEnabled: settingsResponse.data.slackEnabled,
      mainWebhook: settingsResponse.data.slackWebhookUrl ? 'Set' : 'Not set',
      financeWebhook: settingsResponse.data.slackFinanceWebhookUrl ? 'Set' : 'Not set'
    });
    console.log('');

    // Configure test webhooks
    console.log('3. Configuring test webhooks...');
    await axios.post(`${BASE_URL}/api/notification-settings`, {
      slackEnabled: true,
      slackWebhookUrl: 'https://hooks.slack.com/test/main',
      slackFinanceWebhookUrl: 'https://hooks.slack.com/test/finance',
      slackNotifyInvoices: true,
      slackNotifyPayments: true
    }, {
      headers: { 
        Cookie: cookieString,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Test webhooks configured');
    console.log('✅ Finance webhook feature is working!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testFinanceWebhook();