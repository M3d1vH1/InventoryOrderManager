const fs = require('fs');

function extractRouterEndpoints() {
  const endpoints = [];
  
  // Router files to check
  const routers = [
    { file: 'server/api/callLogs.ts', basePath: '/api/call-logs' },
    { file: 'server/api/production.ts', basePath: '/api/production' },
    { file: 'server/api/supplierPayments.ts', basePath: '/api/supplier-payments' },
    { file: 'server/api/prospectiveCustomers.ts', basePath: '/api/prospective-customers' },
    { file: 'server/api/reports.ts', basePath: '/api/reports' },
    { file: 'server/api/customers.ts', basePath: '/api/customers' }
  ];
  
  routers.forEach(({ file, basePath }) => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(/router\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g) || [];
      
      matches.forEach(match => {
        const [, method, routePath] = match.match(/router\.(\w+)\(['"`]([^'"`]+)['"`]/) || [];
        if (routePath) {
          const fullPath = routePath === '/' ? basePath : `${basePath}${routePath}`;
          endpoints.push({ 
            method: method.toUpperCase(), 
            path: fullPath, 
            source: file,
            router: true 
          });
        }
      });
    }
  });
  
  return endpoints;
}

function extractMainRouteEndpoints() {
  const endpoints = [];
  const content = fs.readFileSync('server/routes.ts', 'utf8');
  const matches = content.match(/app\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g) || [];
  
  matches.forEach(match => {
    const [, method, path] = match.match(/app\.(\w+)\(['"`]([^'"`]+)['"`]/) || [];
    if (path && path.startsWith('/api/')) {
      endpoints.push({ 
        method: method.toUpperCase(), 
        path, 
        source: 'server/routes.ts',
        router: false 
      });
    }
  });
  
  return endpoints;
}

function extractFrontendCalls() {
  const calls = [];
  
  function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = require('path').join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.')) {
        scanDirectory(filePath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          const apiMatch = line.match(/['"`](\/api\/[^'"`\?\s]+)/);
          if (apiMatch) {
            let apiPath = apiMatch[1];
            // Normalize dynamic segments
            apiPath = apiPath
              .replace(/\/\d+/g, '/:id')
              .replace(/\/\${[^}]+}/g, '/:id')
              .replace(/\/:[^\/\s]+/g, '/:id');
            
            calls.push({
              path: apiPath,
              file: filePath.replace(process.cwd() + '/', ''),
              line: index + 1,
              original: apiMatch[1]
            });
          }
        });
      }
    });
  }
  
  scanDirectory('client/src');
  return calls;
}

// Generate corrected analysis
console.log('=== CORRECTED API AUDIT ===\n');

const routerEndpoints = extractRouterEndpoints();
const mainEndpoints = extractMainRouteEndpoints();
const allBackendEndpoints = [...routerEndpoints, ...mainEndpoints];
const frontendCalls = extractFrontendCalls();

console.log(`Router endpoints: ${routerEndpoints.length}`);
console.log(`Main route endpoints: ${mainEndpoints.length}`);
console.log(`Total backend endpoints: ${allBackendEndpoints.length}`);

// Group frontend calls
const frontendByPath = {};
frontendCalls.forEach(call => {
  if (!frontendByPath[call.path]) {
    frontendByPath[call.path] = [];
  }
  frontendByPath[call.path].push(call);
});

console.log(`Unique frontend paths: ${Object.keys(frontendByPath).length}\n`);

// Check critical endpoints specifically
const criticalPaths = [
  '/api/call-logs',
  '/api/production/orders', 
  '/api/supplier-payments/invoices'
];

console.log('=== STATUS OF TOP 3 CRITICAL ENDPOINTS ===\n');

criticalPaths.forEach(path => {
  const backendExists = allBackendEndpoints.some(ep => 
    ep.path === path || ep.path === path + '/' || ep.path === path.replace('/:id', '')
  );
  
  const frontendUsage = frontendByPath[path] || frontendByPath[path + '/:id'] || [];
  
  console.log(`${path}:`);
  console.log(`  Backend exists: ${backendExists ? '✅' : '❌'}`);
  console.log(`  Frontend usage: ${frontendUsage.length} calls`);
  
  if (backendExists) {
    const endpoint = allBackendEndpoints.find(ep => 
      ep.path === path || ep.path === path + '/' || ep.path === path.replace('/:id', '')
    );
    console.log(`  Source: ${endpoint.source}`);
    console.log(`  Method: ${endpoint.method}`);
  }
  
  if (frontendUsage.length > 0) {
    const files = [...new Set(frontendUsage.map(u => u.file))];
    console.log(`  Used in: ${files.slice(0, 2).join(', ')}${files.length > 2 ? ` (+${files.length - 2} more)` : ''}`);
  }
  console.log('');
});

// Show router-based endpoints for the critical ones
console.log('=== ROUTER ENDPOINT DETAILS ===\n');

['call-logs', 'production', 'supplier-payments'].forEach(router => {
  const routerPath = `/api/${router}`;
  const routerEndpointsForThis = routerEndpoints.filter(ep => ep.path.startsWith(routerPath));
  
  console.log(`${router.toUpperCase()} Router (${routerEndpointsForThis.length} endpoints):`);
  routerEndpointsForThis.slice(0, 10).forEach(ep => {
    console.log(`  ${ep.method} ${ep.path}`);
  });
  if (routerEndpointsForThis.length > 10) {
    console.log(`  ... and ${routerEndpointsForThis.length - 10} more`);
  }
  console.log('');
});
