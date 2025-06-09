const fs = require('fs');
const path = require('path');

function extractBackendEndpoints() {
  const routesContent = fs.readFileSync('server/routes.ts', 'utf8');
  const endpoints = [];
  
  // Extract API routes with methods
  const routeMatches = routesContent.match(/app\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g) || [];
  
  routeMatches.forEach(match => {
    const [, method, path] = match.match(/app\.(\w+)\(['"`]([^'"`]+)['"`]/) || [];
    if (path && path.startsWith('/api/')) {
      endpoints.push({ method: method.toUpperCase(), path, source: 'routes.ts' });
    }
  });
  
  // Check for router imports and their endpoints
  const routerImports = [
    'server/api/callLogs.ts',
    'server/api/prospectiveCustomers.ts', 
    'server/api/reports.ts',
    'server/api/production.ts',
    'server/api/supplierPayments.ts',
    'server/api/customers.ts'
  ];
  
  routerImports.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const matches = content.match(/router\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g) || [];
      
      matches.forEach(match => {
        const [, method, routePath] = match.match(/router\.(\w+)\(['"`]([^'"`]+)['"`]/) || [];
        if (routePath) {
          // Determine base path from filename
          const basePath = path.basename(filePath, '.ts');
          const fullPath = routePath.startsWith('/') ? `/api${routePath}` : `/api/${basePath}${routePath}`;
          endpoints.push({ method: method.toUpperCase(), path: fullPath, source: filePath });
        }
      });
    }
  });
  
  return endpoints.sort((a, b) => a.path.localeCompare(b.path));
}

function extractFrontendCalls() {
  const calls = [];
  
  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.')) {
        scanDirectory(filePath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract API calls with context
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          const apiMatch = line.match(/['"`](\/api\/[^'"`]+)['"`]/);
          if (apiMatch) {
            const apiPath = apiMatch[1];
            const context = line.trim();
            const lineNumber = index + 1;
            
            calls.push({
              path: apiPath,
              file: filePath.replace(process.cwd() + '/', ''),
              line: lineNumber,
              context: context.length > 100 ? context.substring(0, 100) + '...' : context
            });
          }
        });
      }
    });
  }
  
  scanDirectory('client/src');
  return calls;
}

// Generate comprehensive catalog
console.log('=== WAREHOUSE MANAGEMENT SYSTEM - COMPLETE API CATALOG ===\n');

const backendEndpoints = extractBackendEndpoints();
const frontendCalls = extractFrontendCalls();

// Group frontend calls by normalized path
const frontendByPath = {};
frontendCalls.forEach(call => {
  let normalizedPath = call.path
    .replace(/\/\d+/g, '/:id')
    .replace(/\/\${[^}]+}/g, '/:id')
    .replace(/\?[^'"`]*/g, '');
  
  if (!frontendByPath[normalizedPath]) {
    frontendByPath[normalizedPath] = [];
  }
  frontendByPath[normalizedPath].push(call);
});

console.log(`BACKEND ENDPOINTS: ${backendEndpoints.length}`);
console.log(`FRONTEND API CALLS: ${Object.keys(frontendByPath).length} unique paths\n`);

// Create comprehensive mapping
const backendPaths = new Set(backendEndpoints.map(e => e.path));
const frontendPaths = Object.keys(frontendByPath);

console.log('=== COMPLETE ENDPOINT CATALOG ===\n');

// 1. Endpoints with perfect matches
const perfectMatches = [];
frontendPaths.forEach(fePath => {
  const variations = [
    fePath,
    fePath.replace(/:\w+/g, ':id'),
    fePath.replace(/:id/g, '/:id')
  ];
  
  const matchedBackend = backendEndpoints.find(be => variations.includes(be.path));
  if (matchedBackend) {
    perfectMatches.push({
      path: fePath,
      backend: matchedBackend,
      frontend: frontendByPath[fePath]
    });
  }
});

console.log('✅ WORKING API RELATIONSHIPS:');
perfectMatches.forEach(match => {
  const fileCount = match.frontend.length;
  const files = [...new Set(match.frontend.map(f => f.file))];
  console.log(`   ${match.backend.method} ${match.path}`);
  console.log(`     Backend: ${match.backend.source}`);
  console.log(`     Frontend: ${files.slice(0, 2).join(', ')}${files.length > 2 ? ` (+${files.length - 2} more)` : ''}`);
  console.log('');
});

// 2. Missing backend endpoints
const missingBackend = [];
frontendPaths.forEach(fePath => {
  const variations = [
    fePath,
    fePath.replace(/:\w+/g, ':id'),
    fePath.replace(/:id/g, '/:id')
  ];
  
  const hasBackend = backendEndpoints.some(be => variations.includes(be.path));
  if (!hasBackend) {
    missingBackend.push({
      path: fePath,
      frontend: frontendByPath[fePath]
    });
  }
});

console.log('❌ MISSING BACKEND ENDPOINTS:');
missingBackend.forEach(missing => {
  const files = [...new Set(missing.frontend.map(f => f.file))];
  const usageCount = missing.frontend.length;
  console.log(`   ${missing.path}`);
  console.log(`     Used ${usageCount} times in: ${files.slice(0, 2).join(', ')}${files.length > 2 ? ` (+${files.length - 2} more)` : ''}`);
  console.log('');
});

// 3. Unused backend endpoints
const usedBackendPaths = new Set();
perfectMatches.forEach(match => {
  usedBackendPaths.add(match.backend.path);
});

const unusedBackend = backendEndpoints.filter(be => !usedBackendPaths.has(be.path));

console.log('⚠️  UNUSED BACKEND ENDPOINTS:');
unusedBackend.forEach(endpoint => {
  console.log(`   ${endpoint.method} ${endpoint.path}`);
  console.log(`     Source: ${endpoint.source}`);
});

// 4. Summary statistics
console.log('\n=== CATALOG SUMMARY ===');
console.log(`Total backend endpoints: ${backendEndpoints.length}`);
console.log(`Frontend API paths: ${frontendPaths.length}`);
console.log(`Working relationships: ${perfectMatches.length}`);
console.log(`Missing backend endpoints: ${missingBackend.length}`);
console.log(`Unused backend endpoints: ${unusedBackend.length}`);

const healthPercentage = Math.round((perfectMatches.length / frontendPaths.length) * 100);
console.log(`API health score: ${healthPercentage}%`);

// 5. Priority recommendations
console.log('\n=== PRIORITY ACTIONS NEEDED ===');

const criticalMissing = missingBackend
  .sort((a, b) => b.frontend.length - a.frontend.length)
  .slice(0, 10);

console.log('🔥 CRITICAL - Most used missing endpoints:');
criticalMissing.forEach((missing, index) => {
  console.log(`${index + 1}. ${missing.path} (used ${missing.frontend.length} times)`);
});

console.log('\n📊 CLEANUP OPPORTUNITIES:');
const cleanupCandidates = unusedBackend.slice(0, 10);
cleanupCandidates.forEach(endpoint => {
  console.log(`• ${endpoint.method} ${endpoint.path}`);
});

console.log('\n=== END OF CATALOG ===');
