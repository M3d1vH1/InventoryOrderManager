#!/bin/bash

# This script starts the application in production mode
# It assumes that you've already built the application with 'npm run build'

# Set environment to production
export NODE_ENV=production

# Start the server from the built files
echo "Starting server in production mode..."
node dist/index.js