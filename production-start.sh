#!/bin/bash

# Set NODE_ENV to production
export NODE_ENV=production

# Build the application
echo "Building the application..."
npm run build

# Start the application in production mode
echo "Starting the application in production mode..."
npm run start