/**
 * REPLIT DEPLOYMENT OPTIMIZER
 * 
 * This module helps optimize Node.js applications running on Replit
 * to prevent 502 errors and improve performance under resource constraints.
 */

// Track memory usage and prevent leaks
function setupMemoryMonitor() {
  const memoryUsageInterval = setInterval(() => {
    // Get current memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = Math.round(memoryUsage.rss / 1024 / 1024);
    
    // Log if memory usage is high
    if (memoryUsageMB > 400) { // Over 400MB is concerning on Replit
      console.warn(`[MEMORY WARNING] High memory usage: ${memoryUsageMB}MB`);
      
      // Force garbage collection (if available in Node.js environment)
      if (global.gc) {
        global.gc();
        console.log('[MEMORY] Garbage collection triggered');
      }
    }
    
    // Log every 5 minutes for tracking
    if (new Date().getMinutes() % 5 === 0) {
      console.log(`[MEMORY] Current usage: ${memoryUsageMB}MB`);
    }
  }, 60000); // Check every minute
  
  return memoryUsageInterval;
}

// Optimize for Replit environment
function optimizeForReplit() {
  // Start memory monitoring
  const memoryMonitor = setupMemoryMonitor();
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[REPLIT] SIGTERM received, shutting down gracefully');
    clearInterval(memoryMonitor);
    
    // Allow time for cleanup before exit
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });
  
  // Register process-wide unhandled exception handler 
  // to prevent full crashes on Replit
  process.on('uncaughtException', (err) => {
    console.error('[FATAL ERROR] Uncaught exception:', err);
    // Don't exit the process, just log the error
  });
  
  // Set global timeout for all outgoing HTTP requests
  require('http').globalAgent.options.timeout = 10000;
  require('https').globalAgent.options.timeout = 10000;
  
  console.log('[REPLIT] Deployment optimizations applied');
}

module.exports = { optimizeForReplit };