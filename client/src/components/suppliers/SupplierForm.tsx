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
import { Switch } from '@/components/ui/switch';
import { Loader } from 'lucide-react';

// Define validation schema for supplier form
const supplierFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  contactPerson: z.string().optional(),
  vatNumber: z.string().optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  paymentTerms: z.string().optional(),
  bankAccount: z.string().optional(),
  isActive: z.boolean().default(true),
});

type SupplierFormValues = z.infer<typeof supplierFormSchema>;

interface SupplierFormProps {
  isOpen: boolean;
  onClose: () => void;
  supplier?: any;
}

export const SupplierForm = ({ isOpen, onClose, supplier }: SupplierFormProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize form with supplier data or defaults
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: '',
      contactPerson: '',
      vatNumber: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
      notes: '',
      paymentTerms: '',
      bankAccount: '',
      isActive: true,
    },
  });

  // Reset form when supplier changes
  useEffect(() => {
    if (supplier) {
      form.reset({
        name: supplier.name || '',
        contactPerson: supplier.contactPerson || '',
        vatNumber: supplier.vatNumber || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        city: supplier.city || '',
        state: supplier.state || '',
        postalCode: supplier.postalCode || '',
        country: supplier.country || '',
        notes: supplier.notes || '',
        paymentTerms: supplier.paymentTerms || '',
        bankAccount: supplier.bankAccount || '',
        isActive: supplier.isActive ?? true,
      });
    } else {
      form.reset({
        name: '',
        contactPerson: '',
        vatNumber: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        notes: '',
        paymentTerms: '',
        bankAccount: '',
        isActive: true,
      });
    }
  }, [supplier, form]);

  // Save supplier mutation
  const saveSupplierMutation = useMutation({
    mutationFn: async (data: SupplierFormValues) => {
      if (supplier) {
        // Update existing supplier
        return apiRequest(`/api/supplier-payments/suppliers/${supplier.id}`, { 
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        // Create new supplier
        return apiRequest('/api/supplier-payments/suppliers', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
    },
    onSuccess: () => {
      toast({
        title: supplier ? t('supplierPayments.supplier.updated') : t('supplierPayments.supplier.created'),
        description: supplier ? t('supplierPayments.supplier.updateSuccess') : t('supplierPayments.supplier.createSuccess'),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/suppliers'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('supplierPayments.supplier.saveError'),
        variant: 'destructive',
      });
    },
  });

  // Form submission handler
  const onSubmit = (data: SupplierFormValues) => {
    saveSupplierMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {supplier ? t('supplierPayments.supplier.edit') : t('supplierPayments.supplier.create')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name field - required */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('supplierPayments.supplier.name')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contact Person field */}
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.contactPerson')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('supplierPayments.supplier.contactPerson')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* VAT Number field */}
              <FormField
                control={form.control}
                name="vatNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.vatNumber')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('supplierPayments.supplier.vatNumber')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email field */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.email')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t('supplierPayments.supplier.email')}
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Phone field */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.phone')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('supplierPayments.supplier.phone')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Terms field */}
              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.paymentTerms')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('supplierPayments.supplier.paymentTerms')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Bank Account field */}
              <FormField
                control={form.control}
                name="bankAccount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.bankAccount')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('supplierPayments.supplier.bankAccount')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address field */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.address')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('supplierPayments.supplier.address')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* City field */}
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.city')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('supplierPayments.supplier.city')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* State/Region field */}
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.state')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('supplierPayments.supplier.state')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Postal Code field */}
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.postalCode')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('supplierPayments.supplier.postalCode')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Country field */}
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('supplierPayments.supplier.country')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('supplierPayments.supplier.country')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Active Status */}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between space-x-2 rounded-md border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>{t('supplierPayments.supplier.isActive')}</FormLabel>
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
            </div>

            {/* Notes field */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('supplierPayments.supplier.notes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('supplierPayments.supplier.notes')}
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
                disabled={saveSupplierMutation.isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saveSupplierMutation.isPending}>
                {saveSupplierMutation.isPending && (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                )}
                {supplier ? t('supplierPayments.supplier.update') : t('supplierPayments.supplier.create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};