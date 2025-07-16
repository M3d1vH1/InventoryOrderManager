/**
 * Test Product Creation API
 * This script will help identify the specific validation issue causing 400 errors
 */

const BASE_URL = 'http://localhost:5000';

async function testProductCreation() {
  console.log('Testing Product Creation API...\n');
  
  // Test data that should work
  const testProduct = {
    name: 'Test Product',
    sku: 'TEST-001',
    barcode: '1234567890',
    description: 'Test product description',
    minStockLevel: 5,
    currentStock: 10,
    location: 'A1-B2',
    unitsPerBox: 12,
    categoryId: 1,
    tags: ['test', 'demo']
  };
  
  try {
    console.log('Sending product data:', JSON.stringify(testProduct, null, 2));
    
    const response = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testProduct),
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseData = await response.text();
    console.log('Raw response:', responseData);
    
    if (!response.ok) {
      console.log('\n❌ Request failed with status:', response.status);
      
      try {
        const errorData = JSON.parse(responseData);
        console.log('Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('Could not parse error response as JSON');
      }
      
      return false;
    }
    
    console.log('\n✅ Product created successfully!');
    const result = JSON.parse(responseData);
    console.log('Created product:', JSON.stringify(result, null, 2));
    
    return true;
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return false;
  }
}

async function testWithMissingFields() {
  console.log('\n\nTesting with missing required fields...\n');
  
  const incompleteProduct = {
    name: 'Incomplete Product',
    // Missing required fields: sku, categoryId, minStockLevel, currentStock
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(incompleteProduct),
    });
    
    console.log('Response status:', response.status);
    const responseData = await response.text();
    
    if (!response.ok) {
      console.log('Expected validation error:', responseData);
      
      try {
        const errorData = JSON.parse(responseData);
        console.log('Validation errors:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('Could not parse error response as JSON');
      }
    }
    
  } catch (error) {
    console.error('Network error:', error.message);
  }
}

async function testWithInvalidCategoryId() {
  console.log('\n\nTesting with invalid category ID...\n');
  
  const invalidCategoryProduct = {
    name: 'Invalid Category Product',
    sku: 'INVALID-001',
    categoryId: 999999, // Non-existent category
    minStockLevel: 5,
    currentStock: 10,
    tags: []
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidCategoryProduct),
    });
    
    console.log('Response status:', response.status);
    const responseData = await response.text();
    
    if (!response.ok) {
      console.log('Expected category validation error:', responseData);
      
      try {
        const errorData = JSON.parse(responseData);
        console.log('Category validation error:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('Could not parse error response as JSON');
      }
    }
    
  } catch (error) {
    console.error('Network error:', error.message);
  }
}

async function runAllTests() {
  console.log('🧪 Starting Product Creation Tests\n');
  
  await testProductCreation();
  await testWithMissingFields();
  await testWithInvalidCategoryId();
  
  console.log('\n🏁 Tests completed');
}

runAllTests();