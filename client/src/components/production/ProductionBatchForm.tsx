import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Define the form schema using zod
const batchFormSchema = z.object({
  batchNumber: z.string().min(2, { message: 'Batch number is required' }),
  quantity: z.coerce.number().min(1, { message: 'Quantity must be greater than 0' }),
  unit: z.enum(['liter', 'kg', 'piece']),
  status: z.enum(['planned', 'in_progress', 'completed', 'quality_check', 'approved', 'rejected']),
  startDate: z.string().min(1, { message: 'Start date is required' }),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});

type BatchFormValues = z.infer<typeof batchFormSchema>;

interface ProductionBatchFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batchToEdit?: any; // Optional batch to edit
}

export default function ProductionBatchForm({ open, onOpenChange, batchToEdit }: ProductionBatchFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditMode = !!batchToEdit;

  // Format dates for form initialization
  const formatDateForInput = (date: Date | string | null | undefined) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  // Initialize form with default values or values from batch to edit
  const form = useForm<BatchFormValues>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: {
      batchNumber: batchToEdit?.batchNumber || '',
      quantity: batchToEdit?.quantity || 0,
      unit: batchToEdit?.unit || 'liter',
      status: batchToEdit?.status || 'planned',
      startDate: formatDateForInput(batchToEdit?.startDate) || formatDateForInput(new Date()),
      endDate: formatDateForInput(batchToEdit?.endDate) || '',
      notes: batchToEdit?.notes || '',
    }
  });

  const handleSubmit = async (values: BatchFormValues) => {
    try {
      if (isEditMode) {
        // Update existing batch
        await apiRequest(`/api/production/batches/${batchToEdit.id}`, {
          method: 'PATCH',
          data: values
        });
        
        toast({
          title: t('production.batchUpdated'),
          description: t('production.batchUpdatedDesc'),
        });
      } else {
        // Create new batch
        await apiRequest('/api/production/batches', {
          method: 'POST',
          data: values
        });
        
        toast({
          title: t('production.batchCreated'),
          description: t('production.batchCreatedDesc'),
        });
      }
      
      // Invalidate batches query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/production/batches'] });
      
      // Close the dialog
      onOpenChange(false);
      
      // Reset the form
      form.reset();
    } catch (error) {
      console.error('Error saving batch:', error);
      toast({
        title: t('errorOccurred'),
        description: t('production.errorSavingBatch'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('production.editBatch') : t('production.addBatch')}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="batchNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('production.batchNumber')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('production.quantity')}</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('production.unit')}</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('production.selectUnit')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="liter">{t('production.units.liter')}</SelectItem>
                        <SelectItem value="kg">{t('production.units.kg')}</SelectItem>
                        <SelectItem value="piece">{t('production.units.piece')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('production.status')}</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('production.selectStatus')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="planned">{t('production.batchStatus.planned')}</SelectItem>
                      <SelectItem value="in_progress">{t('production.batchStatus.in_progress')}</SelectItem>
                      <SelectItem value="completed">{t('production.batchStatus.completed')}</SelectItem>
                      <SelectItem value="quality_check">{t('production.batchStatus.quality_check')}</SelectItem>
                      <SelectItem value="approved">{t('production.batchStatus.approved')}</SelectItem>
                      <SelectItem value="rejected">{t('production.batchStatus.rejected')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('production.startDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('production.endDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('notes')}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                {t('cancel')}
              </Button>
              <Button type="submit">
                {isEditMode ? t('save') : t('create')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}