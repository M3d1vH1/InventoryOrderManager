import { useEffect } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

const generalSettingsSchema = z.object({
  companyName: z.string().min(2, { message: "Company name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  phone: z.string().min(10, { message: "Please enter a valid phone number" }),
  address: z.string().min(5, { message: "Address must be at least 5 characters" }),
});

const notificationSettingsSchema = z.object({
  lowStockAlerts: z.boolean(),
  orderConfirmation: z.boolean(),
  shippingUpdates: z.boolean(),
  dailyReports: z.boolean(),
  weeklyReports: z.boolean(),
});

const Settings = () => {
  const { setCurrentPage } = useSidebar();
  const { toast } = useToast();

  useEffect(() => {
    setCurrentPage("Settings");
  }, [setCurrentPage]);

  const generalForm = useForm<z.infer<typeof generalSettingsSchema>>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      companyName: "Warehouse Pro",
      email: "info@warehousepro.example",
      phone: "555-123-4567",
      address: "123 Main St, Suite 100, Anytown USA 12345",
    },
  });

  const notificationForm = useForm<z.infer<typeof notificationSettingsSchema>>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      lowStockAlerts: true,
      orderConfirmation: true,
      shippingUpdates: true,
      dailyReports: false,
      weeklyReports: true,
    },
  });

  const onGeneralSubmit = (values: z.infer<typeof generalSettingsSchema>) => {
    toast({
      title: "Settings updated",
      description: "Your general settings have been updated successfully.",
    });
    console.log(values);
  };

  const onNotificationSubmit = (values: z.infer<typeof notificationSettingsSchema>) => {
    toast({
      title: "Notification preferences updated",
      description: "Your notification preferences have been updated successfully.",
    });
    console.log(values);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="users">Users & Permissions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Manage your company information and system settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...generalForm}>
                <form onSubmit={generalForm.handleSubmit(onGeneralSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={generalForm.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={generalForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={generalForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={generalForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div>
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              </Form>
              
              <Separator className="my-6" />
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">System Preferences</h3>
                
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Low Stock Threshold Percentage</h4>
                      <p className="text-sm text-slate-500">Set the default percentage for low stock alerts</p>
                    </div>
                    <Input
                      type="number"
                      className="w-24"
                      min={1}
                      max={100}
                      defaultValue={20}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Default Order Status</h4>
                      <p className="text-sm text-slate-500">Set the default status for new orders</p>
                    </div>
                    <select className="w-40 rounded-md border border-slate-300 py-2 px-3">
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Enable Barcode Scanning</h4>
                      <p className="text-sm text-slate-500">Allow warehouse staff to use barcode scanners</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Manage your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...notificationForm}>
                <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Email Notifications</h3>
                    
                    <FormField
                      control={notificationForm.control}
                      name="lowStockAlerts"
                      render={({ field }) => (
                        <FormItem className="flex justify-between items-center">
                          <div>
                            <FormLabel>Low Stock Alerts</FormLabel>
                            <FormDescription>
                              Receive alerts when items fall below minimum stock level
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
                      name="orderConfirmation"
                      render={({ field }) => (
                        <FormItem className="flex justify-between items-center">
                          <div>
                            <FormLabel>Order Confirmations</FormLabel>
                            <FormDescription>
                              Receive notifications when new orders are placed
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
                      name="shippingUpdates"
                      render={({ field }) => (
                        <FormItem className="flex justify-between items-center">
                          <div>
                            <FormLabel>Shipping Updates</FormLabel>
                            <FormDescription>
                              Receive notifications when orders are shipped
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
                  
                  <Separator />
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Report Scheduling</h3>
                    
                    <FormField
                      control={notificationForm.control}
                      name="dailyReports"
                      render={({ field }) => (
                        <FormItem className="flex justify-between items-center">
                          <div>
                            <FormLabel>Daily Reports</FormLabel>
                            <FormDescription>
                              Receive daily inventory and order reports
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
                      name="weeklyReports"
                      render={({ field }) => (
                        <FormItem className="flex justify-between items-center">
                          <div>
                            <FormLabel>Weekly Reports</FormLabel>
                            <FormDescription>
                              Receive weekly summary reports
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
                  
                  <div>
                    <Button type="submit">Save Preferences</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Users & Permissions</CardTitle>
              <CardDescription>
                Manage users and their access to the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">System Users</h3>
                  <Button size="sm">
                    <i className="fas fa-plus mr-2"></i>
                    Add User
                  </Button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="py-3 px-4 text-left text-sm font-medium text-slate-600">Name</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-slate-600">Email</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-slate-600">Role</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-slate-600">Status</th>
                        <th className="py-3 px-4 text-left text-sm font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="py-3 px-4">John Smith</td>
                        <td className="py-3 px-4">john@example.com</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Admin
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <button className="text-slate-600 hover:text-primary">
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className="text-slate-600 hover:text-red-500">
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4">Sarah Johnson</td>
                        <td className="py-3 px-4">sarah@example.com</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Manager
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <button className="text-slate-600 hover:text-primary">
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className="text-slate-600 hover:text-red-500">
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4">Robert Lee</td>
                        <td className="py-3 px-4">robert@example.com</td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                            Staff
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                            Inactive
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <button className="text-slate-600 hover:text-primary">
                              <i className="fas fa-edit"></i>
                            </button>
                            <button className="text-slate-600 hover:text-red-500">
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Role Permissions</h3>
                  
                  <Card className="border border-slate-200">
                    <CardHeader className="px-4 py-3">
                      <CardTitle className="text-base">Admin</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 py-3 pt-0">
                      <p className="text-sm text-slate-500 mb-2">Full access to all system features and settings</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Dashboard</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Products</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Orders</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Inventory</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Reports</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Settings</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Users</span>
                      </div>
                    </CardContent>
                    <CardFooter className="px-4 py-3 border-t border-slate-200 flex justify-end">
                      <Button size="sm" variant="outline">Edit Role</Button>
                    </CardFooter>
                  </Card>
                  
                  <Card className="border border-slate-200">
                    <CardHeader className="px-4 py-3">
                      <CardTitle className="text-base">Manager</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 py-3 pt-0">
                      <p className="text-sm text-slate-500 mb-2">Access to manage inventory and orders, view reports</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Dashboard</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Products</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Orders</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Inventory</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Reports</span>
                      </div>
                    </CardContent>
                    <CardFooter className="px-4 py-3 border-t border-slate-200 flex justify-end">
                      <Button size="sm" variant="outline">Edit Role</Button>
                    </CardFooter>
                  </Card>
                  
                  <Card className="border border-slate-200">
                    <CardHeader className="px-4 py-3">
                      <CardTitle className="text-base">Staff</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 py-3 pt-0">
                      <p className="text-sm text-slate-500 mb-2">Limited access to process orders and update inventory</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Dashboard</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Orders</span>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Inventory</span>
                      </div>
                    </CardContent>
                    <CardFooter className="px-4 py-3 border-t border-slate-200 flex justify-end">
                      <Button size="sm" variant="outline">Edit Role</Button>
                    </CardFooter>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;