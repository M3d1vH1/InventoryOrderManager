#!/bin/bash

# Build script for production deployment
echo "==============================================="
echo "  Production Build - Warehouse Management System"
echo "==============================================="
echo ""

# Make sure we're in development mode for the build process
echo "Setting NODE_ENV to development for the build process..."
sed -i 's/NODE_ENV=production/NODE_ENV=development/g' .env

# Install dependencies if needed
echo "Checking/installing dependencies..."
npm install --silent || echo "Warning: Some dependencies may be missing"

# Build the client and server for production
echo "Building client and server for production..."
npm run build

# Set proper label dimensions
echo "Setting label dimensions to 9cm x 6cm..."
if grep -q "LABEL_WIDTH" .env; then
  sed -i 's/LABEL_WIDTH=.*/LABEL_WIDTH=9/g' .env
else
  echo "LABEL_WIDTH=9" >> .env
fi

if grep -q "LABEL_HEIGHT" .env; then
  sed -i 's/LABEL_HEIGHT=.*/LABEL_HEIGHT=6/g' .env
else
  echo "LABEL_HEIGHT=6" >> .env
fi

# Switch to production mode
echo "Setting NODE_ENV to production for deployment..."
sed -i 's/NODE_ENV=development/NODE_ENV=production/g' .env

# Enable geoblocking for production
echo "Enabling geoblocking for production..."
if grep -q "ENABLE_GEOBLOCKING" .env; then
  sed -i 's/ENABLE_GEOBLOCKING=.*/ENABLE_GEOBLOCKING=true/g' .env
else
  echo "ENABLE_GEOBLOCKING=true" >> .env
fi

echo ""
echo "==============================================="
echo "Build complete! The application is ready for deployment."
echo "Run this script each time before deploying to production."
echo "==============================================="