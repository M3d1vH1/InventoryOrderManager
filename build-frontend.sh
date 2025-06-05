#!/bin/bash
# Step 1: Build just the frontend part of the application

echo "=== Building frontend only ==="
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

# Create client build directory if it doesn't exist
mkdir -p client/dist
mkdir -p server/public

# Build the frontend using Vite
npx vite build

echo "=== Frontend build complete ==="