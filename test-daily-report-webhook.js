import { DatabaseStorage } from './server/storage.postgresql.js';
import { db } from './server/db.js';

async function testDailyReportWebhookSaving() {
  console.log('Testing daily report webhook URL saving...');
  
  try {
    const storage = new DatabaseStorage(db);
    
    // First, get current settings
    console.log('1. Getting current notification settings...');
    const currentSettings = await storage.getNotificationSettings();
    console.log('Current settings:', JSON.stringify(currentSettings, null, 2));
    
    // Test updating with daily report webhook URL
    console.log('\n2. Testing update with daily report webhook URL...');
    const testWebhookUrl = 'https://hooks.slack.com/services/TEST/WEBHOOK/URL';
    const updateData = {
      dailyReportEnabled: true,
      dailyReportTime: '18:00',
      dailyReportWebhookUrl: testWebhookUrl
    };
    
    console.log('Update data:', JSON.stringify(updateData, null, 2));
    const updatedSettings = await storage.updateNotificationSettings(updateData);
    console.log('Updated settings result:', JSON.stringify(updatedSettings, null, 2));
    
    // Verify the webhook URL was saved
    console.log('\n3. Verifying webhook URL was saved...');
    const verifySettings = await storage.getNotificationSettings();
    console.log('Verification - dailyReportWebhookUrl:', verifySettings?.dailyReportWebhookUrl);
    console.log('Verification - dailyReportEnabled:', verifySettings?.dailyReportEnabled);
    console.log('Verification - dailyReportTime:', verifySettings?.dailyReportTime);
    
    if (verifySettings?.dailyReportWebhookUrl === testWebhookUrl) {
      console.log('\n✅ SUCCESS: Daily report webhook URL saved correctly!');
    } else {
      console.log('\n❌ FAILED: Daily report webhook URL not saved correctly');
      console.log('Expected:', testWebhookUrl);
      console.log('Actual:', verifySettings?.dailyReportWebhookUrl);
    }
    
  } catch (error) {
    console.error('❌ ERROR during test:', error);
  }
  
  process.exit(0);
}

testDailyReportWebhookSaving();