#!/bin/bash

echo "Building production version..."

# Set production environment
export NODE_ENV=production

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf dist/
rm -rf public/

# Install dependencies
echo "Installing dependencies..."
npm install

# Build frontend and backend
echo "Building application..."
npm run build

# Verify build files exist
if [ ! -f "dist/index.js" ]; then
    echo "Build failed - server bundle not found"
    exit 1
fi

echo "Production build completed successfully"
echo "Build artifacts:"
ls -la dist/

echo "Ready for deployment"