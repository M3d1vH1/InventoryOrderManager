import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertCircle, CheckCircle, Clock, Plus, Pencil, RefreshCw, Truck, FileText } from "lucide-react";
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

interface ChangelogItem {
  id: number;
  orderId: number;
  userId: number;
  username: string;
  action: 'create' | 'update' | 'status_change';
  timestamp: string;
  details: string;
  previousStatus?: string;
  newStatus?: string;
  changedFields?: string[];
  previousValues?: Record<string, any>;
  notes?: string;
}

interface OrderChangelogProps {
  orderId: number;
}

export function OrderChangelog({ orderId }: OrderChangelogProps) {
  const { data: changelog, isLoading, error } = useQuery<ChangelogItem[]>({
    queryKey: ['/api/orders', orderId, 'changelog'],
    enabled: !!orderId,
    queryFn: async () => {
      return apiRequest({
        url: `/api/orders/${orderId}/changelog`,
      });
    },
  });

  const getActionIcon = (action: string, newStatus?: string) => {
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
      default:
        return <RefreshCw className="h-4 w-4 text-slate-500" />;
    }
  };

  const getActionText = (item: ChangelogItem) => {
    if (item.action === 'create') {
      return 'Order created';
    }
    
    if (item.action === 'update') {
      if (item.changedFields && item.changedFields.includes('documentPath')) {
        return 'Document uploaded';
      }
      return `Order updated (${item.changedFields?.join(', ')})`;
    }
    
    if (item.action === 'status_change') {
      let statusText = '';
      switch (item.newStatus) {
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
          statusText = `status changed to ${item.newStatus}`;
      }
      return `Order ${statusText}`;
    }
    
    return 'Order updated';
  };

  const renderChanges = (item: ChangelogItem) => {
    if (item.action === 'status_change') {
      return (
        <div className="text-sm">
          <span className="font-medium">Status changed: </span>
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(item.previousStatus || '')}`}>
            {item.previousStatus?.charAt(0).toUpperCase() + item.previousStatus?.slice(1) || 'None'}
          </span>
          <span className="mx-2">→</span>
          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(item.newStatus || '')}`}>
            {item.newStatus?.charAt(0).toUpperCase() + item.newStatus?.slice(1) || 'None'}
          </span>
        </div>
      );
    }
    
    if (item.action === 'update' && item.changedFields && item.previousValues) {
      return (
        <div className="text-sm">
          {item.changedFields.includes('documentPath') ? (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span>Document added to order</span>
            </div>
          ) : (
            <div className="space-y-1">
              {item.changedFields.map(field => (
                <div key={field}>
                  <span className="font-medium">{formatFieldName(field)}: </span>
                  <span className="line-through text-slate-500 mr-2">
                    {formatFieldValue(field, item.previousValues?.[field])}
                  </span>
                  <span className="text-slate-900">
                    {formatFieldValue(field, item.details ? JSON.parse(item.details)[field] : '')}
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
                  {getActionIcon(item.action, item.newStatus)}
                  <span>{getActionText(item)}</span>
                </div>
              </TableCell>
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted">
                        {item.username}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>User ID: {item.userId}</p>
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