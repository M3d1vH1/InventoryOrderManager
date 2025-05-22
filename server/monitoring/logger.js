const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create log file paths
const accessLogPath = path.join(logsDir, 'access.log');
const errorLogPath = path.join(logsDir, 'error.log');
const performanceLogPath = path.join(logsDir, 'performance.log');

// Format timestamp for logs
function getTimestamp() {
  return format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS');
}

// Log levels
const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

// Core logging function
function logToFile(filePath, message) {
  const timestamp = getTimestamp();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  fs.appendFile(filePath, logEntry, (err) => {
    if (err) {
      console.error(`Failed to write to log file ${filePath}:`, err);
    }
  });
}

// Log access - use for tracking website visitors
function logAccess(req, res, time) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const method = req.method;
  const url = req.originalUrl || req.url;
  const status = res.statusCode;
  const responseTime = time;
  const userId = req.user ? req.user.id : 'unauthenticated';
  
  const message = `IP:${ip} | User:${userId} | ${method} ${url} | Status:${status} | Time:${responseTime}ms | UA:${userAgent}`;
  logToFile(accessLogPath, message);
}

// Log performance metrics - use for tracking CPU/memory usage
function logPerformance(metrics) {
  const { cpuUsage, memoryUsage, activeConnections, queryTime } = metrics;
  
  const message = `CPU:${cpuUsage}% | Memory:${memoryUsage}MB | DBConnections:${activeConnections} | QueryTime:${queryTime}ms`;
  logToFile(performanceLogPath, message);
}

// Log errors
function logError(error, context = {}) {
  const contextStr = Object.keys(context).length 
    ? ` | Context: ${JSON.stringify(context)}`
    : '';
  
  const message = `${LOG_LEVELS.ERROR} | ${error.message || error}${contextStr}`;
  
  // Also output to console for immediate visibility
  console.error(`[${getTimestamp()}] ${message}`);
  logToFile(errorLogPath, message);
}

// General purpose logging
function log(level, message, context = {}) {
  const logLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  const contextStr = Object.keys(context).length 
    ? ` | Context: ${JSON.stringify(context)}`
    : '';
  
  const logMessage = `${logLevel} | ${message}${contextStr}`;
  logToFile(accessLogPath, logMessage);
  
  // Also output to console for development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${getTimestamp()}] ${logMessage}`);
  }
}

module.exports = {
  logAccess,
  logPerformance,
  logError,
  log,
  LOG_LEVELS
};