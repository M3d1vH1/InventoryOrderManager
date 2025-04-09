import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
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
import { 
  AlertCircle, 
  CheckCircle2, 
  PackageOpen, 
  ChevronDown, 
  ChevronRight,
  ShoppingCart
} from 'lucide-react';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger 
} from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';
import { useLocation } from 'wouter';

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
  customerName: string;        
  originalOrderNumber: string; 
  notes: string | null;
  customerId?: string | null;
  productName?: string; // Added for convenience
  sku?: string; // Added for convenience
}

// Group type to represent orders with their unshipped items
interface OrderGroup {
  orderId: number;
  orderNumber: string;
  customerName: string;
  date: string; // Date of the first unshipped item
  items: UnshippedItem[];
  authorizedCount: number;
  totalCount: number;
  percentage: number;
}

interface UnshippedItemsProps {
  mode?: 'all' | 'pending-authorization';
  customerId?: string;
}

export default function UnshippedItems({ mode = 'all', customerId }: UnshippedItemsProps) {
  const { t } = useTranslation();
  const { user, hasPermission } = useAuth();
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]); // Now selecting orders instead of items
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'authorized'>('all');
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  
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

  // Process unshipped items into order groups
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  
  useEffect(() => {
    if (unshippedItems && unshippedItems.length > 0 && products && products.length > 0) {
      // Add product names to unshipped items
      const itemsWithProductDetails = unshippedItems.map(item => ({
        ...item,
        productName: products.find(p => p.id === item.productId)?.name || `Product #${item.productId}`,
        sku: products.find(p => p.id === item.productId)?.sku || 'Unknown SKU',
      }));

      // Group by orderId
      const groupedByOrder = itemsWithProductDetails.reduce<Record<number, UnshippedItem[]>>((acc, item) => {
        if (!acc[item.orderId]) {
          acc[item.orderId] = [];
        }
        acc[item.orderId].push(item);
        return acc;
      }, {});

      // Convert to OrderGroup array
      const groups: OrderGroup[] = Object.entries(groupedByOrder).map(([orderIdStr, items]) => {
        const orderId = parseInt(orderIdStr);
        const firstItem = items[0];
        const authorizedCount = items.filter(item => item.authorized).length;
        const totalCount = items.length;
        const percentage = totalCount > 0 ? Math.round((authorizedCount / totalCount) * 100) : 0;

        return {
          orderId,
          orderNumber: firstItem.originalOrderNumber,
          customerName: firstItem.customerName,
          date: firstItem.date,
          items,
          authorizedCount,
          totalCount,
          percentage
        };
      });

      // Sort by most recent first
      setOrderGroups(groups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
  }, [unshippedItems, products]);

  // Calculate status counts
  const pendingCount = orderGroups.filter(group => group.percentage < 100).length;
  const authorizedCount = orderGroups.filter(group => group.percentage === 100).length;

  const authorizeItemsMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      // Get all unshipped items for the selected orders
      const itemsToAuthorize = unshippedItems
        .filter(item => orderIds.includes(item.orderId) && !item.authorized)
        .map(item => item.id);
      
      if (itemsToAuthorize.length === 0) {
        throw new Error(t('unshippedItems.noItemsToAuthorize'));
      }

      return await apiRequest('/api/unshipped-items/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds: itemsToAuthorize }),
      });
    },
    onSuccess: () => {
      const selectedOrderItems = unshippedItems.filter(
        item => selectedOrders.includes(item.orderId) && !item.authorized
      );
      
      toast({
        title: t('unshippedItems.authorized'),
        description: t('unshippedItems.authorizedSuccess', { count: selectedOrderItems.length }),
      });
      setSelectedOrders([]);
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

  const handleSelectOrder = (orderId: number) => {
    setSelectedOrders(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
  };

  // Handle accordion toggle
  const handleAccordionChange = (orderNumber: string) => {
    if (expandedOrders.includes(orderNumber)) {
      setExpandedOrders(expandedOrders.filter(id => id !== orderNumber));
    } else {
      setExpandedOrders([...expandedOrders, orderNumber]);
    }
  };

  // Filter order groups based on current filter
  const filteredGroups = orderGroups.filter((group: OrderGroup) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return group.percentage < 100;
    if (filterStatus === 'authorized') return group.percentage === 100;
    return true;
  });

  // Handle select all based on filtered groups
  const handleSelectAll = () => {
    if (filteredGroups && filteredGroups.length > 0) {
      const selectableGroups = filteredGroups
        .filter(group => group.percentage < 100)
        .map(group => group.orderId);
        
      const allSelected = selectableGroups.every(id => selectedOrders.includes(id));
      
      if (allSelected) {
        setSelectedOrders([]);
      } else {
        setSelectedOrders(selectableGroups);
      }
    }
  };

  const handleAuthorize = () => {
    if (selectedOrders.length > 0) {
      authorizeItemsMutation.mutate(selectedOrders);
    } else {
      toast({
        title: t('unshippedItems.noOrdersSelected'),
        description: t('unshippedItems.selectOrdersToAuthorize'),
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('unshippedItems.title')}</CardTitle>
          <CardDescription>{t('unshippedItems.orderCentricDescription')}</CardDescription>
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
          <CardDescription>{t('unshippedItems.orderCentricDescription')}</CardDescription>
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

  if (orderGroups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('unshippedItems.title')}</CardTitle>
          <CardDescription>{t('unshippedItems.orderCentricDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center p-6 text-muted-foreground">
            <PackageOpen className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-center">
              {mode === 'pending-authorization' 
                ? t('unshippedItems.noItemsPendingAuthorization')
                : t('unshippedItems.noUnshippedItems')}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>
            {mode === 'pending-authorization' 
              ? t('unshippedItems.pendingAuthorization') 
              : t('unshippedItems.title')}
          </CardTitle>
          <CardDescription>{t('unshippedItems.orderCentricDescription')}</CardDescription>
        </div>
        
        {hasPermission(['admin', 'manager', 'front_office']) && selectedOrders.length > 0 && (
          <Button 
            onClick={handleAuthorize}
            disabled={authorizeItemsMutation.isPending}
          >
            {authorizeItemsMutation.isPending ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {t('unshippedItems.authorizeSelectedOrders', { count: selectedOrders.length })}
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
                {orderGroups.length}
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
              {t('unshippedItems.pendingOrders')}
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
              {t('unshippedItems.fullyAuthorizedOrders')}
              <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-xs ${
                filterStatus === 'authorized' ? 'bg-white bg-opacity-20' : 'bg-green-500 text-white'
              }`}>
                {authorizedCount}
              </span>
            </button>
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-muted-foreground">
            <PackageOpen className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-center">
              {filterStatus === 'all' 
                ? t('unshippedItems.noUnshippedItems')
                : filterStatus === 'pending'
                  ? t('unshippedItems.noOrdersPendingAuthorization')
                  : t('unshippedItems.noOrdersFullyAuthorized')}
            </p>
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={expandedOrders}
            className="w-full"
          >
            {filteredGroups.map((group) => (
              <AccordionItem key={group.orderId} value={group.orderNumber}>
                <div className="border border-border rounded-md mb-4">
                  <div className="flex items-center px-4 py-2">
                    {hasPermission(['admin', 'manager', 'front_office']) && (
                      <Checkbox 
                        id={`order-${group.orderId}`}
                        checked={selectedOrders.includes(group.orderId)}
                        onCheckedChange={() => handleSelectOrder(group.orderId)}
                        disabled={group.percentage === 100}
                        className="mr-3"
                      />
                    )}
                    <AccordionTrigger 
                      className="flex-1 hover:no-underline py-2"
                      onClick={() => handleAccordionChange(group.orderNumber)}
                    >
                      <div className="grid grid-cols-5 w-full items-center text-left">
                        <div className="flex items-center">
                          <span className="font-semibold">{group.orderNumber}</span>
                        </div>
                        <div>{group.customerName}</div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="outline" 
                            className={group.percentage === 100 
                              ? "bg-green-50 text-green-700 border-green-200" 
                              : "bg-yellow-50 text-yellow-700 border-yellow-200"
                            }
                          >
                            {group.percentage === 100 
                              ? t('unshippedItems.fullyAuthorized')
                              : t('unshippedItems.partiallyAuthorized')}
                          </Badge>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Progress value={group.percentage} className="h-2" />
                            <span className="text-xs">{group.percentage}%</span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(group.date), { addSuffix: true })}
                        </div>
                      </div>
                    </AccordionTrigger>
                  </div>
                  
                  <AccordionContent className="border-t border-border px-4 py-3">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">
                          {t('unshippedItems.itemsInOrder', { 
                            count: group.totalCount, 
                            authorized: group.authorizedCount 
                          })}
                        </h4>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/orders/${group.orderId}`)}
                        >
                          {t('orders.viewOrderDetails')}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/orders/edit/${group.orderId}`)}
                        >
                          {t('orders.editOrder')}
                        </Button>
                      </div>
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('unshippedItems.productId')}</TableHead>
                          <TableHead>{t('unshippedItems.quantity')}</TableHead>
                          <TableHead>{t('unshippedItems.date')}</TableHead>
                          <TableHead>{t('unshippedItems.status')}</TableHead>
                          <TableHead>{t('unshippedItems.notes')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.productName}</div>
                              <div className="text-xs text-slate-500">{item.sku}</div>
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
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </div>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}