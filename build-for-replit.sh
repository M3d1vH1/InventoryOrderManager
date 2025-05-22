#!/bin/bash
# Build script optimized for Replit deployment

echo "=== Building application for Replit deployment ==="

# Ensure environment is set to production
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

# Clean previous build
echo "Cleaning previous build..."
rm -rf dist

# Build frontend
echo "Building frontend..."
npm run build

# Make the script executable
chmod +x build-for-replit.sh

echo "=== Build complete! ==="
echo "To start the application in production mode, run: npm run start"