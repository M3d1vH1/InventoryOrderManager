import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Clock, User, Calendar, FileText, TrendingDown, RefreshCw, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface AuditEntry {
  id: number;
  entity_type: 'invoice' | 'payment';
  entity_id: number;
  tracking_id: string | null;
  action: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  user_id: number;
  user_name: string;
  user_full_name: string | null;
  ip_address: string;
  user_agent: string;
  reason: string | null;
  timestamp: string;
}

interface PaymentDiscrepancy {
  invoice_id: number;
  invoice_number: string;
  invoice_amount: string;
  paid_amount: string;
  status: string;
  calculated_total_payments: string;
  payment_count: number;
  discrepancy: string;
}

export function AuditTrail() {
  const [searchEntityId, setSearchEntityId] = useState('');
  const [searchEntityType, setSearchEntityType] = useState<'invoice' | 'payment'>('invoice');
  const [searchTrackingId, setSearchTrackingId] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for recent audit activity
  const { data: recentActivity, isLoading: recentLoading } = useQuery<AuditEntry[]>({
    queryKey: ['/api/supplier-payments/audit/recent', 20],
    queryFn: () => fetch('/api/supplier-payments/audit/recent?limit=20', { credentials: 'include' }).then(res => res.json()),
  });

  // Query for payment discrepancies
  const { data: discrepancies, isLoading: discrepanciesLoading } = useQuery<PaymentDiscrepancy[]>({
    queryKey: ['/api/supplier-payments/discrepancies'],
    queryFn: () => fetch('/api/supplier-payments/discrepancies', { credentials: 'include' }).then(res => res.json()),
  });

  // Query for specific entity audit trail
  const { data: entityAudit, isLoading: entityLoading, refetch: refetchEntity } = useQuery<AuditEntry[]>({
    queryKey: ['/api/supplier-payments/audit', searchEntityType, searchEntityId],
    queryFn: () => {
      if (!searchEntityId) return Promise.resolve([]);
      return fetch(`/api/supplier-payments/audit/${searchEntityType}/${searchEntityId}`, { 
        credentials: 'include' 
      }).then(res => res.json());
    },
    enabled: !!searchEntityId,
  });

  // Mutation for data repair
  const repairDataMutation = useMutation({
    mutationFn: () => apiRequest('/api/supplier-payments/repair-data', { method: 'POST' }),
    onSuccess: (data) => {
      toast({
        title: "Data Repair Completed",
        description: `Repaired ${data.repaired} invoice(s). ${data.errors.length > 0 ? `Errors: ${data.errors.join(', ')}` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/supplier-payments/discrepancies'] });
    },
    onError: (error) => {
      toast({
        title: "Repair Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('el-GR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatChanges = (oldValues: Record<string, any> | null, newValues: Record<string, any> | null) => {
    if (!oldValues && !newValues) return 'No changes recorded';
    
    if (newValues && !oldValues) {
      return Object.entries(newValues)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    
    if (oldValues && newValues) {
      const changes = Object.entries(newValues)
        .filter(([key, value]) => oldValues[key] !== value)
        .map(([key, value]) => `${key}: ${oldValues[key]} → ${value}`);
      return changes.join(', ') || 'No changes detected';
    }
    
    return 'Changes not available';
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'created': return 'default';
      case 'updated': return 'secondary';
      case 'deleted': return 'destructive';
      case 'status_changed': return 'outline';
      default: return 'secondary';
    }
  };

  const handleEntitySearch = () => {
    if (searchEntityId.trim() || searchTrackingId.trim()) {
      refetchEntity();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Audit Trail</h2>
        <p className="text-muted-foreground">
          Track all payment and invoice operations with complete user attribution
        </p>
      </div>

      <Tabs defaultValue="recent" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recent">Recent Activity</TabsTrigger>
          <TabsTrigger value="search">Search Entity</TabsTrigger>
          <TabsTrigger value="discrepancies">Discrepancies</TabsTrigger>
          <TabsTrigger value="tools">Management Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest 20 audit entries across all payments and invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading audit data...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Changes</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivity?.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {formatTimestamp(entry.timestamp)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(entry.action)}>
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              {entry.entity_type} #{entry.entity_id}
                            </div>
                            {entry.tracking_id && (
                              <Badge variant="outline" className="font-mono text-xs w-fit">
                                {entry.tracking_id}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{entry.user_full_name || entry.user_name}</div>
                              <div className="text-sm text-muted-foreground">{entry.ip_address}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="text-sm">
                            {formatChanges(entry.old_values, entry.new_values)}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-sm">
                          <div className="text-sm text-muted-foreground">
                            {entry.reason || 'No reason provided'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!recentActivity?.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No audit entries found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Entity Search
              </CardTitle>
              <CardDescription>
                Search audit history by invoice number (e.g., INV-001) or payment ID. Find the invoice number from the Finance section or payment details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="entityType">Entity Type</Label>
                  <select
                    id="entityType"
                    className="w-full p-2 border rounded"
                    value={searchEntityType}
                    onChange={(e) => setSearchEntityType(e.target.value as 'invoice' | 'payment')}
                  >
                    <option value="invoice">Invoice</option>
                    <option value="payment">Payment</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="entityId">{searchEntityType === 'invoice' ? 'Invoice Number' : 'Payment ID'}</Label>
                  <Input
                    id="entityId"
                    value={searchEntityId}
                    onChange={(e) => setSearchEntityId(e.target.value)}
                    placeholder={searchEntityType === 'invoice' ? 'Enter invoice number...' : 'Enter payment ID...'}
                  />
                </div>
                <div>
                  <Label htmlFor="trackingId">Tracking ID</Label>
                  <Input
                    id="trackingId"
                    value={searchTrackingId}
                    onChange={(e) => setSearchTrackingId(e.target.value)}
                    placeholder="Enter tracking ID (INV-001, PAY-001)..."
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={handleEntitySearch} disabled={!searchEntityId.trim() && !searchTrackingId.trim()}>
                    <FileText className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>
              </div>

              {entityAudit && entityAudit.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Audit Trail for {searchEntityType} #{searchEntityId}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Changes</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entityAudit.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{formatTimestamp(entry.timestamp)}</TableCell>
                          <TableCell>
                            <Badge variant={getActionBadgeVariant(entry.action)}>
                              {entry.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {entry.user_full_name || entry.user_name}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            {formatChanges(entry.old_values, entry.new_values)}
                          </TableCell>
                          <TableCell>{entry.reason || 'No reason provided'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {entityAudit && entityAudit.length === 0 && searchEntityId && (
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-2">
                    No audit entries found for {searchEntityType} "{searchEntityId}"
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {searchEntityType === 'invoice' 
                      ? 'Try using the exact invoice number format (e.g., INV-001)' 
                      : 'Try using the payment ID number'}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discrepancies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Payment Discrepancies
              </CardTitle>
              <CardDescription>
                Invoices with payment calculation inconsistencies that need attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              {discrepanciesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Checking for discrepancies...</span>
                </div>
              ) : discrepancies?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recorded Paid</TableHead>
                      <TableHead>Calculated Paid</TableHead>
                      <TableHead>Discrepancy</TableHead>
                      <TableHead>Payments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discrepancies.map((disc) => (
                      <TableRow key={disc.invoice_id}>
                        <TableCell className="font-medium">
                          {disc.invoice_number}
                        </TableCell>
                        <TableCell>€{disc.invoice_amount}</TableCell>
                        <TableCell>
                          <Badge variant={disc.status === 'paid' ? 'default' : 'secondary'}>
                            {disc.status}
                          </Badge>
                        </TableCell>
                        <TableCell>€{disc.paid_amount}</TableCell>
                        <TableCell>€{disc.calculated_total_payments}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            €{disc.discrepancy}
                          </Badge>
                        </TableCell>
                        <TableCell>{disc.payment_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex items-center justify-center py-8 text-green-600">
                  <CheckCircle className="h-6 w-6 mr-2" />
                  <span className="font-medium">No payment discrepancies found - data integrity is good!</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Data Management Tools
              </CardTitle>
              <CardDescription>
                Tools to maintain data integrity and fix payment discrepancies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Repair Payment Data</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Automatically detect and fix payment calculation discrepancies. This will update 
                  invoice paid amounts to match the sum of their payments and correct status fields.
                </p>
                <Button 
                  onClick={() => repairDataMutation.mutate()}
                  disabled={repairDataMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {repairDataMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Repairing Data...
                    </>
                  ) : (
                    'Run Data Repair'
                  )}
                </Button>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">Audit Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium">What Gets Tracked:</h4>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      <li>• Payment creation, updates, and deletion</li>
                      <li>• Invoice status changes</li>
                      <li>• User attribution with IP addresses</li>
                      <li>• Before/after values for all changes</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium">Security Features:</h4>
                    <ul className="mt-2 space-y-1 text-muted-foreground">
                      <li>• Immutable audit logs</li>
                      <li>• Database-level overpayment protection</li>
                      <li>• Automatic data validation</li>
                      <li>• Complete change history</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}