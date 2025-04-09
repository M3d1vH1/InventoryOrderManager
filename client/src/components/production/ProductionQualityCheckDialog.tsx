import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ProductionQualityCheckDialogProps {
  open: boolean;
  onClose: () => void;
  productionOrderId: number;
  onQualityCheckAdded?: () => void;
}

type QualityCheckType = 
  | 'appearance' 
  | 'odor' 
  | 'taste' 
  | 'color' 
  | 'texture' 
  | 'ph_level' 
  | 'viscosity' 
  | 'weight' 
  | 'packaging' 
  | 'labeling' 
  | 'other';

interface QualityCheck {
  id: number;
  productionOrderId: number;
  checkType: QualityCheckType;
  passed: boolean;
  notes: string | null;
  checkedById: number;
  checkedAt: Date;
}

const qualityCheckSchema = z.object({
  checkType: z.enum([
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
    'other'
  ], {
    required_error: "Please select a check type",
  }),
  passed: z.boolean(),
  notes: z.string().optional(),
});

type QualityCheckFormValues = z.infer<typeof qualityCheckSchema>;

const ProductionQualityCheckDialog = ({ 
  open, 
  onClose, 
  productionOrderId,
  onQualityCheckAdded 
}: ProductionQualityCheckDialogProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);
  const [fetchingChecks, setFetchingChecks] = useState(false);
  const [coreChecksCompleted, setCoreChecksCompleted] = useState(false);

  const form = useForm<QualityCheckFormValues>({
    resolver: zodResolver(qualityCheckSchema),
    defaultValues: {
      checkType: 'appearance',
      passed: true,
      notes: '',
    },
  });

  // Core checks are appearance, odor, taste, color
  const coreCheckTypes = ['appearance', 'odor', 'taste', 'color'];

  useEffect(() => {
    if (open && productionOrderId) {
      fetchQualityChecks();
    }
  }, [open, productionOrderId]);

  const fetchQualityChecks = async () => {
    if (!productionOrderId) return;

    setFetchingChecks(true);
    try {
      const response = await fetch(`/api/production/${productionOrderId}/quality-checks`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch quality checks');
      }

      const data = await response.json();
      setQualityChecks(data);
      
      // Check if all core checks are completed
      const completedCoreChecks = coreCheckTypes.filter(coreType => 
        data.some((check: QualityCheck) => check.checkType === coreType)
      );
      
      setCoreChecksCompleted(completedCoreChecks.length === coreCheckTypes.length);

    } catch (error) {
      console.error('Error fetching quality checks:', error);
    } finally {
      setFetchingChecks(false);
    }
  };

  const onSubmit = async (values: QualityCheckFormValues) => {
    if (!productionOrderId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/production/${productionOrderId}/quality-checks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Failed to add quality check');
      }

      form.reset();
      toast({
        title: t('production.qualityCheckAdded'),
        description: t('production.qualityCheckAddedDesc'),
      });

      fetchQualityChecks();

      if (onQualityCheckAdded) {
        onQualityCheckAdded();
      }
    } catch (error) {
      console.error('Error adding quality check:', error);
      toast({
        title: t('production.errorSavingQualityCheck'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const hasCompletedCheckOfType = (type: QualityCheckType) => {
    return qualityChecks.some(check => check.checkType === type);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) onClose();
    }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('production.qualityCheck')}</DialogTitle>
          <DialogDescription>
            {t('production.qualityCheckDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 mb-4">
          {coreChecksCompleted ? (
            <Alert className="bg-green-50 text-green-800 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>{t('production.coreChecksCompleted')}</AlertTitle>
              <AlertDescription>
                {t('production.coreChecksCompletedDesc')}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-amber-50 text-amber-800 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle>{t('production.requiredChecksRemaining')}</AlertTitle>
              <AlertDescription>
                {t('production.requiredChecksRemainingDesc')}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">{t('production.completedChecks')}</h3>
            {qualityChecks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('orderErrors.noErrorsDescription')}
              </p>
            ) : (
              <div className="space-y-2">
                {qualityChecks.map((check) => (
                  <div 
                    key={check.id} 
                    className="p-3 border rounded-md flex items-start justify-between bg-background"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {t(`production.checkTypes.${check.checkType}`)}
                        </span>
                        {check.passed ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {t('common.passed')}
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                            <XCircle className="w-3 h-3 mr-1" />
                            {t('common.failed')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {check.notes || t('common.noNotesAvailable')}
                      </p>
                      <div className="text-xs text-muted-foreground flex gap-2">
                        <span>{format(new Date(check.checkedAt), 'PPp')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="checkType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('production.checkType')}</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('production.selectCheckType')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(['appearance', 'odor', 'taste', 'color', 'texture', 'ph_level', 
                        'viscosity', 'weight', 'packaging', 'labeling', 'other'] as const).map((type) => (
                        <SelectItem 
                          key={type} 
                          value={type}
                          disabled={hasCompletedCheckOfType(type)}
                        >
                          {t(`production.checkTypes.${type}`)}
                          {coreCheckTypes.includes(type) && ' *'}
                          {hasCompletedCheckOfType(type) && ` (${t('common.completed')})`}
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
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={loading}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>{t('production.checkPassed')}</FormLabel>
                    <FormDescription>
                      {t('production.checkPassedDescription')}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.notes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('production.qualityCheckNotesPlaceholder')}
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={loading || fetchingChecks}>
                {loading ? t('common.saving') : t('production.recordQualityCheck')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductionQualityCheckDialog;