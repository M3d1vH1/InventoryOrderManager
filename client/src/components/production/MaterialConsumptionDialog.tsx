import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { InfoIcon, AlertTriangle, PackageCheck, Package, Loader2 } from 'lucide-react';

const consumptionSchema = z.object({
  materialId: z.number({
    required_error: 'Material is required',
  }),
  quantity: z.coerce.number()
    .positive({ message: 'Quantity must be positive' }),
  notes: z.string().optional(),
});

type ConsumptionFormValues = z.infer<typeof consumptionSchema>;

interface MaterialConsumptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productionOrderId: number | null;
  recipeId: number | null;
}

export default function MaterialConsumptionDialog({
  open,
  onOpenChange,
  productionOrderId,
  recipeId,
}: MaterialConsumptionDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [inventoryWarning, setInventoryWarning] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Get the recipe materials
  const { data: recipeMaterials = [], isLoading: loadingRecipeMaterials } = useQuery({
    queryKey: ['/api/production/recipes', recipeId, 'materials'],
    enabled: !!recipeId && open,
  });

  // Get the raw materials
  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ['/api/production/raw-materials'],
    enabled: open,
  });

  // Get already consumed materials for this order
  const { data: consumedMaterials = [], isLoading: loadingConsumed } = useQuery({
    queryKey: ['/api/production/orders', productionOrderId, 'consumed-materials'],
    enabled: !!productionOrderId && open,
  });

  const form = useForm<ConsumptionFormValues>({
    resolver: zodResolver(consumptionSchema),
    defaultValues: {
      materialId: 0,
      quantity: 0,
      notes: '',
    },
  });

  // Watch for material change to validate inventory
  const watchMaterialId = form.watch('materialId');
  const watchQuantity = form.watch('quantity');

  useEffect(() => {
    if (watchMaterialId && watchQuantity > 0) {
      const selectedMaterial = materials.find((m: any) => m.id === watchMaterialId);
      if (selectedMaterial && selectedMaterial.currentStock < watchQuantity) {
        setInventoryWarning(true);
      } else {
        setInventoryWarning(false);
      }
    } else {
      setInventoryWarning(false);
    }
  }, [watchMaterialId, watchQuantity, materials]);

  // Find materials that are part of the recipe
  const getRecipeMaterialIds = () => {
    return recipeMaterials.map((rm: any) => rm.materialId);
  };

  const getRecipeMaterialQuantity = (materialId: number) => {
    const material = recipeMaterials.find((rm: any) => rm.materialId === materialId);
    return material ? material.quantity : null;
  };

  // Filter available materials
  const filteredMaterials = materials.filter((material: any) => {
    // If there's a recipe, only show materials that are part of it
    if (recipeMaterials.length > 0) {
      return getRecipeMaterialIds().includes(material.id);
    }
    return true;
  });

  const getStockStatusBadge = (currentStock: number, minStockLevel: number) => {
    if (currentStock <= 0) {
      return (
        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
          {t('inventory.outOfStock')}
        </Badge>
      );
    } else if (currentStock < minStockLevel) {
      return (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
          {t('inventory.lowStock')}
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
          {t('inventory.inStock')}
        </Badge>
      );
    }
  };

  const handleSubmit = async (values: ConsumptionFormValues) => {
    if (!productionOrderId) return;
    
    setSubmitting(true);
    try {
      await apiRequest('/api/production/material-consumption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          productionOrderId,
          consumedAt: new Date().toISOString(),
        }),
      });

      // Also create a log entry for material consumption
      await apiRequest('/api/production/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productionOrderId: productionOrderId,
          eventType: 'material_added',
          description: `Material ${values.materialId} consumed: ${values.quantity} units`,
        }),
      });

      toast({
        title: t('production.materialAdded'),
        description: t('production.materialAddedDesc'),
      });

      // Reset form
      form.reset({
        materialId: 0,
        quantity: 0,
        notes: '',
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/production/orders', productionOrderId, 'consumed-materials'] });
      queryClient.invalidateQueries({ queryKey: ['/api/production/raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['/api/production/orders'] });
    } catch (error: any) {
      console.error('Error recording material consumption:', error);
      toast({
        title: t('errorOccurred'),
        description: error.message || t('production.errorRecordingConsumption'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = loadingRecipeMaterials || loadingMaterials || loadingConsumed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>{t('production.recordMaterialConsumption')}</DialogTitle>
          <DialogDescription>
            {t('production.recordMaterialConsumptionDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6">
          {/* Already consumed materials */}
          <div>
            <h4 className="text-sm font-medium mb-2">{t('production.consumedMaterials')}</h4>
            {consumedMaterials.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('production.material')}</TableHead>
                    <TableHead>{t('production.quantity')}</TableHead>
                    <TableHead>{t('production.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumedMaterials.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.materialName}
                        {item.unit && <span className="text-xs text-muted-foreground ml-1">({item.unit})</span>}
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        {item.consumedAt ? format(new Date(item.consumedAt), 'PPp') : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-muted-foreground py-2">
                {t('production.noMaterialsConsumedYet')}
              </div>
            )}
          </div>

          {/* Add material consumption form */}
          <div>
            <h4 className="text-sm font-medium mb-2">{t('production.addMaterialConsumption')}</h4>
            
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="materialId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('production.material')}</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          defaultValue={field.value?.toString() || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('production.selectMaterial')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredMaterials.map((material: any) => (
                              <SelectItem key={material.id} value={material.id.toString()}>
                                <div className="flex items-center justify-between w-full">
                                  <span>{material.name}</span>
                                  <span className="ml-2 text-xs">
                                    {getStockStatusBadge(material.currentStock, material.minStockLevel)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {field.value > 0 && (
                          <div className="text-xs mt-1">
                            {recipeMaterials.length > 0 && getRecipeMaterialQuantity(field.value) && (
                              <div className="flex items-center text-blue-600">
                                <InfoIcon className="h-3 w-3 mr-1" />
                                {t('production.recipeRequires')} {getRecipeMaterialQuantity(field.value)}
                              </div>
                            )}
                            
                            {field.value > 0 && (
                              <div className="flex items-center text-slate-600 mt-1">
                                <PackageCheck className="h-3 w-3 mr-1" />
                                {t('common.currentStock')}: {materials.find((m: any) => m.id === field.value)?.currentStock || 0}
                              </div>
                            )}
                          </div>
                        )}

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('production.quantity')}</FormLabel>
                        <FormControl>
                          <Input type="number" step="any" min="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {inventoryWarning && (
                    <Alert variant="warning">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{t('production.inventoryWarning')}</AlertTitle>
                      <AlertDescription>
                        {t('production.inventoryWarningDesc')}
                      </AlertDescription>
                    </Alert>
                  )}

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('notes')}</FormLabel>
                        <FormControl>
                          <Textarea rows={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      {t('cancel')}
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('production.recordConsumption')}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}