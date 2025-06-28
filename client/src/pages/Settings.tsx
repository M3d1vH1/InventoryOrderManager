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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { UserManagement } from "@/components/settings/UserManagement";
import { TemplateEditor } from "@/components/settings/TemplateEditor";
import RBACDisplay from "@/components/settings/RBACDisplay";
import { AuditTrail } from "@/components/settings/AuditTrail";
import { Save, Volume2 } from "lucide-react";

// --- SCHEMAS ---
const companySettingsSchema = z.object({
  companyName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  address: z.string().min(5),
});

const notificationSettingsSchema = z.object({
  lowStockAlerts: z.boolean().default(false),
  orderConfirmation: z.boolean().default(false),
  shippingUpdates: z.boolean().default(false),
  dailyReports: z.boolean().default(false),
  weeklyReports: z.boolean().default(false),
  soundEnabled: z.boolean().default(false),
  invoiceAlerts: z.boolean().default(false),
  paymentAlerts: z.boolean().default(false),
  overdueInvoiceAlerts: z.boolean().default(false),
  slackEnabled: z.boolean().default(false),
  slackWebhookUrl: z.string().nullable().default(null),
  slackFinanceWebhookUrl: z.string().nullable().default(null),
  slackNotifyNewOrders: z.boolean().default(false),
  slackNotifyOrderPicked: z.boolean().default(false),
  slackNotifyOrderShipped: z.boolean().default(false),
  slackNotifyCallLogs: z.boolean().default(false),
  slackNotifyLowStock: z.boolean().default(false),
  slackNotifyInvoices: z.boolean().default(false),
  slackNotifyPayments: z.boolean().default(false),
  dailyReportEnabled: z.boolean().default(false),
  dailyReportTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:mm format").default('17:30'),
  dailyReportWebhookUrl: z.string().nullable().default(null),
  
  // Daily report customization
  dailyReportTitle: z.string().min(1).default('Daily Operations Report'),
  dailyReportIncludeMetrics: z.boolean().default(true),
  dailyReportIncludeOutstanding: z.boolean().default(true),
  dailyReportMaxOutstanding: z.number().int().min(1).max(50).default(10),
  dailyReportIncludeLink: z.boolean().default(true),
  dailyReportFormat: z.enum(['detailed', 'summary', 'metrics_only']).default('detailed'),
  dailyReportDaysOfWeek: z.string().default('1,2,3,4,5'),
  dailyReportTemplate: z.string().nullable().default(null),
  slackOrderTemplate: z.string().nullable().default(null),
  slackCallLogTemplate: z.string().nullable().default(null),
  slackLowStockTemplate: z.string().nullable().default(null),
  slackInvoiceTemplate: z.string().nullable().default(null),
  slackPaymentTemplate: z.string().nullable().default(null),
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
      slackNotifyOrderPicked: false,
      slackNotifyOrderShipped: false,
      slackNotifyCallLogs: false,
      slackNotifyLowStock: false,
      slackNotifyInvoices: false,
      slackNotifyPayments: false,
      dailyReportEnabled: false,
      dailyReportTime: "17:30",
      dailyReportWebhookUrl: "",
      
      // Daily report customization
      dailyReportTitle: "Daily Operations Report",
      dailyReportIncludeMetrics: true,
      dailyReportIncludeOutstanding: true,
      dailyReportMaxOutstanding: 10,
      dailyReportIncludeLink: true,
      dailyReportFormat: "detailed" as const,
      dailyReportDaysOfWeek: "1,2,3,4,5",
      dailyReportTemplate: "",
      slackOrderTemplate: "",
      slackOrderPickedTemplate: "",
      slackOrderShippedTemplate: "",
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
      // Convert null values to empty strings for the form
      const formData = {
        ...notificationSettingsData,
        slackOrderTemplate: notificationSettingsData.slackOrderTemplate || "",
        slackOrderPickedTemplate: notificationSettingsData.slackOrderPickedTemplate || "",
        slackOrderShippedTemplate: notificationSettingsData.slackOrderShippedTemplate || "",
        slackCallLogTemplate: notificationSettingsData.slackCallLogTemplate || "",
        slackLowStockTemplate: notificationSettingsData.slackLowStockTemplate || "",
        slackInvoiceTemplate: notificationSettingsData.slackInvoiceTemplate || "",
        slackPaymentTemplate: notificationSettingsData.slackPaymentTemplate || "",
        dailyReportEnabled: notificationSettingsData.dailyReportEnabled || false,
        dailyReportTime: notificationSettingsData.dailyReportTime || "17:30",
        dailyReportWebhookUrl: notificationSettingsData.dailyReportWebhookUrl || "",
      };
      notificationForm.reset(formData);
    }
  }, [notificationSettingsData, notificationForm]);

  // Save notification settings
  const saveNotificationSettings = useMutation({
    mutationFn: async (values: z.infer<typeof notificationSettingsSchema>) => {
      console.log("Saving notification settings:", values);
      
      // Convert empty strings back to null for storage
      const processedValues = {
        ...values,
        slackOrderTemplate: values.slackOrderTemplate || null,
        slackOrderPickedTemplate: values.slackOrderPickedTemplate || null,
        slackOrderShippedTemplate: values.slackOrderShippedTemplate || null,
        slackCallLogTemplate: values.slackCallLogTemplate || null,
        slackLowStockTemplate: values.slackLowStockTemplate || null,
        slackInvoiceTemplate: values.slackInvoiceTemplate || null,
        slackPaymentTemplate: values.slackPaymentTemplate || null,
        dailyReportWebhookUrl: values.dailyReportWebhookUrl || null,
      };
      
      try {
        const response = await fetch("/api/settings/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(processedValues),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        return data;
      } catch (error) {
        console.error("Network or parsing error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("Settings saved successfully:", data);
      toast({ title: "Settings saved", description: "Notification settings updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/notifications"] });
    },
    onError: (error: any) => {
      console.error("Settings save error:", error);
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to save notification settings.", 
        variant: "destructive" 
      });
    },
  });

  // Test webhook functionality
  const testWebhook = useMutation({
    mutationFn: async ({ webhookUrl, isFinance }: { webhookUrl: string; isFinance?: boolean }) => {
      const response = await fetch("/api/settings/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          webhookUrl, 
          testMessage: isFinance ? "Finance webhook test" : "General webhook test" 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Webhook test successful!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Webhook Test Failed", 
        description: error?.message || "Failed to send test message.", 
        variant: "destructive" 
      });
    },
  });

  // Test daily report functionality
  const testDailyReport = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/settings/test-daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Daily report test sent successfully!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Daily Report Test Failed", 
        description: error?.message || "Failed to send test daily report.", 
        variant: "destructive" 
      });
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
        <TabsTrigger value="rbac">RBAC</TabsTrigger>
        <TabsTrigger value="audit">Audit Trail</TabsTrigger>
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
                          name="slackNotifyOrderPicked"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 rounded p-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">Order Picked</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={notificationForm.control}
                          name="slackNotifyOrderShipped"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 rounded p-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="text-sm font-normal">Order Shipped</FormLabel>
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

                  {/* Daily Report Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h4 className="text-lg font-semibold">Daily Operations Report</h4>
                        <p className="text-sm text-muted-foreground">
                          Send daily summary of new orders, picked orders, shipped orders, and outstanding orders to Slack
                        </p>
                      </div>
                      <FormField
                        control={notificationForm.control}
                        name="dailyReportEnabled"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={notificationForm.watch("dailyReportEnabled")}
                                onCheckedChange={(checked) => {
                                  notificationForm.setValue("dailyReportEnabled", checked);
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    {notificationForm.watch("dailyReportEnabled") && (
                      <div className="space-y-6 ml-4 pl-4 border-l-2 border-gray-200">
                        {/* Basic Configuration */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={notificationForm.control}
                            name="dailyReportTime"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Report Time</FormLabel>
                                <FormControl>
                                  <input
                                    type="time"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    {...field}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Time to send daily reports (24-hour format, default: 17:30)
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={notificationForm.control}
                            name="dailyReportWebhookUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Daily Report Slack Webhook URL</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="https://hooks.slack.com/services/... (optional)"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Separate webhook URL for daily reports. If not provided, uses main Slack webhook above.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Report Customization */}
                        <div className="space-y-4">
                          <h5 className="text-sm font-semibold text-gray-700">Report Customization</h5>
                          
                          <FormField
                            control={notificationForm.control}
                            name="dailyReportTitle"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Report Title</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="Daily Operations Report"
                                  />
                                </FormControl>
                                <FormDescription>
                                  Custom title for your daily reports
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={notificationForm.control}
                            name="dailyReportFormat"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Report Format</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select report format" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="detailed">Detailed - Full metrics and order lists</SelectItem>
                                    <SelectItem value="summary">Summary - Key metrics only</SelectItem>
                                    <SelectItem value="metrics_only">Metrics Only - Numbers without lists</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormDescription>
                                  Choose the level of detail for your reports
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                              control={notificationForm.control}
                              name="dailyReportIncludeMetrics"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-sm">Include Metrics</FormLabel>
                                    <FormDescription className="text-xs">
                                      Show order counts and statistics
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
                              control={notificationForm.control}
                              name="dailyReportIncludeOutstanding"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-sm">Outstanding Orders</FormLabel>
                                    <FormDescription className="text-xs">
                                      Show list of pending orders
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
                              control={notificationForm.control}
                              name="dailyReportIncludeLink"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                  <div className="space-y-0.5">
                                    <FormLabel className="text-sm">Dashboard Link</FormLabel>
                                    <FormDescription className="text-xs">
                                      Include link to dashboard
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
                          </div>

                          {notificationForm.watch("dailyReportIncludeOutstanding") && (
                            <FormField
                              control={notificationForm.control}
                              name="dailyReportMaxOutstanding"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Max Outstanding Orders to Show</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="1"
                                      max="50"
                                      {...field}
                                      onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                                    />
                                  </FormControl>
                                  <FormDescription>
                                    Maximum number of outstanding orders to display (1-50)
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {/* Days of Week Selection */}
                          <FormField
                            control={notificationForm.control}
                            name="dailyReportDaysOfWeek"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Report Days</FormLabel>
                                <FormDescription>
                                  Select which days to send reports
                                </FormDescription>
                                <FormControl>
                                  <div className="flex flex-wrap gap-2">
                                    {[
                                      { value: '1', label: 'Mon' },
                                      { value: '2', label: 'Tue' },
                                      { value: '3', label: 'Wed' },
                                      { value: '4', label: 'Thu' },
                                      { value: '5', label: 'Fri' },
                                      { value: '6', label: 'Sat' },
                                      { value: '0', label: 'Sun' }
                                    ].map((day) => {
                                      const selectedDays = field.value?.split(',') || [];
                                      const isSelected = selectedDays.includes(day.value);
                                      
                                      return (
                                        <Button
                                          key={day.value}
                                          type="button"
                                          variant={isSelected ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => {
                                            const currentDays = field.value?.split(',').filter(Boolean) || [];
                                            let newDays;
                                            if (isSelected) {
                                              newDays = currentDays.filter(d => d !== day.value);
                                            } else {
                                              newDays = [...currentDays, day.value];
                                            }
                                            field.onChange(newDays.join(','));
                                          }}
                                        >
                                          {day.label}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Custom Template */}
                          <FormField
                            control={notificationForm.control}
                            name="dailyReportTemplate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Custom Template (Optional)</FormLabel>
                                <FormControl>
                                  <textarea
                                    className="w-full min-h-[100px] p-3 border rounded-md resize-vertical"
                                    placeholder="Custom message template using variables: {title}, {date}, {newOrders}, {pickedOrders}, {shippedOrders}, {outstandingOrders}, {outstandingList}, {dashboardUrl}"
                                    value={field.value || ""}
                                    onChange={(e) => field.onChange(e.target.value || null)}
                                  />
                                </FormControl>
                                <FormDescription>
                                  Advanced: Customize the entire report format with variables
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Template Customization */}
                  {notificationForm.watch("slackEnabled") && (
                    <div className="space-y-4">
                      <h4 className="text-md font-semibold">Customize Notification Templates</h4>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="order-template">
                          <AccordionTrigger>Order Notifications</AccordionTrigger>
                          <AccordionContent>
                            <TemplateEditor
                              title="Order Notification Template"
                              description="Customize the message sent when new orders are created"
                              value={notificationForm.watch("slackOrderTemplate") || ""}
                              onChange={(value) => notificationForm.setValue("slackOrderTemplate", value)}
                              variables={["orderNumber", "customerName", "totalAmount", "status", "priority", "notes"]}
                              placeholder="New order #{orderNumber} from {customerName} - Total: {totalAmount}"
                            />
                          </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="invoice-template">
                          <AccordionTrigger>Invoice Notifications</AccordionTrigger>
                          <AccordionContent>
                            <TemplateEditor
                              title="Invoice Notification Template"
                              description="Customize the message sent when new supplier invoices are received"
                              value={notificationForm.watch("slackInvoiceTemplate") || ""}
                              onChange={(value) => notificationForm.setValue("slackInvoiceTemplate", value)}
                              variables={["invoiceNumber", "supplierName", "amount", "dueDate", "description", "status"]}
                              placeholder="New invoice #{invoiceNumber} from {supplierName} - Amount: {amount} - Due: {dueDate}"
                            />
                          </AccordionContent>
                        </AccordionItem>
                        
                        <AccordionItem value="payment-template">
                          <AccordionTrigger>Payment Notifications</AccordionTrigger>
                          <AccordionContent>
                            <TemplateEditor
                              title="Payment Notification Template"
                              description="Customize the message sent when payments are made to suppliers"
                              value={notificationForm.watch("slackPaymentTemplate") || ""}
                              onChange={(value) => notificationForm.setValue("slackPaymentTemplate", value)}
                              variables={["amount", "supplierName", "paymentMethod", "reference", "invoiceNumber", "date"]}
                              placeholder="Payment of {amount} made to {supplierName} - Method: {paymentMethod} - Ref: {reference}"
                            />
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  )}
                  <div className="flex gap-2 justify-end mt-6">
                    <Button 
                      type="submit" 
                      disabled={saveNotificationSettings.isPending}
                      onClick={notificationForm.handleSubmit((data) => saveNotificationSettings.mutate(data))}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saveNotificationSettings.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    
                    {notificationForm.watch("slackWebhookUrl") && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={testWebhook.isPending}
                        onClick={() => testWebhook.mutate({ 
                          webhookUrl: notificationForm.getValues("slackWebhookUrl") 
                        })}
                      >
                        {testWebhook.isPending ? "Testing..." : "Test Main"}
                      </Button>
                    )}
                    
                    {notificationForm.watch("slackFinanceWebhookUrl") && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={testWebhook.isPending}
                        onClick={() => testWebhook.mutate({ 
                          webhookUrl: notificationForm.getValues("slackFinanceWebhookUrl"),
                          isFinance: true
                        })}
                      >
                        {testWebhook.isPending ? "Testing..." : "Test Finance"}
                      </Button>
                    )}
                    
                    {notificationForm.watch("dailyReportEnabled") && notificationForm.watch("dailyReportWebhookUrl") && (
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={testDailyReport.isPending}
                        onClick={() => testDailyReport.mutate()}
                      >
                        {testDailyReport.isPending ? "Testing..." : "Test Daily Report"}
                      </Button>
                    )}
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

      {/* --- RBAC TAB --- */}
      <TabsContent value="rbac" className="mt-4">
        <RBACDisplay />
      </TabsContent>

      {/* --- AUDIT TRAIL TAB --- */}
      <TabsContent value="audit" className="mt-4">
        <AuditTrail />
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