#!/bin/bash
# Step 1: Setup and clean previous build artifacts

echo "=== Build Step 1: Setup and cleanup ==="
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

# Clean previous build files
echo "Cleaning previous build artifacts..."
rm -rf dist
rm -rf client/dist

# Create needed directories
mkdir -p dist
mkdir -p client/dist
mkdir -p server/public

echo "=== Build Step 1 complete ==="