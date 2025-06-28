/**
 * Test script to create an order and verify daily report functionality
 */

const https = require('https');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testDailyReportWithRealData() {
  console.log('Testing Daily Report System with Real Database Data');
  console.log('='.repeat(60));

  try {
    // Test the daily report endpoint
    const testOptions = {
      hostname: 'amphoreus.replit.app',
      port: 443,
      path: '/api/test/daily-report',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cookie': 'connect.sid=s%3AeyJwYXNzcG9ydCI6eyJ1c2VyIjp7ImlkIjoxLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6ImFkbWluIn19fQ.VqHqoUyYtjRp5L8YhjJ_ek8uA8TfQQ3BqnBw-uh9lkE'
      }
    };

    const response = await makeRequest(testOptions);
    
    if (response.status === 200) {
      console.log('REAL DAILY REPORT DATA FROM YOUR DATABASE:');
      console.log('='.repeat(60));
      
      const { data } = response;
      console.log('Status:', data.status);
      console.log('Scheduler Running:', data.schedulerRunning);
      console.log('Settings:', JSON.stringify(data.settings, null, 2));
      console.log('Metrics:', JSON.stringify(data.metrics, null, 2));
      
      console.log('\nREAL DAILY REPORT PREVIEW:');
      console.log('='.repeat(60));
      console.log(data.reportPreview);
      
      console.log('\nDATA SUMMARY:');
      console.log(`Total orders in your system: ${data.metrics.totalOrders}`);
      console.log(`New orders today: ${data.metrics.newToday}`);
      console.log(`Picked today: ${data.metrics.pickedToday}`);
      console.log(`Shipped today: ${data.metrics.shippedToday}`);
      console.log(`Outstanding orders: ${data.metrics.outstanding}`);
      
      console.log('\nSYSTEM STATUS:');
      console.log('Scheduler:', data.schedulerRunning ? 'RUNNING' : 'STOPPED');
      console.log('Daily reports enabled:', data.settings.enabled);
      console.log('Report time:', data.settings.time);
      console.log('Webhook configured:', data.settings.webhookConfigured);
      
      console.log('\nTHIS IS THE EXACT MESSAGE THAT WOULD BE SENT TO SLACK');
      console.log('Configure Slack webhook URL in Settings to activate daily reports');
      
    } else {
      console.log('Error response:', response.status, response.data);
    }

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testDailyReportWithRealData();