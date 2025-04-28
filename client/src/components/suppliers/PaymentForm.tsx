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
import { Loader } from 'lucide-react';
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Define validation schema for payment form
const paymentFormSchema = z.object({
  invoiceId: z.string().min(1, { message: 'Invoice is required' }),
  paymentDate: z.date({
    required_error: "Payment date is required",
  }),
  amount: z.string().min(1, { message: 'Amount is required' })
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Amount must be a positive number',
    }),
  paymentMethod: z.string().min(1, { message: 'Payment method is required' }),
  reference: z.string().optional(),
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
      invoiceId: '',
      paymentDate: new Date(),
      amount: '',
      paymentMethod: '',
      reference: '',
      notes: '',
    },
  });

  // Get unpaid amount for an invoice
  const getUnpaidAmount = (invoiceId: number) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return 0;
    
    // Calculate unpaid amount
    const totalAmount = invoice.amount || 0;
    const paidAmount = invoice.paidAmount || 0;
    return Math.max(0, totalAmount - paidAmount);
  };

  // Get formatted invoice options with supplier name and unpaid amount
  const getInvoiceOptions = () => {
    return invoices
      .filter(invoice => 
        invoice.status === 'pending' || 
        invoice.status === 'partially_paid' || 
        invoice.status === 'overdue' ||
        (payment && payment.invoiceId === invoice.id)
      )
      .map(invoice => {
        const supplier = suppliers.find(s => s.id === invoice.supplierId);
        const supplierName = supplier ? supplier.name : 'Unknown';
        const unpaidAmount = getUnpaidAmount(invoice.id);
        
        // Format currency for display
        const formattedUnpaid = new Intl.NumberFormat('el-GR', {
          style: 'currency',
          currency: 'EUR',
        }).format(unpaidAmount);
        
        return {
          id: invoice.id,
          label: `${invoice.invoiceNumber} - ${supplierName} (${formattedUnpaid})`,
          unpaidAmount
        };
      });
  };

  // Watch for invoice changes to set default amount
  const watchedInvoiceId = form.watch('invoiceId');
  
  useEffect(() => {
    if (watchedInvoiceId && !payment) {
      const invoiceId = parseInt(watchedInvoiceId);
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        setSelectedInvoice(invoice);
        
        // Set default amount to unpaid amount
        const unpaidAmount = getUnpaidAmount(invoiceId);
        form.setValue('amount', unpaidAmount.toString());
      }
    }
  }, [watchedInvoiceId, invoices, form, payment]);

  // Reset form when payment changes
  useEffect(() => {
    if (payment) {
      form.reset({
        invoiceId: payment.invoiceId?.toString() || '',
        paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
        amount: payment.amount?.toString() || '',
        paymentMethod: payment.paymentMethod || '',
        reference: payment.reference || '',
        notes: payment.notes || '',
      });
      
      const invoice = invoices.find(inv => inv.id === payment.invoiceId);
      if (invoice) {
        setSelectedInvoice(invoice);
      }
    } else {
      form.reset({
        invoiceId: '',
        paymentDate: new Date(),
        amount: '',
        paymentMethod: '',
        reference: '',
        notes: '',
      });
      setSelectedInvoice(null);
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
    // Convert string values to numbers
    const formattedData = {
      ...data,
      invoiceId: parseInt(data.invoiceId),
      amount: parseFloat(data.amount),
    };

    savePaymentMutation.mutate(formattedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {payment ? t('supplierPayments.payment.edit') : t('supplierPayments.payment.create')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <SelectValue placeholder={t('payments.selectInvoice')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {getInvoiceOptions().map((option) => (
                        <SelectItem key={option.id} value={option.id.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                            <span>{t('payments.selectDate')}</span>
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
                      placeholder={t('payments.amountPlaceholder')} 
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
                        <SelectValue placeholder={t('payments.selectPaymentMethod')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reference field */}
            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('payments.reference')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('payments.referencePlaceholder')} {...field} />
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
                  <FormLabel>{t('payments.notes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('payments.notesPlaceholder')}
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
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};