import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { Checkbox } from '../ui/checkbox';
import { toast } from '../../hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Spinner } from '../ui/spinner';
import { apiRequest } from '../../lib/queryClient';
import { Badge } from '../ui/badge';
import { useAuth } from '../../context/AuthContext';
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
  customerName: string;        // Changed from customer_name to match schema
  originalOrderNumber: string; // Changed from original_order_number to match schema
  notes: string | null;
  customerId?: string | null;
}

interface UnshippedItemsProps {
  mode?: 'all' | 'pending-authorization';
  customerId?: string;
}

export default function UnshippedItems({ mode = 'all', customerId }: UnshippedItemsProps) {
  const { t } = useTranslation();
  const { user, hasPermission } = useAuth();
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'authorized'>('all');
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
  
  // Get all products to display product names
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['/api/products'],
    retry: 1,
  });
  
  // Calculate status counts
  const pendingCount = unshippedItems.filter(item => !item.authorized).length;
  const authorizedCount = unshippedItems.filter(item => item.authorized).length;

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

  // Filter items based on current filter
  const filteredItems = unshippedItems.filter((item: UnshippedItem) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return !item.authorized;
    if (filterStatus === 'authorized') return item.authorized;
    return true;
  });

  // Handle select all based on filtered items
  const handleSelectAll = () => {
    if (filteredItems && filteredItems.length > 0) {
      const selectableItems = filteredItems
        .filter(item => !item.authorized)
        .map(item => item.id);
        
      const allSelected = selectableItems.every(id => selectedItems.includes(id));
      
      if (allSelected) {
        setSelectedItems([]);
      } else {
        setSelectedItems(selectableItems);
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
        {hasPermission(['admin', 'manager', 'front_office']) && selectedItems.length > 0 && (
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
        <div className="mb-4 flex items-center gap-2">
          <div className="text-sm font-medium">{t('common.filter')}:</div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 rounded-full text-sm ${
                filterStatus === 'all' 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {t('common.all')}
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-white bg-opacity-20 px-1.5 text-xs">
                {unshippedItems.length}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1 rounded-full text-sm ${
                filterStatus === 'pending' 
                  ? 'bg-yellow-500 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {t('unshippedItems.pendingAuthorization')}
              <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-xs ${
                filterStatus === 'pending' ? 'bg-white bg-opacity-20' : 'bg-yellow-500 text-white'
              }`}>
                {pendingCount}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('authorized')}
              className={`px-3 py-1 rounded-full text-sm ${
                filterStatus === 'authorized' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {t('unshippedItems.authorized')}
              <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-xs ${
                filterStatus === 'authorized' ? 'bg-white bg-opacity-20' : 'bg-green-500 text-white'
              }`}>
                {authorizedCount}
              </span>
            </button>
          </div>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {hasPermission(['admin', 'manager', 'front_office']) && (
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={
                        filteredItems
                          .filter(item => !item.authorized)
                          .every(item => selectedItems.includes(item.id))
                        && filteredItems.some(item => !item.authorized)
                      }
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
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={hasPermission(['admin', 'manager', 'front_office']) ? 8 : 7} className="h-24 text-center">
                    <div className="text-muted-foreground">
                      {filterStatus === 'all' 
                        ? t('unshippedItems.noUnshippedItems')
                        : filterStatus === 'pending'
                          ? t('unshippedItems.noItemsPendingAuthorization')
                          : t('unshippedItems.noAuthorizedItems')}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item: UnshippedItem) => (
                <TableRow key={item.id}>
                  {hasPermission(['admin', 'manager', 'front_office']) && (
                    <TableCell>
                      <Checkbox 
                        checked={selectedItems.includes(item.id)}
                        onCheckedChange={() => handleSelectItem(item.id)}
                        disabled={item.authorized}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="font-medium">{item.originalOrderNumber}</div>
                    <div className="text-xs text-slate-500">Order ID: {item.orderId}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{item.customerName}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {products.find(p => p.id === item.productId)?.name || `Product #${item.productId}`}
                    </div>
                    <div className="text-xs text-slate-500">
                      {products.find(p => p.id === item.productId)?.sku || 'Unknown SKU'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                      {item.quantity}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
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
              )))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}