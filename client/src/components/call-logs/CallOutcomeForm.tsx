import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, CheckCircle2, AlertTriangle } from 'lucide-react';

interface CallOutcomeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callId: number;
  initialData?: any;
  mode?: 'create' | 'edit';
  onSuccess?: () => void;
}

// Form validation schema
const callOutcomeFormSchema = z.object({
  outcome: z.string().min(1, { message: "Outcome description is required" }),
  status: z.string().default('pending'),
  dueDate: z.date().optional(),
  assignedToId: z.number().optional(),
  notes: z.string().optional(),
});

type CallOutcomeFormValues = z.infer<typeof callOutcomeFormSchema>;

const CallOutcomeForm: React.FC<CallOutcomeFormProps> = ({
  open,
  onOpenChange,
  callId,
  initialData,
  mode = 'create',
  onSuccess
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set up form with default values
  const form = useForm<CallOutcomeFormValues>({
    resolver: zodResolver(callOutcomeFormSchema),
    defaultValues: initialData ? {
      ...initialData,
      dueDate: initialData.dueDate ? new Date(initialData.dueDate) : undefined,
    } : {
      outcome: '',
      status: 'pending',
      notes: '',
    }
  });

  // Create mutation for handling form submission
  const createMutation = React.useMemo(() => ({
    mutate: async (values: CallOutcomeFormValues) => {
      try {
        const url = mode === 'create' 
          ? `/api/call-logs/${callId}/outcomes` 
          : `/api/call-logs/outcomes/${initialData?.id}`;
        
        const method = mode === 'create' ? 'POST' : 'PATCH';
        
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            ...values,
            dueDate: values.dueDate ? format(values.dueDate, 'yyyy-MM-dd') : undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // Show success message
        toast({
          title: t('callLogs.outcomes.successTitle'),
          description: mode === 'create' 
            ? t('callLogs.outcomes.createdSuccess') 
            : t('callLogs.outcomes.updatedSuccess'),
          variant: 'default',
          duration: 3000,
        });

        // Invalidate call logs queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
        if (callId) {
          queryClient.invalidateQueries({ queryKey: [`/api/call-logs/${callId}/outcomes`] });
        }
        
        // Close the form
        onOpenChange(false);
        
        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess();
        }

        return result;
      } catch (error) {
        console.error('Error saving call outcome:', error);
        toast({
          title: t('common.error'),
          description: mode === 'create' 
            ? t('callLogs.outcomes.errorCreating') 
            : t('callLogs.outcomes.errorUpdating'),
          variant: 'destructive',
          duration: 5000,
        });
        throw error;
      }
    },
    isPending: false
  }), [callId, initialData, mode, onOpenChange, onSuccess, queryClient, t, toast]);

  // Handle form submission
  const onSubmit = async (values: CallOutcomeFormValues) => {
    try {
      await createMutation.mutate(values);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('callLogs.outcomes.newOutcome') : t('callLogs.outcomes.editOutcome')}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Outcome Description */}
            <FormField
              control={form.control}
              name="outcome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('callLogs.outcomes.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('callLogs.outcomes.descriptionPlaceholder')}
                      {...field}
                      className="min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('callLogs.outcomes.status')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('callLogs.outcomes.selectStatus')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">
                          <div className="flex items-center">
                            <AlertTriangle className="mr-2 h-4 w-4 text-amber-500" />
                            <span>{t('callLogs.outcomes.statuses.pending')}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="in-progress">
                          <div className="flex items-center">
                            <span className="mr-2 h-4 w-4 text-blue-500">🔄</span>
                            <span>{t('callLogs.outcomes.statuses.inProgress')}</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="completed">
                          <div className="flex items-center">
                            <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                            <span>{t('callLogs.outcomes.statuses.completed')}</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Due Date */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('callLogs.outcomes.dueDate')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={`w-full pl-3 text-left font-normal ${
                              !field.value ? "text-muted-foreground" : ""
                            }`}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>{t('callLogs.outcomes.selectDate')}</span>
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
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('callLogs.outcomes.notes')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('callLogs.outcomes.notesPlaceholder')}
                      {...field}
                      className="min-h-[80px]"
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
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <span>{t('common.saving')}</span>
                ) : mode === 'create' ? (
                  <span>{t('common.create')}</span>
                ) : (
                  <span>{t('common.save')}</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CallOutcomeForm;