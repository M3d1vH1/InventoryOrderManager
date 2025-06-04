import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');

// Create Winston logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: {
    service: 'warehouse-management',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // Daily rotating file for all logs
    new DailyRotateFile({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    }),
    
    // Daily rotating file for errors only
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    })
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ],
  
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

// Create child logger with additional context
export function createContextLogger(context: Record<string, any>) {
  return logger.child(context);
}

// Request logger function
export function logRequest(req: any, statusCode: number, responseTime?: number, additionalData?: any) {
  const logData = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    statusCode,
    responseTime: responseTime ? `${responseTime}ms` : undefined,
    userId: req.user?.id,
    username: req.user?.username,
    ...additionalData
  };

  // Log based on status code
  if (statusCode >= 500) {
    logger.error('Request completed with server error', logData);
  } else if (statusCode >= 400) {
    logger.warn('Request completed with client error', logData);
  } else {
    logger.info('Request completed successfully', logData);
  }
}

// Error logger function with stack trace
export function logError(error: Error, context?: Record<string, any>) {
  logger.error('Application error occurred', {
    errorName: error.name,
    errorMessage: error.message,
    stack: error.stack,
    ...context
  });
}

// Business logic logger
export function logBusinessEvent(event: string, data: Record<string, any>) {
  logger.info(`Business event: ${event}`, {
    event,
    ...data
  });
}

// Security logger
export function logSecurityEvent(event: string, data: Record<string, any>) {
  logger.warn(`Security event: ${event}`, {
    securityEvent: event,
    ...data
  });
}

// Database operation logger
export function logDatabaseOperation(operation: string, table: string, duration?: number, error?: Error) {
  const logData = {
    operation,
    table,
    duration: duration ? `${duration}ms` : undefined,
    error: error ? {
      name: error.name,
      message: error.message
    } : undefined
  };

  if (error) {
    logger.error(`Database operation failed: ${operation} on ${table}`, logData);
  } else {
    logger.debug(`Database operation completed: ${operation} on ${table}`, logData);
  }
}

// Export the main logger
export default logger;