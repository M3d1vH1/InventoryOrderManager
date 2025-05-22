import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { log } from './vite';
import { existsSync } from 'fs';
import { WebSocket, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// For Neon serverless compatibility
if (process.env.DATABASE_URL?.includes('neon.tech')) {
  neonConfig.webSocketConstructor = ws as any;
  log('Using Neon serverless WebSocket configuration', 'database');
}

// Create the connection string from environment variables
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

// Configure connection pool with optimized settings
const POOL_CONFIG = {
  connectionString,
  max: 20,                   // Maximum number of clients (increased for higher throughput)
  idleTimeoutMillis: 60000,  // Longer idle timeout (1 minute)
  connectionTimeoutMillis: 10000, // Connection timeout
  statement_timeout: 30000,  // Statement timeout (30 seconds to prevent long-running queries)
  query_timeout: 30000,      // Query timeout (30 seconds)
  keepAlive: true,           // Enable TCP keepalive
  keepAliveInitialDelayMillis: 30000, // Delay before starting keepalive probes
};

// Create PostgreSQL connection pool with advanced configuration
const pool = new Pool(POOL_CONFIG);

// Health check interval
const HEALTH_CHECK_INTERVAL = 60000; // 1 minute
let healthCheckInterval: any = null;

// Monitor connection health 
function startHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(async () => {
    try {
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT 1');
        if (result.rowCount !== 1) {
          log('Health check query returned unexpected result', 'database');
        }
      } catch (error) {
        log(`Health check query failed: ${error instanceof Error ? error.message : String(error)}`, 'database');
      } finally {
        client.release();
      }
    } catch (error) {
      log(`Health check failed to acquire connection: ${error instanceof Error ? error.message : String(error)}`, 'database');
    }
  }, HEALTH_CHECK_INTERVAL);
}

// Enhanced pool error handling with reconnection strategy
pool.on('error', (err) => {
  log(`Database pool error: ${err.message}`, 'database');
  
  // If the connection is terminated, try to reconnect
  if (
    err.message.includes('terminated') || 
    err.message.includes('connection') ||
    err.message.includes('network')
  ) {
    log('Connection lost, will use new connection on next request', 'database');
    
    // Restart the health check which will verify new connections
    startHealthCheck();
  }
});

// Maximum number of retries for database operations
const MAX_RETRIES = 5; // Increased from 3 to 5
const BASE_RETRY_DELAY = 1000; // Base delay is 1 second

// Enhanced retry function with exponential backoff
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES, operationName = 'Database operation'): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Stop retrying if we've reached the max number of retries
      if (attempt > retries) {
        log(`${operationName} failed after ${retries} retries: ${error.message}`, 'database');
        throw error;
      }
      
      // Determine if the error is retriable
      const errorCode = error.code;
      const retriableErrors = [
        // Connection-related errors
        '08000', // connection_exception
        '08003', // connection_does_not_exist
        '08006', // connection_failure
        '08001', // sqlclient_unable_to_establish_sqlconnection
        '08004', // sqlserver_rejected_establishment_of_sqlconnection
        // Server shutdown errors
        '57P01', // admin_shutdown
        '57P02', // crash_shutdown
        '57P03', // cannot_connect_now
        // Concurrency errors
        '40001', // serialization_failure
        '40P01', // deadlock_detected
        // Timeout errors
        '57014', // query_canceled
        // Temporary server issues
        '53100', // disk_full
        '53200', // out_of_memory
        '53300', // too_many_connections
      ];
      
      // Also check for connection timeout errors in message
      const isConnectionTimeout = error.message?.includes('timeout') || 
                                 error.message?.includes('Connection terminated');
      
      if (retriableErrors.includes(errorCode) || isConnectionTimeout) {
        // Calculate exponential backoff with jitter
        // Formula: base * 2^attempt + random jitter
        const jitter = Math.random() * 500; // Random jitter up to 500ms
        const delay = BASE_RETRY_DELAY * Math.pow(2, attempt - 1) + jitter;
        
        log(`${operationName} failed with error ${errorCode || 'unknown'}, retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${retries})`, 'database');
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Continue to next attempt
        continue;
      }
      
      // Non-retriable error, rethrow immediately
      log(`${operationName} failed with non-retriable error: ${error.message}`, 'database');
      throw error;
    }
  }
  
  // This should never be reached due to the throw in the loop
  throw lastError;
}

// Create a Drizzle ORM instance
let db: ReturnType<typeof drizzle>;

// Function to initialize the database connection
export async function initDatabase() {
  try {
    // Test the database connection by getting a client from the pool
    const client = await withRetry(
      () => pool.connect(),
      3,
      'Initial database connection'
    );
    
    try {
      // Check if the database is accessible
      await client.query('SELECT NOW() as current_time');
      log('Connected to PostgreSQL database', 'database');
    } finally {
      // Always release client back to pool
      client.release();
    }
    
    // Create a Drizzle instance using the pool
    db = drizzle(pool);
    
    // Run migrations with retry logic
    await withRetry(async () => {
      // Check if migrations folder exists with required structure
      if (existsSync('migrations/meta/_journal.json')) {
        await migrate(db, { migrationsFolder: 'migrations' });
        log('Database migrations applied successfully', 'database');
      } else {
        log('No migrations to apply yet - skipping migration step', 'database');
      }
    }, 3, 'Database migration');
    
    // Start health check monitoring
    startHealthCheck();
    
    return db;
  } catch (error) {
    log(`Database initialization error: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  }
}

// Graceful shutdown function
export async function closeDatabase() {
  // Stop health check
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  
  try {
    // Close the pool
    await pool.end();
    log('Database pool closed successfully', 'database');
  } catch (error) {
    log(`Error closing database pool: ${error instanceof Error ? error.message : String(error)}`, 'database');
  }
}

// Execute function with proper transaction management and error handling
export async function withTransaction<T>(
  operation: (tx: any) => Promise<T>, 
  maxRetries = 3
): Promise<T> {
  return withRetry(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Execute the operation within the transaction
      const result = await operation(client);
      
      await client.query('COMMIT');
      return result;
    } catch (error) {
      // Attempt to roll back the transaction
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        log(`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`, 'database');
      }
      
      throw error;
    } finally {
      client.release();
    }
  }, maxRetries, 'Transaction');
}

export { pool, withRetry };