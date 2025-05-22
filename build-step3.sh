#!/bin/bash
# Step 3: Build frontend assets - part 2 (UI components)

echo "=== Build Step 3: Building frontend UI components ==="
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

# Build UI components separately
echo "Building UI components..."
npx vite build --outDir=client/dist --config=vite.build.step2.js

echo "=== Build Step 3 complete ==="