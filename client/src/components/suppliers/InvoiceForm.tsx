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
  DialogDescription,
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

// Note: We don't need a custom FormMessage component anymore since we're using the Zod errorMap
// to handle translation of error messages. The errorMap will translate any message
// that includes 'supplierPayments.' prefix.

// Define validation schema for invoice form - using translation keys for error messages
const invoiceFormSchema = z.object({
  invoiceNumber: z.string().min(1, { message: 'supplierPayments.invoice.errors.invoiceNumberRequired' }),
  supplierId: z.string().min(1, { message: 'supplierPayments.invoice.errors.supplierRequired' }),
  invoiceDate: z.date({
    required_error: "supplierPayments.invoice.errors.invoiceDateRequired",
  }),
  dueDate: z.date({
    required_error: "supplierPayments.invoice.errors.dueDateRequired",
  }),
  amount: z.string().min(1, { message: 'supplierPayments.invoice.errors.amountRequired' })
    .refine(val => !isNaN(parseFloat(val)), {
      message: 'supplierPayments.invoice.errors.invalidAmount',
    }),
  paidAmount: z.string()
    .refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, {
      message: 'supplierPayments.invoice.errors.invalidPaidAmount',
    }),
  company: z.string().optional(), // Company name as free text field
  reference: z.string().optional(), // General reference field
  rfNumber: z.string().optional(), // Specific RF number field for payments
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
  
  // Company is now a simple text field, no need for dropdown options
  
  // Custom error message handler for Zod validation
  const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
    // Check if the error message is a translation key and translate it
    if (issue.message && issue.message.includes('supplierPayments.')) {
      return { message: t(issue.message) };
    }
    // Use the default error map for other errors
    return { message: ctx.defaultError };
  };

  // Initialize form with invoice data or defaults
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema, { errorMap: customErrorMap }),
    defaultValues: {
      invoiceNumber: '',
      supplierId: '',
      invoiceDate: new Date(),
      dueDate: new Date(),
      amount: '0',
      paidAmount: '', // Start with empty paid amount to allow user to specify or leave blank
      company: '', // Company name as free text field
      reference: '', // General reference field
      rfNumber: '', // Specific RF number field for payments
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
      console.log("Invoice data received for edit:", invoice);
      
      // Log property access attempts for debugging
      const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber || '';
      const supplierId = invoice.supplier_id || invoice.supplierId || '';
      const invoiceDate = invoice.invoice_date || invoice.invoiceDate || new Date();
      const dueDate = invoice.due_date || invoice.dueDate || new Date();
      const amount = invoice.amount || '0';
      const paidAmount = invoice.paid_amount || invoice.paidAmount || '';
      const reference = invoice.reference || '';
      const rfNumber = invoice.rf_number || invoice.rfNumber || '';
      const company = invoice.company || '';
      
      console.log("Extracted invoice properties:", {
        invoiceNumber, supplierId, invoiceDate, dueDate, amount, paidAmount, reference, rfNumber, company
      });
      
      form.reset({
        invoiceNumber: invoiceNumber,
        supplierId: supplierId.toString(),
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : new Date(),
        amount: amount?.toString() || '0',
        paidAmount: paidAmount ? paidAmount.toString() : '',
        company: company || '', // Company name as free text
        reference: reference, // General reference field
        rfNumber: rfNumber, // Specific RF number field
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
        paidAmount: '', // Empty string to allow clearing the paid amount
        company: '', // Company name as free text
        reference: '', // General reference field
        rfNumber: '', // Specific RF number field
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
      // Create request options
      const requestOptions = {
        method: invoice ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      };

      // Construct the URL
      const endpoint = invoice 
        ? `/api/supplier-payments/invoices/${invoice.id}` 
        : '/api/supplier-payments/invoices';

      // Make the request using fetch for better error handling
      const response = await fetch(endpoint, requestOptions);
      
      if (!response.ok) {
        // Try to get detailed error message from response
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch (e) {
          // If we can't parse the error, use status text
          throw new Error(`${response.status}: ${response.statusText}`);
        }
        
        // Throw error with details from the server if available
        if (errorDetails && errorDetails.error) {
          throw new Error(
            typeof errorDetails.error === 'string' 
              ? errorDetails.error 
              : JSON.stringify(errorDetails.error)
          );
        }
        
        throw new Error(`${response.status}: ${response.statusText}`);
      }
      
      return response.json();
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
      console.error("Invoice save error:", error);
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
  
  // Company field is now a simple text input, no need for dropdown options or defaults

  // Update status when amount or paidAmount changes
  useEffect(() => {
    const amount = parseFloat(watchedAmount || '0');
    
    // Only calculate status if paidAmount is not empty
    if (watchedPaidAmount !== '' && watchedPaidAmount !== undefined && watchedPaidAmount !== null) {
      const paidAmount = parseFloat(watchedPaidAmount || '0');
      if (!isNaN(amount) && !isNaN(paidAmount)) {
        const calculatedStatus = calculateStatus(amount, paidAmount);
        if (calculatedStatus !== form.getValues('status')) {
          form.setValue('status', calculatedStatus as any);
        }
      }
    } else {
      // Reset status to pending if paidAmount is empty
      if (form.getValues('status') === 'paid' || form.getValues('status') === 'partially_paid') {
        form.setValue('status', 'pending');
      }
    }
  }, [watchedAmount, watchedPaidAmount, form]);

  // Form submission handler
  const onSubmit = (data: InvoiceFormValues) => {
    // Send the Date objects directly - our updated schema can handle them
    // We also keep the full Date objects for more accurate date handling
    
    // Handle paidAmount to set to undefined if it's blank or null, also handle string to number conversion
    let paidAmount = undefined;
    if (data.paidAmount !== null && data.paidAmount !== '' && data.paidAmount !== undefined) {
      paidAmount = parseFloat(data.paidAmount.toString());
    }
    
    // Convert string values to numbers and map the fields to correct schema names
    // Map invoiceDate to both invoiceDate and issueDate fields to avoid confusion
    // between client and server naming
    const formattedData = {
      invoiceNumber: data.invoiceNumber,
      supplierId: data.supplierId, // Now schema handles string-to-number coercion
      issueDate: data.invoiceDate,  // Send full Date object, schema will handle it
      invoiceDate: data.invoiceDate, // Also send as invoiceDate
      dueDate: data.dueDate,        // Send full Date object, schema will handle it
      amount: data.amount,          // Schema will handle number coercion
      paidAmount: paidAmount,       // Allow undefined to be passed through
      company: data.company || '', // Company name as free text
      reference: data.reference || '', // General reference field
      rfNumber: data.rfNumber || '', // Specific RF number field for payments
      status: data.status,
      notes: data.notes || '',
      attachmentPath: data.attachmentPath || '',
      isRecurring: data.isRecurring,
      recurringCycle: data.isRecurring && data.recurringCycle ? data.recurringCycle : undefined,
    };

    console.log("Submitting invoice data:", formattedData);
    saveInvoiceMutation.mutate(formattedData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {invoice ? t('supplierPayments.invoice.edit') : t('supplierPayments.invoice.create')}
          </DialogTitle>
          <DialogDescription>
            {invoice 
              ? t('supplierPayments.invoice.editDescription', 'Update invoice information') 
              : t('supplierPayments.invoice.createDescription', 'Enter new invoice details')}
          </DialogDescription>
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
                        // Remove the default value display to allow clearing the field
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* General Reference field */}
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.invoice.reference', 'Reference')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('supplierPayments.invoice.referencePlaceholder', 'Enter general reference')} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* RF Number field - specific for payments */}
              <FormField
                control={form.control}
                name="rfNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.invoice.rfNumber', 'RF Number')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('supplierPayments.invoice.rfNumberPlaceholder', 'Enter RF payment reference')} 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Company field - simple text input */}
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.invoice.company', 'Company')}</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder={t('supplierPayments.invoice.companyPlaceholder', 'Enter company name')} 
                        {...field} 
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
                    <FormLabel>{t('supplierPayments.invoice.status')}</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('supplierPayments.invoice.selectStatus')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">{t('supplierPayments.invoice.statusPending')}</SelectItem>
                        <SelectItem value="paid">{t('supplierPayments.invoice.statusPaid')}</SelectItem>
                        <SelectItem value="partially_paid">{t('supplierPayments.invoice.statusPartiallyPaid')}</SelectItem>
                        <SelectItem value="overdue">{t('supplierPayments.invoice.statusOverdue')}</SelectItem>
                        <SelectItem value="cancelled">{t('supplierPayments.invoice.statusCancelled')}</SelectItem>
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
                      <FormLabel>{t('supplierPayments.invoice.isRecurring')}</FormLabel>
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
                      <FormLabel>{t('supplierPayments.invoice.recurringCycle')}</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder={t('supplierPayments.invoice.recurringCyclePlaceholder')} 
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
                  <FormLabel>{t('supplierPayments.invoice.notes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('supplierPayments.invoice.notesPlaceholder')}
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