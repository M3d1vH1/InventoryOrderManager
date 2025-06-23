/**
 * Test script to create an invoice and verify Slack notification is sent
 */

async function testInvoiceSlackNotification() {
  console.log('🧪 Testing Invoice Slack Notification System');
  console.log('=' * 50);
  
  try {
    // Step 1: Login to get session
    console.log('1. Logging in...');
    const loginResponse = await fetch('http://localhost:5000/api/dev-login', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const sessionCookie = loginResponse.headers.get('set-cookie');
    console.log('✅ Login successful');
    
    // Step 2: Create test invoice
    console.log('2. Creating test invoice...');
    const invoiceData = {
      invoiceNumber: `SLACK-LIVE-${Date.now()}`,
      supplierId: 1,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amount: 2500.75,
      status: 'pending',
      company: 'Live Test Supplier',
      notes: 'Testing live Slack notification integration'
    };
    
    console.log('Invoice data:', JSON.stringify(invoiceData, null, 2));
    
    const createResponse = await fetch('http://localhost:5000/api/supplier-payments/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify(invoiceData)
    });
    
    console.log('3. Response status:', createResponse.status);
    const responseText = await createResponse.text();
    console.log('4. Response body:', responseText);
    
    if (createResponse.ok) {
      const createdInvoice = JSON.parse(responseText);
      console.log('✅ Invoice created successfully!');
      console.log('📄 Invoice details:');
      console.log(`   - Number: ${createdInvoice.invoice_number || createdInvoice.invoiceNumber}`);
      console.log(`   - Amount: €${createdInvoice.amount}`);
      console.log(`   - Status: ${createdInvoice.status}`);
      console.log('');
      console.log('🔔 Slack notification should have been sent!');
      console.log('📱 Check your Slack channel for the notification.');
      
      return createdInvoice;
    } else {
      const errorData = JSON.parse(responseText);
      console.error('❌ Invoice creation failed:', errorData);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

// Run the test
testInvoiceSlackNotification()
  .then(result => {
    if (result) {
      console.log('\n🎉 Test completed successfully!');
      console.log('The invoice notification system is working.');
    } else {
      console.log('\n❌ Test failed - check the errors above.');
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
  });