import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Clock, FileText, UserCircle } from 'lucide-react';

interface OrderChangelogProps {
  orderId: number;
}

interface ChangelogUser {
  id: number;
  username: string;
  fullName: string;
}

interface OrderChangelog {
  id: number;
  orderId: number;
  userId: number;
  action: 'create' | 'update' | 'delete' | 'status_change';
  timestamp: string;
  changes: Record<string, any>;
  previousValues: Record<string, any>;
  notes: string | null;
  user?: ChangelogUser;
}

function getActionLabel(action: string): string {
  switch (action) {
    case 'create':
      return 'Created';
    case 'update':
      return 'Updated';
    case 'delete':
      return 'Deleted';
    case 'status_change':
      return 'Status Changed';
    default:
      return action;
  }
}

function getActionColor(action: string): string {
  switch (action) {
    case 'create':
      return 'bg-green-500 hover:bg-green-600';
    case 'update':
      return 'bg-blue-500 hover:bg-blue-600';
    case 'delete':
      return 'bg-red-500 hover:bg-red-600';
    case 'status_change':
      return 'bg-amber-500 hover:bg-amber-600';
    default:
      return 'bg-gray-500 hover:bg-gray-600';
  }
}

function formatChangedValue(key: string, value: any): string {
  if (key === 'status') {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  
  if (value === null || value === undefined) {
    return 'None';
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  
  return String(value);
}

function getKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    status: 'Status',
    notes: 'Notes',
    orderNumber: 'Order Number',
    customerName: 'Customer Name',
    orderDate: 'Order Date',
    lastUpdated: 'Last Updated',
    hasShippingDocument: 'Has Shipping Document',
    documentPath: 'Document Path',
    documentType: 'Document Type'
  };
  
  return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

function renderChanges(changes: Record<string, any>, previousValues: Record<string, any>) {
  const keys = Object.keys(changes);
  
  if (keys.length === 0) {
    return <p className="text-sm text-gray-500 italic">No changes recorded</p>;
  }
  
  return (
    <div className="space-y-2">
      {keys.map(key => (
        <div key={key} className="grid grid-cols-3 gap-2 text-sm items-start">
          <div className="font-medium text-slate-800">{getKeyLabel(key)}</div>
          <div className="text-red-600 line-through">
            {key in previousValues 
              ? formatChangedValue(key, previousValues[key])
              : <span className="text-slate-400 italic">Not set</span>
            }
          </div>
          <div className="text-green-600">
            {formatChangedValue(key, changes[key])}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OrderChangelog({ orderId }: OrderChangelogProps) {
  const { data: changelogs, isLoading, isError } = useQuery<OrderChangelog[]>({
    queryKey: ['/api/orders', orderId, 'changelogs'],
    queryFn: async () => {
      const response = await fetch(`/api/orders/${orderId}/changelogs`);
      if (!response.ok) throw new Error('Failed to fetch order history');
      return response.json();
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity size={18} /> Order History
          </CardTitle>
          <CardDescription>Loading change history...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Activity size={18} /> Error Loading Order History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>There was an error loading the order history. Please try again later.</p>
        </CardContent>
      </Card>
    );
  }

  if (!changelogs || changelogs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity size={18} /> Order History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500">No change history available for this order.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity size={18} /> Order History
        </CardTitle>
        <CardDescription>
          History of changes made to this order
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {changelogs.map((log) => (
            <AccordionItem key={log.id} value={`item-${log.id}`}>
              <AccordionTrigger className="py-4 px-0">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full text-left gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getActionColor(log.action)}>
                      {getActionLabel(log.action)}
                    </Badge>
                    <span className="font-semibold">
                      {log.user && log.user.fullName}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-slate-500">
                    <Clock size={14} className="mr-1" />
                    {format(new Date(log.timestamp), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {log.notes && (
                  <div className="flex items-start bg-slate-50 p-3 rounded-md">
                    <FileText size={16} className="mr-2 mt-0.5 text-slate-500" />
                    <p className="text-sm text-slate-700">{log.notes}</p>
                  </div>
                )}
                <div className="space-y-4">
                  <div className="flex items-center">
                    <UserCircle size={16} className="mr-2 text-slate-500" />
                    <h4 className="text-sm font-medium">
                      {log.user ? (
                        <span>Changed by {log.user.fullName} (@{log.user.username})</span>
                      ) : (
                        <span>Changed by user ID {log.userId}</span>
                      )}
                    </h4>
                  </div>
                  <div className="border-t pt-3">
                    <h4 className="text-sm font-medium mb-2">Changes</h4>
                    {renderChanges(log.changes, log.previousValues)}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}