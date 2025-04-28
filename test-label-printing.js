// Test script for label printing functionality
import axios from 'axios';
import fs from 'fs';
import path from 'path';

async function testLabelPrinting() {
  console.log('Testing label printing functionality...');
  
  try {
    // Test 1: Generate preview for an existing order
    console.log('\n--- Test 1: Generate Label Preview ---');
    const previewResponse = await axios.post('http://localhost:5000/api/preview-label', {
      orderId: 93, // Use an existing order ID
      boxCount: 2,
      currentBox: 1
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Preview response:', previewResponse.data);
    
    if (previewResponse.data.success) {
      console.log('✅ Preview generation successful');
      console.log('Preview URL:', previewResponse.data.previewUrl);
    } else {
      console.log('❌ Preview generation failed:', previewResponse.data.error);
    }
    
    // Test 2: Print a single label (simulation only in dev environment)
    console.log('\n--- Test 2: Print Single Label ---');
    const printResponse = await axios.post('http://localhost:5000/api/print-label', {
      orderId: 93, // Use an existing order ID
      boxCount: 2,
      currentBox: 1
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Print response:', printResponse.data);
    
    if (printResponse.data.success) {
      console.log('✅ Label printing successful');
    } else {
      console.log('❌ Label printing failed:', printResponse.data.error);
    }
    
    // Test 3: Print batch labels (simulation only in dev environment)
    console.log('\n--- Test 3: Print Batch Labels ---');
    const batchResponse = await axios.post('http://localhost:5000/api/print-batch-labels', {
      orderId: 93, // Use an existing order ID
      boxCount: 2
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Batch print response:', batchResponse.data);
    
    if (batchResponse.data.success) {
      console.log('✅ Batch label printing successful');
    } else {
      console.log('❌ Batch label printing failed:', batchResponse.data.error);
    }
    
    console.log('\nAll tests completed!');
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testLabelPrinting();