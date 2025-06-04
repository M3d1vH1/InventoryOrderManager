/**
 * Examples demonstrating robust external API calls with timeouts, retries, and exponential backoff
 * These examples show how to handle various external services like webhooks, payment APIs, and notification services
 */

import { RobustHttpClient, HttpRequestError, robustHttpRequest } from '../utils/robustHttpClient';
import { asyncHandler } from '../middlewares/errorHandler';
import { ValidationError, createApiError } from '../utils/errorUtils';
import { Request, Response } from 'express';

// Example 1: Slack Webhook with Custom Retry Logic
export const sendSlackNotification = asyncHandler(async (req: Request, res: Response) => {
  const { message, webhookUrl } = req.body;
  
  if (!message || !webhookUrl) {
    throw new ValidationError('Message and webhook URL are required');
  }
  
  const slackClient = new RobustHttpClient(
    {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Warehouse-Management-System/1.0'
      }
    },
    {
      timeout: 15000, // 15 seconds
      maxRetries: 3,
      retryDelay: 2000, // Start with 2 seconds
      maxRetryDelay: 30000, // Max 30 seconds
      backoffMultiplier: 2, // Double delay each retry
      enableJitter: true, // Add randomness to prevent thundering herd
      retryStatusCodes: [408, 429, 500, 502, 503, 504],
      onRetry: (attempt, error) => {
        console.log(`Slack notification retry ${attempt}: ${error.message}`);
      }
    }
  );
  
  try {
    const response = await slackClient.post(webhookUrl, {
      text: message,
      username: 'Warehouse Bot',
      icon_emoji: ':package:'
    });
    
    res.json({ 
      success: true, 
      message: 'Slack notification sent successfully',
      responseStatus: response.status 
    });
  } catch (error) {
    if (error instanceof HttpRequestError) {
      throw createApiError(
        `Slack notification failed: ${error.message}`,
        error.statusCode || 502,
        'SLACK_API_ERROR',
        {
          attempts: error.attempts,
          isTimeout: error.isTimeout,
          isNetworkError: error.isNetworkError
        }
      );
    }
    throw error;
  }
});

// Example 2: Payment Gateway Integration (Stripe-like)
export const processPayment = asyncHandler(async (req: Request, res: Response) => {
  const { amount, currency, paymentMethodId } = req.body;
  
  if (!amount || !currency || !paymentMethodId) {
    throw new ValidationError('Amount, currency, and payment method are required');
  }
  
  // Configure for payment API with strict timeouts
  const paymentClient = new RobustHttpClient(
    {
      baseURL: 'https://api.stripe.com/v1',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    },
    {
      timeout: 30000, // 30 seconds for payment processing
      maxRetries: 2, // Only 2 retries for payments to avoid double charging
      retryDelay: 5000, // 5 seconds between retries
      retryStatusCodes: [500, 502, 503, 504], // Don't retry 4xx errors for payments
      shouldRetry: (error) => {
        // Custom retry logic: only retry on server errors, not client errors
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          return false; // Don't retry 4xx errors
        }
        return true;
      },
      onRetry: (attempt, error) => {
        console.log(`Payment retry ${attempt}: ${error.message} - This may indicate payment gateway issues`);
      }
    }
  );
  
  try {
    const response = await paymentClient.post('/payment_intents', new URLSearchParams({
      amount: amount.toString(),
      currency: currency,
      payment_method: paymentMethodId,
      confirm: 'true'
    }));
    
    res.json({
      success: true,
      paymentIntentId: response.data.id,
      status: response.data.status
    });
  } catch (error) {
    if (error instanceof HttpRequestError) {
      // Handle specific payment errors
      if (error.statusCode === 402) {
        throw createApiError('Payment failed: Insufficient funds or card declined', 402, 'PAYMENT_DECLINED');
      }
      if (error.statusCode === 429) {
        throw createApiError('Payment failed: Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
      }
      throw createApiError(
        `Payment processing failed: ${error.message}`,
        error.statusCode || 502,
        'PAYMENT_API_ERROR',
        { attempts: error.attempts }
      );
    }
    throw error;
  }
});

// Example 3: Email Service API (SendGrid-like)
export const sendTransactionalEmail = asyncHandler(async (req: Request, res: Response) => {
  const { to, subject, htmlContent, templateId } = req.body;
  
  if (!to || !subject) {
    throw new ValidationError('Recipient email and subject are required');
  }
  
  const emailClient = new RobustHttpClient(
    {
      baseURL: 'https://api.sendgrid.com/v3',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      }
    },
    {
      timeout: 20000, // 20 seconds
      maxRetries: 3,
      retryDelay: 3000, // 3 seconds initial delay
      maxRetryDelay: 45000, // Max 45 seconds
      retryStatusCodes: [408, 429, 500, 502, 503, 504],
      onRetry: (attempt, error) => {
        console.log(`Email API retry ${attempt}: ${error.message}`);
      }
    }
  );
  
  try {
    const emailData = {
      personalizations: [{
        to: [{ email: to }],
        subject: subject
      }],
      from: { email: process.env.FROM_EMAIL || 'noreply@example.com' },
      content: [{
        type: 'text/html',
        value: htmlContent || '<p>Default email content</p>'
      }]
    };
    
    if (templateId) {
      (emailData as any).template_id = templateId;
    }
    
    const response = await emailClient.post('/mail/send', emailData);
    
    res.json({
      success: true,
      message: 'Email sent successfully',
      messageId: response.headers['x-message-id']
    });
  } catch (error) {
    if (error instanceof HttpRequestError) {
      throw createApiError(
        `Email sending failed: ${error.message}`,
        error.statusCode || 502,
        'EMAIL_API_ERROR',
        {
          attempts: error.attempts,
          isTimeout: error.isTimeout
        }
      );
    }
    throw error;
  }
});

// Example 4: External Inventory API Integration
export const syncExternalInventory = asyncHandler(async (req: Request, res: Response) => {
  const { productSku, quantity } = req.body;
  
  if (!productSku || quantity === undefined) {
    throw new ValidationError('Product SKU and quantity are required');
  }
  
  // Configure for external inventory system with long timeout
  const inventoryClient = new RobustHttpClient(
    {
      baseURL: process.env.EXTERNAL_INVENTORY_API_URL,
      headers: {
        'Authorization': `Bearer ${process.env.EXTERNAL_INVENTORY_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0'
      }
    },
    {
      timeout: 45000, // 45 seconds for inventory operations
      maxRetries: 4, // More retries for inventory sync
      retryDelay: 2000, // 2 seconds initial delay
      maxRetryDelay: 60000, // Max 1 minute
      backoffMultiplier: 1.5, // Slower exponential backoff
      enableJitter: true,
      retryStatusCodes: [408, 429, 500, 502, 503, 504],
      retryErrorCodes: ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'],
      onRetry: (attempt, error) => {
        console.log(`Inventory sync retry ${attempt}: ${error.message}`);
      }
    }
  );
  
  try {
    // First, get current inventory
    const currentInventory = await inventoryClient.get(`/products/${productSku}/inventory`);
    
    // Then update with new quantity
    const updateResponse = await inventoryClient.patch(`/products/${productSku}/inventory`, {
      quantity: quantity,
      lastUpdated: new Date().toISOString(),
      source: 'warehouse-management-system'
    });
    
    res.json({
      success: true,
      previousQuantity: currentInventory.data.quantity,
      newQuantity: updateResponse.data.quantity,
      syncTimestamp: updateResponse.data.lastUpdated
    });
  } catch (error) {
    if (error instanceof HttpRequestError) {
      if (error.statusCode === 404) {
        throw createApiError(`Product ${productSku} not found in external inventory system`, 404, 'PRODUCT_NOT_FOUND');
      }
      if (error.isTimeout) {
        throw createApiError(
          `Inventory sync timeout after ${error.attempts} attempts`,
          504,
          'INVENTORY_SYNC_TIMEOUT',
          { productSku, attempts: error.attempts }
        );
      }
      throw createApiError(
        `Inventory sync failed: ${error.message}`,
        error.statusCode || 502,
        'INVENTORY_SYNC_ERROR',
        { productSku, attempts: error.attempts }
      );
    }
    throw error;
  }
});

// Example 5: Webhook Notification with Circuit Breaker Pattern
class WebhookCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeout = 60000 // 1 minute
  ) {}
  
  async call<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
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

const webhookCircuitBreaker = new WebhookCircuitBreaker();

export const sendWebhookWithCircuitBreaker = asyncHandler(async (req: Request, res: Response) => {
  const { webhookUrl, payload } = req.body;
  
  if (!webhookUrl || !payload) {
    throw new ValidationError('Webhook URL and payload are required');
  }
  
  try {
    const result = await webhookCircuitBreaker.call(async () => {
      return await robustHttpRequest({
        method: 'POST',
        url: webhookUrl,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Warehouse-Management-System/1.0'
        }
      }, {
        timeout: 10000,
        maxRetries: 3,
        retryDelay: 1000,
        retryStatusCodes: [408, 429, 500, 502, 503, 504]
      });
    });
    
    res.json({
      success: true,
      message: 'Webhook sent successfully',
      status: result.status
    });
  } catch (error: any) {
    if (error.message.includes('Circuit breaker is OPEN')) {
      throw createApiError(
        'Webhook service temporarily unavailable due to repeated failures',
        503,
        'SERVICE_UNAVAILABLE'
      );
    }
    
    if (error instanceof HttpRequestError) {
      throw createApiError(
        `Webhook delivery failed: ${error.message}`,
        error.statusCode || 502,
        'WEBHOOK_DELIVERY_ERROR',
        { attempts: error.attempts }
      );
    }
    
    throw error;
  }
});

// Example 6: Batch Operations with Individual Retry Logic
export const processBatchWebhooks = asyncHandler(async (req: Request, res: Response) => {
  const { webhooks } = req.body; // Array of {url, payload} objects
  
  if (!Array.isArray(webhooks) || webhooks.length === 0) {
    throw new ValidationError('Webhooks array is required and must not be empty');
  }
  
  const client = new RobustHttpClient({}, {
    timeout: 10000,
    maxRetries: 2,
    retryDelay: 2000
  });
  
  const results = await Promise.allSettled(
    webhooks.map(async (webhook, index) => {
      try {
        const response = await client.post(webhook.url, webhook.payload);
        return {
          index,
          success: true,
          status: response.status,
          url: webhook.url
        };
      } catch (error) {
        return {
          index,
          success: false,
          error: error instanceof HttpRequestError ? error.message : 'Unknown error',
          url: webhook.url,
          attempts: error instanceof HttpRequestError ? error.attempts : 1
        };
      }
    })
  );
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - successful;
  
  res.json({
    success: failed === 0,
    total: webhooks.length,
    successful,
    failed,
    results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason })
  });
});

// Route registration examples (add these to your routes.ts file):
/*
app.post('/api/notifications/slack', sendSlackNotification);
app.post('/api/payments/process', processPayment);
app.post('/api/emails/send', sendTransactionalEmail);
app.patch('/api/inventory/sync', syncExternalInventory);
app.post('/api/webhooks/send', sendWebhookWithCircuitBreaker);
app.post('/api/webhooks/batch', processBatchWebhooks);
*/