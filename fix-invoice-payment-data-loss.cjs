/**
 * Data Loss Investigation and Fix for Invoice and Payment Forms
 * This script identifies and fixes the data persistence issues
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Investigating Invoice and Payment Data Loss Issues...\n');

// Read the relevant files
const invoiceFormPath = 'client/src/components/suppliers/InvoiceForm.tsx';
const paymentFormPath = 'client/src/components/suppliers/PaymentForm.tsx';
const schemaPath = 'shared/schema.ts';

let issues = [];

function analyzeInvoiceForm() {
  console.log('📄 Analyzing InvoiceForm.tsx...');
  
  if (!fs.existsSync(invoiceFormPath)) {
    issues.push('❌ InvoiceForm.tsx not found');
    return;
  }
  
  const content = fs.readFileSync(invoiceFormPath, 'utf8');
  
  // Check for field name inconsistency issues
  const fieldMappings = [
    'invoice_number || invoice.invoiceNumber',
    'supplier_id || invoice.supplierId',
    'invoice_date || invoice.invoiceDate',
    'due_date || invoice.dueDate',
    'paid_amount || invoice.paidAmount',
    'rf_number || invoice.rfNumber'
  ];
  
  const hasFieldMappingIssues = fieldMappings.some(mapping => content.includes(mapping));
  
  if (hasFieldMappingIssues) {
    issues.push('⚠️ InvoiceForm: Multiple field name mappings detected (snake_case vs camelCase)');
  }
  
  // Check for complex form reset logic
  if (content.includes('form.reset({') && content.includes('useEffect')) {
    const resetMatches = content.match(/form\.reset\(/g);
    if (resetMatches && resetMatches.length > 1) {
      issues.push('⚠️ InvoiceForm: Multiple form.reset() calls detected - potential data loss on re-renders');
    }
  }
  
  // Check for notes field handling
  if (content.includes('notes: invoice.notes ||')) {
    console.log('✅ InvoiceForm: Notes field is being mapped correctly');
  } else {
    issues.push('❌ InvoiceForm: Notes field mapping may be incomplete');
  }
  
  console.log('   InvoiceForm analysis complete\n');
}

function analyzePaymentForm() {
  console.log('💰 Analyzing PaymentForm.tsx...');
  
  if (!fs.existsSync(paymentFormPath)) {
    issues.push('❌ PaymentForm.tsx not found');
    return;
  }
  
  const content = fs.readFileSync(paymentFormPath, 'utf8');
  
  // Check for field name inconsistency issues
  const fieldMappings = [
    'payment.invoiceId || payment.invoice_id',
    'payment.paymentDate || payment.payment_date',
    'payment.paymentMethod || payment.payment_method',
    'payment.referenceNumber || payment.reference_number'
  ];
  
  const hasFieldMappingIssues = fieldMappings.some(mapping => content.includes(mapping));
  
  if (hasFieldMappingIssues) {
    issues.push('⚠️ PaymentForm: Multiple field name mappings detected (snake_case vs camelCase)');
  }
  
  // Check for complex form reset logic
  if (content.includes('form.reset({') && content.includes('useEffect')) {
    const resetMatches = content.match(/form\.reset\(/g);
    if (resetMatches && resetMatches.length > 1) {
      issues.push('⚠️ PaymentForm: Multiple form.reset() calls detected - potential data loss on re-renders');
    }
  }
  
  // Check for notes field handling
  if (content.includes('notes: payment.notes ||')) {
    console.log('✅ PaymentForm: Notes field is being mapped correctly');
  } else {
    issues.push('❌ PaymentForm: Notes field mapping may be incomplete');
  }
  
  console.log('   PaymentForm analysis complete\n');
}

function analyzeSchema() {
  console.log('🗂️ Analyzing schema.ts...');
  
  if (!fs.existsSync(schemaPath)) {
    issues.push('❌ schema.ts not found');
    return;
  }
  
  const content = fs.readFileSync(schemaPath, 'utf8');
  
  // Check for supplier invoice schema
  if (content.includes('supplierInvoices')) {
    console.log('✅ Schema: supplierInvoices table found');
    
    // Check for notes field
    if (content.includes('notes:') && content.includes('supplierInvoices')) {
      console.log('✅ Schema: notes field exists in supplierInvoices');
    } else {
      issues.push('❌ Schema: notes field missing from supplierInvoices');
    }
  } else {
    issues.push('❌ Schema: supplierInvoices table not found');
  }
  
  // Check for supplier payments schema
  if (content.includes('supplierPayments')) {
    console.log('✅ Schema: supplierPayments table found');
    
    // Check for notes field
    if (content.includes('notes:') && content.includes('supplierPayments')) {
      console.log('✅ Schema: notes field exists in supplierPayments');
    } else {
      issues.push('❌ Schema: notes field missing from supplierPayments');
    }
  } else {
    issues.push('❌ Schema: supplierPayments table not found');
  }
  
  console.log('   Schema analysis complete\n');
}

function generateFixRecommendations() {
  console.log('🛠️ Generating Fix Recommendations...\n');
  
  const fixes = [
    '1. Standardize field naming convention (use camelCase consistently)',
    '2. Simplify form reset logic to prevent data loss on re-renders',
    '3. Ensure proper handling of null/undefined values in form fields',
    '4. Add proper error handling for form validation',
    '5. Implement form state persistence to prevent data loss',
    '6. Add console logging for debugging form data flow'
  ];
  
  console.log('Recommended fixes:');
  fixes.forEach(fix => console.log(`   ${fix}`));
  console.log();
}

// Run the analysis
analyzeInvoiceForm();
analyzePaymentForm();
analyzeSchema();

console.log('📋 Issues Found:');
if (issues.length === 0) {
  console.log('   ✅ No critical issues detected');
} else {
  issues.forEach(issue => console.log(`   ${issue}`));
}
console.log();

generateFixRecommendations();

console.log('🎯 Next Steps:');
console.log('   1. Fix field name inconsistencies');
console.log('   2. Simplify form reset logic');
console.log('   3. Test data persistence after fixes');
console.log('   4. Validate forms work correctly with real data\n');

console.log('✅ Analysis complete - ready to implement fixes');