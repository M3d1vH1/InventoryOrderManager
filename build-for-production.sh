#!/bin/bash
set -e

echo "Running optimized build process..."

# Clean up previous build
rm -rf dist
mkdir -p dist/public

# Bundle server-side code
echo "Building server-side code..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Build frontend with reduced workers to avoid memory issues
echo "Building client-side code..."
# Using lower number of workers and in-memory file system size
NODE_OPTIONS="--max-old-space-size=3072" npx vite build

echo "Build completed successfully!"
