import React, { useState, useContext } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Users, Settings, Eye, Edit, Trash2, Package, FileText, Truck, UserCheck, Plus, UserPlus, Mail, Calendar, Activity, Key, ToggleLeft, ToggleRight } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface RolePermission {
  id: number;
  role: string;
  permission: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

// Form schemas
const createUserSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  fullName: z.string().min(1, 'Full name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'front_office', 'warehouse'])
});

const editUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['admin', 'front_office', 'warehouse']),
  isActive: z.boolean()
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type EditUserForm = z.infer<typeof editUserSchema>;
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

// Permission categories and descriptions
const permissionCategories = {
  'Dashboard': ['dashboard_view', 'dashboard_stats', 'dashboard_analytics'],
  'Products': ['products_view', 'products_create', 'products_edit', 'products_delete'],
  'Orders': ['orders_view', 'orders_create', 'orders_edit', 'orders_delete', 'orders_pick', 'orders_ship'],
  'Customers': ['customers_view', 'customers_create', 'customers_edit', 'customers_delete'],
  'Inventory': ['inventory_view', 'inventory_edit', 'inventory_reports'],
  'Reports': ['reports_view', 'reports_export', 'reports_analytics'],
  'Settings': ['settings_view', 'settings_edit', 'settings_users', 'settings_roles'],
  'System': ['system_logs', 'system_maintenance', 'system_backup']
};

const permissionDescriptions: Record<string, string> = {
  'dashboard_view': 'View main dashboard',
  'dashboard_stats': 'View dashboard statistics',
  'dashboard_analytics': 'View analytics data',
  'products_view': 'View product catalog',
  'products_create': 'Create new products',
  'products_edit': 'Edit existing products',
  'products_delete': 'Delete products',
  'orders_view': 'View order list',
  'orders_create': 'Create new orders',
  'orders_edit': 'Edit order details',
  'orders_delete': 'Delete orders',
  'orders_pick': 'Pick orders in warehouse',
  'orders_ship': 'Ship completed orders',
  'customers_view': 'View customer list',
  'customers_create': 'Create new customers',
  'customers_edit': 'Edit customer information',
  'customers_delete': 'Delete customers',
  'inventory_view': 'View inventory levels',
  'inventory_edit': 'Adjust inventory quantities',
  'inventory_reports': 'Generate inventory reports',
  'reports_view': 'View system reports',
  'reports_export': 'Export report data',
  'reports_analytics': 'Access advanced analytics',
  'settings_view': 'View system settings',
  'settings_edit': 'Modify system settings',
  'settings_users': 'Manage user accounts',
  'settings_roles': 'Manage user roles',
  'system_logs': 'Access system logs',
  'system_maintenance': 'Perform system maintenance',
  'system_backup': 'Create system backups'
};

// Get icon for permission
const getPermissionIcon = (permission: string) => {
  if (permission.includes('dashboard')) return Activity;
  if (permission.includes('product')) return Package;
  if (permission.includes('order')) return FileText;
  if (permission.includes('customer')) return Users;
  if (permission.includes('inventory')) return Package;
  if (permission.includes('report')) return FileText;
  if (permission.includes('setting')) return Settings;
  if (permission.includes('system')) return Settings;
  return Key;
};

export default function RBACDisplay() {
  const { user } = useUser();
  const { toast } = useToast();

  // State management
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [isPermissionDialogOpen, setIsPermissionDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [newPermission, setNewPermission] = useState<string>('');

  // Form management
  const createUserForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: '',
      fullName: '',
      password: '',
      role: 'warehouse'
    }
  });

  const editUserForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      fullName: '',
      role: 'warehouse',
      isActive: true
    }
  });

  const resetPasswordForm = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: ''
    }
  });

  // Data queries
  const { data: rolePermissions = [], isLoading, error } = useQuery<RolePermission[]>({
    queryKey: ['/api/role-permissions'],
    queryFn: async () => {
      const response = await fetch('/api/role-permissions');
      if (!response.ok) {
        throw new Error('Failed to fetch role permissions');
      }
      return response.json();
    }
  });

  const { data: currentUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    }
  });

  // Permission management mutations
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ role, permission, enabled }: { role: string; permission: string; enabled: boolean }) => {
      return apiRequest(`/api/role-permissions/${role}/${permission}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/role-permissions'] });
      toast({
        title: "Permission Updated",
        description: "Role permission has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed", 
        description: error.message || "Failed to update permission",
        variant: "destructive"
      });
    }
  });

  const addPermissionMutation = useMutation({
    mutationFn: async ({ role, permission }: { role: string; permission: string }) => {
      return apiRequest(`/api/role-permissions/${role}/${permission}`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/role-permissions'] });
      setIsPermissionDialogOpen(false);
      setNewPermission('');
      toast({
        title: "Permission Added",
        description: "New permission has been added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Add Failed",
        description: error.message || "Failed to add permission",
        variant: "destructive"
      });
    }
  });

  const removePermissionMutation = useMutation({
    mutationFn: async ({ role, permission }: { role: string; permission: string }) => {
      return apiRequest(`/api/role-permissions/${role}/${permission}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/role-permissions'] });
      toast({
        title: "Permission Removed",
        description: "Permission has been removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Remove Failed",
        description: error.message || "Failed to remove permission",
        variant: "destructive"
      });
    }
  });

  // User management mutations
  const createUser = useMutation({
    mutationFn: async (userData: CreateUserForm) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsCreateDialogOpen(false);
      createUserForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const editUser = useMutation({
    mutationFn: async ({ userId, userData }: { userId: number; userData: EditUserForm }) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update user');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setEditingUser(null);
      editUserForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetPassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset password');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Password reset successfully',
      });
      setResetPasswordUser(null);
      resetPasswordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role-Based Access Control (RBAC)
          </CardTitle>
          <CardDescription>Loading access control information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role-Based Access Control (RBAC)
          </CardTitle>
          <CardDescription>Failed to load access control information</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Error: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  // Group permissions by role
  const permissionsByRole = rolePermissions.reduce((acc, rp) => {
    if (!acc[rp.role]) {
      acc[rp.role] = [];
    }
    acc[rp.role].push(rp);
    return acc;
  }, {} as Record<string, RolePermission[]>);

  // Count users by role
  const usersByRole = currentUsers.reduce((acc: Record<string, number>, user: User) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});

  // Role information
  const roleInfo = [
    {
      role: 'admin',
      displayName: 'Administrator',
      description: 'Full system access and user management',
      icon: Shield,
      color: 'default' as const
    },
    {
      role: 'front_office',
      displayName: 'Front Office',
      description: 'Customer service and order management',
      icon: Users,
      color: 'secondary' as const
    },
    {
      role: 'warehouse',
      displayName: 'Warehouse Staff',
      description: 'Inventory and fulfillment operations',
      icon: Package,
      color: 'outline' as const
    }
  ];

  // Get available permissions for adding
  const availablePermissions = Object.values(permissionCategories).flat().filter(permission => {
    const rolePerms = permissionsByRole[selectedRole] || [];
    return !rolePerms.some(rp => rp.permission === permission);
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role-Based Access Control (RBAC)
          </CardTitle>
          <CardDescription>
            Manage user roles and permissions across the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Role Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {roleInfo.map((role) => {
              const Icon = role.icon;
              const permissions = permissionsByRole[role.role] || [];
              const enabledCount = permissions.filter(p => p.enabled).length;
              const totalCount = permissions.length;
              const userCount = usersByRole[role.role] || 0;

              return (
                <Card key={role.role} className="border-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4" />
                      {role.displayName}
                      <Badge variant={role.color} className="ml-auto text-xs">
                        {userCount} user{userCount !== 1 ? 's' : ''}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {role.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span>Permissions:</span>
                        <span className="font-medium">{enabledCount}/{totalCount}</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${totalCount > 0 ? (enabledCount / totalCount) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Detailed Permissions */}
          <Accordion type="single" collapsible className="w-full">
            {roleInfo.map((role) => {
              const Icon = role.icon;
              const permissions = permissionsByRole[role.role] || [];
              
              return (
                <AccordionItem key={role.role} value={role.role}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{role.displayName} Permissions</span>
                      <Badge variant={role.color} className="ml-2">
                        {permissions.filter(p => p.enabled).length} enabled
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      {Object.entries(permissionCategories).map(([category, categoryPermissions]) => {
                        const categoryPerms = permissions.filter(p => 
                          categoryPermissions.includes(p.permission)
                        );
                        
                        if (categoryPerms.length === 0) return null;

                        return (
                          <div key={category}>
                            <h4 className="font-medium text-sm text-slate-700 mb-2">{category}</h4>
                            <div className="space-y-2">
                              {categoryPerms.map((perm) => {
                                const PermIcon = getPermissionIcon(perm.permission);
                                return (
                                  <div key={perm.permission} className="flex items-center gap-3 p-2 border rounded-lg">
                                    <PermIcon className="h-4 w-4 text-slate-500" />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{perm.permission}</span>
                                        <Badge variant={perm.enabled ? 'default' : 'secondary'} className="text-xs">
                                          {perm.enabled ? 'Enabled' : 'Disabled'}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-slate-500 mt-1">
                                        {permissionDescriptions[perm.permission] || 'No description available'}
                                      </p>
                                    </div>
                                    {user?.role === 'admin' && role.role !== 'admin' && (
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={perm.enabled}
                                          onCheckedChange={(checked) => {
                                            updatePermissionMutation.mutate({
                                              role: role.role,
                                              permission: perm.permission,
                                              enabled: checked
                                            });
                                          }}
                                          disabled={updatePermissionMutation.isPending}
                                        />
                                        {perm.enabled && (
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Remove Permission</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  Are you sure you want to remove the "{perm.permission}" permission from the {role.role} role?
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() => {
                                                    removePermissionMutation.mutate({
                                                      role: role.role,
                                                      permission: perm.permission
                                                    });
                                                  }}
                                                  disabled={removePermissionMutation.isPending}
                                                >
                                                  {removePermissionMutation.isPending ? 'Removing...' : 'Remove'}
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Add Permission Button for non-admin roles */}
                      {user?.role === 'admin' && role.role !== 'admin' && (
                        <div className="mt-4 pt-4 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRole(role.role);
                              setIsPermissionDialogOpen(true);
                            }}
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Permission
                          </Button>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      {/* User Management Section */}
      {user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>Manage system users and their roles</CardDescription>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                  </DialogHeader>
                  <Form {...createUserForm}>
                    <form onSubmit={createUserForm.handleSubmit((data) => createUser.mutate(data))} className="space-y-4">
                      <FormField
                        control={createUserForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createUserForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter full name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createUserForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Enter password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createUserForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="admin">Administrator</SelectItem>
                                <SelectItem value="front_office">Front Office</SelectItem>
                                <SelectItem value="warehouse">Warehouse Staff</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={createUser.isPending}>
                          {createUser.isPending ? 'Creating...' : 'Create User'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentUsers.map((userData) => (
                  <TableRow key={userData.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{userData.fullName}</div>
                        <div className="text-sm text-slate-500">{userData.username}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={userData.role === 'admin' ? 'default' : 'secondary'}>
                        {userData.role === 'front_office' ? 'Front Office' : 
                         userData.role === 'warehouse' ? 'Warehouse' : 'Admin'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={userData.isActive ? 'default' : 'destructive'}>
                        {userData.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {userData.lastLogin ? new Date(userData.lastLogin).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingUser(userData);
                            editUserForm.reset({
                              fullName: userData.fullName,
                              role: userData.role as any,
                              isActive: userData.isActive
                            });
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setResetPasswordUser(userData)}
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                        {userData.id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete {userData.fullName}? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUser.mutate(userData.id)}
                                  disabled={deleteUser.isPending}
                                >
                                  {deleteUser.isPending ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Permission Dialog */}
      <Dialog open={isPermissionDialogOpen} onOpenChange={setIsPermissionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Permission to {selectedRole}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="permission">Permission Name</Label>
              <Select value={newPermission} onValueChange={setNewPermission}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a permission to add" />
                </SelectTrigger>
                <SelectContent>
                  {availablePermissions.map((permission) => (
                    <SelectItem key={permission} value={permission}>
                      {permission} - {permissionDescriptions[permission]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (newPermission) {
                  addPermissionMutation.mutate({
                    role: selectedRole,
                    permission: newPermission
                  });
                }
              }}
              disabled={!newPermission || addPermissionMutation.isPending}
            >
              {addPermissionMutation.isPending ? 'Adding...' : 'Add Permission'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User: {editingUser.fullName}</DialogTitle>
            </DialogHeader>
            <Form {...editUserForm}>
              <form onSubmit={editUserForm.handleSubmit((data) => editUser.mutate({ userId: editingUser.id, userData: data }))} className="space-y-4">
                <FormField
                  control={editUserForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Administrator</SelectItem>
                          <SelectItem value="front_office">Front Office</SelectItem>
                          <SelectItem value="warehouse">Warehouse Staff</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editUserForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel>Active User</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={editUser.isPending}>
                    {editUser.isPending ? 'Updating...' : 'Update User'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Reset Password Dialog */}
      {resetPasswordUser && (
        <Dialog open={!!resetPasswordUser} onOpenChange={() => setResetPasswordUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Password: {resetPasswordUser.fullName}</DialogTitle>
            </DialogHeader>
            <Form {...resetPasswordForm}>
              <form onSubmit={resetPasswordForm.handleSubmit((data) => resetPassword.mutate({ userId: resetPasswordUser.id, newPassword: data.newPassword }))} className="space-y-4">
                <FormField
                  control={resetPasswordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Enter new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={resetPasswordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={resetPassword.isPending}>
                    {resetPassword.isPending ? 'Resetting...' : 'Reset Password'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}