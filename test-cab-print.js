// Test script for direct printing to CAB EOS 1 printer

import { directPrinter } from './server/services/directPrinting.js';

const createTestLabel = () => {
  // Based on CAB EOS manual - JScript programming language
  return `
m m
J
H 100,0,T
S l1;0,0,68,71,100
T 25,25,0,3,pt15;CAB EOS1 TEST LABEL
T 25,50,0,3,pt12;Warehouse Management System
T 25,75,0,3,pt10;Print Test: ${new Date().toLocaleString()}
T 25,100,0,3,pt12;TEST SUCCESSFUL
T 25,220,0,3,pt8;This is a test label for the CAB EOS1 printer
A 1
`;
};

const testPrint = async () => {
  console.log('Creating test label for CAB EOS1 printer...');
  
  // Generate label content
  const labelContent = createTestLabel();
  
  console.log('Sending test label to printer...');
  
  try {
    // Send to printer using our direct printing service
    const result = await directPrinter.printContent(labelContent, 'test-label');
    
    if (result.success) {
      console.log('✓ Success:', result.message);
    } else {
      console.log('✗ Failed:', result.message);
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
};

// Run the test
testPrint();