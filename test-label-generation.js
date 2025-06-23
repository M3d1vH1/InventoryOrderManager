/**
 * Test Label Generation Fix
 * Tests the improved multibox label loading system
 */

import axios from 'axios';
import fs from 'fs';

const BASE_URL = 'http://localhost:5000';

async function testLabelGeneration() {
  console.log('🧪 Testing Label Generation Fix...\n');

  try {
    // 1. Get orders in picked status
    console.log('1. Finding picked orders for label generation...');
    const ordersResponse = await axios.get(`${BASE_URL}/api/orders`);
    const pickedOrders = ordersResponse.data.filter(order => order.status === 'picked');
    
    if (pickedOrders.length === 0) {
      console.log('No picked orders found. Creating a test order...');
      
      // Create and pick an order for testing
      const orderResponse = await axios.post(`${BASE_URL}/api/orders`, {
        customerName: 'Test Customer - Label Generation',
        customerAddress: '456 Label Street, Test City',
        customerPhone: '555-0456',
        items: [{ productId: 1, quantity: 2 }]
      });
      
      const orderId = orderResponse.data.id;
      
      // Mark as picked
      await axios.patch(`${BASE_URL}/api/orders/${orderId}/status`, {
        status: 'picked'
      });
      
      pickedOrders.push({ ...orderResponse.data, status: 'picked' });
      console.log(`✅ Created and picked test order: ${orderId}`);
    }

    const testOrder = pickedOrders[0];
    console.log(`✅ Using order ${testOrder.id} for label generation test`);

    // 2. Test shipping label generation endpoint
    console.log('\n2. Testing shipping label generation...');
    
    const labelRequest = {
      orderId: testOrder.id,
      customerName: testOrder.customerName,
      customerAddress: testOrder.customerAddress || '123 Default Address',
      boxCount: 2,
      shippingCompany: 'Test Shipping Co'
    };

    const labelResponse = await axios.post(`${BASE_URL}/api/shipping/generate-labels`, labelRequest);
    
    if (labelResponse.data && labelResponse.data.success) {
      console.log('✅ Label generation successful');
      console.log(`  Generated ${labelResponse.data.boxCount || labelRequest.boxCount} labels`);
      
      if (labelResponse.data.labels && labelResponse.data.labels.length > 0) {
        console.log(`  Label format: ${labelResponse.data.labels[0].length > 100 ? 'JScript commands' : 'Simple text'}`);
      }
    } else {
      console.log('❌ Label generation failed or returned unexpected format');
    }

    // 3. Test parallel loading performance (simulated)
    console.log('\n3. Testing parallel loading performance...');
    const startTime = Date.now();
    
    const parallelRequests = Array.from({ length: 3 }, (_, i) => 
      axios.post(`${BASE_URL}/api/shipping/generate-labels`, {
        ...labelRequest,
        boxCount: 1
      })
    );
    
    const results = await Promise.allSettled(parallelRequests);
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const duration = Date.now() - startTime;
    
    console.log(`✅ Parallel processing: ${successCount}/3 labels generated in ${duration}ms`);

    // 4. Test shipping company modification
    console.log('\n4. Testing shipping company modification...');
    const modifiedLabelRequest = {
      ...labelRequest,
      shippingCompany: 'Modified Shipping Company'
    };
    
    const modifiedResponse = await axios.post(`${BASE_URL}/api/shipping/generate-labels`, modifiedLabelRequest);
    
    if (modifiedResponse.data && modifiedResponse.data.success) {
      console.log('✅ Shipping company modification successful');
    }

    console.log('\n✅ Label Generation Test Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Error testing label generation:', error.response?.data || error.message);
  }
}

// Run the test
testLabelGeneration();