import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Spinner } from '@/components/ui/spinner'; // Now pointing to our new Spinner component
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface UnshippedItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  shipped: boolean;
  authorized: boolean;
  authorizedById: number | null;
  authorizedAt: string | null;
  date: string;
  customer_name: string;
  original_order_number: string;
  notes: string | null;
}

interface UnshippedItemsProps {
  mode?: 'all' | 'pending-authorization';
  customerId?: string;
}

export default function UnshippedItems({ mode = 'all', customerId }: UnshippedItemsProps) {
  const { t } = useTranslation();
  const { user, hasPermission } = useAuth();
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const queryClient = useQueryClient();
  
  // Determine endpoint based on mode
  const endpoint = mode === 'pending-authorization' 
    ? '/api/unshipped-items/pending-authorization'
    : customerId 
      ? `/api/unshipped-items?customerId=${customerId}`
      : '/api/unshipped-items';
  
  const { data: unshippedItems = [], isLoading, error } = useQuery<UnshippedItem[]>({
    queryKey: [endpoint],
    retry: 1,
  });

  const authorizeItemsMutation = useMutation({
    mutationFn: async (itemIds: number[]) => {
      return await apiRequest('/api/unshipped-items/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds }),
      });
    },
    onSuccess: () => {
      toast({
        title: t('unshippedItems.authorized'),
        description: t('unshippedItems.authorizedSuccess', { count: selectedItems.length }),
      });
      setSelectedItems([]);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/unshipped-items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/unshipped-items/pending-authorization'] });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message || t('common.errorOccurred'),
        variant: 'destructive',
      });
    },
  });

  const handleSelectItem = (itemId: number) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const handleSelectAll = () => {
    if (unshippedItems && unshippedItems.length > 0) {
      if (selectedItems.length === unshippedItems.length) {
        setSelectedItems([]);
      } else {
        setSelectedItems(unshippedItems.map((item: UnshippedItem) => item.id));
      }
    }
  };

  const handleAuthorize = () => {
    if (selectedItems.length > 0) {
      authorizeItemsMutation.mutate(selectedItems);
    } else {
      toast({
        title: t('unshippedItems.noItemsSelected'),
        description: t('unshippedItems.selectItemsToAuthorize'),
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('unshippedItems.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('unshippedItems.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('common.errorLoadingData')}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!unshippedItems || unshippedItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('unshippedItems.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            {mode === 'pending-authorization' 
              ? t('unshippedItems.noItemsPendingAuthorization')
              : t('unshippedItems.noUnshippedItems')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          {mode === 'pending-authorization' 
            ? t('unshippedItems.pendingAuthorization') 
            : t('unshippedItems.title')}
        </CardTitle>
        {hasPermission(['admin', 'manager']) && selectedItems.length > 0 && (
          <Button 
            onClick={handleAuthorize}
            disabled={authorizeItemsMutation.isPending}
          >
            {authorizeItemsMutation.isPending ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {t('unshippedItems.authorizeSelected', { count: selectedItems.length })}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {hasPermission(['admin', 'manager']) && (
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedItems.length === unshippedItems.length && unshippedItems.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>{t('unshippedItems.orderNumber')}</TableHead>
                <TableHead>{t('unshippedItems.customerName')}</TableHead>
                <TableHead>{t('unshippedItems.productId')}</TableHead>
                <TableHead>{t('unshippedItems.quantity')}</TableHead>
                <TableHead>{t('unshippedItems.date')}</TableHead>
                <TableHead>{t('unshippedItems.status')}</TableHead>
                <TableHead>{t('unshippedItems.notes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unshippedItems.map((item: UnshippedItem) => (
                <TableRow key={item.id}>
                  {hasPermission(['admin', 'manager']) && (
                    <TableCell>
                      <Checkbox 
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => handleSelectItem(item.id)}
                        disabled={item.authorized}
                      />
                    </TableCell>
                  )}
                  <TableCell>{item.original_order_number}</TableCell>
                  <TableCell>{item.customer_name}</TableCell>
                  <TableCell>{item.productId}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>
                    {new Date(item.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {item.authorized ? (
                      <Badge className="bg-green-500 hover:bg-green-600">{t('unshippedItems.authorized')}</Badge>
                    ) : (
                      <Badge className="bg-yellow-500 hover:bg-yellow-600">{t('unshippedItems.pendingAuthorization')}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{item.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}