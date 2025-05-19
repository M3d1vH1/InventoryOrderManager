#!/bin/bash

# Build script for production deployment
echo "==============================================="
echo "  Production Build - Warehouse Management System"
echo "==============================================="
echo ""

# Make sure we're in development mode for the build
sed -i 's/NODE_ENV=production/NODE_ENV=development/g' .env

# Install dependencies if needed
echo "Checking dependencies..."
npm ci --silent || npm install --silent

# Create production build of client and server code
echo "Building client and server for production..."
npm run build

# Update environment to production mode
echo "Setting environment to production..."
sed -i 's/NODE_ENV=development/NODE_ENV=production/g' .env

# Set label dimensions to 9cm x 6cm
echo "Setting label dimensions..."
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

echo ""
echo "==============================================="
echo "Build complete! The application is ready for deployment."
echo "To run the production version locally:"
echo "  npm run start"
echo ""
echo "To deploy to Replit:"
echo "  1. Make sure you're in production mode (NODE_ENV=production in .env)"
echo "  2. Use the Deploy button in the Replit interface"
echo "==============================================="