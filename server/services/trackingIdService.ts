/**
 * Tracking ID Generation Service
 * Generates unique tracking IDs for invoices and payments (e.g., INV-001, PAY-001)
 */

import { pool } from '../db';
import { supplierInvoices, supplierPayments } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Generate the next unique invoice tracking ID
 * Format: INV-XXX (e.g., INV-001, INV-002, etc.)
 */
export async function generateInvoiceTrackingId(): Promise<string> {
  // Get the highest existing invoice tracking ID
  const result = await pool.query(`
    SELECT tracking_id 
    FROM supplier_invoices 
    WHERE tracking_id LIKE 'INV-%' 
    ORDER BY CAST(SUBSTRING(tracking_id, 5) AS INTEGER) DESC 
    LIMIT 1
  `);

  let nextNumber = 1;
  if (result.rows.length > 0 && result.rows[0].tracking_id) {
    const currentNumber = parseInt(result.rows[0].tracking_id.substring(4));
    nextNumber = currentNumber + 1;
  }

  return `INV-${nextNumber.toString().padStart(3, '0')}`;
}

/**
 * Generate the next unique payment tracking ID
 * Format: PAY-XXX (e.g., PAY-001, PAY-002, etc.)
 */
export async function generatePaymentTrackingId(): Promise<string> {
  // Get the highest existing payment tracking ID
  const result = await pool.query(`
    SELECT tracking_id 
    FROM supplier_payments 
    WHERE tracking_id LIKE 'PAY-%' 
    ORDER BY CAST(SUBSTRING(tracking_id, 5) AS INTEGER) DESC 
    LIMIT 1
  `);

  let nextNumber = 1;
  if (result.rows.length > 0 && result.rows[0].tracking_id) {
    const currentNumber = parseInt(result.rows[0].tracking_id.substring(4));
    nextNumber = currentNumber + 1;
  }

  return `PAY-${nextNumber.toString().padStart(3, '0')}`;
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