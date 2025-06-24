/**
 * Invoice Payment Service
 * Centralized service for managing invoice payment status and calculations
 * Replaces multiple conflicting payment update functions with a single source of truth
 */
import { db } from '../db';
import { PaymentAuditService } from './paymentAuditService';

export interface InvoiceStatusUpdate {
  invoiceId: number;
  userId?: number;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export interface PaymentValidation {
  isValid: boolean;
  error?: string;
  remainingAmount?: number;
  currentTotal?: number;
}

export class InvoicePaymentService {
  /**
   * Validate that a payment amount doesn't exceed the remaining invoice balance
   */
  static async validatePaymentAmount(
    invoiceId: number, 
    paymentAmount: number, 
    excludePaymentId?: number
  ): Promise<PaymentValidation> {
    try {
      // Get invoice details
      const invoiceResult = await db.query(
        'SELECT amount FROM supplier_invoices WHERE id = $1',
        [invoiceId]
      );

      if (invoiceResult.rows.length === 0) {
        return { isValid: false, error: 'Invoice not found' };
      }

      const invoiceAmount = parseFloat(invoiceResult.rows[0].amount);

      // Calculate current payments (excluding the payment being updated if applicable)
      let paymentsQuery = 'SELECT COALESCE(SUM(amount), 0) as total_paid FROM supplier_payments WHERE invoice_id = $1';
      const queryParams = [invoiceId];

      if (excludePaymentId) {
        paymentsQuery += ' AND id != $2';
        queryParams.push(excludePaymentId);
      }

      const paymentsResult = await db.query(paymentsQuery, queryParams);
      const currentTotal = parseFloat(paymentsResult.rows[0].total_paid || 0);
      const remainingAmount = invoiceAmount - currentTotal;

      // Allow small tolerance for floating point precision (1 cent)
      const tolerance = 0.01;
      
      if (paymentAmount > remainingAmount + tolerance) {
        return {
          isValid: false,
          error: `Payment amount (€${paymentAmount.toFixed(2)}) exceeds remaining invoice balance (€${remainingAmount.toFixed(2)})`,
          remainingAmount,
          currentTotal
        };
      }

      return {
        isValid: true,
        remainingAmount,
        currentTotal
      };
    } catch (error) {
      console.error('Error validating payment amount:', error);
      return { isValid: false, error: 'Validation failed due to system error' };
    }
  }

  /**
   * Calculate and update invoice payment status and amount
   * This is the single source of truth for invoice status updates
   */
  static async updateInvoiceStatus(params: InvoiceStatusUpdate): Promise<boolean> {
    const { invoiceId, userId, userName, ipAddress, userAgent, reason } = params;

    try {
      // Start transaction
      await db.query('BEGIN');

      // Get current invoice details
      const invoiceResult = await db.query(`
        SELECT id, invoice_number, amount, paid_amount, status, due_date
        FROM supplier_invoices WHERE id = $1
      `, [invoiceId]);

      if (invoiceResult.rows.length === 0) {
        await db.query('ROLLBACK');
        console.error(`Invoice ${invoiceId} not found for status update`);
        return false;
      }

      const currentInvoice = invoiceResult.rows[0];
      const invoiceAmount = parseFloat(currentInvoice.amount);
      const dueDate = new Date(currentInvoice.due_date);
      const today = new Date();

      // Calculate total payments for this invoice using precise decimal arithmetic
      const paymentsResult = await db.query(`
        SELECT COALESCE(SUM(amount), 0) as total_paid 
        FROM supplier_payments 
        WHERE invoice_id = $1
      `, [invoiceId]);

      const totalPaid = parseFloat(paymentsResult.rows[0].total_paid || 0);

      // Determine new status using precise comparison
      let newStatus = currentInvoice.status;
      const tolerance = 0.005; // 0.5 cent tolerance for rounding

      if (currentInvoice.status === 'cancelled') {
        // Don't update cancelled invoices
        await db.query('COMMIT');
        return true;
      }

      // Status determination logic
      if (Math.abs(totalPaid - invoiceAmount) <= tolerance) {
        newStatus = 'paid';
      } else if (totalPaid > tolerance) {
        newStatus = 'partially_paid';
      } else if (dueDate < today) {
        newStatus = 'overdue';
      } else {
        newStatus = 'pending';
      }

      // Update invoice with new status and paid amount
      const updateResult = await db.query(`
        UPDATE supplier_invoices 
        SET status = $1, paid_amount = $2, updated_by_id = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [newStatus, totalPaid, userId || null, invoiceId]);

      const updatedInvoice = updateResult.rows[0];

      // Log audit trail if status changed or paid amount changed
      if (newStatus !== currentInvoice.status || Math.abs(totalPaid - parseFloat(currentInvoice.paid_amount || 0)) > tolerance) {
        await PaymentAuditService.logAction({
          entityType: 'invoice',
          entityId: invoiceId,
          action: 'status_changed',
          oldValues: {
            status: currentInvoice.status,
            paid_amount: currentInvoice.paid_amount,
            calculated_payments: totalPaid
          },
          newValues: {
            status: newStatus,
            paid_amount: totalPaid,
            invoice_amount: invoiceAmount
          },
          userId,
          userName,
          ipAddress,
          userAgent,
          reason: reason || `Status updated based on payment calculation`
        });

        console.log(`[PAYMENT] Invoice ${invoiceId} status: ${currentInvoice.status} -> ${newStatus} | Amount: €${invoiceAmount} | Paid: €${totalPaid.toFixed(2)}`);
      }

      await db.query('COMMIT');
      return true;

    } catch (error) {
      await db.query('ROLLBACK');
      console.error('Error updating invoice status:', error);
      return false;
    }
  }

  /**
   * Get payment discrepancies for audit and reconciliation
   */
  static async getPaymentDiscrepancies(): Promise<any[]> {
    try {
      const result = await db.query(`
        SELECT 
          si.id as invoice_id,
          si.invoice_number,
          si.amount as invoice_amount,
          si.paid_amount,
          si.status,
          COALESCE(SUM(sp.amount), 0) as calculated_total_payments,
          COUNT(sp.id) as payment_count,
          ABS(si.paid_amount - COALESCE(SUM(sp.amount), 0)) as discrepancy
        FROM supplier_invoices si
        LEFT JOIN supplier_payments sp ON si.id = sp.invoice_id
        GROUP BY si.id, si.invoice_number, si.amount, si.paid_amount, si.status
        HAVING ABS(si.paid_amount - COALESCE(SUM(sp.amount), 0)) > 0.01
        OR (si.status = 'paid' AND COALESCE(SUM(sp.amount), 0) < si.amount - 0.01)
        ORDER BY discrepancy DESC
      `);

      return result.rows;
    } catch (error) {
      console.error('Error fetching payment discrepancies:', error);
      return [];
    }
  }

  /**
   * Repair data inconsistencies - use with caution
   */
  static async repairDataInconsistencies(userId?: number, userName?: string): Promise<{ repaired: number; errors: string[] }> {
    let repaired = 0;
    const errors: string[] = [];

    try {
      // Get all invoices with discrepancies
      const discrepancies = await this.getPaymentDiscrepancies();

      for (const discrepancy of discrepancies) {
        try {
          const success = await this.updateInvoiceStatus({
            invoiceId: discrepancy.invoice_id,
            userId,
            userName,
            reason: 'Data repair - fixing payment discrepancy'
          });

          if (success) {
            repaired++;
          } else {
            errors.push(`Failed to repair invoice ${discrepancy.invoice_id}`);
          }
        } catch (error) {
          errors.push(`Error repairing invoice ${discrepancy.invoice_id}: ${error.message}`);
        }
      }

      console.log(`[REPAIR] Repaired ${repaired} invoice payment discrepancies`);
      return { repaired, errors };

    } catch (error) {
      console.error('Error during data repair:', error);
      return { repaired, errors: [`System error during repair: ${error.message}`] };
    }
  }
}