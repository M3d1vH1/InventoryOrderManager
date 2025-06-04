#!/usr/bin/env node

// Production startup script for Replit deployment
process.env.NODE_ENV = 'production';

// Set the port for deployment
const port = process.env.PORT || 5000;
process.env.PORT = port;

console.log('Starting production server...');
console.log('Port:', port);
console.log('Environment:', process.env.NODE_ENV);

// Import and start the production server
import('./dist/index.js').catch(err => {
  console.error('Failed to start production server:', err);
  process.exit(1);
});