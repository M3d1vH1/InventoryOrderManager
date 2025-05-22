#!/bin/bash
# Build script broken into smaller steps for Replit deployment

echo "=== Step 1: Setting up environment ==="
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

echo "=== Step 2: Cleaning previous build artifacts ==="
rm -rf dist
rm -rf client/dist

echo "=== Step 3: Building frontend (this will take a while) ==="
npx vite build

echo "=== Step 4: Building backend ==="
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "=== Build complete ==="
echo "To start the application in production mode, run: NODE_ENV=production node dist/index.js"