/**
 * Debug the exact user data that caused the validation error
 */

const BASE_URL = 'http://localhost:5000';

async function testUserData() {
  console.log('Testing the exact user data that failed...\n');
  
  // This is the exact data from the error log
  const userData = {
    barcode: "123456789",
    currentStock: 500,
    description: "Cybel 250ml Tin",
    location: "B2",
    minStockLevel: 40,
    name: "Cybel 250ml Tin",
    sku: "testesttest",
    tags: ["Ελαιόλαδο"],
    unitsPerBox: 16
  };
  
  console.log('User data:', JSON.stringify(userData, null, 2));
  
  // The frontend adds categoryId: 1 to this data
  const frontendData = {
    ...userData,
    categoryId: 1
  };
  
  console.log('Frontend data (with categoryId):', JSON.stringify(frontendData, null, 2));
  
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

testUserData();