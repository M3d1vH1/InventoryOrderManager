# Bundle Analysis Guide for Vite React Project

## Quick Start Commands

Since configuration files are protected, use these manual commands:

### 1. Build with Bundle Analysis
```bash
# Build using the analysis configuration
npx vite build --config vite.analyze.config.ts

# Or build the backend too
npx vite build --config vite.analyze.config.ts && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

### 2. View Results
After building, open `dist/bundle-analysis.html` in your browser to see the visualization.

## Analysis Configuration Features

The `vite.analyze.config.ts` includes:

- **Multiple visualization templates**: treemap (default), sunburst, network
- **Compression analysis**: Shows gzipped and brotli sizes
- **Manual chunk separation**: Organizes vendors by category for clearer analysis
- **Output location**: `dist/bundle-analysis.html`

## Understanding the Bundle Visualization

### 1. Treemap View (Default)
- **Large rectangles** = Large bundle components
- **Colors** represent different modules/chunks
- **Size** is proportional to actual file size
- **Hover** shows exact sizes and percentages

### 2. Key Metrics to Monitor
- **Total bundle size**: Should be < 500KB for good performance
- **Individual chunk sizes**: No single chunk should exceed 250KB
- **Vendor vs. application code ratio**: Aim for 60/40 or better

### 3. What to Look For

#### Large Dependencies to Investigate:
- **Date libraries**: moment.js (heavy) vs date-fns (lighter)
- **Icon libraries**: @fortawesome/fontawesome-free (very heavy)
- **UI components**: Multiple @radix-ui packages
- **Charts**: recharts can be large
- **PDF generation**: pdfkit and related packages

#### Red Flags:
- Any single dependency > 100KB
- Duplicate dependencies in different chunks
- Unused code in vendor bundles

## Optimization Strategies

### 1. Immediate Wins
```bash
# Replace FontAwesome with lucide-react (already done partially)
# You have both - consider removing FontAwesome
npm uninstall @fortawesome/fontawesome-free

# Use dynamic imports for heavy components
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));
```

### 2. Code Splitting Improvements
Your app already has:
- ✅ Page-level lazy loading (React.lazy)
- ✅ Vendor chunk separation in analysis config

### 3. Bundle Size Targets
- **Critical path**: < 150KB
- **Full app bundle**: < 500KB
- **Individual page chunks**: < 100KB each

## Current Bundle Composition

Based on your dependencies, expect these approximate sizes:

### Large Contributors:
- **@radix-ui packages**: ~150-200KB combined
- **recharts**: ~80-120KB
- **@fortawesome/fontawesome-free**: ~200-300KB
- **@tanstack/react-query**: ~40-60KB
- **react-hook-form**: ~30-50KB

### Optimization Opportunities:
1. **FontAwesome**: Replace with lucide-react entirely
2. **PDF generation**: Load pdfkit dynamically only when needed
3. **Charts**: Consider lazy loading recharts for reports page
4. **Calendar**: Load react-big-calendar only on calendar routes

## Running Different Analysis Views

### Treemap (Default)
```bash
npx vite build --config vite.analyze.config.ts
```

### Sunburst View
Edit `vite.analyze.config.ts` and change `template: "sunburst"`, then rebuild.

### Network View
Edit `vite.analyze.config.ts` and change `template: "network"`, then rebuild.

## Monitoring Over Time

Run bundle analysis:
- **Before major dependency updates**
- **After adding new features**
- **Monthly for size regression detection**

## Expected Results

With your current lazy loading implementation, you should see:
- **Main bundle**: ~200-300KB
- **Vendor chunks**: Separated by category
- **Page chunks**: 20-50KB each
- **Total downloaded on first visit**: ~400-500KB

The analysis will help identify which specific dependencies contribute most to bundle size and guide optimization decisions.