#!/bin/bash

# Bundle Analysis Script for Vite React Project
# This script builds the project with bundle analysis and opens the results

echo "🔍 Starting bundle analysis..."

# Clean previous build
echo "Cleaning previous build..."
rm -rf dist/

# Build with analysis configuration
echo "Building with bundle analysis..."
npx vite build --config vite.analyze.config.ts

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo ""
    echo "📊 Bundle analysis report generated at: dist/bundle-analysis.html"
    echo ""
    echo "To view the analysis:"
    echo "1. Open dist/bundle-analysis.html in your browser"
    echo "2. Or run: python3 -m http.server 8080 --directory dist"
    echo "   Then visit: http://localhost:8080/bundle-analysis.html"
    echo ""
    
    # Show basic file sizes
    echo "📁 Build output summary:"
    if [ -d "dist/public" ]; then
        du -sh dist/public/* 2>/dev/null | sort -hr
    fi
    
    echo ""
    echo "🎯 Look for:"
    echo "  - Individual files > 100KB"
    echo "  - Total bundle size > 500KB" 
    echo "  - Duplicate dependencies"
    echo "  - Unused vendor code"
    
else
    echo "❌ Build failed. Check the error messages above."
    exit 1
fi