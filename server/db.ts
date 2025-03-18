import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { log } from './vite';

// Create the connection string from environment variables
const connectionString = process.env.DATABASE_URL;

// Create a PostgreSQL client
const client = new Client({
  connectionString
});

// Function to initialize the database connection
export async function initDatabase() {
  try {
    // Connect to the database
    await client.connect();
    log('Connected to PostgreSQL database', 'database');
    
    // Create a Drizzle instance
    const db = drizzle(client);
    
    // Run migrations
    try {
      await migrate(db, { migrationsFolder: 'migrations' });
      log('Database migrations applied successfully', 'database');
    } catch (error) {
      log(`Migration error: ${error instanceof Error ? error.message : String(error)}`, 'database');
      // Continue even if migrations fail - they might not be set up yet
    }
    
    return db;
  } catch (error) {
    log(`Database connection error: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  }
}

export { client };