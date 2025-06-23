/**
 * Comprehensive Notification System Test
 * Tests all fixed notification types: Orders, Invoices, and Payments
 */

async function testNotificationSystem() {
  console.log('🧪 Testing Complete Notification System');
  console.log('=' .repeat(60));
  
  let sessionCookie;
  
  try {
    // Step 1: Login
    console.log('1. Logging in...');
    const loginResponse = await fetch('http://localhost:5000/api/dev-login', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    sessionCookie = loginResponse.headers.get('set-cookie');
    console.log('✅ Login successful');
    
    // Step 2: Test Order Notification
    await testOrderNotification(sessionCookie);
    
    // Step 3: Test Invoice Notification
    await testInvoiceNotification(sessionCookie);
    
    // Step 4: Test Payment Notification
    await testPaymentNotification(sessionCookie);
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 All notification tests completed!');
    console.log('Check the server logs for detailed notification processing');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

async function testOrderNotification(sessionCookie) {
  console.log('\n2. Testing Order Notification...');
  
  try {
    const orderData = {
      customerName: 'Test Customer - Notifications',
      orderDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      priority: 'high',
      notes: 'Testing notification system for orders',
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 }
      ]
    };
    
    console.log('Creating test order...');
    const response = await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify(orderData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Order created successfully:', result.order?.orderNumber);
      console.log('   Check logs for Slack notification attempt');
    } else {
      console.log('❌ Order creation failed:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Order notification test failed:', error.message);
  }
}

async function testInvoiceNotification(sessionCookie) {
  console.log('\n3. Testing Invoice Notification...');
  
  try {
    const invoiceData = {
      invoiceNumber: `TEST-NOTIF-${Date.now()}`,
      supplierId: 1,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amount: 1500.75,
      status: 'pending',
      company: 'Notification Test Supplier',
      notes: 'Testing notification system for invoices'
    };
    
    console.log('Creating test invoice...');
    const response = await fetch('http://localhost:5000/api/supplier-payments/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify(invoiceData)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Invoice created successfully:', result.invoiceNumber);
      console.log('   Check logs for notification processing');
      return result.id; // Return for payment test
    } else {
      console.log('❌ Invoice creation failed:', result.message || result.error);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Invoice notification test failed:', error.message);
    return null;
  }
}

async function testPaymentNotification(sessionCookie) {
  console.log('\n4. Testing Payment Notification...');
  
  try {
    // First create an invoice to pay against
    const invoiceData = {
      invoiceNumber: `PAY-TEST-${Date.now()}`,
      supplierId: 1,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      amount: 800.00,
      status: 'pending',
      company: 'Payment Test Supplier'
    };
    
    const invoiceResponse = await fetch('http://localhost:5000/api/supplier-payments/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify(invoiceData)
    });
    
    const invoice = await invoiceResponse.json();
    
    if (!invoiceResponse.ok) {
      console.log('❌ Could not create invoice for payment test');
      return;
    }
    
    // Now create a payment
    const paymentData = {
      invoiceId: invoice.id,
      amount: 400.00,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'bank_transfer',
      referenceNumber: `REF-${Date.now()}`,
      notes: 'Testing payment notification system'
    };
    
    console.log('Creating test payment...');
    const paymentResponse = await fetch('http://localhost:5000/api/supplier-payments/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify(paymentData)
    });
    
    const payment = await paymentResponse.json();
    
    if (paymentResponse.ok) {
      console.log('✅ Payment created successfully');
      console.log('   Check logs for notification processing');
    } else {
      console.log('❌ Payment creation failed:', payment.message || payment.error);
    }
    
  } catch (error) {
    console.error('❌ Payment notification test failed:', error.message);
  }
}

// Run the test
testNotificationSystem().then(() => {
  console.log('\nTest completed. Check server console for notification logs.');
}).catch(error => {
  console.error('Test suite failed:', error);
});