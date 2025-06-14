import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Search, Calendar, CreditCard, Receipt } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { PaymentForm } from './PaymentForm';
import { apiRequest } from '@/lib/queryClient';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export const PaymentList = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  
  // Define types for our data
  type Supplier = {
    id: number;
    name: string;
    [key: string]: any;
  };
  
  type Invoice = {
    id: number;
    invoiceNumber: string;
    supplierId: number;
    [key: string]: any;
  };
  
  type Payment = {
    id: number;
    invoiceId: number;
    paymentDate: string;
    amount: number | string;
    paymentMethod: string;
    reference?: string | null;
    notes?: string | null;
    company?: string | null;
    [key: string]: any;
  };

  // Fetch all payments
  const { data: payments = [], isLoading: isLoadingPayments } = useQuery<Payment[]>({
    queryKey: ['/api/supplier-payments/payments'],
    retry: 1,
  });

  // Fetch all suppliers for dropdown
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery<Supplier[]>({
    queryKey: ['/api/supplier-payments/suppliers'],
    retry: 1,
  });

  // Fetch all invoices for dropdown in form
  const { data: invoices = [], isLoading: isLoadingInvoices } = useQuery<Invoice[]>({
    queryKey: ['/api/supplier-payments/invoices'],
    retry: 1,
  });

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest({
        url: `/api/supplier-payments/payments/${id}`,
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: t('supplierPayments.payment.deleted'),
        description: t('supplierPayments.payment.deleteSuccess'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/summary'] });
      setIsDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('supplierPayments.payment.deleteError'),
        variant: 'destructive',
      });
    },
  });

  // Filter payments based on search query and supplier
  const filteredPayments = payments.filter((payment: any) => {
    const query = searchQuery.toLowerCase();
    
    // Get invoice for this payment - try both camelCase and snake_case property names
    const invoice = invoices.find((inv: any) => 
      inv.id === (payment.invoiceId || payment.invoice_id)
    );
    
    // Get supplier for this payment - try both camelCase and snake_case property names
    const supplier = invoice 
      ? suppliers.find((s: any) => 
          s.id === (invoice.supplierId || invoice.supplier_id)
        )
      : null;
    
    // Handle reference field (which might be stored as either reference or referenceNumber)
    const referenceValue = payment.reference || payment.referenceNumber || payment.reference_number;
    
    const matchesSearch = 
      (referenceValue ? referenceValue.toLowerCase().includes(query) : false) ||
      (payment.notes ? payment.notes.toLowerCase().includes(query) : false) ||
      (payment.paymentMethod || payment.payment_method ? (payment.paymentMethod || payment.payment_method).toLowerCase().includes(query) : false) ||
      (payment.company ? payment.company.toLowerCase().includes(query) : false) ||
      (supplier && supplier.name ? supplier.name.toLowerCase().includes(query) : false) ||
      (invoice && (invoice.invoiceNumber || invoice.invoice_number) ? 
        (invoice.invoiceNumber || invoice.invoice_number).toLowerCase().includes(query) : false);
    
    if (filterSupplier === 'all') {
      return matchesSearch;
    }
    
    // Handle either camelCase or snake_case property names
    return matchesSearch && 
      invoice && 
      (invoice.supplierId?.toString() === filterSupplier || 
       invoice.supplier_id?.toString() === filterSupplier);
  });

  // Get supplier name for a payment
  const getSupplierForPayment = (payment: any) => {
    // Check if payment already has supplier information
    if (payment.supplierName) return payment.supplierName;
    
    // Extract invoice ID using either camelCase or snake_case
    const paymentInvoiceId = payment.invoiceId || payment.invoice_id;
    if (!paymentInvoiceId) return '-';
    
    // Get the invoice
    const invoice = invoices.find((inv: any) => inv.id === paymentInvoiceId);
    if (!invoice) return '-';
    
    // Extract supplier ID using either camelCase or snake_case
    const invoiceSupplierId = invoice.supplierId || invoice.supplier_id;
    if (!invoiceSupplierId) return '-';
    
    // Find the supplier
    const supplier = suppliers.find((s: any) => s.id === invoiceSupplierId);
    
    // Return supplier name or fallback
    return supplier ? supplier.name : '-';
  };

  // Get invoice number for a payment
  const getInvoiceNumber = (invoiceId: number) => {
    if (!invoiceId) return '-';
    
    const invoice = invoices.find((inv: any) => inv.id === invoiceId);
    // Try invoiceNumber first, fallback to invoice_number (snake_case from backend)
    return invoice ? (invoice.invoiceNumber || invoice.invoice_number || '-') : '-';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Get badge and icon for payment method
  const getPaymentMethodBadge = (method: string) => {
    if (!method) return null;
    
    let icon;
    let variant: "default" | "secondary" | "destructive" | "outline" = "default";
    let displayText = method;
    
    // Clean up method for display - remove translation prefixes if they exist
    if (typeof method === 'string' && method.startsWith('supplierPayments.payment.method.')) {
      displayText = method.replace('supplierPayments.payment.method.', '');
    }
    
    // Clean up any remaining t() wrappers
    if (typeof displayText === 'string' && displayText.startsWith('t(')) {
      displayText = displayText.replace(/^t\(['"](.+)['"]\)$/, '$1');
      // Further clean up if it's a translation key
      if (displayText.includes('.')) {
        displayText = displayText.split('.').pop() || displayText;
      }
    }
    
    // Convert display text for better readability
    displayText = displayText
      .replace(/_/g, ' ')  // Replace underscores with spaces
      .replace(/\b\w/g, (c) => c.toUpperCase());  // Capitalize first letter of each word
    
    const methodLower = method && typeof method === 'string' ? method.toLowerCase() : '';
    switch (methodLower) {
      case 'credit card':
      case 'credit_card':
      case 'creditcard':
      case 'supplierPayments.payment.method.credit_card'.toLowerCase():
        icon = <CreditCard className="h-4 w-4" />;
        variant = "default";
        displayText = "Credit Card";
        break;
      case 'bank transfer':
      case 'bank_transfer':
      case 'banktransfer':
      case 'supplierPayments.payment.method.bank_transfer'.toLowerCase():
        icon = <Receipt className="h-4 w-4" />;
        variant = "secondary";
        displayText = "Bank Transfer";
        break;
      case 'cash':
      case 'supplierPayments.payment.method.cash'.toLowerCase():
        icon = <Calendar className="h-4 w-4" />;
        variant = "outline";
        displayText = "Cash";
        break;
      default:
        icon = <Receipt className="h-4 w-4" />;
        variant = "outline";
    }
    
    return (
      <Badge variant={variant} className="flex w-fit items-center gap-1">
        {icon}
        {displayText}
      </Badge>
    );
  };

  const handleAddClick = () => {
    setSelectedPayment(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (payment: any) => {
    setSelectedPayment(payment);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (payment: any) => {
    setSelectedPayment(payment);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedPayment) {
      deletePaymentMutation.mutate(selectedPayment.id);
    }
  };

  return (
    <div>
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{t('supplierPayments.payment.list')}</CardTitle>
            <Button onClick={handleAddClick}>
              <Plus className="mr-2 h-4 w-4" /> {t('supplierPayments.payment.add')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-grow">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('supplierPayments.payment.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="w-full sm:w-[200px]">
              <Select
                value={filterSupplier}
                onValueChange={setFilterSupplier}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('supplierPayments.payment.filterBySupplier')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('supplierPayments.payment.allSuppliers')}</SelectItem>
                  {suppliers.map((supplier: any) => (
                    <SelectItem key={supplier.id} value={supplier.id.toString()}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoadingPayments || isLoadingSuppliers || isLoadingInvoices ? (
            <div className="text-center py-4">{t('common.loading')}</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('supplierPayments.payment.date')}</TableHead>
                    <TableHead>{t('supplierPayments.payment.supplier')}</TableHead>
                    <TableHead>{t('supplierPayments.payment.invoice')}</TableHead>
                    <TableHead>{t('supplierPayments.payment.company')}</TableHead>
                    <TableHead>{t('supplierPayments.payment.amount')}</TableHead>
                    <TableHead>{t('supplierPayments.payment.paymentMethod')}</TableHead>
                    <TableHead>{t('supplierPayments.payment.reference')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-4">
                        {t('supplierPayments.payment.noResults')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment: any) => (
                      <TableRow key={payment.id}>
                        <TableCell>{formatDate(payment.paymentDate || payment.payment_date)}</TableCell>
                        <TableCell>{getSupplierForPayment(payment)}</TableCell>
                        <TableCell>{getInvoiceNumber(payment.invoiceId || payment.invoice_id)}</TableCell>
                        <TableCell>{payment.company || '-'}</TableCell>
                        <TableCell>{formatCurrency(payment.amount)}</TableCell>
                        <TableCell>
                          {getPaymentMethodBadge(payment.paymentMethod || payment.payment_method)}
                        </TableCell>
                        <TableCell>{payment.reference || payment.referenceNumber || payment.reference_number || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditClick(payment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(payment)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Form Dialog */}
      <PaymentForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        payment={selectedPayment}
        invoices={invoices as any[]}
        suppliers={suppliers as any[]}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('supplierPayments.payment.confirmDelete')}</DialogTitle>
            <DialogDescription>
              {t('supplierPayments.payment.deleteWarning')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deletePaymentMutation.isPending}
            >
              {deletePaymentMutation.isPending ? t('common.processing') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};