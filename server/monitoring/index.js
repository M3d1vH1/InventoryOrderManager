const { startMonitoring, stopMonitoring } = require('./performanceMonitor');
const accessMonitorMiddleware = require('./accessMonitor');
const { log, logError } = require('./logger');

// Graceful shutdown handling
function setupGracefulShutdown() {
  // Handle application termination
  process.on('SIGTERM', () => {
    log('INFO', 'SIGTERM received, shutting down monitoring');
    stopMonitoring();
  });
  
  process.on('SIGINT', () => {
    log('INFO', 'SIGINT received, shutting down monitoring');
    stopMonitoring();
  });
}

// Initialize all monitoring
function initMonitoring(app, options = {}) {
  const {
    performanceInterval = 60000, // Default: log performance every minute
    detailedLogging = false      // More verbose logging
  } = options;
  
  try {
    // Apply access monitoring middleware
    app.use(accessMonitorMiddleware);
    
    // Start performance monitoring
    startMonitoring(performanceInterval);
    
    // Setup graceful shutdown
    setupGracefulShutdown();
    
    // Configure more detailed logging if needed
    if (detailedLogging) {
      // Add more detailed error tracking globally
      process.on('uncaughtException', (error) => {
        logError(error, { source: 'uncaughtException' });
      });
      
      process.on('unhandledRejection', (reason) => {
        logError(reason, { source: 'unhandledRejection' });
      });
    }
    
    log('INFO', 'Monitoring system initialized successfully');
    
    return true;
  } catch (error) {
    logError(error, { source: 'initMonitoring' });
    console.error('Failed to initialize monitoring:', error);
    return false;
  }
}

module.exports = {
  initMonitoring,
  accessMonitorMiddleware,
  startMonitoring,
  stopMonitoring,
  log,
  logError
};