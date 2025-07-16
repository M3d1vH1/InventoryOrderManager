/**
 * Test if the validation fix works for empty strings
 */

const BASE_URL = 'http://localhost:5000';

async function testFixedValidation() {
  console.log('Testing fixed validation with empty strings...\n');
  
  // Test the exact data structure the frontend sends
  const frontendData = {
    name: 'Fixed Validation Test',
    sku: 'FIXED-001',
    barcode: '',  // Empty string - should now be converted to undefined
    description: '',  // Empty string - should now be converted to undefined
    minStockLevel: 5,
    currentStock: 0,
    location: '',  // Empty string - should now be converted to undefined
    unitsPerBox: 1,
    categoryId: 1,
    tags: []
  };
  
  console.log('Sending data:', JSON.stringify(frontendData, null, 2));
  
  try {
    const response = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(frontendData),
    });
    
    console.log('Response status:', response.status);
    const responseData = await response.text();
    
    if (!response.ok) {
      console.log('❌ Request failed with status:', response.status);
      console.log('Response:', responseData);
      
      try {
        const errorData = JSON.parse(responseData);
        console.log('Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('Could not parse error response as JSON');
      }
      
      return false;
    }
    
    console.log('✅ Product created successfully!');
    const result = JSON.parse(responseData);
    console.log('Created product:', JSON.stringify(result, null, 2));
    
    return true;
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return false;
  }
}

async function testWithVariousEmptyValues() {
  console.log('\n\nTesting with various empty value combinations...\n');
  
  const testCases = [
    {
      name: 'Empty Barcode Test',
      sku: 'EMPTY-BARCODE-001',
      barcode: '',
      description: 'Valid description',
      location: 'A1',
      unitsPerBox: 12,
      categoryId: 1,
      minStockLevel: 5,
      currentStock: 10,
      tags: []
    },
    {
      name: 'Empty Description Test',
      sku: 'EMPTY-DESC-001',
      barcode: '12345678',
      description: '',
      location: 'B2',
      unitsPerBox: 6,
      categoryId: 1,
      minStockLevel: 3,
      currentStock: 15,
      tags: []
    },
    {
      name: 'All Empty Optionals Test',
      sku: 'ALL-EMPTY-001',
      barcode: '',
      description: '',
      location: '',
      unitsPerBox: 1,
      categoryId: 1,
      minStockLevel: 1,
      currentStock: 5,
      tags: []
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.name}`);
    console.log('Data:', JSON.stringify(testCase, null, 2));
    
    try {
      const response = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase),
      });
      
      console.log('Response status:', response.status);
      const responseData = await response.text();
      
      if (!response.ok) {
        console.log('❌ Failed:', responseData);
        try {
          const errorData = JSON.parse(responseData);
          console.log('Error details:', JSON.stringify(errorData, null, 2));
        } catch (e) {
          console.log('Could not parse error response as JSON');
        }
      } else {
        console.log('✅ Success!');
        const result = JSON.parse(responseData);
        console.log('Created product ID:', result.data?.id);
      }
    } catch (error) {
      console.error('❌ Network error:', error.message);
    }
  }
}

async function runValidationTests() {
  console.log('🧪 Starting Validation Fix Tests\n');
  
  await testFixedValidation();
  await testWithVariousEmptyValues();
  
  console.log('\n🏁 Validation tests completed');
}

runValidationTests();