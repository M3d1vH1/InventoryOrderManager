import { useState, useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

// UI Components
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
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
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Clock as ClockIcon } from 'lucide-react';

// Schema for our form data
const quickCallFormSchema = z.object({
  customerId: z.number().optional().nullable(),
  prospectiveCustomerId: z.number().optional().nullable(),
  subject: z.string().min(1, { message: "Subject is required" }),
  callType: z.string(), // 'inbound', 'outbound', 'missed', 'scheduled'
  callDate: z.date().default(new Date()),
  duration: z.coerce.number().min(1, { message: "Duration is required" }),
  notes: z.string().optional(),
  priority: z.string().default('medium'), // 'low', 'medium', 'high', 'urgent'
  needsFollowup: z.boolean().default(false),
  followupDate: z.date().optional().nullable(),
});

type QuickCallFormValues = z.infer<typeof quickCallFormSchema>;

interface QuickCallFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QuickCallForm = ({ open, onOpenChange }: QuickCallFormProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [customerType, setCustomerType] = useState<'existing' | 'none'>('none');

  // Fetch customers for dropdown
  const { data: customers = [] } = useQuery({
    queryKey: ['/api/customers'],
    queryFn: () => apiRequest('/api/customers'),
    enabled: open,
  });

  // Form setup
  const form = useForm<QuickCallFormValues>({
    resolver: zodResolver(quickCallFormSchema),
    defaultValues: {
      subject: '',
      callType: 'inbound',
      callDate: new Date(),
      duration: 1,
      notes: '',
      priority: 'medium',
      needsFollowup: false,
      followupDate: null,
      customerId: null,
      prospectiveCustomerId: null,
    },
  });

  // Watch for changes to needsFollowup
  const needsFollowup = form.watch('needsFollowup');

  // Mutation for saving the call log
  const createMutation = useMutation({
    mutationFn: async (data: QuickCallFormValues) => {
      return apiRequest('/api/call-logs?quick=true', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
      toast({
        title: t('callLogs.form.successTitle'),
        description: t('callLogs.form.quickCallSuccessDescription'),
      });
      onOpenChange(false);
      form.reset(); // Reset form after successful submission
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('common.errorSaving'),
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: QuickCallFormValues) => {
    if (customerType === 'none') {
      data.customerId = null;
    }
    
    createMutation.mutate(data);
  };

  // Reset form when closing dialog
  useEffect(() => {
    if (!open) {
      form.reset();
      setCustomerType('none');
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{t('callLogs.quickForm.title')}</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Subject */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('callLogs.quickForm.subject')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('callLogs.quickForm.subjectPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Call Type & Customer Selection */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="callType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('callLogs.quickForm.callType')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('callLogs.quickForm.selectCallType')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="inbound">{t('callLogs.form.callTypes.inbound')}</SelectItem>
                        <SelectItem value="outbound">{t('callLogs.form.callTypes.outbound')}</SelectItem>
                        <SelectItem value="missed">{t('callLogs.form.callTypes.missed')}</SelectItem>
                        <SelectItem value="scheduled">{t('callLogs.form.callTypes.scheduled')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Customer Selection */}
              <div>
                <FormLabel>{t('callLogs.quickForm.customer')}</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    if (value === 'none') {
                      setCustomerType('none');
                      form.setValue('customerId', null);
                    } else {
                      setCustomerType('existing');
                      form.setValue('customerId', Number(value));
                    }
                  }} 
                  defaultValue="none"
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('callLogs.quickForm.selectCustomer')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('callLogs.quickForm.noCustomer')}</SelectItem>
                    {customers.map((customer: any) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Call Date & Duration */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="callDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('callLogs.quickForm.date')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full pl-3 text-left font-normal"
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>{t('callLogs.quickForm.selectDate')}</span>
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
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('callLogs.quickForm.duration')}</FormLabel>
                    <FormControl>
                      <div className="flex items-center">
                        <Input
                          type="number"
                          min={1}
                          {...field}
                        />
                        <span className="ml-2">{t('callLogs.quickForm.minutes')}</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('callLogs.quickForm.priority')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('callLogs.quickForm.selectPriority')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">{t('callLogs.form.priorities.low')}</SelectItem>
                      <SelectItem value="medium">{t('callLogs.form.priorities.medium')}</SelectItem>
                      <SelectItem value="high">{t('callLogs.form.priorities.high')}</SelectItem>
                      <SelectItem value="urgent">{t('callLogs.form.priorities.urgent')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('callLogs.quickForm.notes')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t('callLogs.quickForm.notesPlaceholder')}
                      className="resize-none min-h-[80px]"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Needs Follow-up */}
            <FormField
              control={form.control}
              name="needsFollowup"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>{t('callLogs.quickForm.needsFollowup')}</FormLabel>
                    <FormDescription>
                      {t('callLogs.quickForm.needsFollowupDescription')}
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

            {/* Follow-up Date (conditional) */}
            {needsFollowup && (
              <FormField
                control={form.control}
                name="followupDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('callLogs.quickForm.followupDate')}</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full pl-3 text-left font-normal"
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>{t('callLogs.quickForm.selectFollowupDate')}</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickCallForm;