#!/bin/bash
# Step 2: Build frontend assets - part 1

echo "=== Build Step 2: Building frontend assets (phase 1) ==="
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

# Build only basic JS dependencies with limited modules
echo "Building core frontend modules..."
npx vite build --outDir=client/dist --config=vite.build.step1.js

echo "=== Build Step 2 complete ==="