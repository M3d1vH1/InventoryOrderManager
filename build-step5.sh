#!/bin/bash
# Step 5: Build frontend assets - part 4 (icons and remaining assets)

echo "=== Build Step 5: Building icons and remaining assets ==="
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

# Build icons and remaining assets
echo "Building icons and remaining assets..."
npx vite build --outDir=client/dist --config=vite.build.step4.js

echo "=== Build Step 5 complete ==="