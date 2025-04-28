import express, { Request, Response } from "express";
import { storage } from "../storage";
import { isAuthenticated, hasRole } from "../auth";
import { 
  insertSupplierSchema,
  insertSupplierInvoiceSchema,
  insertSupplierPaymentSchema
} from "@shared/schema";
import { ZodError } from "zod";

const router = express.Router();

// Middleware to check if the user has permission to access supplier payment features
const canManageSupplierPayments = hasRole(['admin']);

// Get payment summary - accessible by admin and front_office
router.get('/summary', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const summary = await storage.getPaymentsSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error getting payment summary:', error);
    res.status(500).json({ message: 'Failed to get payment summary' });
  }
});

// ===== SUPPLIER ENDPOINTS =====

// Get all suppliers
router.get('/suppliers', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const suppliers = await storage.getAllSuppliers();
    res.json(suppliers);
  } catch (error) {
    console.error('Error getting suppliers:', error);
    res.status(500).json({ message: 'Failed to get suppliers' });
  }
});

// Get active suppliers
router.get('/suppliers/active', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const suppliers = await storage.getActiveSuppliers();
    res.json(suppliers);
  } catch (error) {
    console.error('Error getting active suppliers:', error);
    res.status(500).json({ message: 'Failed to get active suppliers' });
  }
});

// Get supplier by ID
router.get('/suppliers/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const supplier = await storage.getSupplier(parseInt(req.params.id));
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    res.json(supplier);
  } catch (error) {
    console.error('Error getting supplier:', error);
    res.status(500).json({ message: 'Failed to get supplier' });
  }
});

// Get supplier payment history
router.get('/suppliers/:id/payment-history', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const history = await storage.getSupplierPaymentHistory(parseInt(req.params.id));
    res.json(history);
  } catch (error) {
    console.error('Error getting supplier payment history:', error);
    res.status(500).json({ message: 'Failed to get supplier payment history' });
  }
});

// Create a new supplier
router.post('/suppliers', canManageSupplierPayments, async (req: Request, res: Response) => {
  try {
    const validatedData = insertSupplierSchema.parse(req.body);
    const supplier = await storage.createSupplier(validatedData);
    res.status(201).json(supplier);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid supplier data', errors: error.errors });
    }
    console.error('Error creating supplier:', error);
    res.status(500).json({ message: 'Failed to create supplier' });
  }
});

// Update a supplier
router.put('/suppliers/:id', canManageSupplierPayments, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const supplier = await storage.getSupplier(id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    const validatedData = insertSupplierSchema.partial().parse(req.body);
    const updatedSupplier = await storage.updateSupplier(id, validatedData);
    res.json(updatedSupplier);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid supplier data', errors: error.errors });
    }
    console.error('Error updating supplier:', error);
    res.status(500).json({ message: 'Failed to update supplier' });
  }
});

// Delete a supplier
router.delete('/suppliers/:id', canManageSupplierPayments, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const supplier = await storage.getSupplier(id);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }
    
    await storage.deleteSupplier(id);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ message: 'Failed to delete supplier' });
  }
});

// ===== INVOICE ENDPOINTS =====

// Get all invoices
router.get('/invoices', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const invoices = await storage.getAllSupplierInvoices();
    res.json(invoices);
  } catch (error) {
    console.error('Error getting invoices:', error);
    res.status(500).json({ message: 'Failed to get invoices' });
  }
});

// Get pending invoices
router.get('/invoices/pending', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const invoices = await storage.getPendingInvoices();
    res.json(invoices);
  } catch (error) {
    console.error('Error getting pending invoices:', error);
    res.status(500).json({ message: 'Failed to get pending invoices' });
  }
});

// Get overdue invoices
router.get('/invoices/overdue', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const invoices = await storage.getOverdueInvoices();
    res.json(invoices);
  } catch (error) {
    console.error('Error getting overdue invoices:', error);
    res.status(500).json({ message: 'Failed to get overdue invoices' });
  }
});

// Get invoice by ID
router.get('/invoices/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const invoice = await storage.getSupplierInvoice(parseInt(req.params.id));
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Error getting invoice:', error);
    res.status(500).json({ message: 'Failed to get invoice' });
  }
});

// Get invoices by supplier ID
router.get('/suppliers/:id/invoices', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const invoices = await storage.getSupplierInvoicesBySupplier(parseInt(req.params.id));
    res.json(invoices);
  } catch (error) {
    console.error('Error getting supplier invoices:', error);
    res.status(500).json({ message: 'Failed to get supplier invoices' });
  }
});

// Create a new invoice
router.post('/invoices', canManageSupplierPayments, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const invoiceData = {
      ...req.body,
      createdById: userId
    };
    
    const validatedData = insertSupplierInvoiceSchema.parse(invoiceData);
    const invoice = await storage.createSupplierInvoice(validatedData);
    res.status(201).json(invoice);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid invoice data', errors: error.errors });
    }
    console.error('Error creating invoice:', error);
    res.status(500).json({ message: 'Failed to create invoice' });
  }
});

// Update an invoice
router.put('/invoices/:id', canManageSupplierPayments, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const invoice = await storage.getSupplierInvoice(id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const validatedData = insertSupplierInvoiceSchema.partial().parse(req.body);
    const updatedInvoice = await storage.updateSupplierInvoice(id, {
      ...validatedData,
      updatedById: userId
    });
    
    res.json(updatedInvoice);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid invoice data', errors: error.errors });
    }
    console.error('Error updating invoice:', error);
    res.status(500).json({ message: 'Failed to update invoice' });
  }
});

// Update invoice status
router.patch('/invoices/:id/status', canManageSupplierPayments, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!status || !['pending', 'paid', 'partially_paid', 'overdue', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    const invoice = await storage.getSupplierInvoice(id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    const updatedInvoice = await storage.updateInvoiceStatus(id, status);
    res.json(updatedInvoice);
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({ message: 'Failed to update invoice status' });
  }
});

// Delete an invoice
router.delete('/invoices/:id', canManageSupplierPayments, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const invoice = await storage.getSupplierInvoice(id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    await storage.deleteSupplierInvoice(id);
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ message: 'Failed to delete invoice' });
  }
});

// ===== PAYMENT ENDPOINTS =====

// Get all payments
router.get('/payments', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const payments = await storage.getAllSupplierPayments();
    res.json(payments);
  } catch (error) {
    console.error('Error getting payments:', error);
    res.status(500).json({ message: 'Failed to get payments' });
  }
});

// Get payment by ID
router.get('/payments/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const payment = await storage.getSupplierPayment(parseInt(req.params.id));
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    res.json(payment);
  } catch (error) {
    console.error('Error getting payment:', error);
    res.status(500).json({ message: 'Failed to get payment' });
  }
});

// Get payments by invoice ID
router.get('/invoices/:id/payments', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const payments = await storage.getSupplierPaymentsByInvoice(parseInt(req.params.id));
    res.json(payments);
  } catch (error) {
    console.error('Error getting invoice payments:', error);
    res.status(500).json({ message: 'Failed to get invoice payments' });
  }
});

// Create a new payment
router.post('/payments', canManageSupplierPayments, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const paymentData = {
      ...req.body,
      createdById: userId
    };
    
    const validatedData = insertSupplierPaymentSchema.parse(paymentData);
    const payment = await storage.createSupplierPayment(validatedData);
    res.status(201).json(payment);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid payment data', errors: error.errors });
    }
    console.error('Error creating payment:', error);
    res.status(500).json({ message: 'Failed to create payment' });
  }
});

// Update a payment
router.put('/payments/:id', canManageSupplierPayments, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const payment = await storage.getSupplierPayment(id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    const validatedData = insertSupplierPaymentSchema.partial().parse(req.body);
    const updatedPayment = await storage.updateSupplierPayment(id, validatedData);
    res.json(updatedPayment);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ message: 'Invalid payment data', errors: error.errors });
    }
    console.error('Error updating payment:', error);
    res.status(500).json({ message: 'Failed to update payment' });
  }
});

// Delete a payment
router.delete('/payments/:id', canManageSupplierPayments, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const payment = await storage.getSupplierPayment(id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    await storage.deleteSupplierPayment(id);
    res.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ message: 'Failed to delete payment' });
  }
});

export default router;