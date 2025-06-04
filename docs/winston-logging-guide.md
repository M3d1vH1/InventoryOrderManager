# Enhanced Winston Logging System

This guide explains the comprehensive logging system implemented with Winston to replace the basic logger with structured JSON logging, request correlation IDs, and detailed error tracking.

## Overview

The logging system provides:
- **Structured JSON logging** with timestamps and log levels
- **Request correlation IDs** for tracking requests across the system
- **Contextual information** including user ID, IP address, and user agent
- **Automatic request/response logging** with timing information
- **Error stack trace logging** with full context
- **Daily rotating log files** with size limits and retention policies
- **Multiple log levels** (error, warn, info, debug)

## Architecture

### Core Components

1. **Winston Logger** (`server/utils/logger.ts`)
   - Main logging instance with custom formatting
   - Daily rotating file transports
   - Console logging for development
   - Structured JSON output

2. **Request Logging Middleware** (`server/middlewares/requestLogger.ts`)
   - Adds unique request IDs to all requests
   - Logs request/response details automatically
   - Provides helper functions for business and security events

3. **Enhanced Error Handler** (`server/middlewares/errorHandler.ts`)
   - Integrates with Winston for structured error logging
   - Includes request context in error logs
   - Maintains error correlation IDs

## Log Format

### JSON Structure
```json
{
  "timestamp": "2025-06-04 13:55:10",
  "level": "info",
  "message": "Request completed successfully",
  "service": "warehouse-management",
  "environment": "development",
  "requestId": "1749045310636-9nxsxc59o",
  "method": "GET",
  "url": "/api/user",
  "statusCode": 304,
  "responseTime": "110ms",
  "ip": "10.83.8.161",
  "userAgent": "Mozilla/5.0...",
  "userId": 1,
  "username": "admin"
}
```

### Log Levels
- **error**: Application errors, exceptions, and failures
- **warn**: Warning conditions, security events, validation failures
- **info**: General application flow, successful operations
- **debug**: Detailed debugging information (development only)

## File Organization

### Log Files Location: `./logs/`

- **application-YYYY-MM-DD.log**: All application logs (info level and above)
- **error-YYYY-MM-DD.log**: Error logs only
- **exceptions-YYYY-MM-DD.log**: Uncaught exceptions
- **rejections-YYYY-MM-DD.log**: Unhandled promise rejections

### Retention Policy
- **Application logs**: 14 days
- **Error logs**: 30 days
- **Exception logs**: 30 days
- **Maximum file size**: 20MB (auto-rotate)

## Usage Examples

### Basic Logging in Route Handlers

```typescript
import logger, { logError, logBusinessEvent } from '../utils/logger';
import { logSecurityEvent, logBusinessEvent as logBusinessEventWithReq } from '../middlewares/requestLogger';

// Info logging with context
app.get('/api/products', async (req, res) => {
  logger.info('Product list requested', {
    requestId: (req as any).requestId,
    userId: (req as any).user?.id,
    filters: req.query
  });

  try {
    const products = await getProducts(req.query);
    
    logBusinessEventWithReq(req, 'products_retrieved', {
      count: products.length,
      filters: req.query
    });

    res.json(products);
  } catch (error) {
    logError(error, {
      requestId: (req as any).requestId,
      operation: 'get_products',
      userId: (req as any).user?.id
    });
    
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
});
```

### Error Logging with Stack Traces

```typescript
// Automatic error logging (handled by global error middleware)
app.post('/api/products', async (req, res) => {
  try {
    const product = await createProduct(req.body);
    res.status(201).json(product);
  } catch (error) {
    // This error will be automatically logged by globalErrorHandler
    // with full request context, stack trace, and correlation ID
    throw error;
  }
});

// Manual error logging with additional context
app.delete('/api/products/:id', async (req, res) => {
  try {
    await deleteProduct(req.params.id);
    res.status(204).send();
  } catch (error) {
    logError(error, {
      requestId: (req as any).requestId,
      operation: 'delete_product',
      productId: req.params.id,
      userId: (req as any).user?.id,
      additionalContext: 'Product deletion failed'
    });
    
    res.status(500).json({ error: 'Failed to delete product' });
  }
});
```

### Security Event Logging

```typescript
// Failed authentication attempts
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  const user = await validateCredentials(username, password);
  
  if (!user) {
    logSecurityEvent(req, 'login_failed', {
      username,
      reason: 'invalid_credentials',
      attemptedAt: new Date().toISOString()
    });
    
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  logBusinessEventWithReq(req, 'user_login_success', {
    userId: user.id,
    username: user.username
  });
  
  res.json({ success: true, user });
});

// Rate limiting violations
app.use('/api', (req, res, next) => {
  if (isRateLimited(req.ip)) {
    logSecurityEvent(req, 'rate_limit_exceeded', {
      ip: req.ip,
      endpoint: req.path,
      requestCount: getRequestCount(req.ip)
    });
    
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  next();
});
```

### Business Event Logging

```typescript
// Order processing events
app.post('/api/orders/:id/ship', async (req, res) => {
  const orderId = req.params.id;
  
  try {
    const shipment = await processShipment(orderId, req.body);
    
    logBusinessEventWithReq(req, 'order_shipped', {
      orderId,
      shipmentId: shipment.id,
      trackingNumber: shipment.trackingNumber,
      carrier: shipment.carrier,
      shippedBy: (req as any).user?.id
    });
    
    res.json(shipment);
  } catch (error) {
    logError(error, {
      requestId: (req as any).requestId,
      operation: 'ship_order',
      orderId,
      userId: (req as any).user?.id
    });
    
    res.status(500).json({ error: 'Failed to process shipment' });
  }
});
```

### Database Operation Logging

```typescript
import { logDatabaseOperation } from '../utils/logger';

// Track database performance
async function createProduct(productData) {
  const startTime = Date.now();
  
  try {
    const result = await db.insert(products).values(productData);
    const duration = Date.now() - startTime;
    
    logDatabaseOperation('INSERT', 'products', duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logDatabaseOperation('INSERT', 'products', duration, error);
    throw error;
  }
}
```

## Configuration

### Environment Variables

```env
# Logging configuration
LOG_LEVEL=info              # minimum log level (error, warn, info, debug)
LOG_DIR=./logs             # log files directory
LOG_MAX_SIZE=20m           # maximum log file size
LOG_MAX_FILES=14d          # log file retention period
```

### Development vs Production

**Development Mode:**
- Console logging with colors
- Debug level enabled
- Full error details in console
- Structured JSON in files

**Production Mode:**
- File logging only
- Info level and above
- Sanitized error messages
- Compressed log files

## Request Flow Tracking

Every request gets a unique correlation ID that appears in all related log entries:

```
info: Request completed successfully {"requestId":"1749045310636-9nxsxc59o",...}
info: Business event: product_created {"requestId":"1749045310636-9nxsxc59o",...}
error: Application error occurred {"requestId":"1749045310636-9nxsxc59o",...}
```

This enables complete request tracing across the application.

## Log Analysis

### Common Log Queries

```bash
# Find all logs for a specific request
grep "1749045310636-9nxsxc59o" logs/application-*.log

# Find all errors for a specific user
grep '"userId":123' logs/error-*.log

# Find all failed login attempts
grep '"event":"login_failed"' logs/application-*.log

# Monitor response times
grep '"responseTime"' logs/application-*.log | grep -E '[0-9]{4,}ms'
```

### Log Monitoring

The structured JSON format enables easy integration with log analysis tools:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Fluentd
- CloudWatch Logs

## Best Practices

1. **Always include request ID** in manual log entries
2. **Use appropriate log levels** (don't log everything as info)
3. **Include relevant context** but avoid logging sensitive data
4. **Use business event logging** for important application events
5. **Log both successes and failures** for complete audit trails
6. **Avoid logging passwords, tokens, or personal data**
7. **Use structured data** instead of string concatenation

## Migration from Basic Logger

The Winston system replaces your basic logger (`server/monitoring/logger.js`) with:

1. **Structured JSON output** instead of plain text
2. **Automatic request correlation** instead of manual tracking
3. **Multiple log levels** instead of single level
4. **File rotation** instead of single log file
5. **Error context** instead of basic error messages

All existing log calls will continue to work, but new code should use the enhanced Winston functions for better structured logging.