import { useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Loader } from 'lucide-react';
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Define validation schema for invoice form
const invoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, { message: 'Invoice number is required' }),
  supplierId: z.string().min(1, { message: 'Supplier is required' }),
  invoiceDate: z.date({
    required_error: "Invoice date is required",
  }),
  dueDate: z.date({
    required_error: "Due date is required",
  }),
  amount: z.string().min(1, { message: 'Amount is required' })
    .refine(val => !isNaN(parseFloat(val)), {
      message: 'Amount must be a valid number',
    }),
  paidAmount: z.string()
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: 'Paid amount must be a valid number',
    }),
  status: z.enum(['pending', 'paid', 'partially_paid', 'overdue', 'cancelled']),
  isRecurring: z.boolean().default(false),
  recurringCycle: z.string().optional(),
  notes: z.string().optional(),
  attachmentPath: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface InvoiceFormProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: any;
  suppliers: any[];
}

export const InvoiceForm = ({ isOpen, onClose, invoice, suppliers }: InvoiceFormProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize form with invoice data or defaults
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceNumber: '',
      supplierId: '',
      invoiceDate: new Date(),
      dueDate: new Date(),
      amount: '0',
      paidAmount: '0',
      status: 'pending',
      isRecurring: false,
      recurringCycle: '',
      notes: '',
      attachmentPath: '',
    },
  });

  // Reset form when invoice changes
  useEffect(() => {
    if (invoice) {
      form.reset({
        invoiceNumber: invoice.invoiceNumber || '',
        supplierId: invoice.supplierId?.toString() || '',
        invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date(),
        dueDate: invoice.dueDate ? new Date(invoice.dueDate) : new Date(),
        amount: invoice.amount?.toString() || '0',
        paidAmount: invoice.paidAmount?.toString() || '0',
        status: invoice.status || 'pending',
        isRecurring: invoice.isRecurring || false,
        recurringCycle: invoice.recurringCycle?.toString() || '',
        notes: invoice.notes || '',
        attachmentPath: invoice.attachmentPath || '',
      });
    } else {
      form.reset({
        invoiceNumber: '',
        supplierId: '',
        invoiceDate: new Date(),
        dueDate: new Date(),
        amount: '0',
        paidAmount: '0',
        status: 'pending',
        isRecurring: false,
        recurringCycle: '',
        notes: '',
        attachmentPath: '',
      });
    }
  }, [invoice, form]);

  // Calculate status based on amount and paid amount
  const calculateStatus = (amount: number, paidAmount: number) => {
    if (paidAmount >= amount) {
      return 'paid';
    } else if (paidAmount > 0 && paidAmount < amount) {
      return 'partially_paid';
    }
    return form.getValues('status');
  };

  // Save invoice mutation
  const saveInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      if (invoice) {
        // Update existing invoice
        return apiRequest({
          url: `/api/supplier-payments/invoices/${invoice.id}`,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        // Create new invoice
        return apiRequest({
          url: '/api/supplier-payments/invoices',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
    },
    onSuccess: () => {
      toast({
        title: invoice ? t('supplierPayments.invoice.updated') : t('supplierPayments.invoice.created'),
        description: invoice ? t('supplierPayments.invoice.updateSuccess') : t('supplierPayments.invoice.createSuccess'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/summary'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('supplierPayments.invoice.saveError'),
        variant: 'destructive',
      });
    },
  });

  // Watch form values for dynamic updates
  const isRecurring = form.watch('isRecurring');
  const watchedAmount = form.watch('amount');
  const watchedPaidAmount = form.watch('paidAmount');
  
  // Update status when amount or paidAmount changes
  useEffect(() => {
    const amount = parseFloat(watchedAmount || '0');
    const paidAmount = parseFloat(watchedPaidAmount || '0');
    if (!isNaN(amount) && !isNaN(paidAmount)) {
      const calculatedStatus = calculateStatus(amount, paidAmount);
      if (calculatedStatus !== form.getValues('status')) {
        form.setValue('status', calculatedStatus as any);
      }
    }
  }, [watchedAmount, watchedPaidAmount, form]);

  // Form submission handler
  const onSubmit = (data: InvoiceFormValues) => {
    // Convert string values to numbers
    const formattedData = {
      ...data,
      supplierId: parseInt(data.supplierId),
      amount: parseFloat(data.amount),
      paidAmount: parseFloat(data.paidAmount || '0'),
      recurringCycle: data.isRecurring && data.recurringCycle ? parseInt(data.recurringCycle) : undefined,
    };

    saveInvoiceMutation.mutate(formattedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {invoice ? t('supplierPayments.invoice.edit') : t('supplierPayments.invoice.create')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Invoice Number field - required */}
              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.invoice.invoiceNumber')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('supplierPayments.invoice.invoiceNumberPlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Supplier field - required */}
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.invoice.supplier')}</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('supplierPayments.invoice.selectSupplier')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((supplier) => (
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

              {/* Invoice Date field - required */}
              <FormField
                control={form.control}
                name="invoiceDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('supplierPayments.invoice.invoiceDate')}</FormLabel>
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
                              <span>{t('supplierPayments.invoice.selectDate')}</span>
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

              {/* Due Date field - required */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('supplierPayments.invoice.dueDate')}</FormLabel>
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
                              <span>{t('supplierPayments.invoice.selectDate')}</span>
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
                            date < new Date("1900-01-01")
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
                    <FormLabel>{t('supplierPayments.invoice.amount')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        placeholder={t('supplierPayments.invoice.amountPlaceholder')} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Paid Amount field */}
              <FormField
                control={form.control}
                name="paidAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.invoice.paidAmount')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0" 
                        step="0.01"
                        placeholder={t('supplierPayments.invoice.paidAmountPlaceholder')} 
                        {...field} 
                        value={field.value || '0'}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status field */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('invoices.status')}</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('invoices.selectStatus')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">{t('invoices.statusPending')}</SelectItem>
                        <SelectItem value="paid">{t('invoices.statusPaid')}</SelectItem>
                        <SelectItem value="partially_paid">{t('invoices.statusPartiallyPaid')}</SelectItem>
                        <SelectItem value="overdue">{t('invoices.statusOverdue')}</SelectItem>
                        <SelectItem value="cancelled">{t('invoices.statusCancelled')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Recurring Invoice */}
              <FormField
                control={form.control}
                name="isRecurring"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between space-x-2 rounded-md border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>{t('invoices.isRecurring')}</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Recurring Cycle (only shown if isRecurring is true) */}
              {isRecurring && (
                <FormField
                  control={form.control}
                  name="recurringCycle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('invoices.recurringCycle')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder={t('invoices.recurringCyclePlaceholder')} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Notes field */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('invoices.notes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('invoices.notesPlaceholder')}
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
                disabled={saveInvoiceMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saveInvoiceMutation.isPending}>
                {saveInvoiceMutation.isPending && (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                )}
                {invoice ? t('common.update') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};