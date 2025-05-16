#!/bin/bash
# Production startup script for the Warehouse Management System
# This script builds and runs the application in production mode

# Display banner
echo "======================================================"
echo "  Warehouse Management System - Production Startup"
echo "======================================================"

# Ensure we're in the project directory
cd "$(dirname "$0")"

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Warning: .env file not found. Creating a sample one..."
  echo "NODE_ENV=production" > .env
  echo "PORT=5000" >> .env
  echo "# Configure your printer port (e.g., COM3 on Windows, /dev/usb/lp0 on Linux)" >> .env
  echo "PRINTER_PORT=COM1" >> .env
  echo "Please update the .env file with your correct configuration."
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build the application
echo "Building application for production..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
  echo "Build failed! Please check the errors above."
  exit 1
fi

# Start in production mode
echo "Starting application in production mode..."
NODE_ENV=production node dist/index.js