import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { UserPlus, Info } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
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
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Combobox } from '@/components/ui/combobox';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

// Define the form schema
const callLogFormSchema = z.object({
  callType: z.string({
    required_error: 'Please select a call type',
  }),
  customerType: z.enum(['existing', 'prospective'], {
    required_error: 'Please select customer type',
  }),
  customerId: z.number().optional(),
  prospectiveCustomerId: z.number().optional(),
  newProspectiveCustomer: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    companyName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    address: z.string().optional(),
    city: z.string().optional(),
  }).optional(),
  callDate: z.date({
    required_error: 'Please select a date and time',
  }).default(new Date()),
  duration: z.number().min(1, 'Duration must be at least 1 minute').default(15),
  subject: z.string().min(1, 'Subject is required'),
  notes: z.string().optional(),
  priority: z.string().default('medium'),
  needsFollowup: z.boolean().default(false),
  followupDate: z.date().optional(),
  // New fields for enhanced follow-up and outcome tracking
  outcome: z.string().optional(),
  followupType: z.string().optional(),
  followupReminder: z.boolean().default(false),
  followupReminderDate: z.date().optional(),
  assignedToId: z.number().optional(),
  status: z.string().default('open'),
});

type CallLogFormValues = z.infer<typeof callLogFormSchema>;

interface CallLogFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  mode?: 'create' | 'edit';
}

const CallLogForm: React.FC<CallLogFormProps> = ({
  open,
  onOpenChange,
  initialData,
  mode = 'create',
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isNewProspect, setIsNewProspect] = useState(false);

  // Fetch customers for dropdown
  const { data: customers } = useQuery({
    queryKey: ['/api/customers'],
    enabled: open,
    queryFn: async () => {
      try {
        const response = await fetch('/api/customers', { 
          credentials: 'include'
        });
        if (!response.ok) {
          if (response.status === 401) {
            toast({
              title: t('common.unauthorizedError'),
              description: t('common.pleaseLogin'),
              variant: 'destructive',
            });
            return [];
          }
          throw new Error('Failed to fetch customers');
        }
        return response.json();
      } catch (error) {
        console.error("Customers fetch error:", error);
        return [];
      }
    },
    retry: false
  });

  // Fetch prospective customers for dropdown
  const { data: prospectiveCustomers } = useQuery({
    queryKey: ['/api/prospective-customers'],
    enabled: open,
    queryFn: async () => {
      try {
        const response = await fetch('/api/prospective-customers', { 
          credentials: 'include'
        });
        if (!response.ok) {
          if (response.status === 401) return [];
          throw new Error('Failed to fetch prospective customers');
        }
        return response.json();
      } catch (error) {
        console.error("Prospective customers fetch error:", error);
        return [];
      }
    },
    retry: false
  });

  // Fetch users for assignee dropdown
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    enabled: open,
    queryFn: async () => {
      try {
        const response = await fetch('/api/users', { 
          credentials: 'include'
        });
        if (!response.ok) {
          if (response.status === 401) return [];
          throw new Error('Failed to fetch users');
        }
        return response.json();
      } catch (error) {
        console.error("Users fetch error:", error);
        return [];
      }
    },
    retry: false
  });

  const defaultValues: Partial<CallLogFormValues> = {
    callType: initialData?.callType || 'inbound',
    customerType: 'existing',
    customerId: initialData?.customerId,
    prospectiveCustomerId: undefined,
    newProspectiveCustomer: undefined,
    callDate: initialData?.callDate ? new Date(initialData.callDate) : new Date(),
    duration: initialData?.duration || 15,
    subject: initialData?.subject || '',
    notes: initialData?.notes || '',
    priority: initialData?.priority || 'medium',
    needsFollowup: initialData?.needsFollowup || false,
    followupDate: initialData?.followupDate ? new Date(initialData.followupDate) : undefined,
    // New fields
    outcome: initialData?.outcome || '',
    followupType: initialData?.followupType || 'call',
    followupReminder: initialData?.followupReminder || false,
    followupReminderDate: initialData?.followupReminderDate ? new Date(initialData.followupReminderDate) : undefined,
    assignedToId: initialData?.assignedToId,
    status: initialData?.status || 'open',
  };

  const form = useForm<CallLogFormValues>({
    resolver: zodResolver(callLogFormSchema),
    defaultValues,
  });

  // Update form when initial data changes
  useEffect(() => {
    if (initialData && open) {
      form.reset({
        ...defaultValues,
        callDate: initialData?.callDate ? new Date(initialData.callDate) : new Date(),
        followupDate: initialData?.followupDate ? new Date(initialData.followupDate) : undefined,
      });
    }
  }, [initialData, open, form]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      setIsNewProspect(false);
    }
  }, [open, form]);

  // Watch for changes to needsFollowup
  const needsFollowup = form.watch('needsFollowup');
  const customerType = form.watch('customerType');

  const createMutation = useMutation({
    mutationFn: async (data: CallLogFormValues) => {
      let callLogData: any = { ...data };
      
      try {
        // Handle prospective customer creation
        if (data.customerType === 'prospective') {
          if (isNewProspect && data.newProspectiveCustomer) {
            // Create new prospective customer first
            const prospectiveData = {
              ...data.newProspectiveCustomer,
              status: 'new',
            };
            console.log('Creating new prospective customer:', prospectiveData);
            
            const prospectiveResponse = await apiRequest('/api/prospective-customers', {
              method: 'POST',
              body: JSON.stringify(prospectiveData),
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (prospectiveResponse.id) {
              callLogData.prospectiveCustomerId = prospectiveResponse.id;
              callLogData.customerId = null; // Ensure customerId is null
            }
          } else if (data.prospectiveCustomerId) {
            callLogData.customerId = null; // Ensure customerId is null
          }
        } else {
          // For existing customers
          callLogData.prospectiveCustomerId = null; // Ensure prospectiveCustomerId is null
        }
        
        // Remove unnecessary fields
        delete callLogData.customerType;
        delete callLogData.newProspectiveCustomer;
        
        // Create the call log - Use the quick endpoint
        const response = await fetch('/api/call-logs?quick=true', {
          method: 'POST',
          credentials: 'include', // Ensure cookies are sent
          body: JSON.stringify(callLogData),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            toast({
              title: t('common.unauthorizedError'),
              description: t('common.pleaseLogin'),
              variant: 'destructive',
            });
            // Redirect to login after showing toast
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
            throw new Error('Unauthorized');
          }
          
          // Handle other errors
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create call log');
        }
        
        return await response.json();
      } catch (error: any) {
        console.error('Error creating call log:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
      toast({
        title: t('callLogs.form.successTitle'),
        description: t('callLogs.form.successDescription'),
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      // Don't show error toast for unauthorized errors (already handled in mutationFn)
      if (error.message !== 'Unauthorized') {
        toast({
          title: t('common.error'),
          description: error.message || t('common.errorSaving'),
          variant: 'destructive',
        });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CallLogFormValues) => {
      try {
        const response = await fetch(`/api/call-logs/${initialData.id}`, {
          method: 'PATCH',
          credentials: 'include', // Ensure cookies are sent
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            toast({
              title: t('common.unauthorizedError'),
              description: t('common.pleaseLogin'),
              variant: 'destructive',
            });
            // Redirect to login after showing toast
            setTimeout(() => {
              window.location.href = '/';
            }, 2000);
            throw new Error('Unauthorized');
          }
          
          // Handle other errors
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update call log');
        }
        
        return await response.json();
      } catch (error: any) {
        console.error('Error updating call log:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/call-logs'] });
      toast({
        title: t('callLogs.form.updateSuccessTitle'),
        description: t('callLogs.form.updateSuccessDescription'),
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      // Don't show error toast for unauthorized errors (already handled in mutationFn)
      if (error.message !== 'Unauthorized') {
        toast({
          title: t('common.error'),
          description: error.message || t('common.errorSaving'),
          variant: 'destructive',
        });
      }
    },
  });

  const onSubmit = (data: CallLogFormValues) => {
    if (mode === 'create') {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  };

  const handleCustomerTypeChange = (value: 'existing' | 'prospective') => {
    form.setValue('customerType', value);
    if (value === 'existing') {
      form.setValue('prospectiveCustomerId', undefined);
      form.setValue('newProspectiveCustomer', undefined);
      setIsNewProspect(false);
    } else {
      form.setValue('customerId', undefined);
    }
  };

  const handleProspectiveCustomerChange = (value: string) => {
    if (value === 'new') {
      setIsNewProspect(true);
      form.setValue('prospectiveCustomerId', undefined);
    } else {
      setIsNewProspect(false);
      form.setValue('prospectiveCustomerId', Number(value));
      form.setValue('newProspectiveCustomer', undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('callLogs.form.newCallTitle') : t('callLogs.form.editCallTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('callLogs.form.description')}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Type Selection */}
              <FormField
                control={form.control}
                name="customerType"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>{t('callLogs.form.customerType')}</FormLabel>
                    <div className="flex flex-col space-y-1">
                      <RadioGroup
                        value={field.value}
                        onValueChange={(value: 'existing' | 'prospective') => handleCustomerTypeChange(value)}
                        className="flex flex-col space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="existing" id="existing" />
                          <label htmlFor="existing" className="text-sm font-medium leading-none cursor-pointer">
                            {t('callLogs.form.existingCustomer')}
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="prospective" id="prospective" />
                          <label htmlFor="prospective" className="text-sm font-medium leading-none cursor-pointer">
                            {t('callLogs.form.prospectiveCustomer')}
                          </label>
                        </div>
                      </RadioGroup>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Call Type */}
              <FormField
                control={form.control}
                name="callType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('callLogs.form.callType')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('callLogs.form.selectCallType')} />
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
            </div>

            {/* Customer Selection (conditional) */}
            {customerType === 'existing' && (
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem className="flex flex-col space-y-1.5">
                    <FormLabel>{t('callLogs.form.customer')}<span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Combobox
                        options={(customers || []).map((customer: any) => ({
                          value: customer.id,
                          label: customer.name || customer.companyName || customer.email || t('common.unknown')
                        }))}
                        value={field.value || ""}
                        onChange={(value) => {
                          console.log('Customer selected with Combobox ID:', value);
                          field.onChange(value ? Number(value) : undefined);
                        }}
                        placeholder={t('callLogs.form.selectCustomer')}
                        emptyText={t('common.noOptions')}
                        notFoundText={t('common.noResults')}
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Prospective Customer Selection (conditional) */}
            {customerType === 'prospective' && (
              <>
                <FormField
                  control={form.control}
                  name="prospectiveCustomerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('callLogs.form.prospectiveCustomer')}</FormLabel>
                      <div className="flex items-center space-x-2">
                        <div className="flex-grow">
                          <FormControl>
                            <Combobox
                              options={[
                                { value: 'new', label: `+ ${t('callLogs.form.newProspectiveCustomer')}` },
                                ...(prospectiveCustomers || []).map((prospect: any) => ({
                                  value: prospect.id,
                                  label: prospect.name || prospect.companyName || prospect.email || t('common.unknown')
                                }))
                              ]}
                              value={isNewProspect ? 'new' : field.value || ""}
                              onChange={(value) => {
                                console.log('Prospective customer selected with Combobox:', value);
                                if (value === 'new') {
                                  handleProspectiveCustomerChange('new');
                                } else {
                                  // Convert to number if it's a prospective customer ID
                                  if (value !== 'new' && typeof value === 'string') {
                                    const numericValue = parseInt(value, 10);
                                    if (!isNaN(numericValue)) {
                                      handleProspectiveCustomerChange(numericValue);
                                    } else {
                                      handleProspectiveCustomerChange(value);
                                    }
                                  } else {
                                    handleProspectiveCustomerChange(value);
                                  }
                                }
                              }}
                              placeholder={t('callLogs.form.selectProspectiveCustomer')}
                              emptyText={t('common.noOptions')}
                              notFoundText={t('common.noResults')}
                              className="w-full"
                            />
                          </FormControl>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleProspectiveCustomerChange('new')}
                          title={t('callLogs.form.newProspectiveCustomer')}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* New Prospective Customer Form (conditional) */}
                {isNewProspect && (
                  <Card className="mt-2">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Name */}
                        <FormField
                          control={form.control}
                          name="newProspectiveCustomer.name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('callLogs.form.name')}<span className="text-red-500">*</span></FormLabel>
                              <FormControl>
                                <Input placeholder={t('callLogs.form.enterName')} {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Company Name */}
                        <FormField
                          control={form.control}
                          name="newProspectiveCustomer.companyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('callLogs.form.companyName')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('callLogs.form.enterCompanyName')} {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Phone */}
                        <FormField
                          control={form.control}
                          name="newProspectiveCustomer.phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('callLogs.form.phone')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('callLogs.form.enterPhone')} {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Email */}
                        <FormField
                          control={form.control}
                          name="newProspectiveCustomer.email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('callLogs.form.email')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('callLogs.form.enterEmail')} {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Address Information Section */}
                        <div className="col-span-1 md:col-span-2 border-b pb-2 mt-2">
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('callLogs.form.addressInformation')}</h4>
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="newProspectiveCustomer.address"
                          render={({ field }) => (
                            <FormItem className="col-span-1 md:col-span-2">
                              <FormLabel>{t('callLogs.form.address')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('callLogs.form.enterAddress')} {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="newProspectiveCustomer.city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('callLogs.form.city')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('callLogs.form.enterCity')} {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Subject */}
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('callLogs.form.subject')}<span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder={t('callLogs.form.enterSubject')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('callLogs.form.priority')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('callLogs.form.selectPriority')} />
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Call Date */}
              <FormField
                control={form.control}
                name="callDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('callLogs.form.callDate')}<span className="text-red-500">*</span></FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full pl-3 text-left font-normal"
                          >
                            {field.value ? (
                              format(field.value, 'PPP HH:mm')
                            ) : (
                              <span className="text-muted-foreground">
                                {t('callLogs.form.pickDate')}
                              </span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            if (date) {
                              const newDate = new Date(date);
                              if (field.value) {
                                newDate.setHours(field.value.getHours());
                                newDate.setMinutes(field.value.getMinutes());
                              } else {
                                const now = new Date();
                                newDate.setHours(now.getHours());
                                newDate.setMinutes(now.getMinutes());
                              }
                              field.onChange(newDate);
                            }
                          }}
                          initialFocus
                        />
                        <div className="p-3 border-t border-border">
                          <Input
                            type="time"
                            value={field.value ? 
                              `${String(field.value.getHours()).padStart(2, '0')}:${String(field.value.getMinutes()).padStart(2, '0')}` : 
                              '12:00'}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value.split(':').map(Number);
                              const newDate = new Date(field.value || new Date());
                              newDate.setHours(hours);
                              newDate.setMinutes(minutes);
                              field.onChange(newDate);
                            }}
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Duration */}
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('callLogs.form.duration')}</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder={t('callLogs.form.enterDuration')} 
                        {...field} 
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
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
                  <FormLabel>{t('callLogs.form.notes')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t('callLogs.form.enterNotes')} 
                      {...field} 
                      value={field.value || ''}
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Outcome Tracking Section */}
            <div className="border rounded-md p-4 mb-4">
              <h3 className="text-lg font-medium mb-3">{t('callLogs.form.outcome.title', 'Call Outcome')}</h3>
              
              <FormField
                control={form.control}
                name="outcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('callLogs.form.outcome.label', 'Outcome')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('callLogs.form.outcome.placeholder', 'Select outcome')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t('callLogs.form.outcome.none', 'None')}</SelectItem>
                        <SelectItem value="order_placed">{t('callLogs.form.outcome.orderPlaced', 'Order Placed')}</SelectItem>
                        <SelectItem value="info_requested">{t('callLogs.form.outcome.infoRequested', 'Information Requested')}</SelectItem>
                        <SelectItem value="issue_resolved">{t('callLogs.form.outcome.issueResolved', 'Issue Resolved')}</SelectItem>
                        <SelectItem value="requires_escalation">{t('callLogs.form.outcome.requiresEscalation', 'Requires Escalation')}</SelectItem>
                        <SelectItem value="no_answer">{t('callLogs.form.outcome.noAnswer', 'No Answer')}</SelectItem>
                        <SelectItem value="not_interested">{t('callLogs.form.outcome.notInterested', 'Not Interested')}</SelectItem>
                        <SelectItem value="other">{t('callLogs.form.outcome.other', 'Other')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="mt-3">
                    <FormLabel>{t('callLogs.form.status.label', 'Status')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('callLogs.form.status.placeholder', 'Select status')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open">{t('callLogs.form.status.open', 'Open')}</SelectItem>
                        <SelectItem value="closed">{t('callLogs.form.status.closed', 'Closed')}</SelectItem>
                        <SelectItem value="pending">{t('callLogs.form.status.pending', 'Pending')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Follow-up Section */}
            <div className="border rounded-md p-4 mb-4">
              <h3 className="text-lg font-medium mb-3">{t('callLogs.form.followupSection', 'Follow-up')}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Needs Followup */}
                <FormField
                  control={form.control}
                  name="needsFollowup"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>{t('callLogs.form.needsFollowup', 'Needs Follow-up')}</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          {t('callLogs.form.needsFollowupDescription', 'Schedule a follow-up for this customer')}
                        </p>
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
                
                {needsFollowup && (
                  <FormField
                    control={form.control}
                    name="followupType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('callLogs.form.followupType', 'Follow-up Type')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('callLogs.form.selectFollowupType', 'Select type')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="call">{t('callLogs.form.followupTypes.call', 'Phone Call')}</SelectItem>
                            <SelectItem value="email">{t('callLogs.form.followupTypes.email', 'Email')}</SelectItem>
                            <SelectItem value="meeting">{t('callLogs.form.followupTypes.meeting', 'Meeting')}</SelectItem>
                            <SelectItem value="other">{t('callLogs.form.followupTypes.other', 'Other')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              
              {needsFollowup && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {/* Followup Date */}
                    <FormField
                      control={form.control}
                      name="followupDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t('callLogs.form.followupDate', 'Follow-up Date')}<span className="text-red-500">*</span></FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className="w-full pl-3 text-left font-normal"
                                >
                                  {field.value ? (
                                    format(field.value, 'PPP HH:mm')
                                  ) : (
                                    <span className="text-muted-foreground">
                                      {t('callLogs.form.pickDate', 'Pick a date')}
                                    </span>
                                  )}
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={(date) => {
                                  if (date) {
                                    const newDate = new Date(date);
                                    if (field.value) {
                                      newDate.setHours(field.value.getHours());
                                      newDate.setMinutes(field.value.getMinutes());
                                    } else {
                                      const now = new Date();
                                      newDate.setHours(now.getHours());
                                      newDate.setMinutes(now.getMinutes());
                                    }
                                    field.onChange(newDate);
                                  }
                                }}
                                initialFocus
                              />
                              <div className="p-3 border-t border-border">
                                <Input
                                  type="time"
                                  value={field.value ? 
                                    `${String(field.value.getHours()).padStart(2, '0')}:${String(field.value.getMinutes()).padStart(2, '0')}` : 
                                    '12:00'}
                                  onChange={(e) => {
                                    const [hours, minutes] = e.target.value.split(':').map(Number);
                                    const newDate = new Date(field.value || new Date());
                                    newDate.setHours(hours);
                                    newDate.setMinutes(minutes);
                                    field.onChange(newDate);
                                  }}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* Assigned To (if users are available) */}
                    {users && users.length > 0 && (
                      <FormField
                        control={form.control}
                        name="assignedToId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('callLogs.form.assignTo', 'Assign To')}</FormLabel>
                            <Select 
                              onValueChange={(value) => field.onChange(Number(value))} 
                              value={field.value ? String(field.value) : undefined}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t('callLogs.form.selectAssignee', 'Select assignee')} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {users.map((user: any) => (
                                  <SelectItem key={user.id} value={String(user.id)}>
                                    {user.name || user.username}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                  
                  {/* Follow-up Reminder */}
                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="followupReminder"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>{t('callLogs.form.followupReminder', 'Send Reminder')}</FormLabel>
                            <p className="text-sm text-muted-foreground">
                              {t('callLogs.form.followupReminderDescription', 'Send a notification before the follow-up')}
                            </p>
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
                </>
              )}
            </div>

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
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
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

export default CallLogForm;