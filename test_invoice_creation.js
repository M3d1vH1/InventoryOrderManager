const fetch = require('node-fetch');

async function testInvoiceCreation() {
  console.log('Testing invoice creation endpoint...');
  
  // First, get a session by logging in
  const loginResponse = await fetch('http://localhost:5000/api/dev-login', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!loginResponse.ok) {
    console.log('Login failed:', loginResponse.status, loginResponse.statusText);
    return;
  }
  
  const sessionCookie = loginResponse.headers.get('set-cookie');
  console.log('Login successful, got session cookie');
  
  // Test invoice creation with various data formats
  const testData = {
    invoiceNumber: 'TEST-API-001',
    supplierId: 2,
    issueDate: '2025-01-01',
    dueDate: '2025-01-31',
    amount: 1500.00,
    status: 'pending',
    company: 'Test Company'
  };
  
  console.log('Sending invoice data:', JSON.stringify(testData, null, 2));
  
  const createResponse = await fetch('http://localhost:5000/api/supplier-payments/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    },
    body: JSON.stringify(testData)
  });
  
  console.log('Response status:', createResponse.status);
  
  const responseText = await createResponse.text();
  console.log('Response body:', responseText);
  
  if (!createResponse.ok) {
    try {
      const errorData = JSON.parse(responseText);
      console.log('Parsed error:', JSON.stringify(errorData, null, 2));
    } catch (e) {
      console.log('Could not parse error response as JSON');
    }
  }
}

testInvoiceCreation().catch(console.error);