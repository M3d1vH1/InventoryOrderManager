#!/bin/bash
# Step 4: Build frontend assets - part 3 (pages and application logic)

echo "=== Build Step 4: Building pages and application logic ==="
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

# Build pages and application logic
echo "Building pages and application logic..."
npx vite build --outDir=client/dist --config=vite.build.step3.js

echo "=== Build Step 4 complete ==="