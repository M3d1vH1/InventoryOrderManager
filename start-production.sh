#!/bin/bash

# Set environment to production
export NODE_ENV=production

# Build client files first
echo "Building client files..."
npm run build

# Run the production server
echo "Starting server in production mode..."
node dist/index.js