#!/bin/bash
# Production build script to ensure frontend assets are properly placed

echo "=== Building Complete Production Version ==="
echo "Step 1: Setting environment variables..."
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

echo "Step 2: Building React frontend..."
# Build the frontend using Vite
npx vite build

echo "Step 3: Ensuring server/public directory exists..."
mkdir -p server/public

echo "Step 4: Copying frontend assets to server/public..."
# Copy the built assets to the server/public directory
cp -r client/dist/* server/public/

echo "Step 5: Building server with esbuild..."
# Build the server with esbuild
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "=== Production Build Complete ==="
echo "The application should now be ready to run in production mode!"