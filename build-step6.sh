#!/bin/bash
# Step 6: Build backend and finalize production build

echo "=== Build Step 6: Building backend and finalizing production build ==="
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

# Copy frontend assets to server/public
echo "Copying frontend assets to server/public..."
cp -r client/dist/* server/public/

# Build backend with esbuild
echo "Building backend with esbuild..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "=== Build Step 6 complete ==="
echo ""
echo "Production build completed successfully!"
echo "You can now deploy your application to Replit."