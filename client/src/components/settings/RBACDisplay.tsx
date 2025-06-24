import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Shield, Users, Settings, Eye, Edit, Trash2, Package, FileText, TruckIcon, UserCheck, Plus, UserPlus, Mail, Calendar, Activity, Key } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface RolePermission {
  role: string;
  permission: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: number;
  username: string;
  fullName?: string;
  email?: string;
  role: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

const createUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  role: z.enum(['admin', 'front_office', 'warehouse'], {
    required_error: 'Please select a role'
  })
});

const editUserSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
  role: z.enum(['admin', 'front_office', 'warehouse'], {
    required_error: 'Please select a role'
  }),
  active: z.boolean()
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type EditUserForm = z.infer<typeof editUserSchema>;
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

interface RoleInfo {
  role: string;
  displayName: string;
  description: string;
  color: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ComponentType<any>;
}

const roleInfo: RoleInfo[] = [
  {
    role: 'admin',
    displayName: 'Administrator',
    description: 'Full system access with all permissions',
    color: 'destructive',
    icon: Shield
  },
  {
    role: 'front_office',
    displayName: 'Front Office',
    description: 'Customer service and order management',
    color: 'default',
    icon: Users
  },
  {
    role: 'warehouse',
    displayName: 'Warehouse',
    description: 'Inventory and order fulfillment operations',
    color: 'secondary',
    icon: Package
  }
];

const permissionCategories = {
  'Dashboard & Overview': ['view_dashboard'],
  'Product Management': ['view_products', 'edit_products'],
  'Customer Management': ['view_customers', 'edit_customers'],
  'Order Management': ['view_orders', 'create_orders', 'edit_orders', 'delete_orders', 'order_picking'],
  'Warehouse Operations': ['view_unshipped_items', 'authorize_unshipped_items'],
  'Reporting': ['view_reports'],
  'System Administration': ['view_settings', 'edit_settings', 'view_users', 'edit_users'],
  'Email Templates': ['view_email_templates', 'edit_email_templates']
};

const permissionDescriptions: Record<string, string> = {
  'view_dashboard': 'View system dashboard and statistics',
  'view_products': 'View product catalog and inventory',
  'edit_products': 'Create, modify, and manage products',
  'view_customers': 'View customer information and history',
  'edit_customers': 'Create and modify customer records',
  'view_orders': 'View order details and history',
  'create_orders': 'Create new customer orders',
  'edit_orders': 'Modify existing orders',
  'delete_orders': 'Delete orders from the system',
  'order_picking': 'Access order picking workflows',
  'view_unshipped_items': 'View items awaiting shipment',
  'authorize_unshipped_items': 'Authorize backorder items for shipment',
  'view_reports': 'Access system reports and analytics',
  'view_settings': 'View system settings and configuration',
  'edit_settings': 'Modify system settings and preferences',
  'view_users': 'View user accounts and information',
  'edit_users': 'Create, modify, and manage user accounts',
  'view_email_templates': 'View email template configurations',
  'edit_email_templates': 'Modify email templates and settings'
};

const getPermissionIcon = (permission: string) => {
  if (permission.includes('view')) return Eye;
  if (permission.includes('edit') || permission.includes('create')) return Edit;
  if (permission.includes('delete')) return Trash2;
  if (permission.includes('order')) return FileText;
  if (permission.includes('unshipped') || permission.includes('picking')) return TruckIcon;
  if (permission.includes('user')) return UserCheck;
  if (permission.includes('setting')) return Settings;
  return Shield;
};

export function RBACDisplay() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);

  const createUserForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: '',
      password: '',
      fullName: '',
      email: '',
      role: 'warehouse'
    }
  });

  const editUserForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      fullName: '',
      email: '',
      role: 'warehouse',
      active: true
    }
  });

  const resetPasswordForm = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: ''
    }
  });
  
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

  // Create user mutation
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

  // Edit user mutation
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

  // Delete user mutation
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

  // Reset password mutation
  const resetPassword = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
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

  const handleCreateUser = (data: CreateUserForm) => {
    createUser.mutate(data);
  };

  const handleEditUser = (data: EditUserForm) => {
    if (editingUser) {
      editUser.mutate({ userId: editingUser.id, userData: data });
    }
  };

  const handleDeleteUser = (userId: number) => {
    deleteUser.mutate(userId);
  };

  const handleResetPassword = (data: ResetPasswordForm) => {
    if (resetPasswordUser) {
      resetPassword.mutate({ userId: resetPasswordUser.id, newPassword: data.newPassword });
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    editUserForm.reset({
      fullName: user.fullName || '',
      email: user.email || '',
      role: user.role as any,
      active: user.active
    });
  };

  const openResetPasswordDialog = (user: User) => {
    setResetPasswordUser(user);
    resetPasswordForm.reset();
  };

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

  const activeUsers = currentUsers.filter(u => u.active).length;
  const totalUsers = currentUsers.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Role-Based Access Control (RBAC)
        </CardTitle>
        <CardDescription>
          System roles, permissions, and user management. Your current role: {' '}
          <Badge variant={roleInfo.find(r => r.role === user?.role)?.color || 'outline'}>
            {roleInfo.find(r => r.role === user?.role)?.displayName || user?.role}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User Management Actions */}
        {user?.role === 'admin' && (
          <div className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-slate-600" />
              <div>
                <h3 className="font-medium text-slate-800">User Management</h3>
                <p className="text-sm text-slate-600">{activeUsers} active users out of {totalUsers} total</p>
              </div>
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
                <form onSubmit={createUserForm.handleSubmit(handleCreateUser)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Username *</Label>
                      <Input
                        id="username"
                        {...createUserForm.register('username')}
                        placeholder="Enter username"
                      />
                      {createUserForm.formState.errors.username && (
                        <p className="text-sm text-red-500 mt-1">
                          {createUserForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        {...createUserForm.register('password')}
                        placeholder="Enter password"
                      />
                      {createUserForm.formState.errors.password && (
                        <p className="text-sm text-red-500 mt-1">
                          {createUserForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      {...createUserForm.register('fullName')}
                      placeholder="Enter full name"
                    />
                    {createUserForm.formState.errors.fullName && (
                      <p className="text-sm text-red-500 mt-1">
                        {createUserForm.formState.errors.fullName.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...createUserForm.register('email')}
                      placeholder="Enter email (optional)"
                    />
                    {createUserForm.formState.errors.email && (
                      <p className="text-sm text-red-500 mt-1">
                        {createUserForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={createUserForm.watch('role')}
                      onValueChange={(value) => createUserForm.setValue('role', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="warehouse">Warehouse Staff</SelectItem>
                        <SelectItem value="front_office">Front Office Staff</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                    {createUserForm.formState.errors.role && (
                      <p className="text-sm text-red-500 mt-1">
                        {createUserForm.formState.errors.role.message}
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createUser.isPending}>
                      {createUser.isPending ? 'Creating...' : 'Create User'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Role Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Current Users Management */}
        <div className="border-t pt-4">
          <h3 className="font-medium text-sm text-slate-700 mb-3">System Users ({totalUsers} total, {activeUsers} active)</h3>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  {user?.role === 'admin' && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentUsers.map((currentUser) => {
                  const roleInfo_ = roleInfo.find(r => r.role === currentUser.role);
                  const Icon = roleInfo_?.icon || Users;

                  return (
                    <TableRow key={currentUser.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                              <Icon className="h-4 w-4 text-slate-600" />
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-sm">{currentUser.fullName || currentUser.username}</div>
                            <div className="text-xs text-slate-500">
                              {currentUser.username}
                              {currentUser.email && (
                                <span className="flex items-center gap-1 mt-1">
                                  <Mail className="h-3 w-3" />
                                  {currentUser.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleInfo_?.color || 'outline'} className="text-xs">
                          <Icon className="h-3 w-3 mr-1" />
                          {roleInfo_?.displayName || currentUser.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={currentUser.active ? 'default' : 'secondary'} className="text-xs">
                          <Activity className="h-3 w-3 mr-1" />
                          {currentUser.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Calendar className="h-3 w-3" />
                          {currentUser.lastLogin 
                            ? new Date(currentUser.lastLogin).toLocaleDateString()
                            : 'Never'
                          }
                        </div>
                      </TableCell>
                      {user?.role === 'admin' && (
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(currentUser)}
                              disabled={editUser.isPending}
                              className="h-8 w-8 p-0"
                              title="Edit user"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openResetPasswordDialog(currentUser)}
                              disabled={resetPassword.isPending}
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800"
                              title="Reset password"
                            >
                              <Key className="h-3 w-3" />
                            </Button>
                            {currentUser.id !== user?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={deleteUser.isPending}
                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-800"
                                    title="Delete user"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete user "{currentUser.fullName || currentUser.username}"? 
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(currentUser.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete User
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {currentUsers.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No users found. Create your first user to get started.</p>
            </div>
          )}
        </div>

        {/* Edit User Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User: {editingUser?.fullName || editingUser?.username}</DialogTitle>
            </DialogHeader>
            <form onSubmit={editUserForm.handleSubmit(handleEditUser)} className="space-y-4">
              <div>
                <Label htmlFor="edit-fullName">Full Name *</Label>
                <Input
                  id="edit-fullName"
                  {...editUserForm.register('fullName')}
                  placeholder="Enter full name"
                />
                {editUserForm.formState.errors.fullName && (
                  <p className="text-sm text-red-500 mt-1">
                    {editUserForm.formState.errors.fullName.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  {...editUserForm.register('email')}
                  placeholder="Enter email (optional)"
                />
                {editUserForm.formState.errors.email && (
                  <p className="text-sm text-red-500 mt-1">
                    {editUserForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit-role">Role *</Label>
                <Select
                  value={editUserForm.watch('role')}
                  onValueChange={(value) => editUserForm.setValue('role', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">Warehouse Staff</SelectItem>
                    <SelectItem value="front_office">Front Office Staff</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
                {editUserForm.formState.errors.role && (
                  <p className="text-sm text-red-500 mt-1">
                    {editUserForm.formState.errors.role.message}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  {...editUserForm.register('active')}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="edit-active">User is active</Label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editUser.isPending}>
                  {editUser.isPending ? 'Updating...' : 'Update User'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={!!resetPasswordUser} onOpenChange={() => setResetPasswordUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Reset Password: {resetPasswordUser?.fullName || resetPasswordUser?.username}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)} className="space-y-4">
              <div>
                <Label htmlFor="newPassword">New Password *</Label>
                <Input
                  id="newPassword"
                  type="password"
                  {...resetPasswordForm.register('newPassword')}
                  placeholder="Enter new password"
                />
                {resetPasswordForm.formState.errors.newPassword && (
                  <p className="text-sm text-red-500 mt-1">
                    {resetPasswordForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...resetPasswordForm.register('confirmPassword')}
                  placeholder="Confirm new password"
                />
                {resetPasswordForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-500 mt-1">
                    {resetPasswordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <Key className="h-4 w-4 inline mr-1" />
                  The user will need to use this new password to log in. Make sure to communicate it securely.
                </p>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetPasswordUser(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={resetPassword.isPending}>
                  {resetPassword.isPending ? 'Resetting...' : 'Reset Password'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {user?.role !== 'admin' && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <Shield className="h-4 w-4 inline mr-1" />
              Only administrators can modify role permissions. Contact your system administrator for permission changes.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}