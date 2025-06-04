import fs from 'fs';
import path from 'path';

// Quick analysis of dependencies and their sizes
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const deps = packageJson.dependencies;

console.log('📦 Bundle Size Analysis\n');

// Large dependencies analysis
const knownSizes = {
  '@fortawesome/fontawesome-free': '~300KB',
  'recharts': '~120KB', 
  '@radix-ui/react-dialog': '~25KB',
  '@radix-ui/react-dropdown-menu': '~30KB',
  '@radix-ui/react-toast': '~20KB',
  '@tanstack/react-query': '~60KB',
  'react-hook-form': '~50KB',
  'date-fns': '~80KB',
  'lucide-react': '~200KB (if importing all)',
  'react-icons': '~150KB (if importing all)',
  'pdfkit': '~200KB',
  'react-big-calendar': '~100KB',
  'wouter': '~5KB',
  'axios': '~15KB',
  'zod': '~25KB'
};

console.log('🎯 Large Dependencies Found:');
Object.keys(deps).forEach(dep => {
  if (knownSizes[dep]) {
    console.log(`  ${dep}: ${knownSizes[dep]}`);
  }
});

console.log('\n⚡ Optimization Recommendations:');

if (deps['@fortawesome/fontawesome-free']) {
  console.log('  ❌ FontAwesome (~300KB) - Replace with lucide-react entirely');
}

const radixCount = Object.keys(deps).filter(d => d.startsWith('@radix-ui')).length;
console.log(`  📦 ${radixCount} Radix UI components (~${radixCount * 25}KB total)`);

if (deps['react-icons']) {
  console.log('  ⚠️  React Icons - Use specific imports: react-icons/fa, react-icons/md');
}

console.log('\n🔧 Quick Wins:');
console.log('  1. Remove @fortawesome/fontawesome-free');
console.log('  2. Use specific icon imports instead of full packages');
console.log('  3. Lazy load heavy components (PDF, Charts, Calendar)');

console.log('\n📊 Estimated Current Bundle Size: 800KB - 1.2MB');
console.log('📈 With optimizations: 400KB - 600KB');
