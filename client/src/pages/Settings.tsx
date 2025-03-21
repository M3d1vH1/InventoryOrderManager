import { useState, useEffect } from 'react';
import { Form } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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
import { AlertCircle, Bell, Cog, Edit, HelpCircle, Mail, Plus, Printer, Save, Send, Tag, Trash2, UserCog, Variable, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

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
});

// Email settings schema
const emailSettingsSchema = z.object({
  host: z.string().min(1, { message: "SMTP host is required" }),
  port: z.coerce.number().int().positive({ message: "Port must be a positive number" }),
  secure: z.boolean().default(false),
  authUser: z.string().min(1, { message: "Username is required" }),
  authPass: z.string().optional().refine(val => {
    // For new settings, password is required
    // For updates, empty password means "keep existing password"
    return true;
  }),
  fromEmail: z.string().email({ message: "Valid email address is required" }),
  companyName: z.string().min(1, { message: "Company name is required" }),
  enableNotifications: z.boolean().default(true),
});

// Email test schema
const emailTestSchema = z.object({
  testEmail: z.string().email({ message: "Valid test email address is required" }),
});

// Template edit schema
const templateEditSchema = z.object({
  content: z.string().min(1, { message: "Template content is required" }),
});

// User form schema
const userFormSchema = z.object({
  username: z.string().min(3, { message: "Username must be at least 3 characters" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }).optional(),
  fullName: z.string().min(2, { message: "Full name is required" }),
  role: z.enum(['admin', 'front_office', 'warehouse']),
  email: z.string().email({ message: "Invalid email address" }).optional().or(z.literal('')),
  active: z.boolean().default(true),
});

type UserType = {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'front_office' | 'warehouse';
  email: string | null;
  active: boolean;
  createdAt: string;
  lastLogin: string | null;
};

// User Management Component
const UserManagement = () => {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);

  // User form with default values
  const userForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: '',
      password: '',
      fullName: '',
      role: 'front_office',
      email: '',
      active: true,
    },
  });

  // Query to fetch users
  const { data: users, isLoading, error } = useQuery<UserType[]>({
    queryKey: ['/api/users']
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (values: z.infer<typeof userFormSchema>) => {
      return apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      toast({
        title: "User Created",
        description: "The user has been created successfully.",
      });
      setIsCreateDialogOpen(false);
      userForm.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create user. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: z.infer<typeof userFormSchema> }) => {
      return apiRequest(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      toast({
        title: "User Updated",
        description: "The user has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update user. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/users/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: "The user has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete user. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });

  // Handler for creating a new user
  const handleCreateUser = (values: z.infer<typeof userFormSchema>) => {
    createUserMutation.mutate(values);
  };

  // Handler for editing a user
  const handleEditUser = (user: UserType) => {
    setSelectedUser(user);
    userForm.reset({
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      email: user.email || '',
      active: user.active,
      password: '', // Don't include password in edit form
    });
    setIsEditDialogOpen(true);
  };

  // Handler for updating a user
  const handleUpdateUser = (values: z.infer<typeof userFormSchema>) => {
    if (selectedUser) {
      // Remove password if it's empty string
      if (values.password === '') {
        const { password, ...dataWithoutPassword } = values;
        updateUserMutation.mutate({ id: selectedUser.id, values: dataWithoutPassword });
      } else {
        updateUserMutation.mutate({ id: selectedUser.id, values });
      }
    }
  };

  // Handler for deleting a user
  const handleDeleteUser = (user: UserType) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  // Handler for confirming user deletion
  const confirmDeleteUser = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  // Helper to get role display name and color
  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'admin':
        return { name: 'Admin', bgColor: 'bg-blue-100', textColor: 'text-blue-800' };
      case 'front_office':
        return { name: 'Front Office', bgColor: 'bg-purple-100', textColor: 'text-purple-800' };
      case 'warehouse':
        return { name: 'Warehouse', bgColor: 'bg-amber-100', textColor: 'text-amber-800' };
      default:
        return { name: role, bgColor: 'bg-slate-100', textColor: 'text-slate-800' };
    }
  };

  // If user doesn't have admin permission
  if (!hasPermission(['admin'])) {
    return (
      <div className="text-center p-6 space-y-2">
        <UserCog size={48} className="mx-auto text-slate-400" />
        <h3 className="text-lg font-medium">Admin Access Required</h3>
        <p className="text-slate-500">You need administrator privileges to manage users</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">System Users</h3>
        <Button 
          size="sm" 
          onClick={() => {
            userForm.reset({
              username: '',
              password: '',
              fullName: '',
              role: 'front_office',
              email: '',
              active: true,
            });
            setIsCreateDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>
      
      {isLoading ? (
        <div className="text-center p-6">Loading users...</div>
      ) : error ? (
        <div className="text-center p-6 text-red-500">Error loading users</div>
      ) : users && users.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-600">Name</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-600">Username</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-600">Email</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-600">Role</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-600">Status</th>
                <th className="py-3 px-4 text-left text-sm font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((user) => {
                const roleDisplay = getRoleDisplay(user.role);
                return (
                  <tr key={user.id}>
                    <td className="py-3 px-4">{user.fullName}</td>
                    <td className="py-3 px-4">{user.username}</td>
                    <td className="py-3 px-4">{user.email || "-"}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleDisplay.bgColor} ${roleDisplay.textColor}`}>
                        {roleDisplay.name}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user)} 
                                disabled={user.username === 'admin'} 
                                className={user.username === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center p-6">No users found</div>
      )}

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system with specific role and permissions.
            </DialogDescription>
          </DialogHeader>
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(handleCreateUser)} className="space-y-4">
              <FormField
                control={userForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="front_office">Front Office</SelectItem>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        User can log in when active
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
              <DialogFooter>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions.
            </DialogDescription>
          </DialogHeader>
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(handleUpdateUser)} className="space-y-4">
              <FormField
                control={userForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        disabled={selectedUser?.username === 'admin'}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Leave empty to keep current password" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Leave empty to keep the current password
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={selectedUser?.username === 'admin'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="front_office">Front Office</SelectItem>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>
                        User can log in when active
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={selectedUser?.username === 'admin'}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? "Updating..." : "Update User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user {selectedUser?.fullName}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Settings = () => {
  const { toast } = useToast();
  const { playNotificationSound } = useNotifications();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [isTestEmailDialogOpen, setIsTestEmailDialogOpen] = useState(false);

  // Email settings form
  const emailForm = useForm<z.infer<typeof emailSettingsSchema>>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      authUser: '',
      authPass: '',
      fromEmail: '',
      companyName: 'Warehouse Management System',
      enableNotifications: true,
    }
  });
  
  // Define email settings interface
  interface EmailSettingsData {
    id: number;
    host: string;
    port: number;
    secure: boolean;
    authUser: string;
    fromEmail: string;
    companyName: string;
    enableNotifications: boolean;
  }
  
  // Get current email settings query
  const { data: emailSettings, isLoading: isLoadingEmailSettings } = useQuery<EmailSettingsData>({
    queryKey: ['/api/email-settings'],
  });
  
  // Update form when settings are loaded
  useEffect(() => {
    if (emailSettings) {
      emailForm.reset({
        host: emailSettings.host || 'smtp.gmail.com',
        port: emailSettings.port || 587,
        secure: emailSettings.secure || false,
        authUser: emailSettings.authUser || '',
        authPass: '', // Never pre-fill password field for security
        fromEmail: emailSettings.fromEmail || '',
        companyName: emailSettings.companyName || 'Warehouse Management System',
        enableNotifications: emailSettings.enableNotifications ?? true,
      });
    }
  }, [emailSettings, emailForm]);

  // Test email form
  const testEmailForm = useForm<z.infer<typeof emailTestSchema>>({
    resolver: zodResolver(emailTestSchema),
    defaultValues: {
      testEmail: '',
    }
  });

  // Email settings mutation
  const emailSettingsMutation = useMutation({
    mutationFn: async (values: z.infer<typeof emailSettingsSchema>) => {
      console.log('Submitting email settings:', values);
      try {
        const result = await apiRequest('/api/email-settings', {
          method: 'PUT',
          body: JSON.stringify(values),
        });
        console.log('Email settings saved successfully:', result);
        return result;
      } catch (error) {
        console.error('Error saving email settings:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: "Email Settings Saved",
        description: "Your email settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/email-settings'] });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast({
        title: "Error",
        description: "Failed to save email settings. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async (values: z.infer<typeof emailTestSchema>) => {
      console.log('Sending test email to:', values.testEmail);
      
      // We've updated the API to only require the test email
      return apiRequest('/api/email-settings/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testEmail: values.testEmail,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: "A test email has been sent successfully.",
      });
      setIsTestEmailDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send test email. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });

  const openTestEmailDialog = () => {
    setIsTestEmailDialogOpen(true);
  };

  const handleTestEmail = (values: z.infer<typeof emailTestSchema>) => {
    testEmailMutation.mutate(values);
  };

  const onEmailSettingsSubmit = (values: z.infer<typeof emailSettingsSchema>) => {
    // If password is empty, remove it from the request to keep the existing password
    if (values.authPass === '') {
      const { authPass, ...valuesWithoutPassword } = values;
      emailSettingsMutation.mutate(valuesWithoutPassword);
    } else {
      emailSettingsMutation.mutate(values);
    }
  };

  // Define company settings interface
  interface CompanySettingsData {
    id: number;
    companyName: string;
    email: string;
    phone: string;
    address: string;
    logoPath?: string;
    createdAt: string;
    updatedAt: string;
  }
  
  // Define notification settings interface
  interface NotificationSettingsData {
    id: number;
    lowStockAlerts: boolean;
    orderConfirmation: boolean;
    shippingUpdates: boolean;
    dailyReports: boolean;
    weeklyReports: boolean;
    soundEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  }
  
  // Company settings query
  const { data: companySettingsData, isLoading: isCompanyLoading } = useQuery<CompanySettingsData>({
    queryKey: ['/api/company-settings']
  });
  
  // Company settings form
  const companyForm = useForm<z.infer<typeof companySettingsSchema>>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      companyName: "",
      email: "",
      phone: "",
      address: "",
    },
  });
  
  // Update company form when settings are loaded
  useEffect(() => {
    if (companySettingsData) {
      companyForm.reset({
        companyName: companySettingsData.companyName || '',
        email: companySettingsData.email || '',
        phone: companySettingsData.phone || '',
        address: companySettingsData.address || '',
      });
    }
  }, [companySettingsData, companyForm]);

  // Notification settings form
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

  // Company settings query removed - defined earlier

  // Company settings mutation
  const companyMutation = useMutation({
    mutationFn: async (values: z.infer<typeof companySettingsSchema>) => {
      return apiRequest('/api/company-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-settings'] });
      toast({
        title: "Settings Updated",
        description: "Company settings have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save company settings. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });

  // Handle company settings form submission
  const onCompanySubmit = (values: z.infer<typeof companySettingsSchema>) => {
    companyMutation.mutate(values);
  };

  // Notification settings query
  const { data: notificationSettingsData, isLoading: isNotificationLoading } = useQuery<NotificationSettingsData>({
    queryKey: ['/api/notification-settings']
  });
  
  // Update notification form when settings are loaded
  useEffect(() => {
    if (notificationSettingsData) {
      notificationForm.reset({
        lowStockAlerts: notificationSettingsData.lowStockAlerts || false,
        orderConfirmation: notificationSettingsData.orderConfirmation || false,
        shippingUpdates: notificationSettingsData.shippingUpdates || false,
        dailyReports: notificationSettingsData.dailyReports || false,
        weeklyReports: notificationSettingsData.weeklyReports || false,
      });
    }
  }, [notificationSettingsData, notificationForm]);

  // Notification settings mutation
  const notificationMutation = useMutation({
    mutationFn: async (values: z.infer<typeof notificationSettingsSchema>) => {
      return apiRequest('/api/notification-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-settings'] });
      toast({
        title: "Settings Updated",
        description: "Notification settings have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save notification settings. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });

  // Handle notification settings form submission
  const onNotificationSubmit = (values: z.infer<typeof notificationSettingsSchema>) => {
    notificationMutation.mutate(values);
  };

  // Helper function to send a test notification
  const sendTestNotification = (type: 'success' | 'warning' | 'error' = 'success') => {
    const messages = {
      success: "This is a test success notification.",
      warning: "This is a test warning notification.",
      error: "This is a test error notification.",
    };
    
    playNotificationSound(type);
    
    toast({
      title: "Test Notification",
      description: messages[type],
      variant: type === 'error' ? 'destructive' : 'default',
    });
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue="general" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="grid w-full grid-cols-5">
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
            Email Settings
          </TabsTrigger>
          <TabsTrigger value="labels">
            <Printer className="h-4 w-4 mr-2" />
            Label Templates
          </TabsTrigger>
          <TabsTrigger value="users">
            <UserCog className="h-4 w-4 mr-2" />
            Users & Permissions
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Update your company details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCompanyLoading ? (
                <div className="text-center py-4">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                  <p className="mt-2 text-sm text-slate-500">Loading company settings...</p>
                </div>
              ) : (
                <>
                  <Form {...companyForm}>
                    <form onSubmit={companyForm.handleSubmit(onCompanySubmit)} className="space-y-6">
                      <FormField
                        control={companyForm.control}
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
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={companyForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={companyForm.control}
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
                        control={companyForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end">
                        <Button type="submit">
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </Button>
                      </div>
                    </form>
                  </Form>
                  
                  <Separator className="my-6" />
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">System Information</h3>
                        <p className="text-sm text-slate-500">Details about your current installation</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-md">
                        <p className="text-sm font-medium">Software Version</p>
                        <p className="text-sm text-slate-500">1.0.0</p>
                      </div>
                      
                      <div className="p-4 bg-slate-50 rounded-md">
                        <p className="text-sm font-medium">Database</p>
                        <p className="text-sm text-slate-500">PostgreSQL</p>
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
                </>
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
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                  <p className="mt-2 text-sm text-slate-500">Loading notification settings...</p>
                </div>
              ) : (
                <>
                  <Form {...notificationForm}>
                    <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)} className="space-y-6">
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
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        
                        <h3 className="text-lg font-medium pt-4">Order Notifications</h3>
                        
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
                            <FormItem className="flex items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Shipping Updates</FormLabel>
                                <FormDescription>
                                  Receive notifications when order status changes
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
                    
                        <h3 className="text-lg font-medium pt-4">Reports</h3>
                        
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
                            <FormItem className="flex items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Weekly Reports</FormLabel>
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
                  
                  <div className="flex justify-end">
                    <Button type="submit">
                      <Save className="h-4 w-4 mr-2" />
                      Save Preferences
                    </Button>
                  </div>
                </form>
              </Form>
              
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
                </>
              )}
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
            <div className="mx-6 my-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mr-2" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Gmail Configuration Instructions</h3>
                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
                    <p>If using Gmail, you need to:</p>
                    <ol className="list-decimal ml-4 mt-1 space-y-1">
                      <li>Enable 2-Step Verification in your Google Account</li>
                      <li>Create an App Password (Google Account → Security → App Passwords)</li>
                      <li>Use your full Gmail address as Username and the generated App Password as Password</li>
                    </ol>
                    <p className="mt-1">Regular Gmail passwords won't work due to Google's security settings.</p>
                  </div>
                </div>
              </div>
            </div>
            <CardContent>
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onEmailSettingsSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">SMTP Server Configuration</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              Your email server address
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
                            <FormLabel>SMTP Port</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="587" type="number" />
                            </FormControl>
                            <FormDescription>
                              Usually 587 (TLS) or 465 (SSL)
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
                            <FormLabel className="text-base">Use Secure Connection (SSL)</FormLabel>
                            <FormDescription>
                              Enable for port 465, disable for port 587
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
                    
                    <h3 className="text-lg font-medium pt-4">Authentication</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                              For Gmail, use an app password
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <h3 className="text-lg font-medium pt-4">Sender Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={emailForm.control}
                        name="fromEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>From Email</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="warehouse@yourcompany.com" />
                            </FormControl>
                            <FormDescription>
                              The email address to send from
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
                              Will appear as the sender name
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
                              Turn on or off all email notifications
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
                  
                  <div className="flex justify-between">
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={openTestEmailDialog}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Test Connection
                    </Button>
                    
                    <Button type="submit" disabled={emailSettingsMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      {emailSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                  </div>
                </form>
              </Form>
              
              <Dialog open={isTestEmailDialogOpen} onOpenChange={setIsTestEmailDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Test Email Connection</DialogTitle>
                    <DialogDescription>
                      Send a test email to verify your configuration
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...testEmailForm}>
                    <form onSubmit={testEmailForm.handleSubmit(handleTestEmail)} className="space-y-4">
                      <FormField
                        control={testEmailForm.control}
                        name="testEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Test Email Address</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="your@email.com" />
                            </FormControl>
                            <FormDescription>
                              Where to send the test email
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button 
                          type="submit" 
                          disabled={testEmailMutation.isPending}
                        >
                          {testEmailMutation.isPending ? "Sending..." : "Send Test Email"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
          
          {/* Email Templates Card */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Email Templates</CardTitle>
              <CardDescription>
                Customize the email notifications sent by the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailTemplateEditor />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="labels" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Shipping Label Templates</CardTitle>
              <CardDescription>
                Customize shipping label templates for the CAB EOS1 printer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-muted-foreground">Configure label templates for your printer. These templates will be used when printing shipping labels.</p>
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertTitle className="flex items-center text-yellow-800">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Template for CAB EOS1 Printer
                  </AlertTitle>
                  <AlertDescription className="text-yellow-800">
                    The templates are configured specifically for the CAB EOS1 printer using JScript programming language.
                  </AlertDescription>
                </Alert>
                
                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-base font-medium">Shipping Label</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="mb-2 text-sm text-muted-foreground">This template is used for standard shipping labels.</p>
                    <Button variant="outline" onClick={() => setActiveTab('shipping-label-editor')}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Template
                    </Button>
                  </CardContent>
                </Card>
              </div>
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
              <UserManagement />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="help" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Help & Support</CardTitle>
              <CardDescription>
                Get help and support for using the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Documentation
                      </CardTitle>
                      <HelpCircle className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm">
                        <p>Access the complete system documentation</p>
                        <Button variant="link" className="p-0 h-auto mt-2">
                          View Documentation
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Support
                      </CardTitle>
                      <HelpCircle className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm">
                        <p>Contact our support team for assistance</p>
                        <Button variant="link" className="p-0 h-auto mt-2">
                          Contact Support
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Frequently Asked Questions</h3>
                  
                  <div className="space-y-4">
                    <div className="border rounded-md p-4">
                      <h4 className="font-medium">How do I create a new order?</h4>
                      <p className="text-sm text-slate-500 mt-1">
                        Navigate to the Orders page and click on the "Create Order" button. 
                        Fill in the required information and click "Save".
                      </p>
                    </div>
                    
                    <div className="border rounded-md p-4">
                      <h4 className="font-medium">How can I update product inventory?</h4>
                      <p className="text-sm text-slate-500 mt-1">
                        Go to the Products page, find the product you want to update, 
                        and click the edit button. Update the current stock and save changes.
                      </p>
                    </div>
                    
                    <div className="border rounded-md p-4">
                      <h4 className="font-medium">Can I export reports?</h4>
                      <p className="text-sm text-slate-500 mt-1">
                        Yes, on the Reports page you can export data in various formats 
                        including CSV, Excel, and PDF.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Label Template Editor Component
const LabelTemplateEditor = () => {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState('shipping-label');
  const [isEditing, setIsEditing] = useState(false);
  const [showVariableHelp, setShowVariableHelp] = useState(false);
  
  // Template form
  const templateForm = useForm<z.infer<typeof templateEditSchema>>({
    resolver: zodResolver(templateEditSchema),
    defaultValues: {
      content: '',
    }
  });
  
  // Get template content query
  const { data: labelTemplateData, isLoading: isLoadingLabelTemplate, refetch: refetchTemplate } = useQuery({
    queryKey: ['/api/label-templates', selectedTemplate],
    enabled: !!selectedTemplate,
    queryFn: async () => {
      const response = await apiRequest(`/api/label-templates/${selectedTemplate}`, {
        method: 'GET',
      });
      return response;
    }
  });
  
  // Effect to update form when template data changes
  useEffect(() => {
    if (templateData && templateData.content) {
      templateForm.reset({
        content: templateData.content,
      });
    }
  }, [templateData, templateForm]);
  
  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof templateEditSchema>) => {
      return apiRequest(`/api/label-templates/${selectedTemplate}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      toast({
        title: "Template Updated",
        description: "The label template has been updated successfully.",
      });
      setIsEditing(false);
      refetchTemplate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update template. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });
  
  // Template selection options
  const templateOptions = [
    { value: 'shipping-label', label: 'Standard Shipping Label' },
    // Add more templates as needed
  ];
  
  // Available variables for templates
  const availableVariables = [
    { name: "orderNumber", description: "Order number/ID" },
    { name: "customerName", description: "Customer's full name" },
    { name: "customerAddress", description: "Customer's full address" },
    { name: "customerCity", description: "Customer's city" },
    { name: "customerState", description: "Customer's state/province" },
    { name: "customerPostalCode", description: "Customer's postal code" },
    { name: "customerCountry", description: "Customer's country" },
    { name: "shippingCompany", description: "Name of shipping company used" },
    { name: "trackingNumber", description: "Shipping tracking number (if available)" },
    { name: "items", description: "List of order items (use with {{#each items}})" },
    { name: "this.name", description: "Product name (use inside {{#each items}})" },
    { name: "this.quantity", description: "Product quantity (use inside {{#each items}})" },
    { name: "companyName", description: "Your company name (from settings)" },
    { name: "shippingDate", description: "The shipping date" },
  ];
  
  // Insert a variable at cursor position
  const insertVariable = (variable: string) => {
    // Get textarea element
    const textarea = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templateForm.getValues().content;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    
    // Insert the variable at cursor position
    const newText = `${before}{${variable}}${after}`;
    templateForm.setValue('content', newText);
    
    // Set focus back to textarea and place cursor after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + variable.length + 2; // +2 for the {}
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };
  
  // Handler for template form submission
  const onTemplateSubmit = (values: z.infer<typeof templateEditSchema>) => {
    updateTemplateMutation.mutate(values);
  };
  
  if (isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-medium">Edit Label Template</h3>
            <p className="text-sm text-slate-500">Editing template for the CAB EOS1 printer using JScript</p>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditing(false);
                if (templateData && templateData.content) {
                  templateForm.reset({
                    content: templateData.content,
                  });
                }
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={templateForm.handleSubmit(onTemplateSubmit)}
              disabled={updateTemplateMutation.isPending}
            >
              {updateTemplateMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-4">
            <div className="mb-4 flex justify-between items-center">
              <h4 className="font-medium">Edit {templateOptions.find(t => t.value === selectedTemplate)?.label}</h4>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowVariableHelp(!showVariableHelp)}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                {showVariableHelp ? "Hide Variables" : "Show Variables"}
              </Button>
            </div>
            
            {showVariableHelp && (
              <div className="bg-slate-50 p-4 rounded-md mb-4">
                <h5 className="font-medium mb-2">Available Variables</h5>
                <p className="text-sm mb-2">Click a variable to insert it at cursor position:</p>
                <div className="flex flex-wrap gap-2">
                  {availableVariables.map((variable) => (
                    <Badge 
                      key={variable.name} 
                      variant="outline" 
                      className="cursor-pointer hover:bg-slate-100"
                      onClick={() => insertVariable(variable.name)}
                    >
                      {variable.name}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  <Alert className="bg-yellow-50 border-yellow-200">
                    <AlertTitle className="text-yellow-800 text-xs font-medium">
                      CAB EOS1 JScript Format
                    </AlertTitle>
                    <AlertDescription className="text-yellow-800 text-xs">
                      This template uses JScript for the CAB EOS1 printer. Variables are enclosed in curly braces like {`{variable}`}. 
                      Refer to the <a href="#" className="underline">CAB programming manual</a> for JScript syntax.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            )}
            
            <Form {...templateForm}>
              <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
                <FormField
                  control={templateForm.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Template JScript</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          className="font-mono text-sm h-[500px]"
                          spellCheck={false}
                        />
                      </FormControl>
                      <FormDescription>
                        JScript code for label printing. Variable format: {`{variable_name}`}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">Shipping Label Editor</CardTitle>
        <CardDescription>
          Edit the shipping label template for the CAB EOS1 printer
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Select 
              value={selectedTemplate} 
              onValueChange={setSelectedTemplate}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templateOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Template
            </Button>
          </div>
          
          {isLoadingLabelTemplate ? (
            <div className="text-center py-4">
              <div className="flex justify-center items-center gap-2">
                <span className="animate-spin">
                  <svg className="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
                <span>Loading template...</span>
              </div>
            </div>
          ) : templateData ? (
            <div className="mt-4">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertTitle className="text-blue-800">Template Loaded</AlertTitle>
                <AlertDescription className="text-blue-800">
                  The template for {templateOptions.find(t => t.value === selectedTemplate)?.label} is loaded. Click Edit Template to modify it.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="mt-4">
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTitle className="text-yellow-800">Template Not Found</AlertTitle>
                <AlertDescription className="text-yellow-800">
                  This template doesn't exist yet. Click Edit Template to create it.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Email Template Editor Component
const EmailTemplateEditor = () => {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState('order-shipped');
  const [isEditing, setIsEditing] = useState(false);
  const [showVariableHelp, setShowVariableHelp] = useState(false);
  
  // Template form
  const templateForm = useForm<z.infer<typeof templateEditSchema>>({
    resolver: zodResolver(templateEditSchema),
    defaultValues: {
      content: '',
    }
  });
  
  // Get template content query
  const { data: emailTemplateData, isLoading: isLoadingEmailTemplate, refetch: refetchEmailTemplate } = useQuery({
    queryKey: ['/api/email-settings/templates', selectedTemplate],
    enabled: !!selectedTemplate,
    queryFn: async () => {
      const response = await apiRequest(`/api/email-settings/templates/${selectedTemplate}`, {
        method: 'GET',
      });
      return response;
    }
  });
  
  // Effect to update form when template data changes
  useEffect(() => {
    if (emailTemplateData && emailTemplateData.content) {
      templateForm.reset({
        content: emailTemplateData.content,
      });
    }
  }, [emailTemplateData, templateForm]);
  
  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (values: z.infer<typeof templateEditSchema>) => {
      return apiRequest(`/api/email-settings/templates/${selectedTemplate}`, {
        method: 'PUT',
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      toast({
        title: "Template Updated",
        description: "The email template has been updated successfully.",
      });
      setIsEditing(false);
      refetchEmailTemplate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update template. " + (error instanceof Error ? error.message : String(error)),
        variant: "destructive",
      });
    }
  });
  
  // Template selection options
  const templateOptions = [
    { value: 'order-shipped', label: 'Order Shipped Notification' },
    // Add more templates as needed
  ];
  
  // Available variables for templates
  const availableVariables = [
    { name: "customerName", description: "Customer's full name" },
    { name: "orderNumber", description: "Order number/ID" },
    { name: "items", description: "List of order items (use with {{#each items}})" },
    { name: "this.name", description: "Product name (use inside {{#each items}})" },
    { name: "this.quantity", description: "Product quantity (use inside {{#each items}})" },
    { name: "trackingNumber", description: "Shipping tracking number (if available)" },
    { name: "shippingCompany", description: "Name of shipping company used" },
    { name: "notes", description: "Additional order notes" },
    { name: "companyName", description: "Your company name (from settings)" },
    { name: "currentYear", description: "Current year (automatically inserted)" },
  ];
  
  // Insert a variable at cursor position
  const insertVariable = (variable: string) => {
    // Get textarea element
    const textarea = document.querySelector('textarea[name="content"]') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = templateForm.getValues().content;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    
    // Insert the variable at cursor position
    const newText = `${before}{{${variable}}}${after}`;
    templateForm.setValue('content', newText);
    
    // Set focus back to textarea and place cursor after inserted variable
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + variable.length + 4; // +4 for the {{}}
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };
  
  // Handler for template form submission
  const onTemplateSubmit = (values: z.infer<typeof templateEditSchema>) => {
    updateTemplateMutation.mutate(values);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium">Email Templates</h3>
          <p className="text-sm text-slate-500">Customize notification emails sent to customers</p>
        </div>
        
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsEditing(false);
                  if (emailTemplateData && emailTemplateData.content) {
                    templateForm.reset({
                      content: emailTemplateData.content,
                    });
                  }
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={templateForm.handleSubmit(onTemplateSubmit)}
                disabled={updateTemplateMutation.isPending}
              >
                {updateTemplateMutation.isPending ? "Saving..." : "Save Template"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Template
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <Select 
              value={selectedTemplate} 
              onValueChange={setSelectedTemplate}
              disabled={isEditing}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {templateOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {isLoadingEmailTemplate ? (
            <div className="text-center py-4">
              <div className="flex justify-center items-center gap-2">
                <span className="animate-spin">
                  <svg className="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
                <span>Loading template...</span>
              </div>
            </div>
          ) : (
            <div className="border rounded-md">
              {isEditing ? (
                <div className="p-4">
                  {/* Template editor with variable helper */}
                  <div className="mb-4 flex justify-between items-center">
                    <h4 className="font-medium">Edit Template</h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowVariableHelp(!showVariableHelp)}
                    >
                      <HelpCircle className="h-4 w-4 mr-2" />
                      {showVariableHelp ? "Hide Variables" : "Show Variables"}
                    </Button>
                  </div>
                  
                  {showVariableHelp && (
                    <div className="bg-slate-50 p-4 rounded-md mb-4">
                      <h5 className="font-medium mb-2">Available Variables</h5>
                      <p className="text-sm mb-2">Click a variable to insert it at cursor position:</p>
                      <div className="flex flex-wrap gap-2">
                        {availableVariables.map((variable) => (
                          <Badge 
                            key={variable.name} 
                            variant="outline" 
                            className="cursor-pointer hover:bg-slate-100"
                            onClick={() => insertVariable(variable.name)}
                          >
                            {variable.name}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-slate-500">
                          <strong>Conditional blocks:</strong> Use <code className="bg-slate-100 px-1">{"{{#if variableName}}"}</code> content <code className="bg-slate-100 px-1">{"{{/if}}"}</code>
                        </p>
                        <p className="text-xs text-slate-500">
                          <strong>Loops:</strong> Use <code className="bg-slate-100 px-1">{"{{#each items}}"}</code> content <code className="bg-slate-100 px-1">{"{{/each}}"}</code>
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <Form {...templateForm}>
                    <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
                      <FormField
                        control={templateForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Template HTML</FormLabel>
                            <FormControl>
                              <Textarea 
                                {...field} 
                                className="font-mono text-sm h-[500px]"
                                spellCheck={false}
                              />
                            </FormControl>
                            <FormDescription>
                              HTML + Handlebars syntax for dynamic content. Variable format: {`{{variable_name}}`}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </form>
                  </Form>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">Template Preview</h4>
                    <div className="flex items-center">
                      <HelpCircle className="h-4 w-4 mr-2 text-slate-400" />
                      <span className="text-sm text-slate-500">
                        This template will be used for order shipped notifications
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-md overflow-auto max-h-[500px]">
                    <pre className="text-xs font-mono whitespace-pre-wrap">{emailTemplateData?.content || 'No template content available'}</pre>
                  </div>
                  
                  <div className="mt-4 p-4 border rounded-md bg-slate-50">
                    <h5 className="font-medium text-sm mb-2">Available Variables</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {availableVariables.map((variable) => (
                        <div key={variable.name} className="text-xs">
                          <code className="bg-slate-200 px-1 rounded">{`{{${variable.name}}}`}</code>
                          <span className="text-slate-500 ml-2">{variable.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;