/**
 * Test Out-of-Stock Handling Feature
 * Tests the new out-of-stock functionality in the picking phase
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:5000';

async function testOutOfStockFeature() {
  console.log('🧪 Testing Out-of-Stock Handling Feature...\n');

  try {
    // Login first to get authentication
    console.log('0. Authenticating...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    const cookies = loginResponse.headers['set-cookie'];
    const axiosConfig = {
      headers: {
        'Cookie': cookies ? cookies.join('; ') : ''
      }
    };

    // 1. Create a test order with products
    console.log('1. Creating a test order...');
    const orderResponse = await axios.post(`${BASE_URL}/api/orders`, {
      customerName: 'Test Customer - Out of Stock',
      customerAddress: '123 Test Street',
      customerPhone: '555-0123',
      estimatedShippingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [
        { productId: 1, quantity: 5 },
        { productId: 2, quantity: 3 }
      ]
    }, axiosConfig);
    
    const orderId = orderResponse.data.id;
    console.log(`✅ Order created with ID: ${orderId}`);

    // 2. Get order items to test picking
    const orderItemsResponse = await axios.get(`${BASE_URL}/api/orders/${orderId}/items`, axiosConfig);
    const orderItems = orderItemsResponse.data;
    console.log(`✅ Retrieved ${orderItems.length} order items`);

    // 3. Test picking with out-of-stock items (0 quantity)
    console.log('\n2. Testing picking with out-of-stock items...');
    
    const itemQuantities = orderItems.map((item, index) => ({
      orderItemId: item.id,
      productId: item.productId,
      requestedQuantity: item.quantity,
      actualQuantity: index === 0 ? 0 : item.quantity // First item out of stock
    }));

    const pickingResponse = await axios.patch(`${BASE_URL}/api/orders/${orderId}/status`, {
      status: 'picked',
      itemQuantities: itemQuantities
    }, axiosConfig);

    console.log('✅ Order marked as picked with out-of-stock items');

    // 4. Check if unshipped items were created
    console.log('\n3. Checking unshipped items creation...');
    const unshippedResponse = await axios.get(`${BASE_URL}/api/unshipped-items`, axiosConfig);
    const unshippedItems = unshippedResponse.data.filter(item => 
      item.orderId === orderId && item.reason === 'out_of_stock'
    );

    if (unshippedItems.length > 0) {
      console.log(`✅ ${unshippedItems.length} unshipped items created for out-of-stock products`);
      unshippedItems.forEach(item => {
        console.log(`  - ${item.productName} (${item.sku}): ${item.quantity} units`);
      });
    } else {
      console.log('❌ No unshipped items found for out-of-stock products');
    }

    // 5. Check order status
    const updatedOrderResponse = await axios.get(`${BASE_URL}/api/orders/${orderId}`, axiosConfig);
    const updatedOrder = updatedOrderResponse.data;
    console.log(`✅ Order status: ${updatedOrder.status}`);

    console.log('\n✅ Out-of-Stock Feature Test Completed Successfully!');
    
  } catch (error) {
    console.error('❌ Error testing out-of-stock feature:', error.response?.data || error.message);
  }
}

// Run the test
testOutOfStockFeature();