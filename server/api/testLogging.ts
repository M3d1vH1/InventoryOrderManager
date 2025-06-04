import { Request, Response } from 'express';
import logger, { logError, logBusinessEvent, logDatabaseOperation } from '../utils/logger';
import { logSecurityEvent, logBusinessEvent as logBusinessEventWithReq } from '../middlewares/requestLogger';

/**
 * Test endpoint to demonstrate comprehensive Winston logging features
 */
export async function testAllLoggingFeatures(req: Request, res: Response) {
  const requestId = (req as any).requestId;
  
  try {
    // 1. Basic info logging with context
    logger.info('Logging test endpoint accessed', {
      requestId,
      userId: (req as any).user?.id,
      testType: 'comprehensive_logging_demo'
    });

    // 2. Debug level logging (only shows in development)
    logger.debug('Debug information for logging test', {
      requestId,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    });

    // 3. Business event logging with request context
    logBusinessEventWithReq(req, 'logging_test_started', {
      testId: 'LOGGING_TEST_001',
      features: ['json_format', 'request_id', 'context_data', 'error_handling']
    });

    // 4. Simulate database operations with timing
    const dbStartTime = Date.now();
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate DB delay
    logDatabaseOperation('SELECT', 'test_table', Date.now() - dbStartTime);

    // 5. Warning level logging
    logger.warn('Test warning message', {
      requestId,
      warningType: 'demonstration',
      severity: 'low'
    });

    // 6. Simulate different response scenarios based on query parameter
    const scenario = req.query.scenario as string;

    switch (scenario) {
      case 'error':
        // Demonstrate error logging with full context
        throw new Error('Intentional test error for logging demonstration');

      case 'security':
        // Demonstrate security event logging
        logSecurityEvent(req, 'suspicious_activity_detected', {
          activityType: 'test_security_log',
          riskLevel: 'low',
          details: 'This is a test security event'
        });
        break;

      case 'business':
        // Demonstrate complex business event
        logBusinessEventWithReq(req, 'important_business_operation', {
          operationType: 'test_operation',
          amount: 1000,
          currency: 'EUR',
          status: 'completed',
          metadata: {
            location: 'warehouse_a',
            operator: (req as any).user?.username || 'system'
          }
        });
        break;

      case 'performance':
        // Demonstrate performance logging
        const perfStart = Date.now();
        await new Promise(resolve => setTimeout(resolve, 200));
        const duration = Date.now() - perfStart;
        
        logger.info('Performance test completed', {
          requestId,
          operation: 'performance_simulation',
          duration: `${duration}ms`,
          status: duration < 500 ? 'fast' : 'slow'
        });
        break;
    }

    // 7. Success logging with structured response data
    const responseData = {
      success: true,
      message: 'All logging features demonstrated successfully',
      features_tested: [
        'structured_json_logging',
        'request_correlation_ids',
        'contextual_information',
        'multiple_log_levels',
        'business_event_tracking',
        'database_operation_logging',
        'security_event_logging',
        'error_handling_with_context'
      ],
      timestamp: new Date().toISOString(),
      requestId
    };

    logBusinessEventWithReq(req, 'logging_test_completed', {
      testResult: 'success',
      featuresCount: responseData.features_tested.length,
      scenario: scenario || 'default'
    });

    logger.info('Logging test completed successfully', {
      requestId,
      scenario: scenario || 'default',
      responseSize: JSON.stringify(responseData).length
    });

    res.json(responseData);

  } catch (error: any) {
    // Demonstrate comprehensive error logging
    logError(error, {
      requestId,
      operation: 'logging_test',
      userId: (req as any).user?.id,
      scenario: req.query.scenario,
      errorContext: 'This error was intentionally triggered for testing'
    });

    // Error response with correlation ID
    res.status(500).json({
      error: true,
      message: 'Logging test encountered an error (this may be intentional)',
      requestId,
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Simple endpoint to test request logging middleware
 */
export function testRequestLogging(req: Request, res: Response) {
  // This endpoint relies entirely on the request logging middleware
  // to demonstrate automatic request/response logging
  
  const delay = parseInt(req.query.delay as string) || 0;
  
  setTimeout(() => {
    res.json({
      message: 'Request logging test completed',
      requestId: (req as any).requestId,
      delay: `${delay}ms`,
      timestamp: new Date().toISOString()
    });
  }, delay);
}

/**
 * Test endpoint for validation error logging
 */
export function testValidationErrorLogging(req: Request, res: Response) {
  const { testField } = req.body;
  
  if (!testField) {
    logger.warn('Validation error in logging test', {
      requestId: (req as any).requestId,
      field: 'testField',
      errorType: 'required_field_missing',
      providedData: req.body
    });
    
    return res.status(400).json({
      error: true,
      message: 'Validation failed',
      requestId: (req as any).requestId,
      details: {
        field: 'testField',
        message: 'This field is required for the test'
      }
    });
  }
  
  logger.info('Validation test passed', {
    requestId: (req as any).requestId,
    testField: testField
  });
  
  res.json({
    success: true,
    message: 'Validation passed',
    testField: testField,
    requestId: (req as any).requestId
  });
}