#!/bin/bash
# Production startup script for Replit deployment

# Ensure proper environment
export NODE_ENV=production
export APP_URL=https://amphoreus.replit.app

echo "Starting Amphoreus Warehouse Management System in production mode..."

# Start the server directly from TypeScript (faster for Replit than building)
npx tsx server/index.ts