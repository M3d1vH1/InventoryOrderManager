import { 
  Supplier, InsertSupplier,
  SupplierInvoice, InsertSupplierInvoice,
  SupplierPayment, InsertSupplierPayment
} from '@shared/schema';
import { IStorage } from '../storage';

export interface ISupplierStorage {
  // Supplier methods
  getSupplier(id: number): Promise<Supplier | undefined>;
  getSupplierByName(name: string): Promise<Supplier | undefined>;
  getAllSuppliers(): Promise<Supplier[]>;
  getActiveSuppliers(): Promise<Supplier[]>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: number): Promise<boolean>;
  
  // Supplier Invoice methods
  getSupplierInvoice(id: number): Promise<SupplierInvoice | undefined>;
  getSupplierInvoicesBySupplier(supplierId: number): Promise<SupplierInvoice[]>;
  getPendingInvoices(): Promise<SupplierInvoice[]>;
  getOverdueInvoices(): Promise<SupplierInvoice[]>;
  getAllSupplierInvoices(): Promise<SupplierInvoice[]>;
  createSupplierInvoice(invoice: InsertSupplierInvoice): Promise<SupplierInvoice>;
  updateSupplierInvoice(id: number, invoice: Partial<InsertSupplierInvoice>): Promise<SupplierInvoice | undefined>;
  updateInvoiceStatus(id: number, status: 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'): Promise<SupplierInvoice | undefined>;
  deleteSupplierInvoice(id: number): Promise<boolean>;
  
  // Supplier Payment methods
  getSupplierPayment(id: number): Promise<SupplierPayment | undefined>;
  getSupplierPaymentsByInvoice(invoiceId: number): Promise<SupplierPayment[]>;
  getAllSupplierPayments(): Promise<SupplierPayment[]>;
  createSupplierPayment(payment: InsertSupplierPayment): Promise<SupplierPayment>;
  updateSupplierPayment(id: number, payment: Partial<InsertSupplierPayment>): Promise<SupplierPayment | undefined>;
  deleteSupplierPayment(id: number): Promise<boolean>;
  
  // Payment summary and reporting methods
  getPaymentsSummary(): Promise<{
    totalPending: number;
    totalOverdue: number;
    upcomingPayments: {
      id: number;
      invoiceNumber: string;
      supplierName: string;
      amount: number;
      dueDate: Date;
      daysLeft: number;
    }[];
  }>;
  
  getSupplierPaymentHistory(supplierId: number): Promise<{
    totalPaid: number;
    averageDaysToPayment: number;
    payments: {
      id: number;
      invoiceNumber: string;
      paymentDate: Date;
      amount: number;
      paymentMethod: string;
    }[];
  }>;
}

export class MemSupplierStorage implements ISupplierStorage {
  private suppliers: Map<number, Supplier>;
  private supplierInvoices: Map<number, SupplierInvoice>;
  private supplierPayments: Map<number, SupplierPayment>;
  private supplierIdCounter: number;
  private invoiceIdCounter: number;
  private paymentIdCounter: number;

  constructor() {
    this.suppliers = new Map();
    this.supplierInvoices = new Map();
    this.supplierPayments = new Map();
    this.supplierIdCounter = 1;
    this.invoiceIdCounter = 1;
    this.paymentIdCounter = 1;
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    return this.suppliers.get(id);
  }

  async getSupplierByName(name: string): Promise<Supplier | undefined> {
    return Array.from(this.suppliers.values()).find(s => s.name === name);
  }

  async getAllSuppliers(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values());
  }

  async getActiveSuppliers(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values()).filter(s => s.isActive);
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const id = this.supplierIdCounter++;
    const newSupplier: Supplier = {
      id,
      name: supplier.name,
      contactPerson: supplier.contactPerson ?? null,
      email: supplier.email ?? null,
      phone: supplier.phone ?? null,
      address: supplier.address ?? null,
      city: supplier.city ?? null,
      state: supplier.state ?? null,
      postalCode: supplier.postalCode ?? null,
      country: supplier.country ?? null,
      vatNumber: supplier.vatNumber ?? null,
      paymentTerms: supplier.paymentTerms ?? null,
      bankAccount: supplier.bankAccount ?? null,
      notes: supplier.notes ?? null,
      isActive: supplier.isActive ?? true,
      createdAt: new Date()
    };
    this.suppliers.set(id, newSupplier);
    return newSupplier;
  }

  async updateSupplier(id: number, supplier: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const existing = this.suppliers.get(id);
    if (!existing) return undefined;

    const updated: Supplier = {
      ...existing,
      ...supplier
    };
    this.suppliers.set(id, updated);
    return updated;
  }

  async deleteSupplier(id: number): Promise<boolean> {
    return this.suppliers.delete(id);
  }

  async getSupplierInvoice(id: number): Promise<SupplierInvoice | undefined> {
    return this.supplierInvoices.get(id);
  }

  async getSupplierInvoicesBySupplier(supplierId: number): Promise<SupplierInvoice[]> {
    return Array.from(this.supplierInvoices.values())
      .filter(invoice => invoice.supplierId === supplierId);
  }

  async getPendingInvoices(): Promise<SupplierInvoice[]> {
    return Array.from(this.supplierInvoices.values())
      .filter(invoice => invoice.status === 'pending');
  }

  async getOverdueInvoices(): Promise<SupplierInvoice[]> {
    const now = new Date();
    return Array.from(this.supplierInvoices.values())
      .filter(invoice => invoice.status === 'pending' && new Date(invoice.dueDate) < now);
  }

  async getAllSupplierInvoices(): Promise<SupplierInvoice[]> {
    return Array.from(this.supplierInvoices.values());
  }

  async createSupplierInvoice(invoice: InsertSupplierInvoice): Promise<SupplierInvoice> {
    const id = this.invoiceIdCounter++;
    const newInvoice: SupplierInvoice = {
      id,
      supplierId: invoice.supplierId,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate instanceof Date ? invoice.issueDate.toISOString() : invoice.issueDate,
      dueDate: invoice.dueDate instanceof Date ? invoice.dueDate.toISOString() : invoice.dueDate,
      amount: invoice.amount.toString(),
      paidAmount: invoice.paidAmount?.toString() ?? null,
      status: invoice.status ?? 'pending',
      description: invoice.description ?? null,
      notes: invoice.notes ?? null,
      reference: invoice.reference ?? null,
      rfNumber: invoice.rfNumber ?? null,
      attachmentPath: invoice.attachmentPath ?? null,
      attachment: invoice.attachment ?? null,
      attachmentUrl: invoice.attachmentUrl ?? null,
      invoiceDate: invoice.invoiceDate instanceof Date ? invoice.invoiceDate.toISOString() : invoice.invoiceDate ?? null,
      company: invoice.company ?? null,
      createdAt: new Date()
    };
    this.supplierInvoices.set(id, newInvoice);
    return newInvoice;
  }

  async updateSupplierInvoice(id: number, invoice: Partial<InsertSupplierInvoice>): Promise<SupplierInvoice | undefined> {
    const existing = this.supplierInvoices.get(id);
    if (!existing) return undefined;

    const updated: SupplierInvoice = {
      ...existing,
      ...invoice,
      issueDate: invoice.issueDate instanceof Date ? invoice.issueDate.toISOString() : invoice.issueDate ?? existing.issueDate,
      dueDate: invoice.dueDate instanceof Date ? invoice.dueDate.toISOString() : invoice.dueDate ?? existing.dueDate,
      amount: invoice.amount?.toString() ?? existing.amount,
      paidAmount: invoice.paidAmount?.toString() ?? existing.paidAmount,
      invoiceDate: invoice.invoiceDate instanceof Date ? invoice.invoiceDate.toISOString() : invoice.invoiceDate ?? existing.invoiceDate
    };
    this.supplierInvoices.set(id, updated);
    return updated;
  }

  async updateInvoiceStatus(id: number, status: 'pending' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'): Promise<SupplierInvoice | undefined> {
    const existing = this.supplierInvoices.get(id);
    if (!existing) return undefined;

    const updated: SupplierInvoice = {
      ...existing,
      status
    };
    this.supplierInvoices.set(id, updated);
    return updated;
  }

  async deleteSupplierInvoice(id: number): Promise<boolean> {
    return this.supplierInvoices.delete(id);
  }

  async getSupplierPayment(id: number): Promise<SupplierPayment | undefined> {
    return this.supplierPayments.get(id);
  }

  async getSupplierPaymentsByInvoice(invoiceId: number): Promise<SupplierPayment[]> {
    return Array.from(this.supplierPayments.values())
      .filter(payment => payment.invoiceId === invoiceId);
  }

  async getAllSupplierPayments(): Promise<SupplierPayment[]> {
    return Array.from(this.supplierPayments.values());
  }

  async createSupplierPayment(payment: InsertSupplierPayment): Promise<SupplierPayment> {
    const id = this.paymentIdCounter++;
    const newPayment: SupplierPayment = {
      id,
      invoiceId: payment.invoiceId,
      paymentDate: payment.paymentDate instanceof Date ? payment.paymentDate.toISOString() : payment.paymentDate,
      amount: payment.amount.toString(),
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber ?? null,
      reference: payment.reference ?? null,
      notes: payment.notes ?? null,
      receiptPath: payment.receiptPath ?? null,
      callbackRequired: payment.callbackRequired ?? false,
      callbackDate: payment.callbackDate instanceof Date ? payment.callbackDate.toISOString() : payment.callbackDate ?? null,
      callbackNotes: payment.callbackNotes ?? null,
      callbackCompleted: payment.callbackCompleted ?? false,
      company: payment.company ?? null,
      createdAt: new Date()
    };
    this.supplierPayments.set(id, newPayment);
    return newPayment;
  }

  async updateSupplierPayment(id: number, payment: Partial<InsertSupplierPayment>): Promise<SupplierPayment | undefined> {
    const existing = this.supplierPayments.get(id);
    if (!existing) return undefined;

    const updated: SupplierPayment = {
      ...existing,
      ...payment,
      paymentDate: payment.paymentDate instanceof Date ? payment.paymentDate.toISOString() : payment.paymentDate ?? existing.paymentDate,
      amount: payment.amount?.toString() ?? existing.amount,
      callbackDate: payment.callbackDate instanceof Date ? payment.callbackDate.toISOString() : payment.callbackDate ?? existing.callbackDate
    };
    this.supplierPayments.set(id, updated);
    return updated;
  }

  async deleteSupplierPayment(id: number): Promise<boolean> {
    return this.supplierPayments.delete(id);
  }

  async getPaymentsSummary(): Promise<{
    totalPending: number;
    totalOverdue: number;
    upcomingPayments: {
      id: number;
      invoiceNumber: string;
      supplierName: string;
      amount: number;
      dueDate: Date;
      daysLeft: number;
    }[];
  }> {
    const now = new Date();
    const pendingInvoices = Array.from(this.supplierInvoices.values())
      .filter(invoice => invoice.status === 'pending');
    
    const totalPending = pendingInvoices.reduce((sum, invoice) => sum + parseFloat(invoice.amount), 0);
    const totalOverdue = pendingInvoices
      .filter(invoice => new Date(invoice.dueDate) < now)
      .reduce((sum, invoice) => sum + parseFloat(invoice.amount), 0);

    const upcomingPayments = pendingInvoices
      .filter(invoice => new Date(invoice.dueDate) >= now)
      .map(invoice => {
        const supplier = this.suppliers.get(invoice.supplierId);
        const dueDate = new Date(invoice.dueDate);
        const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          supplierName: supplier?.name ?? 'Unknown Supplier',
          amount: parseFloat(invoice.amount),
          dueDate,
          daysLeft
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      totalPending,
      totalOverdue,
      upcomingPayments
    };
  }

  async getSupplierPaymentHistory(supplierId: number): Promise<{
    totalPaid: number;
    averageDaysToPayment: number;
    payments: {
      id: number;
      invoiceNumber: string;
      paymentDate: Date;
      amount: number;
      paymentMethod: string;
    }[];
  }> {
    const supplierInvoices = Array.from(this.supplierInvoices.values())
      .filter(invoice => invoice.supplierId === supplierId);
    
    const payments = supplierInvoices.flatMap(invoice => 
      Array.from(this.supplierPayments.values())
        .filter(payment => payment.invoiceId === invoice.id)
        .map(payment => ({
          id: payment.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentDate: new Date(payment.paymentDate),
          amount: parseFloat(payment.amount),
          paymentMethod: payment.paymentMethod
        }))
    );

    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    
    let totalDaysToPayment = 0;
    let paymentCount = 0;
    
    payments.forEach(payment => {
      const invoice = supplierInvoices.find(inv => inv.invoiceNumber === payment.invoiceNumber);
      if (invoice) {
        const daysToPayment = Math.ceil(
          (payment.paymentDate.getTime() - new Date(invoice.issueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        totalDaysToPayment += daysToPayment;
        paymentCount++;
      }
    });

    const averageDaysToPayment = paymentCount > 0 ? totalDaysToPayment / paymentCount : 0;

    return {
      totalPaid,
      averageDaysToPayment,
      payments: payments.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())
    };
  }
} 