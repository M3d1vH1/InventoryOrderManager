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
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';

// Define the form schema
const callLogFormSchema = z.object({
  callType: z.enum(['incoming', 'outgoing', 'missed'], {
    required_error: 'Please select a call type',
  }),
  callPurpose: z.enum(['sales', 'support', 'followup', 'complaint', 'inquiry', 'other'], {
    required_error: 'Please select a call purpose',
  }).default('other'),
  callStatus: z.enum(['scheduled', 'completed', 'no_answer', 'needs_followup', 'cancelled'], {
    required_error: 'Please select a call status',
  }).default('completed'),
  customerType: z.enum(['existing', 'prospective'], {
    required_error: 'Please select customer type',
  }),
  customerId: z.number().optional(),
  prospectiveCustomerId: z.number().optional(),
  contactName: z.string().min(1, 'Contact name is required'),
  companyName: z.string().optional(),
  newProspectiveCustomer: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    companyName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    address: z.string().optional(),
    city: z.string().optional(),
    // Simplified prospective customer fields - source field removed
  }).optional(),
  callDate: z.date({
    required_error: 'Please select a date and time',
  }).default(new Date()),
  callTime: z.string().optional(),
  duration: z.number().min(1, 'Duration must be at least 1 minute').default(15),
  notes: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  isFollowup: z.boolean().default(false),
  followupDate: z.date().optional(),
  followupTime: z.string().optional(),
  followupAssignedTo: z.number().optional(),
  previousCallId: z.number().optional(),
  tags: z.array(z.string()).optional().default([]),
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
  });

  // Fetch prospective customers for dropdown
  const { data: prospectiveCustomers } = useQuery({
    queryKey: ['/api/prospective-customers'],
    enabled: open,
  });

  // Fetch users for assignee dropdown
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    enabled: open,
  });

  const defaultValues: Partial<CallLogFormValues> = {
    callType: initialData?.callType || 'incoming',
    callPurpose: initialData?.callPurpose || 'other',
    callStatus: initialData?.callStatus || 'completed',
    customerType: 'existing',
    customerId: initialData?.customerId,
    contactName: initialData?.contactName || '',
    companyName: initialData?.companyName || '',
    prospectiveCustomerId: undefined,
    newProspectiveCustomer: undefined,
    callDate: initialData?.callDate ? new Date(initialData.callDate) : new Date(),
    callTime: initialData?.callTime || '',
    duration: initialData?.duration || 15,
    notes: initialData?.notes || '',
    priority: initialData?.priority || 'normal',
    isFollowup: initialData?.isFollowup || false,
    followupDate: initialData?.followupDate ? new Date(initialData.followupDate) : undefined,
    followupTime: initialData?.followupTime || '',
    followupAssignedTo: initialData?.followupAssignedTo,
    previousCallId: initialData?.previousCallId,
    tags: initialData?.tags || [],
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

  // Watch for changes to isFollowup and customerType
  const isFollowup = form.watch('isFollowup');
  const customerType = form.watch('customerType');

  const createMutation = useMutation({
    mutationFn: async (data: CallLogFormValues) => {
      let callLogData: any = { ...data };
      
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
      
      // Create the call log
      return apiRequest('/api/call-logs', {
        method: 'POST',
        body: JSON.stringify(callLogData),
        headers: {
          'Content-Type': 'application/json'
        }
      });
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
      toast({
        title: t('common.error'),
        description: error.message || t('common.errorSaving'),
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CallLogFormValues) => {
      return apiRequest(`/api/call-logs/${initialData.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      });
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
      toast({
        title: t('common.error'),
        description: error.message || t('common.errorSaving'),
        variant: 'destructive',
      });
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
                        <SelectItem value="incoming">{t('callLogs.form.callTypes.inbound')}</SelectItem>
                        <SelectItem value="outgoing">{t('callLogs.form.callTypes.outbound')}</SelectItem>
                        <SelectItem value="missed">{t('callLogs.form.callTypes.missed')}</SelectItem>
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
                  <FormItem>
                    <FormLabel>{t('callLogs.form.customer')}</FormLabel>
                    <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('callLogs.form.selectCustomer')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers?.map((customer: any) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Prospective Customer Selection or Creation (conditional) */}
            {customerType === 'prospective' && (
              <>
                <FormItem>
                  <FormLabel>{t('callLogs.form.prospectiveCustomerSelect')}</FormLabel>
                  <Select 
                    onValueChange={handleProspectiveCustomerChange} 
                    value={isNewProspect ? 'new' : form.getValues('prospectiveCustomerId')?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('callLogs.form.selectProspectiveCustomer')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="new">{t('callLogs.form.createNewProspect')}</SelectItem>
                      {prospectiveCustomers?.map((customer: any) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>

                {/* New Prospective Customer Form (conditional) */}
                {isNewProspect && (
                  <Card className="border-primary/20">
                    <CardContent className="p-4 space-y-4 mt-4">
                      <div className="flex items-center gap-2 border-b pb-2 mb-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-medium">{t('callLogs.form.newProspectDetails')}</h3>
                      </div>
                      
                      <div className="bg-muted/30 p-3 rounded-md flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-primary" />
                        <p className="text-sm">{t('callLogs.form.prospectiveCustomerInfo')}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Basic Information Section */}
                        <div className="col-span-1 md:col-span-2 border-b pb-2">
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('callLogs.form.basicInformation')}</h4>
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="newProspectiveCustomer.name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('callLogs.form.prospectName')}<span className="text-red-500">*</span></FormLabel>
                              <FormControl>
                                <Input placeholder={t('callLogs.form.enterName')} {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="newProspectiveCustomer.companyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('callLogs.form.companyName')}</FormLabel>
                              <FormControl>
                                <Input placeholder={t('callLogs.form.enterCompany')} {...field} value={field.value || ''} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Contact Information Section */}
                        <div className="col-span-1 md:col-span-2 border-b pb-2 mt-2">
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('callLogs.form.contactInformation')}</h4>
                        </div>
                        
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
                        <FormField
                          control={form.control}
                          name="newProspectiveCustomer.email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('callLogs.form.email')}</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder={t('callLogs.form.enterEmail')} {...field} value={field.value || ''} />
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
              {/* Contact Name */}
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('callLogs.form.contactName')}<span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder={t('callLogs.form.enterContactName')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Company Name (optional) */}
              <FormField
                control={form.control}
                name="companyName"
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Call Purpose */}
              <FormField
                control={form.control}
                name="callPurpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('callLogs.form.callPurpose')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('callLogs.form.selectCallPurpose')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sales">{t('callLogs.form.callPurposes.sales')}</SelectItem>
                        <SelectItem value="support">{t('callLogs.form.callPurposes.support')}</SelectItem>
                        <SelectItem value="followup">{t('callLogs.form.callPurposes.followup')}</SelectItem>
                        <SelectItem value="complaint">{t('callLogs.form.callPurposes.complaint')}</SelectItem>
                        <SelectItem value="inquiry">{t('callLogs.form.callPurposes.inquiry')}</SelectItem>
                        <SelectItem value="other">{t('callLogs.form.callPurposes.other')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Call Status */}
              <FormField
                control={form.control}
                name="callStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('callLogs.form.callStatus')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('callLogs.form.selectCallStatus')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="scheduled">{t('callLogs.form.callStatuses.scheduled')}</SelectItem>
                        <SelectItem value="completed">{t('callLogs.form.callStatuses.completed')}</SelectItem>
                        <SelectItem value="no_answer">{t('callLogs.form.callStatuses.no_answer')}</SelectItem>
                        <SelectItem value="needs_followup">{t('callLogs.form.callStatuses.needs_followup')}</SelectItem>
                        <SelectItem value="cancelled">{t('callLogs.form.callStatuses.cancelled')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <SelectItem value="normal">{t('callLogs.form.priorities.normal')}</SelectItem>
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
                              // Preserve time part if date already has a value
                              const newDate = new Date(date);
                              if (field.value) {
                                newDate.setHours(field.value.getHours());
                                newDate.setMinutes(field.value.getMinutes());
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



            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Is Followup */}
              <FormField
                control={form.control}
                name="isFollowup"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>{t('callLogs.form.isFollowup')}</FormLabel>
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

            {/* Followup Date (conditional) */}
            {isFollowup && (
              <FormField
                control={form.control}
                name="followupDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t('callLogs.form.followupDate')}<span className="text-red-500">*</span></FormLabel>
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
                              // Preserve time part if date already has a value
                              const newDate = new Date(date);
                              if (field.value) {
                                newDate.setHours(field.value.getHours());
                                newDate.setMinutes(field.value.getMinutes());
                              } else {
                                // Default to current time
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
            )}

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