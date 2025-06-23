import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { ImageMigration } from "@/components/settings/ImageMigration";
import LabelTemplateEditorComponent from "@/components/settings/LabelTemplateEditor";
import HealthCheck from "@/components/HealthCheck";
import BundleAnalyzer from "@/components/BundleAnalyzer";
import PerformanceAnalyzer from "@/components/performance/PerformanceAnalyzer";
import DatabasePerformanceAnalyzer from "@/components/database/DatabasePerformanceAnalyzer";
import { Save, Volume2 } from "lucide-react";

// --- SCHEMAS ---
const companySettingsSchema = z.object({
  companyName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  address: z.string().min(5),
});

const notificationSettingsSchema = z.object({
  lowStockAlerts: z.boolean(),
  orderConfirmation: z.boolean(),
  shippingUpdates: z.boolean(),
  dailyReports: z.boolean(),
  weeklyReports: z.boolean(),
  soundEnabled: z.boolean().optional(),
  invoiceAlerts: z.boolean().optional(),
  paymentAlerts: z.boolean().optional(),
  overdueInvoiceAlerts: z.boolean().optional(),
  slackEnabled: z.boolean().optional(),
  slackWebhookUrl: z.string().optional().nullable(),
  slackFinanceWebhookUrl: z.string().optional().nullable(),
  slackNotifyNewOrders: z.boolean().optional(),
  slackNotifyCallLogs: z.boolean().optional(),
  slackNotifyLowStock: z.boolean().optional(),
  slackNotifyInvoices: z.boolean().optional(),
  slackNotifyPayments: z.boolean().optional(),
  slackOrderTemplate: z.string().optional().nullable(),
  slackCallLogTemplate: z.string().optional().nullable(),
  slackLowStockTemplate: z.string().optional().nullable(),
  slackInvoiceTemplate: z.string().optional().nullable(),
  slackPaymentTemplate: z.string().optional().nullable(),
});

const emailSettingsSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().positive(),
  secure: z.boolean().default(false),
  authUser: z.string().min(1),
  authPass: z.string().optional(),
  fromEmail: z.string().email(),
  companyName: z.string().min(1),
  enableNotifications: z.boolean().default(true),
});

// --- MAIN COMPONENT ---
const Settings: React.FC = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const notificationForm = useForm({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      lowStockAlerts: false,
      orderConfirmation: false,
      shippingUpdates: false,
      dailyReports: false,
      weeklyReports: false,
      soundEnabled: false,
      invoiceAlerts: false,
      paymentAlerts: false,
      overdueInvoiceAlerts: false,
      slackEnabled: false,
      slackWebhookUrl: "",
      slackFinanceWebhookUrl: "",
      slackNotifyNewOrders: false,
      slackNotifyCallLogs: false,
      slackNotifyLowStock: false,
      slackNotifyInvoices: false,
      slackNotifyPayments: false,
      slackOrderTemplate: "",
      slackCallLogTemplate: "",
      slackLowStockTemplate: "",
      slackInvoiceTemplate: "",
      slackPaymentTemplate: "",
    },
  });

  // Fetch and set notification settings
  const { data: notificationSettingsData, isLoading: isNotificationLoading } = useQuery({
    queryKey: ["/api/settings/notifications"],
  });

  // Update form when data is loaded
  useEffect(() => {
    if (notificationSettingsData) {
      notificationForm.reset(notificationSettingsData);
    }
  }, [notificationSettingsData, notificationForm]);

  // Save notification settings
  const saveNotificationSettings = useMutation({
    mutationFn: async (values) => apiRequest("/api/settings/notifications", {
      method: "POST",
      body: JSON.stringify(values),
      headers: { "Content-Type": "application/json" },
    }),
    onSuccess: () => {
      toast({ title: "Settings saved", description: "Notification settings updated." });
      queryClient.invalidateQueries(["/api/settings/notifications"]);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save notification settings.", variant: "destructive" });
    },
  });

  // Language toggle
  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "en" ? "el" : "en");
  };

  // --- RENDER ---
  return (
    <Tabs defaultValue="notifications" className="w-full">
      <TabsList>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="company">Company</TabsTrigger>
        <TabsTrigger value="email">Email</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="system">System</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
        <TabsTrigger value="labels">Labels</TabsTrigger>
        <TabsTrigger value="images">Images</TabsTrigger>
      </TabsList>

      {/* --- NOTIFICATIONS TAB --- */}
      <TabsContent value="notifications" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Configure how and when you receive notifications</CardDescription>
          </CardHeader>
          <CardContent>
            {isNotificationLoading ? (
              <div className="text-center py-4">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
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
                    <h3 className="text-lg font-medium pt-4">Sound Notifications</h3>
                    <FormField
                      control={notificationForm.control}
                      name="soundEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Sound Alerts</FormLabel>
                            <FormDescription>
                              Enable sound notifications for alerts and updates
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
                    <h3 className="text-lg font-medium pt-4">Slack Integration</h3>
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
                        <FormField
                          control={notificationForm.control}
                          name="slackWebhookUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Main Webhook URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://hooks.slack.com/services/..." {...field} value={field.value || ''} className="font-mono text-xs" />
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
                              <FormLabel className="text-sm font-medium">Finance Webhook URL (Optional)</FormLabel>
                              <FormControl>
                                <Input placeholder="https://hooks.slack.com/services/..." {...field} value={field.value || ''} className="font-mono text-xs" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {/* Notification type toggles */}
                        <FormField
                          control={notificationForm.control}
                          name="slackNotifyNewOrders"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 rounded p-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">New Orders</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={notificationForm.control}
                          name="slackNotifyCallLogs"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 rounded p-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">Call Logs</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={notificationForm.control}
                          name="slackNotifyLowStock"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 rounded p-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">Low Stock</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={notificationForm.control}
                          name="slackNotifyInvoices"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 rounded p-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">Invoices</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={notificationForm.control}
                          name="slackNotifyPayments"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 rounded p-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">Payments</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                  {/* Template Customization */}
                  <div className="space-y-4">
                    <h4 className="text-md font-semibold">Customize Notification Templates</h4>
                    {/* Accordion for templates */}
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button type="submit" onClick={notificationForm.handleSubmit((data) => saveNotificationSettings.mutate(data))}>
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

      {/* --- COMPANY TAB --- */}
      <TabsContent value="company" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Update your company details and contact information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-slate-500">
              Company settings will be implemented in a future update.
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* --- EMAIL TAB --- */}
      <TabsContent value="email" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Email Settings</CardTitle>
            <CardDescription>Configure email server settings for notifications and alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-slate-500">
              Email settings will be implemented in a future update.
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* --- USERS TAB --- */}
      <TabsContent value="users" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage system users and their permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-slate-500">
              User management will be implemented in a future update.
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* --- SYSTEM TAB --- */}
      <TabsContent value="system" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
            <CardDescription>System configuration and language preferences</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium">Language</h3>
                  <p className="text-sm text-slate-500">Choose your preferred language</p>
                </div>
                <Button onClick={toggleLanguage} variant="outline">
                  Current: {i18n.language === "en" ? "English" : "Greek"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* --- PERFORMANCE TAB --- */}
      <TabsContent value="performance" className="mt-4">
        <HealthCheck />
        <BundleAnalyzer />
        <PerformanceAnalyzer />
        <DatabasePerformanceAnalyzer />
      </TabsContent>

      {/* --- LABELS TAB --- */}
      <TabsContent value="labels" className="mt-4">
        <LabelTemplateEditorComponent />
      </TabsContent>

      {/* --- IMAGES TAB --- */}
      <TabsContent value="images" className="mt-4">
        <ImageMigration />
      </TabsContent>
    </Tabs>
  );
};

export default Settings;