import express, { Router } from 'express';
import { isAuthenticated } from '../auth';
import { pool } from '../db';

const router = Router();

// Ensure all routes are protected
router.use(isAuthenticated);

// Get all invoices for calendar
router.get('/invoices', async (req, res) => {
  console.log('[API] GET /calendar-data/invoices - Fetching all invoices for calendar');
  try {
    // Use direct SQL query to get invoice data with supplier names
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          si.id, 
          si.invoice_number as "invoiceNumber", 
          si.supplier_id as "supplierId",
          s.name as "supplierName",
          si.amount, 
          si.paid_amount as "paidAmount", 
          si.status,
          si.due_date as "dueDate",
          si.invoice_date as "invoiceDate",
          si.issue_date as "issueDate",
          si.company
        FROM supplier_invoices si 
        JOIN suppliers s ON si.supplier_id = s.id
      `);
      
      const invoices = result.rows;
      console.log(`[API] Found ${invoices.length} invoices for calendar`);
      
      // Convert date strings to proper date objects for frontend
      const processedInvoices = invoices.map(invoice => {
        return {
          ...invoice,
          dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : null,
          invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString() : null,
          issueDate: invoice.issueDate ? new Date(invoice.issueDate).toISOString() : null,
        };
      });
      
      res.json(processedInvoices);
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[API] Error fetching invoices for calendar:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;