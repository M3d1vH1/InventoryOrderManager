// Test daily report functionality through the existing API endpoint
const testDailyReport = async () => {
  console.log('🧪 Testing daily report system...');
  
  try {
    const response = await fetch('/api/test/daily-report', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Daily report test successful!');
    console.log('📊 Metrics:', result.metrics);
    console.log('⚙️ Settings:', result.settings);
    console.log('📄 Report preview:', result.reportPreview);
    
    return result;
    
  } catch (error) {
    console.error('❌ Daily report test failed:', error.message);
    throw error;
  }
};

// Execute test
testDailyReport().then(result => {
  console.log('🎉 Daily report system is fully operational!');
}).catch(error => {
  console.error('💥 Test failed:', error);
});