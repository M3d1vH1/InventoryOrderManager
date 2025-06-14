import express, { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { isAuthenticated } from '../auth';
import { createInsertSchema } from 'drizzle-zod';
import { suppliers, supplierInvoices as invoices, supplierPayments as payments, 
         insertSupplierInvoiceSchema, insertSupplierPaymentSchema } from '@shared/schema';
import { subDays, startOfMonth, endOfMonth, format } from 'date-fns';
import { pool } from '../db';

// Helper function to update invoice payment status
async function updateInvoicePaymentStatus(invoiceId: number) {
  const client = await pool.connect();
  try {
    // Get invoice details
    const invoiceResult = await client.query(
      `SELECT id, amount, paid_amount, due_date, status FROM supplier_invoices WHERE id = $1`,
      [invoiceId]
    );
    
    if (invoiceResult.rows.length === 0) {
      console.error(`Invoice with ID ${invoiceId} not found for status update`);
      return;
    }
    
    const invoice = invoiceResult.rows[0];
    
    // Get total payments for this invoice
    const paymentsResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total_paid FROM supplier_payments WHERE invoice_id = $1`,
      [invoiceId]
    );
    
    const totalPaid = parseFloat(paymentsResult.rows[0].total_paid || 0);
    const invoiceAmount = parseFloat(invoice.amount);
    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    
    // Don't update cancelled invoices
    if (invoice.status === 'cancelled') {
      return;
    }
    
    // Update paid_amount field
    await client.query(
      `UPDATE supplier_invoices SET paid_amount = $1 WHERE id = $2`,
      [totalPaid, invoiceId]
    );
    
    // Determine new status
    let newStatus = invoice.status;
    const diff = Math.abs(invoiceAmount - totalPaid);
    const tolerance = 0.01; // Small tolerance for floating-point comparisons
    
    if (diff <= tolerance) {
      newStatus = 'paid';
    } else if (totalPaid > 0) {
      newStatus = 'partially_paid';
    } else if (dueDate < today) {
      newStatus = 'overdue';
    } else {
      newStatus = 'pending';
    }
    
    // Only update if status changed
    if (newStatus !== invoice.status) {
      console.log(`Updating invoice ${invoiceId} status: ${invoice.status} -> ${newStatus}`);
      console.log(`Invoice amount: ${invoiceAmount}, Paid amount: ${totalPaid}, Due date: ${format(dueDate, 'yyyy-MM-dd')}`);
      
      await client.query(
        `UPDATE supplier_invoices SET status = $1 WHERE id = $2`,
        [newStatus, invoiceId]
      );
    }
  } catch (error) {
    console.error('Error updating invoice payment status:', error);
  } finally {
    client.release();
  }
}

const router = Router();

// Ensure most routes are protected except specific ones needed by the Calendar dashboard
// Protected routes middleware will be applied individually to allow some public access

// Supplier validation schemas
const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true
});

const updateSupplierSchema = insertSupplierSchema.partial();

// Use the enhanced schema from shared/schema.ts instead of local definition
const insertInvoiceSchema = insertSupplierInvoiceSchema;
const updateInvoiceSchema = insertInvoiceSchema.partial();

// Use the enhanced schema from shared/schema.ts instead of local definition
const insertPaymentSchema = insertSupplierPaymentSchema;
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

// Get all invoices - public route for calendar integration
router.get('/invoices', async (req, res) => {
  console.log('[API] GET /supplier-payments/invoices - Fetching all invoices');
  
  // IMPORTANT: This route is accessible without authentication specifically
  // to allow calendar integrations to work properly
  try {
    // Use direct SQL query to bypass schema issues
    const client = await pool.connect();
    try {
      // Add more detailed query with snake_case to camelCase field renaming
      // to make it easier to use in calendar integrations
      const result = await client.query(`
        SELECT 
          si.id,
          si.invoice_number AS "invoiceNumber",
          si.supplier_id AS "supplierId",
          si.issue_date AS "issueDate",
          si.due_date AS "dueDate",
          si.amount,
          si.status,
          COALESCE(si.paid_amount, 0) AS "paidAmount",
          si.invoice_date AS "invoiceDate",
          s.name AS "supplierName"
        FROM supplier_invoices si 
        JOIN suppliers s ON si.supplier_id = s.id
        ORDER BY si.due_date DESC
      `);
      
      console.log(`[API] Found ${result.rows.length} invoices`);
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[API] Error fetching invoices:', error);
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
    // Log the original request with custom formatting to avoid Date object serialization issues
    console.log("Invoice creation request data - Raw:", req.body);
    
    // Raw types before validation (for debugging)
    console.log("Date types:", {
      issueDate: req.body.issueDate ? typeof req.body.issueDate : 'undefined',
      invoiceDate: req.body.invoiceDate ? typeof req.body.invoiceDate : 'undefined',
      dueDate: req.body.dueDate ? typeof req.body.dueDate : 'undefined'
    });
    
    // Try to parse the data with the schema directly
    let data;
    try {
      // Validate against the schema - it will now handle type coercion
      data = insertInvoiceSchema.parse(req.body);
    } catch (validationError: any) {
      console.error("Invoice validation error:", validationError);
      if (validationError instanceof z.ZodError) {
        // Log detailed validation errors
        validationError.errors.forEach((err, index) => {
          console.error(`Validation error ${index + 1}:`, JSON.stringify(err, null, 2));
        });
        
        return res.status(400).json({ 
          error: 'Validation error', 
          details: validationError.errors,
          message: validationError.message
        });
      }
      throw validationError;
    }
    
    // Ensure supplier exists
    const supplier = await storage.getSupplier(data.supplierId);
    if (!supplier) {
      return res.status(400).json({ error: 'Supplier not found' });
    }

    // Format dates for database query since we can't directly log Date objects
    const formattedDates = {
      issueDate: data.issueDate instanceof Date ? data.issueDate.toISOString() : 'not a date',
      dueDate: data.dueDate instanceof Date ? data.dueDate.toISOString() : 'not a date',
      invoiceDate: data.invoiceDate instanceof Date ? data.invoiceDate.toISOString() : 'not a date'
    };
    
    console.log("Validated data dates:", formattedDates);
    
    // Create the invoice with a direct SQL query to bypass any ORM issues
    try {
      const client = await pool.connect();
      try {
        // For SQL dates, format the Date objects to YYYY-MM-DD
        const formatSqlDate = (date: Date) => {
          return date.toISOString().split('T')[0];
        };
        
        const result = await client.query(
          `INSERT INTO supplier_invoices 
            (invoice_number, supplier_id, issue_date, due_date, amount, paid_amount, status, notes, attachment_path, invoice_date, reference, rf_number, company) 
           VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
           RETURNING *`,
          [
            data.invoiceNumber,
            data.supplierId,
            formatSqlDate(data.issueDate),
            formatSqlDate(data.dueDate),
            data.amount,
            data.paidAmount === undefined ? null : data.paidAmount,
            data.status,
            data.notes || null,
            data.attachmentPath || null,
            // Include invoice_date if provided
            data.invoiceDate ? formatSqlDate(data.invoiceDate) : null,
            // Include reference if provided
            data.reference || null,
            // Include RF Number if provided
            data.rfNumber || null,
            // Include company name
            data.company || null
          ]
        );
        
        console.log("Created invoice:", JSON.stringify(result.rows[0], null, 2));
        res.status(201).json(result.rows[0]);
      } finally {
        client.release();
      }
    } catch (dbError: any) {
      console.error("Database error creating invoice:", dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }
  } catch (error: any) {
    console.error("Invoice creation error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors,
        message: error.message
      });
    }
    res.status(500).json({ 
      error: error.message || 'Unknown server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
    console.log("Payment creation request data:", JSON.stringify(req.body, null, 2));
    console.log("Payment creation - field analysis:", {
      hasNotes: 'notes' in req.body,
      notesValue: req.body.notes,
      notesType: typeof req.body.notes,
      hasReferenceNumber: 'referenceNumber' in req.body,
      referenceNumberValue: req.body.referenceNumber,
      hasReference: 'reference' in req.body,
      referenceValue: req.body.reference,
      hasCompany: 'company' in req.body,
      companyValue: req.body.company
    });
    
    // Validate with schema that now handles type coercion
    let data;
    try {
      data = insertPaymentSchema.parse(req.body);
    } catch (validationError: any) {
      console.error("Payment validation error:", validationError);
      if (validationError instanceof z.ZodError) {
        // Log detailed validation errors
        validationError.errors.forEach((err, index) => {
          console.error(`Validation error ${index + 1}:`, JSON.stringify(err, null, 2));
        });
        
        return res.status(400).json({ 
          error: 'Validation error', 
          details: validationError.errors,
          message: validationError.message
        });
      }
      throw validationError;
    }
    
    // Ensure invoice exists
    const invoice = await storage.getSupplierInvoice(data.invoiceId);
    if (!invoice) {
      return res.status(400).json({ error: 'Invoice not found' });
    }
    
    // Validate that payment amount doesn't exceed remaining invoice amount
    const existingPayments = await storage.getSupplierPaymentsByInvoice(data.invoiceId);
    const totalPaidSoFar = existingPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const remainingAmount = Number(invoice.amount) - totalPaidSoFar;
    
    if (Number(data.amount) > remainingAmount + 0.01) { // Small tolerance for rounding errors
      return res.status(400).json({
        error: 'Payment validation error',
        message: `Payment amount (${data.amount}) exceeds remaining invoice amount (${remainingAmount.toFixed(2)})`
      });
    }

    // Add createdBy if available
    if (req.user && req.user.id) {
      data.createdById = req.user.id;
    }

    console.log("Validated payment data:", JSON.stringify(data, null, 2));
    
    // Get company field from the invoice if not provided in the payment data
    if (!data.company && invoice.company) {
      data.company = invoice.company;
    }

    // Create the payment with a direct SQL query to bypass ORM issues
    try {
      const client = await pool.connect();
      try {
        // For SQL dates, format the Date objects to YYYY-MM-DD
        const formatSqlDate = (date: Date) => {
          return date.toISOString().split('T')[0];
        };
        
        // Format dates for debugging
        const formattedDates = {
          paymentDate: data.paymentDate instanceof Date ? data.paymentDate.toISOString() : 'not a date',
          callbackDate: data.callbackDate instanceof Date ? data.callbackDate?.toISOString() : 'not a date/undefined'
        };
        console.log("Payment date info:", formattedDates);
        
        const result = await client.query(
          `INSERT INTO supplier_payments 
            (invoice_id, payment_date, amount, payment_method, reference_number, notes, receipt_path, company, reference,
             bank_account, callback_required, callback_date, callback_notes, callback_completed) 
           VALUES 
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
           RETURNING *`,
          [
            data.invoiceId,
            formatSqlDate(data.paymentDate),
            data.amount,
            data.paymentMethod,
            data.referenceNumber || null,
            data.notes || null,
            data.receiptPath || null,
            data.company || null,
            data.reference || null,
            data.bankAccount || null,
            data.callbackRequired || false,
            data.callbackDate ? formatSqlDate(data.callbackDate) : null,
            data.callbackNotes || null,
            data.callbackCompleted || false
          ]
        );
        
        console.log("Created payment:", JSON.stringify(result.rows[0], null, 2));
        
        // Use our new helper function to update invoice status
        await updateInvoicePaymentStatus(data.invoiceId);
        
        // Get invoice amount for comparison
        const invoiceResult = await client.query(
          `SELECT amount FROM supplier_invoices WHERE id = $1`,
          [data.invoiceId]
        );
        
        const invoiceAmount = parseFloat(invoiceResult.rows[0].amount);
        
        // Determine the new status based on payment amount
        let newStatus = invoice.status;
        if (totalPaid >= invoiceAmount) {
          newStatus = 'paid';
        } else if (totalPaid > 0) {
          newStatus = 'partially_paid';
        }
        
        // Update invoice status and paid_amount
        await client.query(
          `UPDATE supplier_invoices 
           SET status = $1, paid_amount = $2 
           WHERE id = $3`,
          [newStatus, totalPaid, data.invoiceId]
        );
        
        res.status(201).json(result.rows[0]);
      } finally {
        client.release();
      }
    } catch (dbError: any) {
      console.error("Database error creating payment:", dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }
  } catch (error: any) {
    console.error("Payment creation error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors,
        message: error.message
      });
    }
    res.status(500).json({ 
      error: error.message || 'Unknown server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update a payment
router.patch('/payments/:id', async (req, res) => {
  try {
    console.log("Payment update request data:", JSON.stringify(req.body, null, 2));
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }
    
    // Validate data with schema that now handles coercion
    let data;
    try {
      data = updatePaymentSchema.parse(req.body);
    } catch (validationError: any) {
      console.error("Payment update validation error:", validationError);
      if (validationError instanceof z.ZodError) {
        // Log detailed validation errors
        validationError.errors.forEach((err, index) => {
          console.error(`Validation error ${index + 1}:`, JSON.stringify(err, null, 2));
        });
        
        return res.status(400).json({ 
          error: 'Validation error', 
          details: validationError.errors,
          message: validationError.message
        });
      }
      throw validationError;
    }
    
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
    
    console.log("Validated payment update data:", JSON.stringify(data, null, 2));
    
    // Update the payment with a direct SQL query
    try {
      const client = await pool.connect();
      try {
        // Build the update query dynamically based on provided fields
        const updateFields = [];
        const queryParams = [];
        let paramCounter = 1;
        
        if (data.invoiceId !== undefined) {
          updateFields.push(`invoice_id = $${paramCounter++}`);
          queryParams.push(data.invoiceId);
        }
        
        // For SQL dates, format the Date objects to YYYY-MM-DD
        const formatSqlDate = (date: Date) => {
          return date.toISOString().split('T')[0];
        };
        
        if (data.paymentDate !== undefined) {
          updateFields.push(`payment_date = $${paramCounter++}`);
          queryParams.push(formatSqlDate(data.paymentDate));
        }
        
        if (data.amount !== undefined) {
          updateFields.push(`amount = $${paramCounter++}`);
          queryParams.push(data.amount);
        }
        
        if (data.paymentMethod !== undefined) {
          updateFields.push(`payment_method = $${paramCounter++}`);
          queryParams.push(data.paymentMethod);
        }
        
        if (data.referenceNumber !== undefined) {
          updateFields.push(`reference_number = $${paramCounter++}`);
          queryParams.push(data.referenceNumber);
        }
        
        if (data.notes !== undefined) {
          updateFields.push(`notes = $${paramCounter++}`);
          queryParams.push(data.notes);
        }
        
        if (data.receiptPath !== undefined) {
          updateFields.push(`receipt_path = $${paramCounter++}`);
          queryParams.push(data.receiptPath);
        }
        
        if (data.company !== undefined) {
          updateFields.push(`company = $${paramCounter++}`);
          queryParams.push(data.company);
        }
        
        if (data.reference !== undefined) {
          updateFields.push(`reference = $${paramCounter++}`);
          queryParams.push(data.reference);
        }
        
        if (updateFields.length === 0) {
          return res.status(400).json({ error: 'No fields to update' });
        }
        
        // Add the payment ID as the last parameter
        queryParams.push(id);
        
        // Execute the update query
        const query = `
          UPDATE supplier_payments 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramCounter}
          RETURNING *
        `;
        
        const result = await client.query(query, queryParams);
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Payment not found' });
        }
        
        console.log("Updated payment:", JSON.stringify(result.rows[0], null, 2));
        
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
        
        res.json(result.rows[0]);
      } finally {
        client.release();
      }
    } catch (dbError: any) {
      console.error("Database error updating payment:", dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }
  } catch (error: any) {
    console.error("Payment update error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors,
        message: error.message
      });
    }
    res.status(500).json({ 
      error: error.message || 'Unknown server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
      
      // Get pending invoices amount - ensure we correctly handle null paid_amount values
      const pendingResult = await client.query(`
        SELECT COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) as total_pending
        FROM supplier_invoices
        WHERE status = 'pending' OR status = 'partially_paid'
      `);
      
      // Get overdue invoices amount - ensure we correctly handle null paid_amount values
      const overdueResult = await client.query(`
        SELECT COALESCE(SUM(amount - COALESCE(paid_amount, 0)), 0) as total_overdue
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
      
      // Get all invoices for calendar display
      const invoicesResult = await client.query(`
        SELECT 
          i.id,
          i.invoice_number as "invoiceNumber",
          s.name as "supplierName",
          i.amount,
          COALESCE(i.paid_amount, 0) as "paidAmount",
          i.due_date as "dueDate",
          i.status
        FROM 
          supplier_invoices i
        JOIN 
          suppliers s ON i.supplier_id = s.id
        WHERE 
          i.status IN ('pending', 'partially_paid', 'overdue', 'paid')
        ORDER BY 
          i.due_date ASC
      `);

      const dashboardSummary = {
        totalOutstanding: parseFloat(pendingResult.rows[0].total_pending) + parseFloat(overdueResult.rows[0].total_overdue),
        totalPaid: parseFloat(totalPaidResult.rows[0].total_paid),
        paidThisMonth: parseFloat(paidThisMonthResult.rows[0].paid_this_month),
        overdueAmount: parseFloat(overdueResult.rows[0].total_overdue),
        dueWithin30Days: parseFloat(pendingResult.rows[0].total_pending),
        paymentCompletion: 0, // We'll calculate this below
        upcomingPayments: [], // We'll add this below
        recentPayments: recentPaymentsResult.rows,
        invoices: invoicesResult.rows // Add all invoices for the calendar
      };
      
      // Calculate payment completion - ensure we correctly handle null paid_amount values
      const totalInvoicesResult = await client.query(`
        SELECT 
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(COALESCE(paid_amount, 0)), 0) as total_paid_amount
        FROM 
          supplier_invoices
        WHERE 
          status != 'cancelled'
      `);
      
      const totalAmount = parseFloat(totalInvoicesResult.rows[0].total_amount);
      const totalPaidAmount = parseFloat(totalInvoicesResult.rows[0].total_paid_amount);
      
      dashboardSummary.paymentCompletion = totalAmount > 0 ? (totalPaidAmount / totalAmount) * 100 : 0;
      
      // Get upcoming payments - include payments due in the next 60 days to populate the calendar
      const upcomingPaymentsResult = await client.query(`
        SELECT 
          i.id,
          i.invoice_number as "invoiceNumber",
          s.name as "supplierName",
          i.amount - COALESCE(i.paid_amount, 0) as "remainingAmount",
          i.due_date as "dueDate"
        FROM 
          supplier_invoices i
        JOIN 
          suppliers s ON i.supplier_id = s.id
        WHERE 
          i.status IN ('pending', 'partially_paid', 'overdue') AND
          i.due_date <= CURRENT_DATE + interval '60 days'
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