import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { log } from './vite';
import { existsSync } from 'fs';

// Create the connection string from environment variables
const connectionString = process.env.DATABASE_URL;

// Create a PostgreSQL connection pool instead of a single client
// This is more resilient as it handles reconnection automatically
const pool = new Pool({
  connectionString,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // How long to wait for a connection to become available
});

// Listen for errors at the pool level
pool.on('error', (err) => {
  log(`Unexpected database pool error: ${err.message}`, 'database');
  // Don't crash the server on connection errors
  // The pool will create a new client when needed
});

// Maximum number of retries for database operations
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second delay between retries

// Helper function to execute a database operation with retries
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Don't retry if we've run out of retries
    if (retries <= 0) {
      throw error;
    }
    
    // Only retry for specific error types that might be transient
    const errorCode = error.code;
    const retriableErrors = [
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08004', // sqlserver_rejected_establishment_of_sqlconnection
      '57P01', // admin_shutdown
      '57P02', // crash_shutdown
      '57P03', // cannot_connect_now
    ];
    
    if (retriableErrors.includes(errorCode)) {
      // Log the retry attempt
      log(`Database operation failed with error ${errorCode}, retrying in ${RETRY_DELAY}ms... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`, 'database');
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      
      // Recursive retry with one less retry available
      return withRetry(operation, retries - 1);
    }
    
    // For non-retriable errors, just throw
    throw error;
  }
}

// Function to initialize the database connection
export async function initDatabase() {
  try {
    // Test the database connection by getting a client from the pool
    const client = await pool.connect();
    try {
      // Use the client for a simple query to test connection
      await client.query('SELECT NOW()');
      log('Connected to PostgreSQL database', 'database');
    } finally {
      // Release the client back to the pool
      client.release();
    }
    
    // Create a Drizzle instance using the pool
    const db = drizzle(pool);
    
    // Run migrations with retry logic
    await withRetry(async () => {
      // Check if migrations folder exists with required structure
      if (existsSync('migrations/meta/_journal.json')) {
        await migrate(db, { migrationsFolder: 'migrations' });
        log('Database migrations applied successfully', 'database');
      } else {
        log('No migrations to apply yet - skipping migration step', 'database');
      }
    });
    
    return db;
  } catch (error) {
    log(`Database connection error: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  }
}

export { pool };