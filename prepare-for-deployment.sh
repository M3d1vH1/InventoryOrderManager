#!/bin/bash
# Deployment preparation script that ensures production mode is used

echo "===== Preparing for Deployment ====="
echo "Setting environment to production mode..."

# 1. Update the .env file to use production mode
if [ -f .env ]; then
  # Replace development with production if it exists
  sed -i 's/NODE_ENV=development/NODE_ENV=production/g' .env
  
  # Check if NODE_ENV exists, add it if not
  if ! grep -q "NODE_ENV=" .env; then
    echo "NODE_ENV=production" >> .env
  fi
else
  # Create .env file if it doesn't exist
  echo "NODE_ENV=production" > .env
  echo "APP_URL=https://amphoreus.replit.app" >> .env
fi

echo "Environment set to production mode."

# 2. Build the frontend for production
echo "Building frontend assets for production..."

# Create necessary directories
mkdir -p client/dist
mkdir -p server/public

# Run Vite build
npx vite build || { echo "Frontend build failed"; exit 1; }

# 3. Copy frontend assets to server/public
echo "Copying frontend assets to server/public..."
cp -r client/dist/* server/public/

# 4. Build the server with esbuild
echo "Building server..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist || { echo "Server build failed"; exit 1; }

echo "===== Deployment Preparation Complete ====="
echo "Your application is ready for deployment in production mode."
echo "Use the Replit deployment feature to deploy your application."