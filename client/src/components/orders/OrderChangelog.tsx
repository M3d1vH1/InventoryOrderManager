import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, CheckCircle, Clock, Plus, Pencil, RefreshCw, Truck, FileText, Package, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface User {
  id: number;
  username: string;
  fullName: string;
}

interface ChangelogItem {
  id: number;
  orderId: number;
  userId: number;
  user?: User;
  action: 'create' | 'update' | 'status_change' | 'unshipped_authorization';
  timestamp: string;
  changes: Record<string, any>;
  previousValues?: Record<string, any>;
  notes?: string;
}

interface OrderChangelogProps {
  orderId: number;
}

export function OrderChangelog({ orderId }: OrderChangelogProps) {
  const { data: changelog, isLoading, error } = useQuery<ChangelogItem[]>({
    queryKey: ['/api/orders', orderId, 'changelogs'],
    enabled: !!orderId,
    queryFn: async () => {
      return apiRequest({
        url: `/api/orders/${orderId}/changelogs`,
      });
    },
  });

  const getActionIcon = (item: ChangelogItem) => {
    const action = item.action;
    const newStatus = item.changes?.status;
    
    switch (action) {
      case 'create':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'update':
        return <Pencil className="h-4 w-4 text-blue-500" />;
      case 'status_change':
        if (newStatus === 'pending') return <Clock className="h-4 w-4 text-amber-500" />;
        if (newStatus === 'picked') return <CheckCircle className="h-4 w-4 text-blue-500" />;
        if (newStatus === 'shipped') return <Truck className="h-4 w-4 text-green-500" />;
        if (newStatus === 'cancelled') return <AlertCircle className="h-4 w-4 text-red-500" />;
        return <RefreshCw className="h-4 w-4 text-slate-500" />;
      case 'unshipped_authorization':
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-slate-500" />;
    }
  };

  const getActionText = (item: ChangelogItem) => {
    if (item.action === 'create') {
      return 'Order created';
    }
    
    if (item.action === 'update') {
      if (item.changes && 'documentPath' in item.changes) {
        return 'Document uploaded';
      }
      const changedFields = item.changes ? Object.keys(item.changes) : [];
      return `Order updated (${changedFields.join(', ')})`;
    }
    
    if (item.action === 'status_change') {
      let statusText = '';
      const newStatus = item.changes?.status;
      
      switch (newStatus) {
        case 'pending':
          statusText = 'marked as Pending';
          break;
        case 'picked':
          statusText = 'marked as Picked';
          break;
        case 'shipped':
          statusText = 'marked as Shipped';
          break;
        case 'cancelled':
          statusText = 'Cancelled';
          break;
        default:
          statusText = `status changed to ${newStatus || 'unknown'}`;
      }
      return `Order ${statusText}`;
    }
    
    if (item.action === 'unshipped_authorization') {
      return 'Unshipped items authorized';
    }
    
    return 'Order updated';
  };

  const renderChanges = (item: ChangelogItem) => {
    if (item.action === 'status_change') {
      const prevStatus = item.previousValues?.status || '';
      const newStatus = item.changes?.status || '';
      
      const formatStatus = (status: string) => {
        if (!status) return 'None';
        return status.charAt(0).toUpperCase() + status.slice(1);
      };
      
      return (
        <div className="text-sm">
          <span className="font-medium">Status changed: </span>
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(prevStatus)}`}>
            {formatStatus(prevStatus)}
          </span>
          <span className="mx-2">→</span>
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(newStatus)}`}>
            {formatStatus(newStatus)}
          </span>
        </div>
      );
    }
    
    if (item.action === 'unshipped_authorization' && item.changes) {
      const { productId, quantity, authorizedByRole } = item.changes;
      
      return (
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-purple-500" />
            <span>
              <span className="font-medium">Product ID {productId}</span>
              {quantity && <span> - Quantity: {quantity}</span>}
            </span>
          </div>
          {authorizedByRole && (
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <User className="h-3.5 w-3.5" />
              <span>Authorized by {authorizedByRole}</span>
            </div>
          )}
          {item.notes && (
            <div className="mt-1 text-xs italic text-slate-600">
              {item.notes}
            </div>
          )}
        </div>
      );
    }
    
    if (item.action === 'update' && item.changes && item.previousValues) {
      const changedFields = Object.keys(item.changes);
      
      return (
        <div className="text-sm">
          {changedFields.includes('documentPath') ? (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span>Document added to order</span>
            </div>
          ) : (
            <div className="space-y-1">
              {changedFields.map((field: string) => (
                <div key={field}>
                  <span className="font-medium">{formatFieldName(field)}: </span>
                  <span className="line-through text-slate-500 mr-2">
                    {formatFieldValue(field, item.previousValues?.[field])}
                  </span>
                  <span className="text-slate-900">
                    {formatFieldValue(field, item.changes?.[field])}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    if (item.notes) {
      return (
        <div className="text-sm italic text-slate-600">
          "{item.notes}"
        </div>
      );
    }
    
    return null;
  };

  const formatFieldName = (field: string) => {
    // Convert camelCase to Title Case with spaces
    const formatted = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    
    // Special cases
    switch (field) {
      case 'orderNumber':
        return 'Order Number';
      case 'customerName':
        return 'Customer';
      case 'orderDate':
        return 'Order Date';
      default:
        return formatted;
    }
  };

  const formatFieldValue = (field: string, value: any) => {
    if (value === null || value === undefined) return 'None';
    
    // Handle dates
    if (field === 'orderDate' && value) {
      try {
        return format(new Date(value), 'MMM dd, yyyy');
      } catch (e) {
        return value;
      }
    }
    
    // Handle booleans
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    // Handle empty strings
    if (value === '') return 'Empty';
    
    return value.toString();
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'picked':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-md">
        Failed to load order history. Please try again later.
      </div>
    );
  }

  if (!changelog || changelog.length === 0) {
    return (
      <div className="p-4 border border-slate-200 bg-slate-50 text-slate-700 rounded-md">
        No change history available for this order.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[180px]">Date & Time</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Changed By</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changelog.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {format(new Date(item.timestamp), "MMM dd, yyyy HH:mm")}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getActionIcon(item)}
                  <span>{getActionText(item)}</span>
                </div>
              </TableCell>
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted">
                        {item.user?.fullName || `User ID: ${item.userId}`}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>User ID: {item.userId}</p>
                      {item.user && <p>Username: {item.user.username}</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell>
                {renderChanges(item)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}