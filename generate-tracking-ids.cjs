/**
 * Migration Script: Generate Tracking IDs for Existing Records
 * 
 * This script assigns tracking IDs to existing invoices and payments
 * while ensuring the tracking ID service continues to work correctly
 * for new records.
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function generateTrackingIds() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting tracking ID generation...');
    
    // Start a transaction
    await client.query('BEGIN');
    
    // Generate tracking IDs for existing invoices
    console.log('📄 Generating invoice tracking IDs...');
    
    // Get all invoices without tracking IDs, ordered by ID for consistent numbering
    const invoicesResult = await client.query(`
      SELECT id FROM supplier_invoices 
      WHERE tracking_id IS NULL 
      ORDER BY id ASC
    `);
    
    console.log(`Found ${invoicesResult.rows.length} invoices without tracking IDs`);
    
    // Assign tracking IDs to invoices
    for (let i = 0; i < invoicesResult.rows.length; i++) {
      const invoiceId = invoicesResult.rows[i].id;
      const trackingId = `INV-${String(i + 1).padStart(3, '0')}`;
      
      await client.query(
        'UPDATE supplier_invoices SET tracking_id = $1 WHERE id = $2',
        [trackingId, invoiceId]
      );
      
      console.log(`✅ Invoice ${invoiceId} → ${trackingId}`);
    }
    
    // Generate tracking IDs for existing payments
    console.log('💰 Generating payment tracking IDs...');
    
    // Get all payments without tracking IDs, ordered by ID for consistent numbering
    const paymentsResult = await client.query(`
      SELECT id FROM supplier_payments 
      WHERE tracking_id IS NULL 
      ORDER BY id ASC
    `);
    
    console.log(`Found ${paymentsResult.rows.length} payments without tracking IDs`);
    
    // Assign tracking IDs to payments
    for (let i = 0; i < paymentsResult.rows.length; i++) {
      const paymentId = paymentsResult.rows[i].id;
      const trackingId = `PAY-${String(i + 1).padStart(3, '0')}`;
      
      await client.query(
        'UPDATE supplier_payments SET tracking_id = $1 WHERE id = $2',
        [trackingId, paymentId]
      );
      
      console.log(`✅ Payment ${paymentId} → ${trackingId}`);
    }
    
    // Update the tracking ID service counters
    console.log('🔧 Updating tracking ID service counters...');
    
    // Set the next invoice number to start after the highest assigned number
    const nextInvoiceNum = invoicesResult.rows.length + 1;
    const nextPaymentNum = paymentsResult.rows.length + 1;
    
    // Insert or update the tracking ID counters in a metadata table
    // First, create the table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS tracking_id_counters (
        type VARCHAR(20) PRIMARY KEY,
        next_number INTEGER NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert or update the counters
    await client.query(`
      INSERT INTO tracking_id_counters (type, next_number) 
      VALUES ('invoice', $1), ('payment', $2)
      ON CONFLICT (type) 
      DO UPDATE SET 
        next_number = EXCLUDED.next_number,
        updated_at = CURRENT_TIMESTAMP
    `, [nextInvoiceNum, nextPaymentNum]);
    
    console.log(`📊 Invoice counter set to: ${nextInvoiceNum}`);
    console.log(`📊 Payment counter set to: ${nextPaymentNum}`);
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log('✨ Tracking ID generation completed successfully!');
    console.log(`📄 Generated ${invoicesResult.rows.length} invoice tracking IDs`);
    console.log(`💰 Generated ${paymentsResult.rows.length} payment tracking IDs`);
    
    // Verify the results
    console.log('\n🔍 Verification:');
    const invoiceCheck = await client.query('SELECT COUNT(*) as count FROM supplier_invoices WHERE tracking_id IS NOT NULL');
    const paymentCheck = await client.query('SELECT COUNT(*) as count FROM supplier_payments WHERE tracking_id IS NOT NULL');
    
    console.log(`✅ Invoices with tracking IDs: ${invoiceCheck.rows[0].count}`);
    console.log(`✅ Payments with tracking IDs: ${paymentCheck.rows[0].count}`);
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Error generating tracking IDs:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Update the tracking ID service to use the database counters
async function updateTrackingIdService() {
  console.log('\n🔧 Updating tracking ID service...');
  
  // The service file content with database-backed counters
  const serviceContent = `/**
 * Tracking ID Service
 * Generates professional tracking IDs for invoices and payments
 * Format: INV-001, PAY-001, etc.
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export class TrackingIdService {
  /**
   * Generate a new tracking ID for invoices
   */
  static async generateInvoiceId(): Promise<string> {
    const client = await pool.connect();
    try {
      // Get and increment the counter atomically
      const result = await client.query(\`
        INSERT INTO tracking_id_counters (type, next_number) 
        VALUES ('invoice', 1)
        ON CONFLICT (type) 
        DO UPDATE SET 
          next_number = tracking_id_counters.next_number + 1,
          updated_at = CURRENT_TIMESTAMP
        RETURNING next_number
      \`);
      
      const number = result.rows[0].next_number;
      return \`INV-\${String(number).padStart(3, '0')}\`;
    } finally {
      client.release();
    }
  }

  /**
   * Generate a new tracking ID for payments
   */
  static async generatePaymentId(): Promise<string> {
    const client = await pool.connect();
    try {
      // Get and increment the counter atomically
      const result = await client.query(\`
        INSERT INTO tracking_id_counters (type, next_number) 
        VALUES ('payment', 1)
        ON CONFLICT (type) 
        DO UPDATE SET 
          next_number = tracking_id_counters.next_number + 1,
          updated_at = CURRENT_TIMESTAMP
        RETURNING next_number
      \`);
      
      const number = result.rows[0].next_number;
      return \`PAY-\${String(number).padStart(3, '0')}\`;
    } finally {
      client.release();
    }
  }

  /**
   * Get the next tracking ID without incrementing (for preview)
   */
  static async previewNextInvoiceId(): Promise<string> {
    const client = await pool.connect();
    try {
      const result = await client.query(\`
        SELECT COALESCE(next_number, 1) as next_number 
        FROM tracking_id_counters 
        WHERE type = 'invoice'
      \`);
      
      const nextNumber = result.rows[0]?.next_number || 1;
      return \`INV-\${String(nextNumber).padStart(3, '0')}\`;
    } finally {
      client.release();
    }
  }

  /**
   * Get the next tracking ID without incrementing (for preview)
   */
  static async previewNextPaymentId(): Promise<string> {
    const client = await pool.connect();
    try {
      const result = await client.query(\`
        SELECT COALESCE(next_number, 1) as next_number 
        FROM tracking_id_counters 
        WHERE type = 'payment'
      \`);
      
      const nextNumber = result.rows[0]?.next_number || 1;
      return \`PAY-\${String(nextNumber).padStart(3, '0')}\`;
    } finally {
      client.release();
    }
  }
}
`;

  // Write the updated service file
  const fs = require('fs');
  fs.writeFileSync('./server/services/trackingIdService.ts', serviceContent);
  console.log('✅ Updated tracking ID service to use database counters');
}

// Run the migration
async function main() {
  try {
    await generateTrackingIds();
    await updateTrackingIdService();
    console.log('\n🎉 Migration completed successfully!');
    console.log('📝 All existing records now have tracking IDs');
    console.log('🔄 Tracking ID service updated for future records');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();