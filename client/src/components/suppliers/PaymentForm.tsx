import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Loader, CalendarIcon, Euro, FileText, Info, Building2 } from 'lucide-react';
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Define validation schema for payment form
const paymentFormSchema = z.object({
  supplierId: z.string().min(1, { message: 'Supplier is required' }),
  invoiceId: z.string().min(1, { message: 'Invoice is required' }),
  paymentDate: z.date({
    required_error: "Payment date is required",
  }),
  amount: z.string().min(1, { message: 'Amount is required' })
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Amount must be a positive number',
    }),
  paymentMethod: z.string().min(1, { message: 'Payment method is required' }),
  bankAccount: z.string().optional(),
  referenceNumber: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  payment?: any;
  invoices: any[];
  suppliers: any[];
}

export const PaymentForm = ({ isOpen, onClose, payment, invoices, suppliers }: PaymentFormProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [step, setStep] = useState<'supplier' | 'invoice'>(payment ? 'invoice' : 'supplier');
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([]);
  
  // Payment methods
  const paymentMethods = [
    'Bank Transfer',
    'Credit Card',
    'Cash',
    'Check',
    'Online Payment',
    'Other'
  ];
  
  // Initialize form with payment data or defaults
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      supplierId: '',
      invoiceId: '',
      paymentDate: new Date(),
      amount: '',
      paymentMethod: '',
      bankAccount: '',
      referenceNumber: '',
      company: '',
      notes: '',
    },
  });

  // Get unpaid amount for an invoice
  const getUnpaidAmount = (invoiceId: number) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return 0;
    
    // Calculate unpaid amount - handle both field name types (snake_case and camelCase)
    const totalAmount = parseFloat(invoice.amount) || 0;
    const paidAmount = parseFloat(invoice.paid_amount || invoice.paidAmount || 0);
    return Math.max(0, totalAmount - paidAmount);
  };

  // Get payment percentage for an invoice
  const getPaymentPercentage = (invoice: any) => {
    if (!invoice) return 0;
    
    // Handle both field name types (snake_case and camelCase)
    const totalAmount = parseFloat(invoice.amount) || 0;
    if (totalAmount === 0) return 0;
    
    const paidAmount = parseFloat(invoice.paid_amount || invoice.paidAmount || 0);
    return Math.min(100, Math.round((paidAmount / totalAmount) * 100));
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Watch for supplier and invoice changes
  const watchedSupplierId = form.watch('supplierId');
  const watchedInvoiceId = form.watch('invoiceId');
  
  // Filter invoices by supplier
  useEffect(() => {
    if (watchedSupplierId) {
      const supplierIdNum = parseInt(watchedSupplierId);
      const filtered = invoices.filter(invoice => {
        // Handle both snake_case and camelCase field names
        const invoiceSupplierID = invoice.supplier_id || invoice.supplierId || invoice.supplierId;
        const invoiceStatus = invoice.status;
        
        // Debug log for field names
        console.log('Invoice fields:', { 
          id: invoice.id, 
          supplierId: invoice.supplierId, 
          supplier_id: invoice.supplier_id,
          status: invoice.status, 
          invoice_number: invoice.invoice_number,
          invoiceNumber: invoice.invoiceNumber,
          matchesSupplier: invoiceSupplierID === supplierIdNum
        });
                
        return invoiceSupplierID === supplierIdNum && 
          (invoiceStatus === 'pending' || 
           invoiceStatus === 'partially_paid' || 
           invoiceStatus === 'overdue');
      });
      
      console.log("Filtered invoices for supplier:", supplierIdNum, filtered);
      setFilteredInvoices(filtered);
      
      // If there's only one invoice, automatically select it
      if (filtered.length === 1 && !payment) {
        form.setValue('invoiceId', filtered[0].id.toString());
      }
    } else {
      setFilteredInvoices([]);
    }
  }, [watchedSupplierId, invoices, form, payment]);
  
  // Update selected invoice and set default amount when invoice changes
  useEffect(() => {
    if (watchedInvoiceId) {
      const invoiceId = parseInt(watchedInvoiceId);
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        setSelectedInvoice(invoice);
        
        // Set default amount to unpaid amount if not editing
        if (!payment) {
          const unpaidAmount = getUnpaidAmount(invoiceId);
          form.setValue('amount', unpaidAmount.toString());
          
          // Automatically set reference from invoice if available
          const invoiceRfNumber = invoice.rf_number || invoice.rfNumber;
          if (invoiceRfNumber) {
            form.setValue('referenceNumber', invoiceRfNumber);
          } else {
            // Fallback to old reference field format
            const invoiceReference = invoice.reference || invoice.reference_number;
            if (invoiceReference) {
              form.setValue('referenceNumber', invoiceReference);
            }
          }
        }
        
        // If supplier not set, set it from the invoice
        if (!watchedSupplierId) {
          const invoiceSupplierId = invoice.supplier_id || invoice.supplierId;
          if (invoiceSupplierId) {
            form.setValue('supplierId', invoiceSupplierId.toString());
          }
        }
      }
    } else {
      setSelectedInvoice(null);
    }
  }, [watchedInvoiceId, invoices, form, payment, watchedSupplierId]);

  // Reset form when payment changes
  useEffect(() => {
    if (payment) {
      const invoice = invoices.find(inv => inv.id === payment.invoiceId);
      // Handle both field name formats (snake_case and camelCase)
      const supplierId = invoice?.supplier_id?.toString() || invoice?.supplierId?.toString() || '';
      
      console.log('Reset form with payment:', { 
        payment, 
        invoice, 
        supplierId,
        invoice_supplier_id: invoice?.supplier_id,
        invoice_supplierId: invoice?.supplierId
      });
      
      form.reset({
        supplierId: supplierId,
        invoiceId: payment.invoiceId?.toString() || '',
        paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
        amount: payment.amount?.toString() || '',
        paymentMethod: payment.paymentMethod || '',
        bankAccount: payment.bankAccount || '',
        referenceNumber: payment.referenceNumber || payment.reference || '',
        company: payment.company || '',
        notes: payment.notes || '',
      });
      
      if (invoice) {
        setSelectedInvoice(invoice);
        setStep('invoice');
      }
    } else {
      form.reset({
        supplierId: '',
        invoiceId: '',
        paymentDate: new Date(),
        amount: '',
        paymentMethod: '',
        bankAccount: '',
        referenceNumber: '',
        company: '',
        notes: '',
      });
      setSelectedInvoice(null);
      setStep('supplier');
    }
  }, [payment, form, invoices]);

  // Save payment mutation
  const savePaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      if (payment) {
        // Update existing payment
        return apiRequest(`/api/supplier-payments/payments/${payment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        // Create new payment
        return apiRequest('/api/supplier-payments/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
    },
    onSuccess: () => {
      toast({
        title: payment ? t('supplierPayments.payment.updated') : t('supplierPayments.payment.created'),
        description: payment ? t('supplierPayments.payment.updateSuccess') : t('supplierPayments.payment.createSuccess'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/summary'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('supplierPayments.payment.saveError'),
        variant: 'destructive',
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: PaymentFormValues) => {
    // Convert string values to numbers and ensure payment method is in the correct format
    const formattedData = {
      ...data,
      invoiceId: parseInt(data.invoiceId),
      amount: parseFloat(data.amount),
      // Make sure paymentMethod is in the correct enum format (snake_case)
      paymentMethod: data.paymentMethod.toLowerCase().replace(' ', '_'),
    };

    savePaymentMutation.mutate(formattedData);
  };

  // Go to next step (from supplier to invoice)
  const goToInvoiceStep = () => {
    if (watchedSupplierId) {
      setStep('invoice');
    } else {
      form.setError('supplierId', { 
        type: 'manual', 
        message: t('supplierPayments.payment.supplierRequired') 
      });
    }
  };

  // Go back to supplier step
  const goToSupplierStep = () => {
    setStep('supplier');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {payment ? t('supplierPayments.payment.edit') : t('supplierPayments.payment.create')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Step: Select Supplier */}
            {step === 'supplier' && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('supplierPayments.payment.supplier')}</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('supplierPayments.payment.selectSupplier')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers
                            .filter(s => s.isActive !== false)
                            .map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id.toString()}>
                                {supplier.name}
                              </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Show unpaid invoices summary for selected supplier */}
                {watchedSupplierId && filteredInvoices.length > 0 && (
                  <Card>
                    <CardContent className="pt-4">
                      <h3 className="text-sm font-medium mb-2">
                        {t('supplierPayments.payment.unpaidInvoices', { count: filteredInvoices.length })}
                      </h3>
                      <ul className="space-y-2">
                        {filteredInvoices.slice(0, 3).map(invoice => (
                          <li key={invoice.id} className="text-sm">
                            <div className="flex justify-between">
                              <span>{invoice.invoice_number || invoice.invoiceNumber}</span>
                              <span className="font-semibold">
                                {formatCurrency(getUnpaidAmount(invoice.id))}
                              </span>
                            </div>
                          </li>
                        ))}
                        {filteredInvoices.length > 3 && (
                          <li className="text-sm text-muted-foreground">
                            {t('supplierPayments.payment.moreInvoices', { count: filteredInvoices.length - 3 })}
                          </li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {watchedSupplierId && filteredInvoices.length === 0 && (
                  <div className="text-sm text-muted-foreground p-4 bg-muted rounded-md">
                    {t('supplierPayments.payment.noUnpaidInvoices')}
                  </div>
                )}

                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button 
                    type="button" 
                    onClick={goToInvoiceStep}
                    disabled={!watchedSupplierId || filteredInvoices.length === 0}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Fill payment details */}
            {step === 'invoice' && (
              <div className="space-y-4">
                {!payment && (
                  <div className="flex items-center mb-4">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="text-sm p-0 h-auto" 
                      onClick={goToSupplierStep}
                    >
                      ← {t('supplierPayments.payment.backToSupplier')}
                    </Button>
                  </div>
                )}

                {/* Invoice field - required */}
                <FormField
                  control={form.control}
                  name="invoiceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('supplierPayments.payment.invoice')}</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('supplierPayments.payment.selectInvoice')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredInvoices.map((invoice) => (
                            <SelectItem key={invoice.id} value={invoice.id.toString()}>
                              {invoice.invoice_number || invoice.invoiceNumber} - {formatCurrency(getUnpaidAmount(invoice.id))}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Selected Invoice Details */}
                {selectedInvoice && (
                  <Card className="bg-muted/40">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-sm font-medium">
                            {selectedInvoice.invoice_number || selectedInvoice.invoiceNumber}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(selectedInvoice.issue_date || selectedInvoice.issueDate), "PPP")}
                          </p>
                        </div>
                        <Badge variant={
                          selectedInvoice.status === 'pending' ? 'outline' :
                          selectedInvoice.status === 'partially_paid' ? 'secondary' :
                          selectedInvoice.status === 'overdue' ? 'destructive' : 'default'
                        }>
                          {t(`supplierPayments.invoice.statuses.${selectedInvoice.status}`)}
                        </Badge>
                      </div>

                      {/* Payment progress */}
                      <div className="space-y-1 mb-3">
                        <div className="flex justify-between text-xs">
                          <span>{t('supplierPayments.payment.paymentProgress')}</span>
                          <span>{getPaymentPercentage(selectedInvoice)}%</span>
                        </div>
                        <Progress value={getPaymentPercentage(selectedInvoice)} className="h-2" />
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-sm">
                        <div className="flex items-center gap-1">
                          <Euro className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{t('supplierPayments.payment.totalAmount')}:</span>
                        </div>
                        <div className="text-right">
                          {formatCurrency(selectedInvoice.amount || 0)}
                        </div>

                        <div className="flex items-center gap-1">
                          <Euro className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{t('supplierPayments.payment.remainingAmount')}:</span>
                        </div>
                        <div className="text-right font-semibold">
                          {formatCurrency(getUnpaidAmount(selectedInvoice.id))}
                        </div>

                        {(selectedInvoice.rf_number || selectedInvoice.rfNumber || selectedInvoice.reference || selectedInvoice.reference_number) && (
                          <>
                            <div className="flex items-center gap-1">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{t('supplierPayments.invoice.rfNumber')}:</span>
                            </div>
                            <div className="text-right font-mono text-xs">
                              {selectedInvoice.rf_number || selectedInvoice.rfNumber || selectedInvoice.reference || selectedInvoice.reference_number}
                            </div>
                          </>
                        )}
                        
                        {/* Display company if available */}
                        {selectedInvoice.company && (
                          <>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{t('supplierPayments.invoice.company')}:</span>
                            </div>
                            <div className="text-right text-xs">
                              {selectedInvoice.company}
                            </div>
                          </>
                        )}
                        
                        {/* Extract company name from notes if present */}
                        {!selectedInvoice.company && selectedInvoice.notes && selectedInvoice.notes.includes('Company:') && (
                          <>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{t('supplierPayments.invoice.company')}:</span>
                            </div>
                            <div className="text-right text-xs">
                              {selectedInvoice.notes.split('Company:')[1].split('\n')[0].trim()}
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Separator className="my-2" />

                {/* Payment Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Payment Date field - required */}
                  <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>{t('supplierPayments.payment.paymentDate')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>{t('supplierPayments.payment.selectDate')}</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Amount field - required */}
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('supplierPayments.payment.amount')}</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0.01" 
                            step="0.01"
                            placeholder={t('supplierPayments.payment.amountPlaceholder')} 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Payment Method field - required */}
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('supplierPayments.payment.paymentMethod')}</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('supplierPayments.payment.selectPaymentMethod')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paymentMethods.map((method) => (
                              <SelectItem key={method} value={method}>
                                {t(`supplierPayments.payment.methods.${method.toLowerCase().replace(' ', '_')}`) || method}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Bank Account field - optional */}
                  <FormField
                    control={form.control}
                    name="bankAccount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('supplierPayments.payment.bankAccount', 'Bank Account')}</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder={t('supplierPayments.payment.bankAccountPlaceholder', 'Enter bank account')} 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Reference field */}
                  <FormField
                    control={form.control}
                    name="referenceNumber"
                    render={({ field }) => {
                      // If selected invoice has RF number or reference, use it as placeholder
                      const invoiceRfNumber = selectedInvoice?.rf_number || selectedInvoice?.rfNumber;
                      const invoiceReference = selectedInvoice?.reference || selectedInvoice?.reference_number;
                      const placeholder = invoiceRfNumber
                        ? invoiceRfNumber
                        : invoiceReference
                          ? invoiceReference
                          : 'RF000000000';
                      
                      return (
                        <FormItem>
                          <FormLabel>RF {t('supplierPayments.payment.reference')}</FormLabel>
                          <FormControl>
                            <Input placeholder={placeholder} {...field} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('supplierPayments.payment.rfHelperText')}
                          </p>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                </div>

                {/* Company field */}
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('supplierPayments.payment.company')}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            placeholder={t('supplierPayments.payment.companyPlaceholder')}
                            {...field} 
                          />
                          <Building2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notes field */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('supplierPayments.payment.notes')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('supplierPayments.payment.notesPlaceholder')}
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={savePaymentMutation.isPending}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={savePaymentMutation.isPending}>
                    {savePaymentMutation.isPending && (
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {payment ? t('common.update') : t('common.create')}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};