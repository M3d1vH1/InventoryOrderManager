/**
 * Tracking ID Generation Service
 * Generates unique tracking IDs for invoices and payments using database counters
 * Format: INV-XXX, PAY-XXX (e.g., INV-001, PAY-001)
 */

import { pool } from '../db';

/**
 * Generate the next unique invoice tracking ID
 * Format: INV-XXX (e.g., INV-001, INV-002, etc.)
 */
export async function generateInvoiceTrackingId(): Promise<string> {
  const client = await pool.connect();
  try {
    // Get and increment the counter atomically
    const result = await client.query(`
      INSERT INTO tracking_id_counters (type, next_number) 
      VALUES ('invoice', 1)
      ON CONFLICT (type) 
      DO UPDATE SET 
        next_number = tracking_id_counters.next_number + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING next_number
    `);
    
    const number = result.rows[0].next_number;
    return `INV-${String(number).padStart(3, '0')}`;
  } finally {
    client.release();
  }
}

/**
 * Generate the next unique payment tracking ID
 * Format: PAY-XXX (e.g., PAY-001, PAY-002, etc.)
 */
export async function generatePaymentTrackingId(): Promise<string> {
  const client = await pool.connect();
  try {
    // Get and increment the counter atomically
    const result = await client.query(`
      INSERT INTO tracking_id_counters (type, next_number) 
      VALUES ('payment', 1)
      ON CONFLICT (type) 
      DO UPDATE SET 
        next_number = tracking_id_counters.next_number + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING next_number
    `);
    
    const number = result.rows[0].next_number;
    return `PAY-${String(number).padStart(3, '0')}`;
  } finally {
    client.release();
  }
}

/**
 * Validate tracking ID format
 */
export function validateTrackingId(trackingId: string, type: 'invoice' | 'payment'): boolean {
  const prefix = type === 'invoice' ? 'INV-' : 'PAY-';
  const pattern = new RegExp(`^${prefix}\\d{3}$`);
  return pattern.test(trackingId);
}

/**
 * Extract number from tracking ID
 */
export function extractTrackingNumber(trackingId: string): number | null {
  const match = trackingId.match(/^(INV|PAY)-(\d{3})$/);
  return match ? parseInt(match[2]) : null;
}