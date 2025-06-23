import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Shield, Users, Settings, Eye, Edit, Trash2, Package, FileText, TruckIcon, UserCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface RolePermission {
  role: string;
  permission: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

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

  const { data: currentUsers = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    }
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
  const usersByRole = currentUsers.reduce((acc: Record<string, number>, user: any) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Role-Based Access Control (RBAC)
        </CardTitle>
        <CardDescription>
          System roles and permissions configuration. Your current role: {' '}
          <Badge variant={roleInfo.find(r => r.role === user?.role)?.color || 'outline'}>
            {roleInfo.find(r => r.role === user?.role)?.displayName || user?.role}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        {/* Current Users Summary */}
        <div className="border-t pt-4">
          <h3 className="font-medium text-sm text-slate-700 mb-3">Current System Users</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Permissions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleInfo.map((role) => {
                const permissions = permissionsByRole[role.role] || [];
                const enabledCount = permissions.filter(p => p.enabled).length;
                const userCount = usersByRole[role.role] || 0;
                const Icon = role.icon;

                return (
                  <TableRow key={role.role}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="font-medium">{role.displayName}</span>
                        <Badge variant={role.color} className="text-xs">
                          {role.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {userCount} user{userCount !== 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">
                        {enabledCount} enabled permissions
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

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