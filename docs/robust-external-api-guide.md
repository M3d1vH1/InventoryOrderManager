# Robust External API Integration Guide

This guide demonstrates how to make external API calls more robust with timeouts, retries, exponential backoff, and proper error handling to prevent 502 errors and improve reliability.

## Overview

The robust HTTP client system provides:
- **Configurable timeouts** to prevent hanging requests
- **Automatic retries** with exponential backoff
- **Jitter** to prevent thundering herd problems
- **Circuit breaker patterns** for failing services
- **Comprehensive error handling** with detailed logging
- **Request correlation IDs** for debugging

## Implementation

### 1. Basic Robust HTTP Client Usage

```typescript
import { RobustHttpClient, HttpRequestError } from '../utils/robustHttpClient';

// Create client with custom configuration
const client = new RobustHttpClient(
  {
    baseURL: 'https://api.external-service.com',
    headers: {
      'Authorization': 'Bearer your-api-key',
      'Content-Type': 'application/json'
    }
  },
  {
    timeout: 15000,        // 15 seconds timeout
    maxRetries: 3,         // Retry up to 3 times
    retryDelay: 2000,      // Start with 2 second delay
    maxRetryDelay: 30000,  // Max 30 seconds between retries
    backoffMultiplier: 2,  // Double delay each retry: 2s, 4s, 8s
    enableJitter: true,    // Add randomness to prevent thundering herd
    retryStatusCodes: [408, 429, 500, 502, 503, 504],
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}: ${error.message}`);
    }
  }
);

// Make requests
try {
  const response = await client.post('/webhook', { data: 'payload' });
  console.log('Success:', response.data);
} catch (error) {
  if (error instanceof HttpRequestError) {
    console.error('Request failed:', {
      message: error.message,
      statusCode: error.statusCode,
      attempts: error.attempts,
      isTimeout: error.isTimeout,
      isNetworkError: error.isNetworkError
    });
  }
}
```

### 2. Slack Webhook Integration

```typescript
export class RobustSlackService {
  private httpClient: RobustHttpClient;
  
  constructor() {
    this.httpClient = new RobustHttpClient(
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Warehouse-Management-System/1.0'
        }
      },
      {
        timeout: 15000,
        maxRetries: 3,
        retryDelay: 2000,
        maxRetryDelay: 30000,
        retryStatusCodes: [408, 429, 500, 502, 503, 504],
        onRetry: (attempt, error) => {
          console.log(`Slack notification retry ${attempt}: ${error.message}`);
        }
      }
    );
  }

  async sendNotification(webhookUrl: string, message: any): Promise<boolean> {
    try {
      const response = await this.httpClient.post(webhookUrl, message);
      console.log('Slack notification sent successfully');
      return true;
    } catch (error) {
      if (error instanceof HttpRequestError) {
        console.error('Slack notification failed:', {
          statusCode: error.statusCode,
          attempts: error.attempts,
          isTimeout: error.isTimeout
        });
      }
      return false;
    }
  }
}
```

### 3. Email Service Integration

```typescript
export class RobustEmailService {
  private httpClient: RobustHttpClient;
  
  constructor() {
    this.httpClient = new RobustHttpClient(
      {
        baseURL: 'https://api.sendgrid.com/v3',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json'
        }
      },
      {
        timeout: 20000,
        maxRetries: 3,
        retryDelay: 3000,
        maxRetryDelay: 45000,
        retryStatusCodes: [408, 429, 500, 502, 503, 504]
      }
    );
  }

  async sendEmail(to: string, subject: string, content: string): Promise<boolean> {
    try {
      const emailData = {
        personalizations: [{ to: [{ email: to }], subject }],
        from: { email: process.env.FROM_EMAIL },
        content: [{ type: 'text/html', value: content }]
      };
      
      await this.httpClient.post('/mail/send', emailData);
      return true;
    } catch (error) {
      if (error instanceof HttpRequestError) {
        console.error('Email sending failed:', error.message);
      }
      return false;
    }
  }
}
```

### 4. Payment Gateway Integration

```typescript
export class RobustPaymentService {
  private httpClient: RobustHttpClient;
  
  constructor() {
    this.httpClient = new RobustHttpClient(
      {
        baseURL: 'https://api.stripe.com/v1',
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      },
      {
        timeout: 30000,
        maxRetries: 2, // Fewer retries for payments to avoid double charging
        retryDelay: 5000,
        retryStatusCodes: [500, 502, 503, 504], // Don't retry 4xx errors
        shouldRetry: (error) => {
          // Custom logic: don't retry client errors for payments
          if (error.response && error.response.status >= 400 && error.response.status < 500) {
            return false;
          }
          return true;
        }
      }
    );
  }

  async processPayment(amount: number, currency: string, paymentMethodId: string) {
    try {
      const response = await this.httpClient.post('/payment_intents', 
        new URLSearchParams({
          amount: amount.toString(),
          currency,
          payment_method: paymentMethodId,
          confirm: 'true'
        })
      );
      
      return { success: true, paymentIntentId: response.data.id };
    } catch (error) {
      if (error instanceof HttpRequestError) {
        if (error.statusCode === 402) {
          throw new Error('Payment declined');
        }
        throw new Error(`Payment failed: ${error.message}`);
      }
      throw error;
    }
  }
}
```

## Configuration Options

### Timeout Settings
- `timeout`: Maximum time to wait for a single request (default: 10000ms)
- Set based on external service SLA (e.g., 15s for webhooks, 30s for payments)

### Retry Configuration
- `maxRetries`: Maximum number of retry attempts (default: 3)
- `retryDelay`: Initial delay between retries (default: 1000ms)
- `maxRetryDelay`: Maximum delay between retries (default: 30000ms)
- `backoffMultiplier`: Exponential backoff multiplier (default: 2)

### Advanced Options
- `enableJitter`: Add randomness to delays (default: true)
- `retryStatusCodes`: HTTP status codes that trigger retries
- `retryErrorCodes`: Network error codes that trigger retries
- `shouldRetry`: Custom function to determine if retry should happen

## Error Handling Patterns

### 1. Service-Specific Error Handling

```typescript
try {
  await externalApiCall();
} catch (error) {
  if (error instanceof HttpRequestError) {
    if (error.statusCode === 429) {
      // Rate limited - implement exponential backoff
      throw new Error('Service temporarily unavailable - rate limited');
    }
    if (error.isTimeout) {
      // Timeout occurred
      throw new Error('Service timeout - please try again');
    }
    if (error.isNetworkError) {
      // Network connectivity issue
      throw new Error('Network connectivity issue');
    }
  }
  throw error;
}
```

### 2. Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeout = 60000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

## Best Practices

### 1. Service-Specific Configuration

```typescript
// Webhook services - fast timeout, more retries
const webhookConfig = {
  timeout: 10000,
  maxRetries: 4,
  retryDelay: 1000
};

// Payment services - longer timeout, fewer retries
const paymentConfig = {
  timeout: 30000,
  maxRetries: 2,
  retryDelay: 5000
};

// Email services - medium timeout, standard retries
const emailConfig = {
  timeout: 20000,
  maxRetries: 3,
  retryDelay: 3000
};
```

### 2. Monitoring and Logging

```typescript
const client = new RobustHttpClient({}, {
  onRetry: (attempt, error) => {
    // Log retry attempts for monitoring
    console.log(`External API retry ${attempt}: ${error.message}`);
    
    // Send to monitoring service
    monitoring.recordRetry({
      service: 'external-api',
      attempt,
      error: error.message
    });
  }
});
```

### 3. Environment-Specific Settings

```typescript
const getTimeoutConfig = () => {
  if (process.env.NODE_ENV === 'production') {
    return {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 2000
    };
  } else {
    return {
      timeout: 10000,
      maxRetries: 1,
      retryDelay: 1000
    };
  }
};
```

## Integration with Express Routes

```typescript
import { asyncHandler } from '../middlewares/errorHandler';
import { createApiError } from '../utils/errorUtils';

export const sendNotification = asyncHandler(async (req, res) => {
  const { message, webhookUrl } = req.body;
  
  try {
    const success = await robustSlackService.sendNotification(webhookUrl, message);
    
    if (success) {
      res.json({ success: true, message: 'Notification sent' });
    } else {
      throw createApiError('Notification delivery failed', 502, 'NOTIFICATION_FAILED');
    }
  } catch (error) {
    if (error instanceof HttpRequestError) {
      throw createApiError(
        `External service error: ${error.message}`,
        error.statusCode || 502,
        'EXTERNAL_SERVICE_ERROR',
        { attempts: error.attempts, isTimeout: error.isTimeout }
      );
    }
    throw error;
  }
});
```

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**: Often caused by timeouts or service unavailability
   - Solution: Implement proper timeouts and retry logic

2. **Rate Limiting (429)**: API rate limits exceeded
   - Solution: Implement exponential backoff with jitter

3. **Network Timeouts**: Slow or unreliable networks
   - Solution: Adjust timeout values and retry counts

4. **Service Overload**: External service under heavy load
   - Solution: Implement circuit breaker pattern

### Monitoring Recommendations

- Track retry rates and failure patterns
- Monitor timeout frequencies
- Set up alerts for circuit breaker state changes
- Log external service response times
- Monitor error rates by service

This robust HTTP client system significantly reduces 502 errors and improves the reliability of external API integrations in your Node.js application.