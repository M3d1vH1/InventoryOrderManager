import { storage } from './server/storage.postgresql.js';

async function testDailyReportSystem() {
  console.log('\n=== Testing Daily Report System ===');
  
  try {
    // Test daily report scheduler service
    const { getDailyReportScheduler } = await import('./server/services/dailyReportScheduler.js');
    const scheduler = getDailyReportScheduler();
    
    if (scheduler) {
      console.log('✅ Daily report scheduler is running');
      
      // Test report generation
      console.log('\n--- Testing daily report generation ---');
      const testResult = await scheduler.sendTestReport();
      console.log(`Test report result: ${testResult ? 'SUCCESS' : 'FAILED'}`);
      
    } else {
      console.log('❌ Daily report scheduler not found');
    }
    
    // Test notification settings API
    console.log('\n--- Testing notification settings API ---');
    const settings = await storage.getNotificationSettings();
    console.log('Current notification settings:', {
      dailyReportEnabled: settings.dailyReportEnabled,
      dailyReportTime: settings.dailyReportTime,
      dailyReportWebhookUrl: settings.dailyReportWebhookUrl
    });
    
    // Test orders for report
    console.log('\n--- Testing orders data for report ---');
    const orders = await storage.getOrdersForReport();
    console.log(`Found ${orders.length} orders for report processing`);
    
    if (orders.length > 0) {
      console.log('Sample order format:');
      console.log(`Order ${orders[0].orderNumber} - Customer: ${orders[0].customerName}`);
      console.log(`Status: ${orders[0].status} - Date: ${orders[0].orderDate}`);
    }
    
  } catch (error) {
    console.error('Error testing daily report system:', error);
  }
}

testDailyReportSystem();