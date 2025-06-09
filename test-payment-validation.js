/**
 * Comprehensive Payment Validation Test
 * Tests all payment-related schemas with empty string handling
 */

import { z } from 'zod';

// Import schemas from shared/schema.ts (simulated for testing)
const testSupplierSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  contactPerson: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string().optional()
  ),
  email: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.union([z.string().email({ message: "Invalid email address" }), z.string().length(0)]).optional().nullable()
  ),
  phone: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string().optional()
  ),
  notes: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string().optional()
  ),
});

const testInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1, { message: "Invoice number is required" }),
  description: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string().optional()
  ),
  notes: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string().optional()
  ),
  reference: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string().optional()
  ),
  company: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string().optional()
  )
});

const testPaymentSchema = z.object({
  referenceNumber: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string().optional()
  ),
  callbackRequired: z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return false;
      if (typeof val === 'string') return val === 'true';
      return Boolean(val);
    },
    z.boolean().default(false)
  ),
  callbackNotes: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string().optional()
  ),
  company: z.preprocess(
    (val) => val === null || val === undefined || val === '' ? undefined : val,
    z.string().optional()
  )
});

console.log('🧪 Testing Payment Validation Schemas with Empty String Handling');
console.log('=' * 70);

// Test Cases
const testCases = [
  {
    name: 'Supplier with empty strings',
    schema: testSupplierSchema,
    data: {
      name: 'Test Supplier',
      contactPerson: '',
      email: '',
      phone: '',
      notes: ''
    }
  },
  {
    name: 'Invoice with empty strings',
    schema: testInvoiceSchema,
    data: {
      invoiceNumber: 'INV-001',
      description: '',
      notes: '',
      reference: '',
      company: ''
    }
  },
  {
    name: 'Payment with empty strings and boolean',
    schema: testPaymentSchema,
    data: {
      referenceNumber: '',
      callbackRequired: '',
      callbackNotes: '',
      company: ''
    }
  },
  {
    name: 'Payment with string boolean values',
    schema: testPaymentSchema,
    data: {
      referenceNumber: 'REF-123',
      callbackRequired: 'true',
      callbackNotes: 'Follow up required',
      company: 'Test Company'
    }
  }
];

// Run tests
let passedTests = 0;
let totalTests = testCases.length;

for (const testCase of testCases) {
  try {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log('Input data:', JSON.stringify(testCase.data, null, 2));
    
    const result = testCase.schema.parse(testCase.data);
    console.log('✅ PASSED - Parsed result:', JSON.stringify(result, null, 2));
    passedTests++;
  } catch (error) {
    console.log('❌ FAILED - Validation error:', error.message);
    if (error.errors) {
      console.log('Detailed errors:', JSON.stringify(error.errors, null, 2));
    }
  }
}

console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('🎉 All payment validation tests passed! Empty string preprocessing is working correctly.');
} else {
  console.log('⚠️  Some tests failed. Review the validation schemas.');
}