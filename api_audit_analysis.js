const fs = require('fs');
const path = require('path');

// Read all files and extract API patterns
function findAPIEndpoints() {
  const routesContent = fs.readFileSync('server/routes.ts', 'utf8');
  
  // Extract all API routes with their methods
  const apiRoutes = [];
  const routeMatches = routesContent.match(/app\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g);
  
  if (routeMatches) {
    routeMatches.forEach(match => {
      const [, method, path] = match.match(/app\.(\w+)\(['"`]([^'"`]+)['"`]/);
      if (path.startsWith('/api/')) {
        apiRoutes.push({ method: method.toUpperCase(), path, defined: true });
      }
    });
  }
  
  return apiRoutes;
}

function findFrontendAPICalls() {
  const frontendCalls = [];
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.')) {
        scanDirectory(filePath);
      } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Find API calls in various patterns
        const patterns = [
          /['"`]\/api\/[^'"`]+['"`]/g,
          /queryKey:\s*\[['"`]\/api\/[^'"`]+['"`]/g,
          /apiRequest\(['"`]\/api\/[^'"`]+['"`]/g,
          /fetch\(['"`]\/api\/[^'"`]+['"`]/g
        ];
        
        patterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            matches.forEach(match => {
              const apiPath = match.match(/\/api\/[^'"`]+/)?.[0];
              if (apiPath) {
                frontendCalls.push({
                  path: apiPath,
                  file: filePath,
                  context: match
                });
              }
            });
          }
        });
      }
    });
  }
  
  scanDirectory('client/src');
  return frontendCalls;
}

// Main analysis
console.log('=== API AUDIT ANALYSIS ===\n');

const backendRoutes = findAPIEndpoints();
const frontendCalls = findFrontendAPICalls();

console.log(`Found ${backendRoutes.length} backend API endpoints`);
console.log(`Found ${frontendCalls.length} frontend API calls\n`);

// Group frontend calls by path
const frontendByPath = {};
frontendCalls.forEach(call => {
  const basePath = call.path.replace(/\/:\w+/g, '/:id').replace(/\/\d+/g, '/:id');
  if (!frontendByPath[basePath]) {
    frontendByPath[basePath] = [];
  }
  frontendByPath[basePath].push(call);
});

// Check for mismatches
console.log('=== MISSING BACKEND ENDPOINTS ===');
const backendPaths = new Set(backendRoutes.map(r => r.path));
const missingBackend = [];

Object.keys(frontendByPath).forEach(path => {
  const normalizedPath = path.replace(/\/\d+/g, '/:id').replace(/\/:[^\/]+/g, '/:id');
  const variations = [
    path,
    normalizedPath,
    path.replace(/\/:\w+/g, '/:id')
  ];
  
  const found = variations.some(v => backendPaths.has(v));
  if (!found) {
    missingBackend.push({
      path,
      usedIn: frontendByPath[path].map(c => c.file)
    });
  }
});

if (missingBackend.length > 0) {
  missingBackend.forEach(missing => {
    console.log(`❌ ${missing.path}`);
    console.log(`   Used in: ${missing.usedIn.slice(0, 3).join(', ')}${missing.usedIn.length > 3 ? '...' : ''}\n`);
  });
} else {
  console.log('✅ All frontend API calls have corresponding backend endpoints\n');
}

console.log('=== UNUSED BACKEND ENDPOINTS ===');
const frontendPaths = new Set(Object.keys(frontendByPath));
const unusedBackend = backendRoutes.filter(route => {
  const variations = [
    route.path,
    route.path.replace(/:\w+/g, ':id')
  ];
  return !variations.some(v => frontendPaths.has(v));
});

if (unusedBackend.length > 0) {
  unusedBackend.forEach(route => {
    console.log(`⚠️  ${route.method} ${route.path}`);
  });
} else {
  console.log('✅ All backend endpoints are used by the frontend');
}

console.log('\n=== SUMMARY ===');
console.log(`Backend endpoints: ${backendRoutes.length}`);
console.log(`Frontend API calls: ${Object.keys(frontendByPath).length} unique paths`);
console.log(`Missing backend: ${missingBackend.length}`);
console.log(`Unused backend: ${unusedBackend.length}`);
