/**
 * Comprehensive Notification Trigger Tests
 * Tests all webhook notification triggers to ensure they work correctly
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Cookie': 'connect.sid=your-session-cookie-here' // Will be set after login
};

let sessionCookie = '';

// Helper function to make authenticated requests
async function makeRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie && { 'Cookie': sessionCookie })
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error with ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// 1. Test Order Notifications
async function testOrderNotifications() {
  console.log('\n🛒 Testing Order Notifications...');
  
  try {
    // Create a new order that should trigger notification
    const newOrder = {
      customerName: 'Test Customer',
      priority: 'high',
      notes: 'Test order for webhook notification',
      items: [
        {
          productId: 1,
          quantity: 5
        }
      ]
    };
    
    const result = await makeRequest('POST', '/api/orders', newOrder);
    console.log('✅ Order created successfully:', result.orderNumber);
    console.log('   Check Slack for new order notification');
    
    return result;
  } catch (error) {
    console.error('❌ Order notification test failed:', error.message);
    return null;
  }
}

// 2. Test Call Log Notifications
async function testCallLogNotifications() {
  console.log('\n📞 Testing Call Log Notifications...');
  
  try {
    // Create a new call log that should trigger notification
    const newCallLog = {
      companyName: 'Test Company Inc.',
      contactName: 'John Doe',
      callPurpose: 'Order inquiry',
      callTime: '14:30',
      duration: 15,
      notes: 'Customer interested in bulk order',
      priority: 'high',
      followupDate: new Date().toISOString().split('T')[0],
      followupTime: '10:00'
    };
    
    const result = await makeRequest('POST', '/api/call-logs', newCallLog);
    console.log('✅ Call log created successfully:', result.id);
    console.log('   Check Slack for call log notification');
    
    return result;
  } catch (error) {
    console.error('❌ Call log notification test failed:', error.message);
    return null;
  }
}

// 3. Test Low Stock Notifications
async function testLowStockNotifications() {
  console.log('\n📦 Testing Low Stock Notifications...');
  
  try {
    // First, get a product to modify
    const products = await makeRequest('GET', '/api/products');
    if (products.length === 0) {
      console.log('⚠️ No products found, creating test product first');
      
      const newProduct = {
        name: 'Test Product for Low Stock',
        sku: 'TEST-LOWSTOCK-001',
        categoryId: 1,
        minStockLevel: 10,
        currentStock: 15,
        description: 'Test product for low stock notification'
      };
      
      const product = await makeRequest('POST', '/api/products', newProduct);
      console.log('   Created test product:', product.name);
    }
    
    const productId = products.length > 0 ? products[0].id : 1;
    
    // Update product stock to trigger low stock alert
    const lowStockUpdate = {
      currentStock: 3, // Below minimum threshold
      minStockLevel: 10
    };
    
    const result = await makeRequest('PUT', `/api/products/${productId}`, lowStockUpdate);
    console.log('✅ Product stock updated to trigger low stock alert');
    console.log('   Check Slack for low stock notification');
    
    return result;
  } catch (error) {
    console.error('❌ Low stock notification test failed:', error.message);
    return null;
  }
}

// 4. Test Invoice Notifications (Finance Webhook)
async function testInvoiceNotifications() {
  console.log('\n💰 Testing Invoice Notifications...');
  
  try {
    // Create a new supplier invoice
    const newInvoice = {
      supplierName: 'Test Supplier Ltd.',
      invoiceNumber: `INV-TEST-${Date.now()}`,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalAmount: 1250.75,
      currency: 'EUR',
      description: 'Test invoice for webhook notification',
      status: 'pending',
      items: [
        {
          description: 'Test Item 1',
          quantity: 10,
          unitPrice: 75.50,
          totalPrice: 755.00
        },
        {
          description: 'Test Item 2', 
          quantity: 5,
          unitPrice: 99.15,
          totalPrice: 495.75
        }
      ]
    };
    
    const result = await makeRequest('POST', '/api/invoices', newInvoice);
    console.log('✅ Invoice created successfully:', result.invoiceNumber);
    console.log('   Check Finance Slack channel for invoice notification');
    
    return result;
  } catch (error) {
    console.error('❌ Invoice notification test failed:', error.message);
    return null;
  }
}

// 5. Test Payment Notifications (Finance Webhook)
async function testPaymentNotifications() {
  console.log('\n💳 Testing Payment Notifications...');
  
  try {
    // Create a new payment record
    const newPayment = {
      supplierName: 'Test Supplier Ltd.',
      invoiceNumber: `INV-TEST-${Date.now()}`,
      paymentDate: new Date().toISOString().split('T')[0],
      amount: 850.25,
      currency: 'EUR',
      paymentMethod: 'bank_transfer',
      referenceNumber: `PAY-${Date.now()}`,
      description: 'Test payment for webhook notification',
      status: 'completed'
    };
    
    const result = await makeRequest('POST', '/api/payments', newPayment);
    console.log('✅ Payment created successfully:', result.id);
    console.log('   Check Finance Slack channel for payment notification');
    
    return result;
  } catch (error) {
    console.error('❌ Payment notification test failed:', error.message);
    return null;
  }
}

// 6. Test Out-of-Stock Order Notifications
async function testOutOfStockNotifications() {
  console.log('\n⚠️ Testing Out-of-Stock Order Notifications...');
  
  try {
    // Create an order with items that will be out of stock
    const outOfStockOrder = {
      customerName: 'Test Customer - Out of Stock',
      priority: 'urgent',
      notes: 'Test order for out-of-stock notification',
      items: [
        {
          productId: 1,
          quantity: 1000 // Intentionally large quantity to trigger out-of-stock
        }
      ]
    };
    
    const result = await makeRequest('POST', '/api/orders', outOfStockOrder);
    console.log('✅ Out-of-stock order created:', result.orderNumber);
    
    // Now try to pick the order to trigger out-of-stock handling
    const pickingResult = await makeRequest('POST', `/api/orders/${result.id}/pick`, {
      items: [
        {
          id: result.items[0].id,
          actualQuantity: 0 // Simulate no stock available
        }
      ]
    });
    
    console.log('✅ Order picking completed with out-of-stock items');
    console.log('   Check Slack for out-of-stock notification');
    
    return pickingResult;
  } catch (error) {
    console.error('❌ Out-of-stock notification test failed:', error.message);
    return null;
  }
}

// Login function
async function login() {
  console.log('🔐 Logging in...');
  
  try {
    const response = await axios.post(`${BASE_URL}/login`, {
      username: 'admin',
      password: 'admin' // Default password - change if different
    });
    
    // Extract session cookie from response
    const cookies = response.headers['set-cookie'];
    if (cookies) {
      sessionCookie = cookies.find(cookie => cookie.startsWith('connect.sid='));
      console.log('✅ Login successful');
      return true;
    }
    
    console.error('❌ No session cookie received');
    return false;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Comprehensive Notification Trigger Tests');
  console.log('=' .repeat(60));
  
  // Login first
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  console.log('\n📋 Test Summary:');
  console.log('1. Order notifications (main Slack webhook)');
  console.log('2. Call log notifications (main Slack webhook)'); 
  console.log('3. Low stock notifications (main Slack webhook)');
  console.log('4. Invoice notifications (finance Slack webhook)');
  console.log('5. Payment notifications (finance Slack webhook)');
  console.log('6. Out-of-stock order notifications (main Slack webhook)');
  
  const results = {};
  
  // Run all tests
  results.orders = await testOrderNotifications();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between tests
  
  results.callLogs = await testCallLogNotifications();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  results.lowStock = await testLowStockNotifications();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  results.invoices = await testInvoiceNotifications();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  results.payments = await testPaymentNotifications();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  results.outOfStock = await testOutOfStockNotifications();
  
  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Test Results Summary:');
  console.log('=' .repeat(60));
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result ? '✅' : '❌';
    console.log(`${status} ${test}: ${result ? 'Success' : 'Failed'}`);
  });
  
  console.log('\n🔔 Check your Slack channels for notifications:');
  console.log('   • Main webhook: Order, Call Log, Low Stock, Out-of-Stock notifications');
  console.log('   • Finance webhook: Invoice and Payment notifications');
  
  console.log('\n✨ All tests completed!');
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testOrderNotifications,
  testCallLogNotifications,
  testLowStockNotifications,
  testInvoiceNotifications,
  testPaymentNotifications,
  testOutOfStockNotifications
};