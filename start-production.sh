#!/bin/bash

echo "Starting production server..."

# Set production environment variables
export NODE_ENV=production
export PORT=5000

# Ensure build exists
if [ ! -f "dist/index.js" ]; then
    echo "Production build not found. Running build first..."
    ./build-production.sh
fi

# Start the production server
echo "Starting server on port 5000..."
node dist/index.js