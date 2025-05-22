const { logAccess } = require('./logger');

/**
 * Middleware to monitor and log all incoming HTTP requests
 * This provides visibility into who is accessing your application and when
 */
function accessMonitorMiddleware(req, res, next) {
  // Record request start time
  const startTime = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override the end function
  res.end = function(chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Log the access
    logAccess(req, res, responseTime);
    
    // Call the original end function
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

module.exports = accessMonitorMiddleware;