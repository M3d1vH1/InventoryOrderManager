import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { log } from '../vite';

/**
 * Configuration for robust HTTP requests
 */
export interface RobustHttpConfig {
  /** Base timeout for each request attempt (default: 10000ms) */
  timeout?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay between retries in milliseconds (default: 1000ms) */
  retryDelay?: number;
  /** Maximum delay between retries in milliseconds (default: 30000ms) */
  maxRetryDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Add random jitter to retry delays (default: true) */
  enableJitter?: boolean;
  /** HTTP status codes that should trigger retries (default: [408, 429, 500, 502, 503, 504]) */
  retryStatusCodes?: number[];
  /** Network error codes that should trigger retries */
  retryErrorCodes?: string[];
  /** Custom retry condition function */
  shouldRetry?: (error: AxiosError) => boolean;
  /** Callback for retry attempts */
  onRetry?: (attempt: number, error: AxiosError) => void;
  /** Request identifier for logging */
  requestId?: string;
}

/**
 * Default configuration for robust HTTP requests
 */
const DEFAULT_CONFIG: Required<RobustHttpConfig> = {
  timeout: 10000, // 10 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  maxRetryDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  enableJitter: true,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  retryErrorCodes: ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED'],
  shouldRetry: () => true,
  onRetry: () => {},
  requestId: ''
};

/**
 * Enhanced error class for HTTP requests
 */
export class HttpRequestError extends Error {
  public readonly isTimeout: boolean;
  public readonly isNetworkError: boolean;
  public readonly statusCode?: number;
  public readonly requestConfig: AxiosRequestConfig;
  public readonly attempts: number;
  public readonly lastError: AxiosError;

  constructor(
    message: string,
    lastError: AxiosError,
    attempts: number,
    requestConfig: AxiosRequestConfig
  ) {
    super(message);
    this.name = 'HttpRequestError';
    this.lastError = lastError;
    this.attempts = attempts;
    this.requestConfig = requestConfig;
    this.statusCode = lastError.response?.status;
    this.isTimeout = lastError.code === 'ECONNABORTED' || lastError.code === 'ETIMEDOUT';
    this.isNetworkError = !lastError.response;
  }
}

/**
 * Calculate retry delay with exponential backoff and optional jitter
 */
function calculateRetryDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  multiplier: number,
  enableJitter: boolean
): number {
  // Calculate exponential backoff delay
  const exponentialDelay = baseDelay * Math.pow(multiplier, attempt - 1);
  
  // Apply maximum delay limit
  let delay = Math.min(exponentialDelay, maxDelay);
  
  // Add jitter to prevent thundering herd
  if (enableJitter) {
    const jitterAmount = delay * 0.1; // 10% jitter
    const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
    delay = Math.max(0, delay + jitter);
  }
  
  return Math.round(delay);
}

/**
 * Check if an error should trigger a retry
 */
function shouldRetryRequest(error: AxiosError, config: Required<RobustHttpConfig>): boolean {
  // Check custom retry condition first
  if (!config.shouldRetry(error)) {
    return false;
  }
  
  // Don't retry if it's not a network error and no response
  if (!error.response && !error.code) {
    return false;
  }
  
  // Check for retryable status codes
  if (error.response && config.retryStatusCodes.includes(error.response.status)) {
    return true;
  }
  
  // Check for retryable error codes
  if (error.code && config.retryErrorCodes.includes(error.code)) {
    return true;
  }
  
  // Don't retry 4xx errors (except 408 and 429 which are in retryStatusCodes)
  if (error.response && error.response.status >= 400 && error.response.status < 500) {
    return false;
  }
  
  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create an axios instance with robust configuration
 */
export function createRobustHttpClient(baseConfig?: AxiosRequestConfig) {
  const client = axios.create({
    timeout: DEFAULT_CONFIG.timeout,
    ...baseConfig,
    // Ensure we have proper headers
    headers: {
      'User-Agent': 'Warehouse-Management-System/1.0',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...baseConfig?.headers
    }
  });

  // Add request interceptor for logging
  client.interceptors.request.use(
    (config: any) => {
      const requestId = config.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      config.requestId = requestId;
      config.startTime = Date.now();
      
      log(`[${requestId}] Starting ${config.method?.toUpperCase()} ${config.url}`, 'http');
      return config;
    },
    (error) => {
      log(`Request interceptor error: ${error.message}`, 'error');
      return Promise.reject(error);
    }
  );

  // Add response interceptor for logging
  client.interceptors.response.use(
    (response) => {
      const requestId = (response.config as any).requestId || 'unknown';
      const startTime = (response.config as any).startTime || Date.now();
      const duration = Date.now() - startTime;
      
      log(`[${requestId}] Completed ${response.status} in ${duration}ms`, 'http');
      return response;
    },
    (error) => {
      const requestId = error.config?.requestId || 'unknown';
      const startTime = error.config?.startTime || Date.now();
      const duration = Date.now() - startTime;
      
      if (error.response) {
        log(`[${requestId}] Failed ${error.response.status} in ${duration}ms: ${error.message}`, 'error');
      } else {
        log(`[${requestId}] Network error after ${duration}ms: ${error.message}`, 'error');
      }
      
      return Promise.reject(error);
    }
  );

  return client;
}

/**
 * Make a robust HTTP request with retries and exponential backoff
 */
export async function robustHttpRequest<T = any>(
  config: AxiosRequestConfig,
  robustConfig: RobustHttpConfig = {}
): Promise<AxiosResponse<T>> {
  const mergedConfig: Required<RobustHttpConfig> = {
    ...DEFAULT_CONFIG,
    ...robustConfig
  };

  const requestId = mergedConfig.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create axios instance with timeout
  const client = createRobustHttpClient({
    timeout: mergedConfig.timeout,
    ...config
  });

  let lastError: AxiosError | undefined;
  let attempt = 0;

  log(`[${requestId}] Starting robust HTTP request to ${config.url} (max ${mergedConfig.maxRetries} retries)`, 'http');

  while (attempt <= mergedConfig.maxRetries) {
    attempt++;
    
    try {
      // Add tracking properties to config
      const requestConfig: any = {
        ...config,
        requestId,
        attempt,
        startTime: Date.now()
      };

      log(`[${requestId}] Attempt ${attempt}/${mergedConfig.maxRetries + 1}`, 'http');
      
      const response = await client(requestConfig);
      
      if (attempt > 1) {
        log(`[${requestId}] Request succeeded on attempt ${attempt}`, 'http');
      }
      
      return response;
    } catch (error) {
      lastError = error as AxiosError;
      
      // Log the error details
      const errorMessage = lastError.response 
        ? `HTTP ${lastError.response.status}: ${lastError.message}`
        : `Network error: ${lastError.message} (${lastError.code})`;
      
      log(`[${requestId}] Attempt ${attempt} failed: ${errorMessage}`, 'error');
      
      // Check if we should retry
      if (attempt <= mergedConfig.maxRetries && shouldRetryRequest(lastError, mergedConfig)) {
        const delay = calculateRetryDelay(
          attempt,
          mergedConfig.retryDelay,
          mergedConfig.maxRetryDelay,
          mergedConfig.backoffMultiplier,
          mergedConfig.enableJitter
        );
        
        log(`[${requestId}] Retrying in ${delay}ms (attempt ${attempt + 1}/${mergedConfig.maxRetries + 1})`, 'http');
        
        // Call retry callback
        mergedConfig.onRetry(attempt, lastError);
        
        // Wait before retrying
        await sleep(delay);
      } else {
        // No more retries or error is not retryable
        break;
      }
    }
  }

  // All attempts failed
  if (!lastError) {
    const unknownError = new Error('Unknown error occurred');
    lastError = Object.assign(unknownError, { 
      isAxiosError: true,
      config: config,
      toJSON: () => ({})
    }) as AxiosError;
  }
  
  const finalMessage = `HTTP request failed after ${attempt} attempts: ${lastError.message}`;
  log(`[${requestId}] ${finalMessage}`, 'error');
  
  throw new HttpRequestError(finalMessage, lastError, attempt, config);
}

/**
 * Convenience methods for common HTTP operations
 */
export class RobustHttpClient {
  private baseConfig: AxiosRequestConfig;
  private robustConfig: RobustHttpConfig;

  constructor(baseConfig: AxiosRequestConfig = {}, robustConfig: RobustHttpConfig = {}) {
    this.baseConfig = baseConfig;
    this.robustConfig = robustConfig;
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return robustHttpRequest<T>(
      { ...this.baseConfig, ...config, method: 'GET', url },
      this.robustConfig
    );
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return robustHttpRequest<T>(
      { ...this.baseConfig, ...config, method: 'POST', url, data },
      this.robustConfig
    );
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return robustHttpRequest<T>(
      { ...this.baseConfig, ...config, method: 'PUT', url, data },
      this.robustConfig
    );
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return robustHttpRequest<T>(
      { ...this.baseConfig, ...config, method: 'PATCH', url, data },
      this.robustConfig
    );
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return robustHttpRequest<T>(
      { ...this.baseConfig, ...config, method: 'DELETE', url },
      this.robustConfig
    );
  }
}