import { useState, useEffect } from 'react';
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
const orderFormSchema = z.object({
  productId: z.number({
    required_error: 'Product is required',
    invalid_type_error: 'Product must be a number'
  }),
  recipeId: z.number({
    required_error: 'Recipe is required',
    invalid_type_error: 'Recipe must be a number'
  }),
  batchId: z.number({
    required_error: 'Batch is required',
    invalid_type_error: 'Batch must be a number'
  }),
  plannedQuantity: z.coerce.number().min(1, { message: 'Quantity must be greater than 0' }),
  status: z.enum(['planned', 'material_check', 'in_progress', 'completed', 'partially_completed', 'cancelled']),
  notes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

interface ProductionOrderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderToEdit?: any; // Optional order to edit
}

export default function ProductionOrderForm({ open, onOpenChange, orderToEdit }: ProductionOrderFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEditMode = !!orderToEdit;

  // Fetch products, recipes, and batches
  const { data: products = [] } = useQuery({
    queryKey: ['/api/products'],
    enabled: open,
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ['/api/production/recipes'],
    enabled: open,
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['/api/production/batches'],
    enabled: open,
  });

  // Filter batches by status
  const availableBatches = batches.filter((batch: any) => 
    ['planned', 'in_progress'].includes(batch.status)
  );

  // Initialize form with default values or values from order to edit
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      productId: orderToEdit?.productId || 0,
      recipeId: orderToEdit?.recipeId || 0,
      batchId: orderToEdit?.batchId || 0,
      plannedQuantity: orderToEdit?.plannedQuantity || 0,
      status: orderToEdit?.status || 'planned',
      notes: orderToEdit?.notes || '',
    }
  });

  // Watch for product changes to recommend appropriate recipes
  const watchProductId = form.watch('productId');
  
  useEffect(() => {
    if (watchProductId && !isEditMode) {
      // Find matching recipes for this product
      const matchingRecipes = recipes.filter((recipe: any) => recipe.productId === watchProductId);
      
      if (matchingRecipes.length === 1) {
        // Auto-select recipe if there's only one match
        form.setValue('recipeId', matchingRecipes[0].id);
      }
    }
  }, [watchProductId, recipes, form, isEditMode]);

  const handleSubmit = async (values: OrderFormValues) => {
    try {
      if (isEditMode) {
        // Update existing order
        await apiRequest(`/api/production/orders/${orderToEdit.id}`, {
          method: 'PATCH',
          data: values
        });
        
        toast({
          title: t('production.orderUpdated'),
          description: t('production.orderUpdatedDesc'),
        });
      } else {
        // Create new order
        await apiRequest('/api/production/orders', {
          method: 'POST',
          data: values
        });
        
        toast({
          title: t('production.orderCreated'),
          description: t('production.orderCreatedDesc'),
        });
      }
      
      // Invalidate orders query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/production/orders'] });
      
      // Close the dialog
      onOpenChange(false);
      
      // Reset the form
      form.reset();
    } catch (error) {
      console.error('Error saving production order:', error);
      toast({
        title: t('errorOccurred'),
        description: t('production.errorSavingOrder'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('production.editOrder') : t('production.addOrder')}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('production.product')}</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    defaultValue={field.value?.toString() || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('production.selectProduct')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((product: any) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="recipeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('production.recipe')}</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    defaultValue={field.value?.toString() || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('production.selectRecipe')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {recipes
                        .filter((recipe: any) => !watchProductId || recipe.productId === watchProductId)
                        .map((recipe: any) => (
                          <SelectItem key={recipe.id} value={recipe.id.toString()}>
                            {recipe.name}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="batchId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('production.batch')}</FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))} 
                    defaultValue={field.value?.toString() || ''}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('production.selectBatch')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableBatches.map((batch: any) => (
                        <SelectItem key={batch.id} value={batch.id.toString()}>
                          {batch.batchNumber} ({batch.quantity} {t(`production.units.${batch.unit}`)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="plannedQuantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('production.plannedQuantity')}</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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
                        <SelectItem value="planned">{t('production.orderStatus.planned')}</SelectItem>
                        <SelectItem value="material_check">{t('production.orderStatus.material_check')}</SelectItem>
                        <SelectItem value="in_progress">{t('production.orderStatus.in_progress')}</SelectItem>
                        <SelectItem value="completed">{t('production.orderStatus.completed')}</SelectItem>
                        <SelectItem value="partially_completed">{t('production.orderStatus.partially_completed')}</SelectItem>
                        <SelectItem value="cancelled">{t('production.orderStatus.cancelled')}</SelectItem>
                      </SelectContent>
                    </Select>
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