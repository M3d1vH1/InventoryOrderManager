import { useState, useEffect } from 'react';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/context/NotificationContext';
import { AlertCircle, Bell, Cog, Edit, Globe, HelpCircle, Mail, Plus, Printer, Save, Send, Tag, Trash2, UserCog, Variable, Volume2, VolumeX, Link2, Slack, Database, HardDrive } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const companySettingsSchema = z.object({
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  phone: z.string().min(10, { message: "Please enter a valid phone number" }),
  address: z.string().min(5, { message: "Address must be at least 5 characters" }),
});

const notificationSettingsSchema = z.object({
  lowStockAlerts: z.boolean(),
  orderConfirmation: z.boolean(),
  shippingUpdates: z.boolean(),
  dailyReports: z.boolean(),
  weeklyReports: z.boolean(),
  soundEnabled: z.boolean().optional(),
  
  // Invoice and Payment alerts
  invoiceAlerts: z.boolean().optional(),
  paymentAlerts: z.boolean().optional(),
  overdueInvoiceAlerts: z.boolean().optional(),
  
  // Slack notification settings
  slackEnabled: z.boolean().optional(),
  slackWebhookUrl: z.string().optional().nullable(),
  slackFinanceWebhookUrl: z.string().optional().nullable(),
  slackNotifyNewOrders: z.boolean().optional(),
  slackNotifyCallLogs: z.boolean().optional(),
  slackNotifyLowStock: z.boolean().optional(),
  slackNotifyInvoices: z.boolean().optional(),
  slackNotifyPayments: z.boolean().optional(),
  
  // Slack notification templates
  slackOrderTemplate: z.string().optional().nullable(),
  slackCallLogTemplate: z.string().optional().nullable(),
  slackLowStockTemplate: z.string().optional().nullable(),
  slackInvoiceTemplate: z.string().optional().nullable(),
  slackPaymentTemplate: z.string().optional().nullable(),
});

const emailSettingsSchema = z.object({
  host: z.string().min(1, { message: "SMTP host is required" }),
  port: z.coerce.number().int().positive({ message: "Port must be a positive number" }),
  secure: z.boolean().default(false),
  authUser: z.string().min(1, { message: "Username is required" }),
  authPass: z.string().optional().refine(val => {
    return true;
  }),
  fromEmail: z.string().email({ message: "Valid email address is required" }),
  companyName: z.string().min(1, { message: "Company name is required" }),
  enableNotifications: z.boolean().default(true),
});

const emailTestSchema = z.object({
  testEmail: z.string().email({ message: "Valid test email address is required" }),
});

const templateEditSchema = z.object({
  content: z.string().min(1, { message: "Template content is required" }),
});

const userFormSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  role: z.enum(['admin', 'warehouse_staff', 'manager']),
});

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const { toast } = useToast();
  const { playNotificationSound, sendTestNotification } = useNotifications();
  const { user } = useAuth();
  const { t } = useTranslation();

  const companyForm = useForm({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      companyName: '',
      email: '',
      phone: '',
      address: '',
    },
  });

  const notificationForm = useForm({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      lowStockAlerts: true,
      orderConfirmation: true,
      shippingUpdates: true,
      dailyReports: false,
      weeklyReports: true,
      soundEnabled: true,
      invoiceAlerts: true,
      paymentAlerts: true,
      overdueInvoiceAlerts: true,
      slackEnabled: false,
      slackWebhookUrl: '',
      slackFinanceWebhookUrl: '',
      slackNotifyNewOrders: true,
      slackNotifyCallLogs: false,
      slackNotifyLowStock: true,
      slackNotifyInvoices: true,
      slackNotifyPayments: true,
      slackOrderTemplate: '',
      slackCallLogTemplate: '',
      slackLowStockTemplate: '',
      slackInvoiceTemplate: '',
      slackPaymentTemplate: '',
    },
  });

  const emailForm = useForm({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      host: '',
      port: 587,
      secure: false,
      authUser: '',
      authPass: '',
      fromEmail: '',
      companyName: '',
      enableNotifications: true,
    },
  });

  const { data: companyData, isLoading: isCompanyLoading } = useQuery({
    queryKey: ['/api/settings/company'],
    enabled: user?.role === 'admin',
  });

  const { data: notificationSettingsData, isLoading: isNotificationLoading } = useQuery({
    queryKey: ['/api/settings/notifications'],
  });

  const { data: emailData, isLoading: isEmailLoading } = useQuery({
    queryKey: ['/api/settings/email'],
    enabled: user?.role === 'admin',
  });

  useEffect(() => {
    if (companyData) {
      companyForm.reset({
        companyName: companyData.companyName || '',
        email: companyData.email || '',
        phone: companyData.phone || '',
        address: companyData.address || '',
      });
    }
  }, [companyData, companyForm]);

  useEffect(() => {
    if (notificationSettingsData) {
      notificationForm.reset({
        lowStockAlerts: notificationSettingsData.lowStockAlerts || false,
        orderConfirmation: notificationSettingsData.orderConfirmation || false,
        shippingUpdates: notificationSettingsData.shippingUpdates || false,
        dailyReports: notificationSettingsData.dailyReports || false,
        weeklyReports: notificationSettingsData.weeklyReports || false,
        soundEnabled: notificationSettingsData.soundEnabled || false,
        
        invoiceAlerts: notificationSettingsData.invoiceAlerts || false,
        paymentAlerts: notificationSettingsData.paymentAlerts || false,
        overdueInvoiceAlerts: notificationSettingsData.overdueInvoiceAlerts || false,
        
        slackEnabled: notificationSettingsData.slackEnabled || false,
        slackWebhookUrl: notificationSettingsData.slackWebhookUrl || '',
        slackFinanceWebhookUrl: notificationSettingsData.slackFinanceWebhookUrl || '',
        slackNotifyNewOrders: notificationSettingsData.slackNotifyNewOrders || false,
        slackNotifyCallLogs: notificationSettingsData.slackNotifyCallLogs || false,
        slackNotifyLowStock: notificationSettingsData.slackNotifyLowStock || false,
        slackNotifyInvoices: notificationSettingsData.slackNotifyInvoices || false,
        slackNotifyPayments: notificationSettingsData.slackNotifyPayments || false,
        
        slackOrderTemplate: notificationSettingsData.slackOrderTemplate || '',
        slackCallLogTemplate: notificationSettingsData.slackCallLogTemplate || '',
        slackLowStockTemplate: notificationSettingsData.slackLowStockTemplate || '',
        slackInvoiceTemplate: notificationSettingsData.slackInvoiceTemplate || '',
        slackPaymentTemplate: notificationSettingsData.slackPaymentTemplate || '',
      });
    }
  }, [notificationSettingsData, notificationForm]);

  useEffect(() => {
    if (emailData) {
      emailForm.reset({
        host: emailData.host || '',
        port: emailData.port || 587,
        secure: emailData.secure || false,
        authUser: emailData.authUser || '',
        authPass: '',
        fromEmail: emailData.fromEmail || '',
        companyName: emailData.companyName || '',
        enableNotifications: emailData.enableNotifications !== false,
      });
    }
  }, [emailData, emailForm]);

  const saveCompanySettingsMutation = useMutation({
    mutationFn: (data: z.infer<typeof companySettingsSchema>) =>
      apiRequest('/api/settings/company', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Company settings saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/company'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save company settings",
        variant: "destructive",
      });
    },
  });

  const saveNotificationSettingsMutation = useMutation({
    mutationFn: (data: z.infer<typeof notificationSettingsSchema>) =>
      apiRequest('/api/settings/notifications', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Notification settings saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/notifications'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save notification settings",
        variant: "destructive",
      });
    },
  });

  const saveEmailSettingsMutation = useMutation({
    mutationFn: (data: z.infer<typeof emailSettingsSchema>) =>
      apiRequest('/api/settings/email', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Email settings saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings/email'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save email settings",
        variant: "destructive",
      });
    },
  });

  const onCompanySubmit = (data: z.infer<typeof companySettingsSchema>) => {
    saveCompanySettingsMutation.mutate(data);
  };

  const onNotificationSubmit = (data: z.infer<typeof notificationSettingsSchema>) => {
    saveNotificationSettingsMutation.mutate(data);
  };

  const onEmailSubmit = (data: z.infer<typeof emailSettingsSchema>) => {
    saveEmailSettingsMutation.mutate(data);
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center mb-6">
        <Cog className="h-8 w-8 mr-3" />
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-slate-600">Manage your warehouse system configuration</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="general">
            <Cog className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="email">
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Link2 className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="labels">
            <Printer className="h-4 w-4 mr-2" />
            Labels
          </TabsTrigger>
          <TabsTrigger value="users">
            <UserCog className="h-4 w-4 mr-2" />
            Users
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <HardDrive className="h-4 w-4 mr-2" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="developer">
            <Variable className="h-4 w-4 mr-2" />
            Developer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Update your company details and contact information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCompanyLoading ? (
                <div className="text-center py-4">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                  <p className="mt-2 text-sm text-slate-500">Loading company settings...</p>
                </div>
              ) : (
                <Form {...companyForm}>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={companyForm.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Your Company Name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={companyForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="company@example.com" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={companyForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="+1 (555) 123-4567" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={companyForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Company address" className="min-h-[80px]" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        onClick={companyForm.handleSubmit(onCompanySubmit)}
                        disabled={saveCompanySettingsMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isNotificationLoading ? (
                <div className="text-center py-4">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                  <p className="mt-2 text-sm text-slate-500">Loading notification settings...</p>
                </div>
              ) : (
                <Form {...notificationForm}>
                  <div className="space-y-6">
                    {/* System Alerts */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">System Alerts</h3>
                      <FormField
                        control={notificationForm.control}
                        name="lowStockAlerts"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Low Stock Alerts</FormLabel>
                              <FormDescription>
                                Receive notifications when products are running low
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="orderConfirmation"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Order Confirmations</FormLabel>
                              <FormDescription>
                                Receive notifications when new orders are placed
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="shippingUpdates"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Shipping Updates</FormLabel>
                              <FormDescription>
                                Receive notifications when order status changes
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="dailyReports"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Daily Reports</FormLabel>
                              <FormDescription>
                                Receive daily summary reports
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={notificationForm.control}
                        name="weeklyReports"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Weekly Reports</FormLabel>
                              <FormDescription>
                                Receive weekly summary reports
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Sound Notifications */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Sound Notifications</h3>
                      <FormField
                        control={notificationForm.control}
                        name="soundEnabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Sound Notifications</FormLabel>
                              <FormDescription>
                                Play sounds for important notifications
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Slack Integration */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium">Slack Integration</h3>
                      
                      <FormField
                        control={notificationForm.control}
                        name="slackEnabled"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Slack Notifications</FormLabel>
                              <FormDescription>
                                Send notifications to Slack channels
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      {notificationForm.watch('slackEnabled') && (
                        <div className="space-y-4 mt-4 p-4 border rounded-lg bg-slate-50">
                          <h4 className="text-sm font-medium text-slate-700">Webhook Configuration</h4>
                          <p className="text-xs text-slate-600">Configure Slack webhook URLs for different notification types</p>
                          
                          <FormField
                            control={notificationForm.control}
                            name="slackWebhookUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Main Slack Webhook URL</FormLabel>
                                <FormDescription className="text-xs">
                                  Primary webhook for order notifications and general alerts
                                </FormDescription>
                                <FormControl>
                                  <Input 
                                    placeholder="https://hooks.slack.com/services/..." 
                                    {...field} 
                                    value={field.value || ''} 
                                    className="font-mono text-xs"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={notificationForm.control}
                            name="slackFinanceWebhookUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm">Finance Slack Webhook URL (Optional)</FormLabel>
                                <FormDescription className="text-xs">
                                  Separate channel for invoice and payment notifications. Leave empty to use main webhook.
                                </FormDescription>
                                <FormControl>
                                  <Input 
                                    placeholder="https://hooks.slack.com/services/..." 
                                    {...field} 
                                    value={field.value || ''} 
                                    className="font-mono text-xs"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="pt-2">
                            <p className="text-xs text-slate-500">
                              💡 Tip: Use different webhooks to send notifications to specific channels like #orders and #finance
                            </p>
                          </div>
                          
                          <div className="mt-4 space-y-2">
                            <h4 className="text-sm font-medium text-slate-700">Notification Types</h4>
                            <p className="text-xs text-slate-600 mb-3">Choose which events trigger Slack notifications</p>
                            
                            <div className="grid grid-cols-1 gap-3">
                              <FormField
                                control={notificationForm.control}
                                name="slackNotifyNewOrders"
                                render={({ field }) => (
                                  <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-white">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-sm">New Orders</FormLabel>
                                      <FormDescription className="text-xs">
                                        → Main webhook channel
                                      </FormDescription>
                                    </div>
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={notificationForm.control}
                                name="slackNotifyInvoices"
                                render={({ field }) => (
                                  <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-white">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-sm">Supplier Invoices</FormLabel>
                                      <FormDescription className="text-xs">
                                        → {notificationForm.watch('slackFinanceWebhookUrl') ? 'Finance webhook channel' : 'Main webhook channel'}
                                      </FormDescription>
                                    </div>
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={notificationForm.control}
                                name="slackNotifyPayments"
                                render={({ field }) => (
                                  <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-white">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-sm">Supplier Payments</FormLabel>
                                      <FormDescription className="text-xs">
                                        → {notificationForm.watch('slackFinanceWebhookUrl') ? 'Finance webhook channel' : 'Main webhook channel'}
                                      </FormDescription>
                                    </div>
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={notificationForm.control}
                                name="slackNotifyCallLogs"
                                render={({ field }) => (
                                  <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-white">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-sm">Call Logs</FormLabel>
                                      <FormDescription className="text-xs">
                                        → Main webhook channel
                                      </FormDescription>
                                    </div>
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              
                              <FormField
                                control={notificationForm.control}
                                name="slackNotifyLowStock"
                                render={({ field }) => (
                                  <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-white">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-sm">Low Stock</FormLabel>
                                      <FormDescription className="text-xs">
                                        → Main webhook channel
                                      </FormDescription>
                                    </div>
                                    <FormControl>
                                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>

                          {/* Slack Templates */}
                          <div className="mt-4 pt-4 border-t">
                            <h4 className="text-sm font-medium text-slate-700 mb-3">Message Templates</h4>
                            <p className="text-xs text-slate-600 mb-4">Customize how notifications appear in Slack</p>
                            
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="order-template">
                                <AccordionTrigger>Order Notification Template</AccordionTrigger>
                                <AccordionContent>
                                  <FormField
                                    control={notificationForm.control}
                                    name="slackOrderTemplate"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Textarea
                                            placeholder="New order #{orderNumber} from {customer} for ${total}"
                                            className="min-h-[120px]"
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            name={field.name}
                                            ref={field.ref}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          Available variables: {"{orderNumber}"}, {"{customer}"}, {"{total}"}, {"{status}"}, {"{orderDate}"}
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </AccordionContent>
                              </AccordionItem>
                              
                              <AccordionItem value="call-template">
                                <AccordionTrigger>Call Log Notification Template</AccordionTrigger>
                                <AccordionContent>
                                  <FormField
                                    control={notificationForm.control}
                                    name="slackCallLogTemplate"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Textarea
                                            placeholder="New call with {customer} regarding {callPurpose}"
                                            className="min-h-[120px]"
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            name={field.name}
                                            ref={field.ref}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          Available variables: {"{caller}"}, {"{customer}"}, {"{callPurpose}"}, {"{callTime}"}, {"{notes}"}
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </AccordionContent>
                              </AccordionItem>
                              
                              <AccordionItem value="stock-template">
                                <AccordionTrigger>Low Stock Notification Template</AccordionTrigger>
                                <AccordionContent>
                                  <FormField
                                    control={notificationForm.control}
                                    name="slackLowStockTemplate"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <Textarea
                                            placeholder="Low stock alert: {productName} (SKU: {sku}) - only {quantity} units left"
                                            className="min-h-[120px]"
                                            value={field.value || ''}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            name={field.name}
                                            ref={field.ref}
                                          />
                                        </FormControl>
                                        <FormDescription>
                                          Available variables: {"{productName}"}, {"{sku}"}, {"{quantity}"}, {"{reorderPoint}"}, {"{category}"}
                                        </FormDescription>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                            
                            <div className="flex justify-between mt-4">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  notificationForm.setValue("slackOrderTemplate", "New order #{orderNumber} from {customer} for ${total}");
                                  notificationForm.setValue("slackCallLogTemplate", "New call with {customer} regarding {callPurpose}");
                                  notificationForm.setValue("slackLowStockTemplate", "Low stock alert: {productName} (SKU: {sku}) - only {quantity} units left");
                                }}
                              >
                                Reset to Defaults
                              </Button>
                              
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={async () => {
                                  const formValues = notificationForm.getValues();
                                  
                                  if (!formValues.slackWebhookUrl) {
                                    toast({
                                      title: "Error",
                                      description: "Please enter a Slack webhook URL first",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  try {
                                    const response = await fetch('/api/settings/test-slack-templates', {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        webhookUrl: formValues.slackWebhookUrl,
                                        templates: {
                                          orderTemplate: formValues.slackOrderTemplate || 'New order #{orderNumber} from {customerName} for ${totalValue}',
                                          callLogTemplate: formValues.slackCallLogTemplate || 'New call with {contactName} from {companyName} regarding {callPurpose}',
                                          lowStockTemplate: formValues.slackLowStockTemplate || 'Low stock alert: {name} is down to {currentStock} units',
                                        }
                                      }),
                                    });
                                    
                                    const data = await response.json();
                                    
                                    if (data.success) {
                                      toast({
                                        title: "Success",
                                        description: "Test notifications sent successfully!",
                                      });
                                    } else {
                                      toast({
                                        title: "Error",
                                        description: data.message || "Failed to send test notifications",
                                        variant: "destructive",
                                      });
                                    }
                                  } catch (error) {
                                    console.error("Error testing templates:", error);
                                    toast({
                                      title: "Error",
                                      description: "An error occurred while testing the templates",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                Test Templates
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end mt-6">
                      <Button type="submit" onClick={notificationForm.handleSubmit(onNotificationSubmit)}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Preferences
                      </Button>
                    </div>
                  </div>
                </Form>
              )}

              <Separator className="my-6" />
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Notification Sounds</h3>
                    <p className="text-sm text-slate-500">Test and manage notification sounds</p>
                  </div>
                  <div>
                    <Button variant="outline" size="sm">
                      <Volume2 className="h-4 w-4 mr-2" />
                      Enable Sounds
                    </Button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      playNotificationSound('success');
                      toast({
                        title: "Success Sound",
                        description: "Success notification sound played.",
                      });
                    }}
                  >
                    Test Success Sound
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => {
                      playNotificationSound('warning');
                      toast({
                        title: "Warning Sound",
                        description: "Warning notification sound played.",
                      });
                    }}
                  >
                    Test Warning Sound
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => {
                      playNotificationSound('error');
                      toast({
                        title: "Error Sound",
                        description: "Error notification sound played.",
                      });
                    }}
                  >
                    Test Error Sound
                  </Button>
                  
                  <Button 
                    onClick={() => sendTestNotification('success')}
                  >
                    Send Test Notification
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>
                Configure email server settings for notifications and alerts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEmailLoading ? (
                <div className="text-center py-4">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                  <p className="mt-2 text-sm text-slate-500">Loading email settings...</p>
                </div>
              ) : (
                <Form {...emailForm}>
                  <div className="space-y-6">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <div className="flex">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                        <div>
                          <h3 className="text-sm font-medium text-yellow-800">Gmail Configuration Instructions</h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>If using Gmail, you need to:</p>
                            <ol className="list-decimal ml-4 mt-1 space-y-1">
                              <li>Enable 2-Step Verification in your Google Account</li>
                              <li>Create an App Password (Google Account → Security → App Passwords)</li>
                              <li>Use your full Gmail address as Username and the generated App Password as Password</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={emailForm.control}
                        name="host"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SMTP Host</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="smtp.gmail.com" />
                            </FormControl>
                            <FormDescription>
                              SMTP server hostname (e.g., smtp.gmail.com for Gmail)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emailForm.control}
                        name="port"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Port</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" placeholder="587" />
                            </FormControl>
                            <FormDescription>
                              SMTP port (587 for TLS, 465 for SSL, 25 for non-secure)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={emailForm.control}
                      name="secure"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Use SSL/TLS</FormLabel>
                            <FormDescription>
                              Enable secure connection (recommended)
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={emailForm.control}
                        name="authUser"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="your.email@gmail.com" />
                            </FormControl>
                            <FormDescription>
                              Usually your email address
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emailForm.control}
                        name="authPass"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="••••••••" />
                            </FormControl>
                            <FormDescription>
                              Use App Password for Gmail (not your regular password)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={emailForm.control}
                        name="fromEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Email</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="noreply@yourcompany.com" />
                            </FormControl>
                            <FormDescription>
                              Email address that appears as sender
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={emailForm.control}
                        name="companyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Your Company Name" />
                            </FormControl>
                            <FormDescription>
                              Company name in email templates
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={emailForm.control}
                      name="enableNotifications"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Enable Email Notifications</FormLabel>
                            <FormDescription>
                              Send email notifications to users
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end">
                      <Button 
                        type="submit" 
                        onClick={emailForm.handleSubmit(onEmailSubmit)}
                        disabled={saveEmailSettingsMutation.isPending}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Email Settings
                      </Button>
                    </div>
                  </div>
                </Form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Connect with external services and APIs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Link2 className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Integrations</h3>
                <p className="text-slate-600 mb-4">
                  Integration features will be available in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labels" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Label Templates</CardTitle>
              <CardDescription>
                Manage shipping label templates and printer settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Printer className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Label Management</h3>
                <p className="text-slate-600 mb-4">
                  Label template features will be available in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage system users and their permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <UserCog className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">User Management</h3>
                <p className="text-slate-600 mb-4">
                  User management features will be available in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>System Maintenance</CardTitle>
              <CardDescription>
                Database maintenance, backups, and system health
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-md">
                    <p className="text-sm font-medium">Application Version</p>
                    <p className="text-sm text-slate-500">1.0.0</p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-md">
                    <p className="text-sm font-medium">Database Status</p>
                    <p className="text-sm text-green-600">Connected</p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-md">
                    <p className="text-sm font-medium">Last Backup</p>
                    <p className="text-sm text-slate-500">Never</p>
                  </div>
                  
                  <div className="p-4 bg-slate-50 rounded-md">
                    <p className="text-sm font-medium">Server Time</p>
                    <p className="text-sm text-slate-500">{new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="developer" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Developer Tools</CardTitle>
              <CardDescription>
                Advanced tools for debugging and development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Variable className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Developer Tools</h3>
                <p className="text-slate-600 mb-4">
                  Developer tools will be available in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}