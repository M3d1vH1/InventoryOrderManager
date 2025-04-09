import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

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
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, ClipboardCheck, CheckCircle, XCircle } from 'lucide-react';

const qualityCheckSchema = z.object({
  checkType: z.string().min(1, { message: 'Check type is required' }),
  passed: z.boolean(),
  notes: z.string().optional(),
});

type QualityCheckFormValues = z.infer<typeof qualityCheckSchema>;

interface ProductionQualityCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productionOrderId: number | null;
}

export default function ProductionQualityCheckDialog({
  open,
  onOpenChange,
  productionOrderId,
}: ProductionQualityCheckDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Get order details
  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ['/api/production/orders', productionOrderId],
    enabled: !!productionOrderId && open,
  });

  // Get previous quality checks
  const { data: qualityChecks = [], isLoading: checksLoading } = useQuery({
    queryKey: ['/api/production/orders', productionOrderId, 'quality-checks'],
    enabled: !!productionOrderId && open,
  });

  // Form setup
  const form = useForm<QualityCheckFormValues>({
    resolver: zodResolver(qualityCheckSchema),
    defaultValues: {
      checkType: '',
      passed: true,
      notes: '',
    },
  });

  // Check types
  const qualityCheckTypes = [
    'appearance',
    'odor',
    'taste',
    'color',
    'texture',
    'ph_level',
    'viscosity',
    'weight',
    'packaging',
    'labeling',
    'other',
  ];

  // Mutation to save quality check
  const saveQualityCheckMutation = useMutation({
    mutationFn: async (values: QualityCheckFormValues) => {
      return await apiRequest('/api/production/quality-checks', {
        method: 'POST',
        data: {
          ...values,
          productionOrderId,
        },
      });
    },
    onSuccess: (data) => {
      toast({
        title: t('production.qualityCheckAdded'),
        description: t('production.qualityCheckAddedDesc'),
      });
      
      // Reset form
      form.reset({
        checkType: '',
        passed: true,
        notes: '',
      });
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/production/orders', productionOrderId, 'quality-checks'] });
      
      // If all checks passed and this is the first set of checks, update order status to approved
      if (data.allPassed) {
        apiRequest(`/api/production/orders/${productionOrderId}/status`, {
          method: 'PATCH',
          data: { status: 'approved' },
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['/api/production/orders'] });
          queryClient.invalidateQueries({ queryKey: ['/api/production/orders', productionOrderId] });
        });
      }
      
      if (data.closed) {
        // If this completes the quality check process, close the dialog
        onOpenChange(false);
      }
    },
    onError: (error: any) => {
      console.error('Error saving quality check:', error);
      toast({
        title: t('errorOccurred'),
        description: error.message || t('production.errorSavingQualityCheck'),
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const handleSubmit = async (values: QualityCheckFormValues) => {
    if (!productionOrderId) return;
    
    setSubmitting(true);
    try {
      await saveQualityCheckMutation.mutateAsync(values);
    } finally {
      setSubmitting(false);
    }
  };

  // Get used check types to avoid duplicates
  const usedCheckTypes = qualityChecks.map((check: any) => check.checkType);
  const availableCheckTypes = qualityCheckTypes.filter(type => !usedCheckTypes.includes(type));

  // Check if all required checks are completed
  const coreChecksCompleted = ['appearance', 'odor', 'taste', 'color'].every(checkType => 
    usedCheckTypes.includes(checkType)
  );

  const isLoading = orderLoading || checksLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('production.qualityCheck')}</DialogTitle>
          <DialogDescription>
            {t('production.qualityCheckDescription')}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {qualityChecks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">{t('production.completedChecks')}</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {qualityChecks.map((check: any) => (
                    <div 
                      key={check.id} 
                      className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${
                        check.passed 
                          ? 'bg-green-100 text-green-800 border border-green-200' 
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}
                    >
                      {check.passed ? (
                        <CheckCircle className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {t(`production.checkTypes.${check.checkType}`)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {coreChecksCompleted ? (
              <>
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">{t('production.coreChecksCompleted')}</AlertTitle>
                  <AlertDescription className="text-green-700">
                    {t('production.coreChecksCompletedDesc')}
                  </AlertDescription>
                </Alert>
                
                {!availableCheckTypes.length && (
                  <Button 
                    className="w-full" 
                    onClick={() => onOpenChange(false)}
                  >
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    {t('production.allChecksCompleted')}
                  </Button>
                )}
              </>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('production.requiredChecksRemaining')}</AlertTitle>
                <AlertDescription>
                  {t('production.requiredChecksRemainingDesc')}
                </AlertDescription>
              </Alert>
            )}

            {availableCheckTypes.length > 0 && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="checkType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('production.checkType')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('production.selectCheckType')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableCheckTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {t(`production.checkTypes.${type}`)}
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
                    name="passed"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>{t('production.checkPassed')}</FormLabel>
                          <FormDescription>
                            {t('production.checkPassedDescription')}
                          </FormDescription>
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

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('notes')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('production.qualityCheckNotesPlaceholder')}
                            rows={3}
                            {...field}
                          />
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
                      {t('production.recordQualityCheck')}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}