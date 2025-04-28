import express, { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { isAuthenticated } from '../auth';
import { createInsertSchema } from 'drizzle-zod';
import { suppliers, supplierInvoices as invoices, supplierPayments as payments } from '@shared/schema';
import { subDays, startOfMonth, endOfMonth } from 'date-fns';

const router = Router();

// Ensure all routes are protected
router.use(isAuthenticated);

// Supplier validation schemas
const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true
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
    const allInvoices = await storage.getAllSupplierInvoices();
    res.json(allInvoices);
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
    const allPayments = await storage.getAllSupplierPayments();
    res.json(allPayments);
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
    // Get payment summary
    const summary = await storage.getPaymentsSummary();
    
    // Recent payments (last 10)
    const allPayments = await storage.getAllSupplierPayments();
    const recentPayments = allPayments
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
      .slice(0, 10)
      .map(async (payment) => {
        const invoice = await storage.getSupplierInvoice(payment.invoiceId);
        const supplier = invoice ? await storage.getSupplier(invoice.supplierId) : null;
        return {
          id: payment.id,
          invoiceNumber: invoice ? invoice.invoiceNumber : 'Unknown',
          supplierName: supplier ? supplier.name : 'Unknown',
          amount: payment.amount,
          paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod
        };
      });
    
    // Combine everything for the dashboard
    const dashboardSummary = {
      totalOutstanding: summary.totalPending + summary.totalOverdue,
      totalPaid: await getTotalPaidAmount(),
      paidThisMonth: await getPaidThisMonth(),
      overdueAmount: summary.totalOverdue,
      dueWithin30Days: summary.totalPending,
      paymentCompletion: calculatePaymentCompletion(),
      upcomingPayments: summary.upcomingPayments,
      recentPayments: await Promise.all(recentPayments)
    };
    
    res.json(dashboardSummary);
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