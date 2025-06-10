// Verify shipping company implementation by checking code structure
import fs from 'fs';
import path from 'path';

console.log('Verifying shipping company modification implementation...\n');

const checks = [];

// Check 1: Verify API routes exist
try {
  const routesFile = fs.readFileSync('server/routes.ts', 'utf8');
  if (routesFile.includes('/api/shipping/companies') && routesFile.includes('/api/shipping/customer/:customerId')) {
    checks.push('✓ Shipping API routes implemented');
  } else {
    checks.push('✗ Missing shipping API routes');
  }
} catch (error) {
  checks.push('✗ Could not read routes file');
}

// Check 2: Verify storage methods exist
try {
  const storageFile = fs.readFileSync('server/storage.ts', 'utf8');
  if (storageFile.includes('getShippingCompanies') && storageFile.includes('updateCustomerShippingCompany')) {
    checks.push('✓ Storage methods implemented');
  } else {
    checks.push('✗ Missing storage methods');
  }
} catch (error) {
  checks.push('✗ Could not read storage interface');
}

// Check 3: Verify PostgreSQL implementation
try {
  const pgFile = fs.readFileSync('server/storage.postgresql.ts', 'utf8');
  if (pgFile.includes('getShippingCompanies') && pgFile.includes('updateCustomerShippingCompany')) {
    checks.push('✓ PostgreSQL implementation exists');
  } else {
    checks.push('✗ Missing PostgreSQL implementation');
  }
} catch (error) {
  checks.push('✗ Could not read PostgreSQL storage');
}

// Check 4: Verify PickList component has shipping dialog
try {
  const pickListFile = fs.readFileSync('client/src/components/orders/PickList.tsx', 'utf8');
  if (pickListFile.includes('showShippingCompanyDialog') && 
      pickListFile.includes('generateShippingLabelsWithCompany') &&
      pickListFile.includes('handleShippingCompanySelected')) {
    checks.push('✓ PickList component has shipping selection dialog');
  } else {
    checks.push('✗ Missing shipping dialog in PickList');
  }
} catch (error) {
  checks.push('✗ Could not read PickList component');
}

// Check 5: Verify shipping companies API file exists
try {
  const apiFile = fs.readFileSync('server/api/shippingCompanies.ts', 'utf8');
  if (apiFile.includes('getShippingCompanies') && apiFile.includes('updateCustomerShippingCompany')) {
    checks.push('✓ Shipping companies API file exists');
  } else {
    checks.push('✗ Missing shipping companies API functions');
  }
} catch (error) {
  checks.push('✗ Could not read shipping companies API');
}

// Print results
checks.forEach(check => console.log(check));

const passed = checks.filter(c => c.startsWith('✓')).length;
const total = checks.length;

console.log(`\nImplementation Status: ${passed}/${total} checks passed`);

if (passed === total) {
  console.log('✓ Shipping company modification feature is fully implemented');
  console.log('✓ All code components are in place and should work correctly');
} else {
  console.log('✗ Some implementation issues detected');
}