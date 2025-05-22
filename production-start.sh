#!/bin/bash
# Production startup script for Replit deployment

echo "Starting Amphoreus Warehouse Management System in production mode..."

# Ensure proper environment
export NODE_ENV=production

# Start the production server
node dist/index.js