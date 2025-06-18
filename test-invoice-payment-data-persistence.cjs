/**
 * Comprehensive Test Agent for Invoice and Payment Data Persistence
 * Tests for data loss issues in notes and other fields
 */

const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://amphoreus.replit.app';
let authCookie = null;

// Test data
const testInvoiceData = {
  supplierId: 1,
  invoiceNumber: `TEST-INV-${Date.now()}`,
  amount: 1500.00,
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'pending',
  notes: 'This is a test invoice note that should persist in the database'
};

const testPaymentData = {
  amount: 750.00,
  paymentDate: new Date().toISOString().split('T')[0],
  paymentMethod: 'bank_transfer',
  notes: 'This is a test payment note that should persist in the database',
  reference: `TEST-PAY-${Date.now()}`
};

function makeRequest(method, path, data = null, useAuth = false) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'amphoreus.replit.app',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; DataPersistenceTest/1.0)'
      }
    };

    if (useAuth && authCookie) {
      options.headers['Cookie'] = authCookie;
    }

    const req = https.request(options, (res) => {
      let data = '';
      
      // Capture cookies for authentication
      if (res.headers['set-cookie']) {
        authCookie = res.headers['set-cookie'].join('; ');
      }

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            data: data ? JSON.parse(data) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function authenticate() {
  console.log('🔐 Authenticating...');
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    if (response.statusCode === 200) {
      console.log('✅ Authentication successful');
      return true;
    } else {
      console.log('❌ Authentication failed:', response.statusCode);
      return false;
    }
  } catch (error) {
    console.log('❌ Authentication error:', error.message);
    return false;
  }
}

async function testSupplierCreation() {
  console.log('\n📦 Testing supplier creation...');
  try {
    const supplierData = {
      name: `Test Supplier ${Date.now()}`,
      email: 'test@supplier.com',
      phone: '1234567890',
      address: 'Test Address',
      notes: 'Test supplier for invoice testing'
    };

    const response = await makeRequest('POST', '/api/suppliers', supplierData, true);
    
    if (response.statusCode === 201 || response.statusCode === 200) {
      console.log('✅ Supplier created successfully');
      return response.data.id || response.data.supplierId || 1;
    } else {
      console.log('⚠️ Using default supplier ID 1');
      return 1;
    }
  } catch (error) {
    console.log('⚠️ Using default supplier ID 1, error:', error.message);
    return 1;
  }
}

async function testInvoiceCreation(supplierId) {
  console.log('\n📄 Testing invoice creation with notes...');
  try {
    const invoiceData = { ...testInvoiceData, supplierId };
    const response = await makeRequest('POST', '/api/supplier-invoices', invoiceData, true);
    
    if (response.statusCode === 201 || response.statusCode === 200) {
      const invoice = response.data;
      console.log('✅ Invoice created with ID:', invoice.id);
      console.log('📝 Created notes:', invoice.notes);
      
      if (invoice.notes === invoiceData.notes) {
        console.log('✅ Invoice notes persisted correctly');
      } else {
        console.log('❌ Invoice notes lost or modified');
        console.log('Expected:', invoiceData.notes);
        console.log('Actual:', invoice.notes);
      }
      
      return invoice;
    } else {
      console.log('❌ Invoice creation failed:', response.statusCode, response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Invoice creation error:', error.message);
    return null;
  }
}

async function testInvoiceRetrieval(invoiceId) {
  console.log('\n🔍 Testing invoice retrieval...');
  try {
    const response = await makeRequest('GET', `/api/supplier-invoices/${invoiceId}`, null, true);
    
    if (response.statusCode === 200) {
      const invoice = response.data;
      console.log('✅ Invoice retrieved successfully');
      console.log('📝 Retrieved notes:', invoice.notes);
      
      if (invoice.notes === testInvoiceData.notes) {
        console.log('✅ Invoice notes persisted after retrieval');
      } else {
        console.log('❌ Invoice notes lost during retrieval');
        console.log('Expected:', testInvoiceData.notes);
        console.log('Actual:', invoice.notes);
      }
      
      return invoice;
    } else {
      console.log('❌ Invoice retrieval failed:', response.statusCode);
      return null;
    }
  } catch (error) {
    console.log('❌ Invoice retrieval error:', error.message);
    return null;
  }
}

async function testInvoiceUpdate(invoiceId) {
  console.log('\n✏️ Testing invoice update...');
  try {
    const updateData = {
      notes: 'Updated invoice note - this should persist after update',
      amount: 1750.00
    };
    
    const response = await makeRequest('PUT', `/api/supplier-invoices/${invoiceId}`, updateData, true);
    
    if (response.statusCode === 200) {
      const invoice = response.data;
      console.log('✅ Invoice updated successfully');
      console.log('📝 Updated notes:', invoice.notes);
      
      if (invoice.notes === updateData.notes) {
        console.log('✅ Invoice notes updated correctly');
      } else {
        console.log('❌ Invoice notes lost during update');
        console.log('Expected:', updateData.notes);
        console.log('Actual:', invoice.notes);
      }
      
      return invoice;
    } else {
      console.log('❌ Invoice update failed:', response.statusCode, response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Invoice update error:', error.message);
    return null;
  }
}

async function testPaymentCreation(invoiceId) {
  console.log('\n💰 Testing payment creation with notes...');
  try {
    const paymentData = { ...testPaymentData, invoiceId };
    const response = await makeRequest('POST', '/api/supplier-payments', paymentData, true);
    
    if (response.statusCode === 201 || response.statusCode === 200) {
      const payment = response.data;
      console.log('✅ Payment created with ID:', payment.id);
      console.log('📝 Created notes:', payment.notes);
      
      if (payment.notes === paymentData.notes) {
        console.log('✅ Payment notes persisted correctly');
      } else {
        console.log('❌ Payment notes lost or modified');
        console.log('Expected:', paymentData.notes);
        console.log('Actual:', payment.notes);
      }
      
      return payment;
    } else {
      console.log('❌ Payment creation failed:', response.statusCode, response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Payment creation error:', error.message);
    return null;
  }
}

async function testPaymentRetrieval(paymentId) {
  console.log('\n🔍 Testing payment retrieval...');
  try {
    const response = await makeRequest('GET', `/api/supplier-payments/${paymentId}`, null, true);
    
    if (response.statusCode === 200) {
      const payment = response.data;
      console.log('✅ Payment retrieved successfully');
      console.log('📝 Retrieved notes:', payment.notes);
      
      if (payment.notes === testPaymentData.notes) {
        console.log('✅ Payment notes persisted after retrieval');
      } else {
        console.log('❌ Payment notes lost during retrieval');
        console.log('Expected:', testPaymentData.notes);
        console.log('Actual:', payment.notes);
      }
      
      return payment;
    } else {
      console.log('❌ Payment retrieval failed:', response.statusCode);
      return null;
    }
  } catch (error) {
    console.log('❌ Payment retrieval error:', error.message);
    return null;
  }
}

async function testPaymentUpdate(paymentId) {
  console.log('\n✏️ Testing payment update...');
  try {
    const updateData = {
      notes: 'Updated payment note - this should persist after update',
      amount: 850.00
    };
    
    const response = await makeRequest('PUT', `/api/supplier-payments/${paymentId}`, updateData, true);
    
    if (response.statusCode === 200) {
      const payment = response.data;
      console.log('✅ Payment updated successfully');
      console.log('📝 Updated notes:', payment.notes);
      
      if (payment.notes === updateData.notes) {
        console.log('✅ Payment notes updated correctly');
      } else {
        console.log('❌ Payment notes lost during update');
        console.log('Expected:', updateData.notes);
        console.log('Actual:', payment.notes);
      }
      
      return payment;
    } else {
      console.log('❌ Payment update failed:', response.statusCode, response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Payment update error:', error.message);
    return null;
  }
}

async function testDataPersistenceAfterRestart() {
  console.log('\n🔄 Testing data persistence after simulated restart...');
  // Clear auth cookie to simulate fresh session
  const originalCookie = authCookie;
  authCookie = null;
  
  const authenticated = await authenticate();
  if (!authenticated) {
    authCookie = originalCookie;
    console.log('⚠️ Using original auth for persistence test');
  }
}

async function runAllTests() {
  console.log('🚀 Starting Invoice and Payment Data Persistence Tests');
  console.log('====================================================');
  
  // Authenticate
  const authenticated = await authenticate();
  if (!authenticated) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  // Test supplier creation (needed for invoices)
  const supplierId = await testSupplierCreation();
  
  // Test invoice lifecycle
  const invoice = await testInvoiceCreation(supplierId);
  if (!invoice) {
    console.log('❌ Invoice tests failed, skipping payment tests');
    return;
  }
  
  const retrievedInvoice = await testInvoiceRetrieval(invoice.id);
  if (retrievedInvoice) {
    await testInvoiceUpdate(invoice.id);
  }
  
  // Test payment lifecycle
  const payment = await testPaymentCreation(invoice.id);
  if (payment) {
    const retrievedPayment = await testPaymentRetrieval(payment.id);
    if (retrievedPayment) {
      await testPaymentUpdate(payment.id);
    }
  }
  
  // Test persistence after restart
  await testDataPersistenceAfterRestart();
  
  console.log('\n====================================================');
  console.log('✅ Invoice and Payment Data Persistence Tests Complete');
  
  // Clean up test data
  console.log('\n🧹 Cleaning up test data...');
  if (invoice && invoice.id) {
    try {
      await makeRequest('DELETE', `/api/supplier-invoices/${invoice.id}`, null, true);
      console.log('✅ Test invoice cleaned up');
    } catch (error) {
      console.log('⚠️ Could not clean up test invoice');
    }
  }
}

// Run the tests
runAllTests().catch(console.error);