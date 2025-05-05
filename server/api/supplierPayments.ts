import express, { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { isAuthenticated } from '../auth';
import { createInsertSchema } from 'drizzle-zod';
import { suppliers, supplierInvoices as invoices, supplierPayments as payments } from '@shared/schema';
import { subDays, startOfMonth, endOfMonth } from 'date-fns';
import { pool } from '../db';

const router = Router();

// Ensure all routes are protected
router.use(isAuthenticated);

// Supplier validation schemas
const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true
});

const updateSupplierSchema = insertSupplierSchema.partial();

// Invoice validation schemas
const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

const updateInvoiceSchema = insertInvoiceSchema.partial();

// Payment validation schemas
const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

const updatePaymentSchema = insertPaymentSchema.partial();

// ===== SUPPLIER ROUTES =====

// Get all suppliers
router.get('/suppliers', async (req, res) => {
  try {
    const allSuppliers = await storage.getAllSuppliers();
    res.json(allSuppliers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get active suppliers
router.get('/suppliers/active', async (req, res) => {
  try {
    const activeSuppliers = await storage.getActiveSuppliers();
    res.json(activeSuppliers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific supplier by ID
router.get('/suppliers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid supplier ID' });
    }

    const supplier = await storage.getSupplier(id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json(supplier);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new supplier
router.post('/suppliers', async (req, res) => {
  try {
    const data = insertSupplierSchema.parse(req.body);
    const newSupplier = await storage.createSupplier(data);
    res.status(201).json(newSupplier);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update a supplier
router.patch('/suppliers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid supplier ID' });
    }

    const data = updateSupplierSchema.parse(req.body);
    
    // Check if supplier exists
    const supplier = await storage.getSupplier(id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const updatedSupplier = await storage.updateSupplier(id, data);
    res.json(updatedSupplier);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a supplier
router.delete('/suppliers/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid supplier ID' });
    }

    // Check if supplier exists
    const supplier = await storage.getSupplier(id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    // Check if supplier has any invoices
    const supplierInvoices = await storage.getSupplierInvoicesBySupplier(id);
    if (supplierInvoices.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete supplier with existing invoices. Please delete all invoices first or mark the supplier as inactive.' 
      });
    }

    await storage.deleteSupplier(id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== INVOICE ROUTES =====

// Get all invoices
router.get('/invoices', async (req, res) => {
  try {
    // Use direct SQL query to bypass schema issues
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT si.*, s.name as supplier_name
        FROM supplier_invoices si 
        JOIN suppliers s ON si.supplier_id = s.id
      `);
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get invoices by supplier ID
router.get('/suppliers/:supplierId/invoices', async (req, res) => {
  try {
    const supplierId = parseInt(req.params.supplierId);
    if (isNaN(supplierId)) {
      return res.status(400).json({ error: 'Invalid supplier ID' });
    }

    const supplierInvoices = await storage.getSupplierInvoicesBySupplier(supplierId);
    res.json(supplierInvoices);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific invoice by ID
router.get('/invoices/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const invoice = await storage.getSupplierInvoice(id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new invoice
router.post('/invoices', async (req, res) => {
  try {
    const data = insertInvoiceSchema.parse(req.body);
    
    // Ensure supplier exists
    const supplier = await storage.getSupplier(data.supplierId);
    if (!supplier) {
      return res.status(400).json({ error: 'Supplier not found' });
    }

    // Initialize paidAmount if not provided
    if (data.paidAmount === undefined) {
      data.paidAmount = 0;
    }

    // Create the invoice
    const newInvoice = await storage.createSupplierInvoice(data);
    res.status(201).json(newInvoice);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update an invoice
router.patch('/invoices/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const data = updateInvoiceSchema.parse(req.body);
    
    // Check if invoice exists
    const invoice = await storage.getSupplierInvoice(id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // If supplierId is being updated, ensure the supplier exists
    if (data.supplierId) {
      const supplier = await storage.getSupplier(data.supplierId);
      if (!supplier) {
        return res.status(400).json({ error: 'Supplier not found' });
      }
    }

    // Update the user who modified the invoice
    if (req.user && req.user.id) {
      data.updatedById = req.user.id;
    }

    const updatedInvoice = await storage.updateSupplierInvoice(id, data);
    res.json(updatedInvoice);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete an invoice
router.delete('/invoices/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    // Check if invoice exists
    const invoice = await storage.getSupplierInvoice(id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check if invoice has any payments
    const invoicePayments = await storage.getSupplierPaymentsByInvoice(id);
    if (invoicePayments.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete invoice with existing payments. Please delete all payments first or mark the invoice as cancelled.' 
      });
    }

    await storage.deleteSupplierInvoice(id);
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PAYMENT ROUTES =====

// Get all payments
router.get('/payments', async (req, res) => {
  try {
    // Use direct SQL query to bypass schema issues
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM supplier_payments');
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get payments by invoice ID
router.get('/invoices/:invoiceId/payments', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoice ID' });
    }

    const invoicePayments = await storage.getSupplierPaymentsByInvoice(invoiceId);
    res.json(invoicePayments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific payment by ID
router.get('/payments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const payment = await storage.getSupplierPayment(id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(payment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new payment
router.post('/payments', async (req, res) => {
  try {
    const data = insertPaymentSchema.parse(req.body);
    
    // Ensure invoice exists
    const invoice = await storage.getSupplierInvoice(data.invoiceId);
    if (!invoice) {
      return res.status(400).json({ error: 'Invoice not found' });
    }

    // Add createdBy if available
    if (req.user && req.user.id) {
      data.createdById = req.user.id;
    }

    // Create the payment
    const newPayment = await storage.createSupplierPayment(data);
    
    // Update the invoice's paidAmount
    const invoicePayments = await storage.getSupplierPaymentsByInvoice(data.invoiceId);
    const totalPaid = invoicePayments.reduce((sum, payment) => sum + payment.amount, 0);
    
    // Determine the new status based on payment amount
    let newStatus = invoice.status;
    if (totalPaid >= invoice.amount) {
      newStatus = 'paid';
    } else if (totalPaid > 0) {
      newStatus = 'partially_paid';
    }
    
    await storage.updateInvoiceStatus(data.invoiceId, newStatus);
    
    res.status(201).json(newPayment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update a payment
router.patch('/payments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    const data = updatePaymentSchema.parse(req.body);
    
    // Check if payment exists
    const payment = await storage.getSupplierPayment(id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // If invoiceId is being updated, ensure the invoice exists
    if (data.invoiceId) {
      const invoice = await storage.getSupplierInvoice(data.invoiceId);
      if (!invoice) {
        return res.status(400).json({ error: 'Invoice not found' });
      }
    }

    // Update the payment
    const updatedPayment = await storage.updateSupplierPayment(id, data);
    
    // If the payment amount was changed or invoice was changed, update the invoice(s)
    if (data.amount !== undefined || data.invoiceId !== undefined) {
      // Update the original invoice if the invoice ID was changed
      if (data.invoiceId !== undefined && data.invoiceId !== payment.invoiceId) {
        await updateInvoicePaidAmount(payment.invoiceId);
      }
      
      // Update the current invoice
      const currentInvoiceId = data.invoiceId || payment.invoiceId;
      await updateInvoicePaidAmount(currentInvoiceId);
    }
    
    res.json(updatedPayment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

// Delete a payment
router.delete('/payments/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }

    // Check if payment exists
    const payment = await storage.getSupplierPayment(id);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Store the invoiceId for later updating
    const invoiceId = payment.invoiceId;

    // Delete the payment
    await storage.deleteSupplierPayment(id);
    
    // Update the invoice's paidAmount
    await updateInvoicePaidAmount(invoiceId);
    
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== DASHBOARD SUMMARY =====

// Get dashboard summary
router.get('/summary', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Get summary data directly from database using SQL queries
      // Get recent payments with supplier info
      const recentPaymentsResult = await client.query(`
        SELECT 
          p.id, 
          p.amount, 
          p.payment_date as "paymentDate",
          p.payment_method as "paymentMethod",
          i.invoice_number as "invoiceNumber",
          s.name as "supplierName"
        FROM 
          supplier_payments p
        JOIN 
          supplier_invoices i ON p.invoice_id = i.id
        JOIN 
          suppliers s ON i.supplier_id = s.id
        ORDER BY 
          p.payment_date DESC
        LIMIT 10
      `);
      
      // Get pending invoices amount
      const pendingResult = await client.query(`
        SELECT COALESCE(SUM(amount - paid_amount), 0) as total_pending
        FROM supplier_invoices
        WHERE status = 'pending'
      `);
      
      // Get overdue invoices amount
      const overdueResult = await client.query(`
        SELECT COALESCE(SUM(amount - paid_amount), 0) as total_overdue
        FROM supplier_invoices
        WHERE status = 'overdue'
      `);
      
      // Get total paid amount
      const totalPaidResult = await client.query(`
        SELECT COALESCE(SUM(amount), 0) as total_paid
        FROM supplier_payments
      `);
      
      // Get paid this month
      const paidThisMonthResult = await client.query(`
        SELECT COALESCE(SUM(amount), 0) as paid_this_month
        FROM supplier_payments
        WHERE 
          payment_date >= date_trunc('month', CURRENT_DATE) AND
          payment_date < date_trunc('month', CURRENT_DATE) + interval '1 month'
      `);
      
      const dashboardSummary = {
        totalOutstanding: parseFloat(pendingResult.rows[0].total_pending) + parseFloat(overdueResult.rows[0].total_overdue),
        totalPaid: parseFloat(totalPaidResult.rows[0].total_paid),
        paidThisMonth: parseFloat(paidThisMonthResult.rows[0].paid_this_month),
        overdueAmount: parseFloat(overdueResult.rows[0].total_overdue),
        dueWithin30Days: parseFloat(pendingResult.rows[0].total_pending),
        paymentCompletion: 0, // We'll calculate this below
        upcomingPayments: [], // We'll add this below
        recentPayments: recentPaymentsResult.rows
      };
      
      // Calculate payment completion
      const totalInvoicesResult = await client.query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(paid_amount), 0) as total_paid_amount
        FROM 
          supplier_invoices
        WHERE 
          status != 'cancelled'
      `);
      
      const totalAmount = parseFloat(totalInvoicesResult.rows[0].total_amount);
      const totalPaidAmount = parseFloat(totalInvoicesResult.rows[0].total_paid_amount);
      
      dashboardSummary.paymentCompletion = totalAmount > 0 ? (totalPaidAmount / totalAmount) * 100 : 0;
      
      // Get upcoming payments
      const upcomingPaymentsResult = await client.query(`
        SELECT 
          i.id,
          i.invoice_number as "invoiceNumber",
          s.name as "supplierName",
          i.amount - i.paid_amount as "remainingAmount",
          i.due_date as "dueDate"
        FROM 
          supplier_invoices i
        JOIN 
          suppliers s ON i.supplier_id = s.id
        WHERE 
          i.status IN ('pending', 'partially_paid') AND
          i.due_date > CURRENT_DATE AND
          i.due_date <= CURRENT_DATE + interval '30 days'
        ORDER BY 
          i.due_date ASC
      `);
      
      dashboardSummary.upcomingPayments = upcomingPaymentsResult.rows;
      
      res.json(dashboardSummary);
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to update invoice paid amount and status
async function updateInvoicePaidAmount(invoiceId: number) {
  try {
    const invoice = await storage.getSupplierInvoice(invoiceId);
    if (!invoice) {
      return;
    }
    
    const invoicePayments = await storage.getSupplierPaymentsByInvoice(invoiceId);
    const totalPaid = invoicePayments.reduce((sum, payment) => sum + payment.amount, 0);
    
    // Determine the new status based on payment amount
    let newStatus = invoice.status;
    if (totalPaid >= invoice.amount) {
      newStatus = 'paid';
    } else if (totalPaid > 0) {
      newStatus = 'partially_paid';
    } else {
      // If no payments, revert to pending or overdue status based on the due date
      const today = new Date();
      const dueDate = new Date(invoice.dueDate);
      newStatus = dueDate < today ? 'overdue' : 'pending';
    }
    
    // Update the invoice
    await storage.updateInvoiceStatus(invoiceId, newStatus);
  } catch (error) {
    console.error("Error updating invoice paid amount:", error);
  }
}

// Helper function to get total paid amount
async function getTotalPaidAmount() {
  const allPayments = await storage.getAllSupplierPayments();
  return allPayments.reduce((sum, payment) => sum + payment.amount, 0);
}

// Helper function to get paid this month
async function getPaidThisMonth() {
  const now = new Date();
  const startOfCurrentMonth = startOfMonth(now);
  const endOfCurrentMonth = endOfMonth(now);
  
  const allPayments = await storage.getAllSupplierPayments();
  return allPayments
    .filter(payment => {
      const paymentDate = new Date(payment.paymentDate);
      return paymentDate >= startOfCurrentMonth && paymentDate <= endOfCurrentMonth;
    })
    .reduce((sum, payment) => sum + payment.amount, 0);
}

// Helper function to calculate payment completion percentage
async function calculatePaymentCompletion() {
  const allInvoices = await storage.getAllSupplierInvoices();
  
  const totalAmount = allInvoices
    .filter(invoice => invoice.status !== 'cancelled')
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  
  const totalPaidAmount = allInvoices
    .filter(invoice => invoice.status !== 'cancelled')
    .reduce((sum, invoice) => sum + invoice.paidAmount, 0);
  
  return totalAmount > 0 ? (totalPaidAmount / totalAmount) * 100 : 0;
}

export default router;