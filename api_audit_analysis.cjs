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
    if (!fs.existsSync(dir)) return;
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
                  file: filePath.replace(process.cwd() + '/', ''),
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
console.log('=== COMPREHENSIVE API AUDIT ANALYSIS ===\n');

const backendRoutes = findAPIEndpoints();
const frontendCalls = findFrontendAPICalls();

console.log(`Backend API endpoints: ${backendRoutes.length}`);
console.log(`Frontend API calls: ${frontendCalls.length}\n`);

// Group frontend calls by path
const frontendByPath = {};
frontendCalls.forEach(call => {
  const basePath = call.path.replace(/\/\d+/g, '/:id').replace(/\/:[^\/]+/g, '/:id');
  if (!frontendByPath[basePath]) {
    frontendByPath[basePath] = [];
  }
  frontendByPath[basePath].push(call);
});

// Check for mismatches
console.log('=== FRONTEND CALLS WITHOUT BACKEND ENDPOINTS ===');
const backendPaths = new Set(backendRoutes.map(r => r.path));
const missingBackend = [];

Object.keys(frontendByPath).forEach(path => {
  const variations = [
    path,
    path.replace(/\/\d+/g, '/:id'),
    path.replace(/\/:[^\/]+/g, '/:id'),
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
    console.log(`❌ MISSING: ${missing.path}`);
    console.log(`   Files: ${missing.usedIn.slice(0, 2).join(', ')}${missing.usedIn.length > 2 ? ` (+${missing.usedIn.length - 2} more)` : ''}\n`);
  });
} else {
  console.log('✅ All frontend calls have backend endpoints\n');
}

console.log('=== BACKEND ENDPOINTS NOT USED BY FRONTEND ===');
const frontendPaths = new Set(Object.keys(frontendByPath));
const unusedBackend = backendRoutes.filter(route => {
  const variations = [
    route.path,
    route.path.replace(/:\w+/g, ':id'),
    route.path.replace(/:id/g, '/:id')
  ];
  return !variations.some(v => frontendPaths.has(v));
});

if (unusedBackend.length > 0) {
  console.log('The following endpoints exist but are not called by the frontend:');
  unusedBackend.forEach(route => {
    console.log(`⚠️  ${route.method} ${route.path}`);
  });
  console.log('');
} else {
  console.log('✅ All backend endpoints are used by frontend\n');
}

// Check for potential issues
console.log('=== POTENTIAL ISSUES DETECTED ===');
let issuesFound = 0;

// Check for commonly problematic patterns
const problemPatterns = [
  { pattern: /\/api\/.*\/\d+/, description: 'Hardcoded IDs in API paths' },
  { pattern: /\/api\/.*\?.*/, description: 'Query parameters in base paths' }
];

frontendCalls.forEach(call => {
  problemPatterns.forEach(({ pattern, description }) => {
    if (pattern.test(call.path)) {
      console.log(`⚠️  ${description}: ${call.path} in ${call.file}`);
      issuesFound++;
    }
  });
});

if (issuesFound === 0) {
  console.log('✅ No obvious API pattern issues detected\n');
} else {
  console.log('');
}

console.log('=== AUDIT SUMMARY ===');
console.log(`Total backend endpoints: ${backendRoutes.length}`);
console.log(`Unique frontend API paths: ${Object.keys(frontendByPath).length}`);
console.log(`Missing backend endpoints: ${missingBackend.length}`);
console.log(`Unused backend endpoints: ${unusedBackend.length}`);
console.log(`Pattern issues detected: ${issuesFound}`);

if (missingBackend.length === 0 && unusedBackend.length < 10 && issuesFound === 0) {
  console.log('\n🎉 AUDIT RESULT: API relationships are well-structured!');
} else if (missingBackend.length > 0) {
  console.log('\n⚠️  AUDIT RESULT: Critical issues found - missing backend endpoints');
} else {
  console.log('\n✅ AUDIT RESULT: Minor cleanup opportunities exist');
}
