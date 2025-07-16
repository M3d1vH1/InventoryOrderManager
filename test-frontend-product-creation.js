/**
 * Test Frontend Product Creation Flow
 * This mimics exactly what the frontend sends to identify validation mismatches
 */

const BASE_URL = 'http://localhost:5000';

async function testFrontendProductCreation() {
  console.log('Testing Frontend Product Creation Flow...\n');
  
  // This mirrors the exact data structure sent from the frontend
  const frontendProductData = {
    name: 'Test Frontend Product',
    sku: 'FRONTEND-001',
    barcode: '',  // Empty string, which might cause issues
    description: '',  // Empty string
    minStockLevel: 5,
    currentStock: 0,
    location: '',  // Empty string
    unitsPerBox: 1,
    categoryId: 1,  // Added by frontend
    tags: []
  };
  
  console.log('Sending frontend product data:', JSON.stringify(frontendProductData, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(frontendProductData),
    });
    
    console.log('Response status:', response.status);
    const responseData = await response.text();
    
    if (!response.ok) {
      console.log('❌ Frontend request failed with status:', response.status);
      console.log('Response:', responseData);
      
      try {
        const errorData = JSON.parse(responseData);
        console.log('Parsed error:', JSON.stringify(errorData, null, 2));
        return false;
      } catch (e) {
        console.log('Could not parse error response as JSON');
        return false;
      }
    }
    
    console.log('✅ Frontend product created successfully!');
    const result = JSON.parse(responseData);
    console.log('Created product:', JSON.stringify(result, null, 2));
    return true;
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return false;
  }
}

async function testMultipartFormData() {
  console.log('\n\nTesting Multipart Form Data (with image)...\n');
  
  // This simulates when the frontend sends a FormData object
  const FormData = require('form-data');
  const formData = new FormData();
  
  formData.append('name', 'Multipart Test Product');
  formData.append('sku', 'MULTIPART-001');
  formData.append('barcode', '');
  formData.append('description', '');
  formData.append('minStockLevel', '5');
  formData.append('currentStock', '0');
  formData.append('location', '');
  formData.append('unitsPerBox', '1');
  formData.append('categoryId', '1');
  formData.append('tags', '[]');
  
  try {
    const response = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      body: formData,
    });
    
    console.log('Response status:', response.status);
    const responseData = await response.text();
    
    if (!response.ok) {
      console.log('❌ Multipart request failed with status:', response.status);
      console.log('Response:', responseData);
      
      try {
        const errorData = JSON.parse(responseData);
        console.log('Parsed error:', JSON.stringify(errorData, null, 2));
        return false;
      } catch (e) {
        console.log('Could not parse error response as JSON');
        return false;
      }
    }
    
    console.log('✅ Multipart product created successfully!');
    const result = JSON.parse(responseData);
    console.log('Created product:', JSON.stringify(result, null, 2));
    return true;
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return false;
  }
}

async function testWithEmptyStrings() {
  console.log('\n\nTesting with empty strings (common frontend issue)...\n');
  
  const emptyStringProduct = {
    name: 'Empty String Test',
    sku: 'EMPTY-001',
    barcode: '',
    description: '',
    minStockLevel: 5,
    currentStock: 0,
    location: '',
    unitsPerBox: '',  // Empty string instead of number
    categoryId: 1,
    tags: []
  };
  
  console.log('Sending empty string product data:', JSON.stringify(emptyStringProduct, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emptyStringProduct),
    });
    
    console.log('Response status:', response.status);
    const responseData = await response.text();
    
    if (!response.ok) {
      console.log('❌ Empty string request failed with status:', response.status);
      console.log('Response:', responseData);
      
      try {
        const errorData = JSON.parse(responseData);
        console.log('Parsed error:', JSON.stringify(errorData, null, 2));
        return false;
      } catch (e) {
        console.log('Could not parse error response as JSON');
        return false;
      }
    }
    
    console.log('✅ Empty string product created successfully!');
    const result = JSON.parse(responseData);
    console.log('Created product:', JSON.stringify(result, null, 2));
    return true;
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return false;
  }
}

async function runFrontendTests() {
  console.log('🧪 Starting Frontend Product Creation Tests\n');
  
  await testFrontendProductCreation();
  await testMultipartFormData();
  await testWithEmptyStrings();
  
  console.log('\n🏁 Frontend tests completed');
}

runFrontendTests();